"""
binance_data_helper.py - Module nạp dữ liệu Crypto từ Binance & Đồng bộ Strapi Symbol-History
Hỗ trợ phân trang không giới hạn (pagination) để lấy tối đa dữ liệu nến M5, M15, M1, H1, D1... từ Binance.
"""

import sys
import os
import time
import re
import json
import requests
import pandas as pd
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple, Union

STRAPI_BASE_URL = os.environ.get("STRAPI_BASE_URL", "http://127.0.0.1:1337").rstrip("/")
STRAPI_API_TOKEN = os.environ.get("STRAPI_API_TOKEN", "")

def get_strapi_headers() -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if STRAPI_API_TOKEN:
        headers["Authorization"] = f"Bearer {STRAPI_API_TOKEN}"
    return headers

def is_crypto_symbol(ticker: str) -> bool:
    clean = str(ticker or "").strip().upper()
    if clean.endswith(".P") or "PERP" in clean or clean.startswith("BINANCE:"):
        return True
    if any(clean.endswith(quote) for quote in ["USDT", "BUSD", "USDC", "FDUSD", "TUSD"]):
        return True
    return False

def map_timeframe_to_binance(timeframe: str) -> str:
    tf = str(timeframe or "D1").strip().upper()
    mapping = {
        "1": "1m", "M1": "1m", "1M": "1m", "1m": "1m",
        "3": "3m", "M3": "3m", "3M": "3m", "3m": "3m",
        "5": "5m", "M5": "5m", "5M": "5m", "5m": "5m",
        "15": "15m", "M15": "15m", "15M": "15m", "15m": "15m",
        "30": "30m", "M30": "30m", "30M": "30m", "30m": "30m",
        "60": "1h", "H1": "1h", "1H": "1h", "1h": "1h",
        "120": "2h", "H2": "2h", "2H": "2h", "2h": "2h",
        "240": "4h", "H4": "4h", "4H": "4h", "4h": "4h",
        "D1": "1d", "1D": "1d", "D": "1d", "1d": "1d",
        "W1": "1w", "1W": "1w", "W": "1w", "1w": "1w",
        "M": "1M", "MN": "1M", "1M_MONTH": "1M"
    }
    return mapping.get(tf, "1d")

def get_default_crypto_countback(timeframe: str, countback: Optional[int] = None) -> int:
    """
    Tự động tính toán số lượng nến tối ưu theo Timeframe để dữ liệu luôn đủ phong phú và chi tiết.
    Đối với M5: mặc định lấy ~30.000 nến (tương đương hơn 100 ngày giao dịch liên tục).
    """
    if countback is not None and countback > 0:
        requested = int(countback)
    else:
        requested = 0

    tf = str(timeframe or "D1").strip().upper()
    tf_binance = map_timeframe_to_binance(tf)

    defaults = {
        "1m": 20000,   # ~14 ngày
        "3m": 25000,   # ~52 ngày
        "5m": 30000,   # ~104 ngày (hơn 3 tháng)
        "15m": 20000,  # ~208 ngày
        "30m": 15000,  # ~312 ngày
        "1h": 10000,   # ~416 ngày
        "2h": 6000,    # ~500 ngày
        "4h": 5000,    # ~833 ngày
        "1d": 2500,    # ~7 năm
        "1w": 1000,    # ~19 năm
    }

    base_count = defaults.get(tf_binance, 5000)
    return max(requested, base_count)

def fetch_binance_candles(
    ticker: str,
    countback: Optional[int] = None,
    timeframe: str = "D1",
    auto_boost: bool = True,
    sync_strapi: bool = False
) -> pd.DataFrame:
    """
    Lấy dữ liệu nến lịch sử từ Binance API (Spot & Futures) với cơ chế phân trang tự động (pagination).
    Có khả năng tải từ vài nghìn đến hơn 100.000 nến M5/M15/H1/D1 một cách mượt mà và an toàn.
    """
    clean = str(ticker or "").strip().upper()
    is_perpetual = clean.endswith(".P") or "PERP" in clean
    symbol = re.sub(r"^.*:", "", clean).replace(".P", "").replace("PERP", "").strip()
    interval = map_timeframe_to_binance(timeframe)
    is_daily_or_weekly = interval in ["1d", "1w", "1M"]

    if auto_boost:
        target_count = get_default_crypto_countback(timeframe, countback)
    else:
        target_count = max(int(countback or 500), 500)

    # Thử qua Futures API trước nếu có đuôi .P hoặc PERP, ngược lại thử Spot trước
    endpoint_configs = [
        ("https://fapi.binance.com/fapi/v1/klines", 1500) if is_perpetual else ("https://api.binance.com/api/v3/klines", 1000),
        ("https://api.binance.com/api/v3/klines", 1000) if is_perpetual else ("https://fapi.binance.com/fapi/v1/klines", 1500),
    ]

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json"
    }

    session = requests.Session()
    session.headers.update(headers)

    for base_url, max_limit in endpoint_configs:
        all_raw = []
        current_end_time = None
        consecutive_errors = 0

        try:
            while len(all_raw) < target_count:
                limit = min(target_count - len(all_raw), max_limit)
                params = f"symbol={symbol}&interval={interval}&limit={limit}"
                if current_end_time is not None:
                    params += f"&endTime={current_end_time}"

                url = f"{base_url}?{params}"
                try:
                    res = session.get(url, timeout=12)
                except Exception:
                    consecutive_errors += 1
                    if consecutive_errors >= 3:
                        break
                    time.sleep(0.5)
                    continue

                if res.status_code == 429:
                    # Rate limited -> sleep brief then retry
                    time.sleep(2)
                    continue
                elif res.status_code != 200:
                    break

                consecutive_errors = 0
                data = res.json()
                if not isinstance(data, list) or len(data) == 0:
                    break

                all_raw = data + all_raw
                oldest_open_time = data[0][0]
                current_end_time = oldest_open_time - 1

                # Nếu Binance trả về ít hơn limit yêu cầu -> đã chạm đến điểm bắt đầu của lịch sử mã này
                if len(data) < limit:
                    break

                # Tránh làm nghẽn mạng nếu tải rất nhiều trang
                if len(all_raw) >= 15000 and len(all_raw) % 15000 == 0:
                    time.sleep(0.02)

            if len(all_raw) > 0:
                seen_times = set()
                deduped = []
                for item in all_raw:
                    ts = item[0]
                    if ts not in seen_times:
                        seen_times.add(ts)
                        deduped.append(item)

                candles = []
                for item in deduped:
                    open_time_ms = item[0]
                    dt = datetime.fromtimestamp(open_time_ms / 1000.0, tz=timezone.utc)
                    if is_daily_or_weekly:
                        date_str = dt.strftime("%Y-%m-%dT00:00:00.000Z")
                        time_str = dt.strftime("%Y-%m-%d")
                    else:
                        date_str = dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
                        time_str = dt.strftime("%H:%M:%S")

                    o = float(item[1])
                    h = float(item[2])
                    l = float(item[3])
                    c = float(item[4])
                    v = float(item[5])

                    decimals = 6 if c < 0.01 else (4 if c < 10 else (2 if c >= 100 else 3))
                    candles.append({
                        "date": date_str,
                        "time": time_str,
                        "open": round(o, decimals),
                        "high": round(h, decimals),
                        "low": round(l, decimals),
                        "close": round(c, decimals),
                        "volume": float(v)
                    })

                df = pd.DataFrame(candles)
                df["dt"] = pd.to_datetime(df["date"])
                df = df.drop_duplicates(subset=["date"]).sort_values("dt").reset_index(drop=True)

                if sync_strapi and not df.empty:
                    sync_candles_to_strapi_bulk(clean, df, timeframe=timeframe)

                return df

        except Exception as e:
            continue

    return pd.DataFrame()

def get_or_create_symbol_in_strapi(ticker: str) -> Optional[str]:
    """Tìm hoặc tạo mới mã Symbol trong Strapi database"""
    clean = str(ticker or "").strip().upper()
    headers = get_strapi_headers()
    variants = [clean]
    if clean.endswith(".P"):
        variants.append(clean.replace(".P", ""))
        variants.append(f"BINANCE:{clean}")
        variants.append(f"BINANCE:{clean.replace('.P', '')}")
    elif clean.startswith("BINANCE:"):
        unprefixed = clean.replace("BINANCE:", "")
        variants.append(unprefixed)
        if unprefixed.endswith(".P"):
            variants.append(unprefixed.replace(".P", ""))
        else:
            variants.append(f"{unprefixed}.P")
    elif clean.endswith("USDT") or clean.endswith("BUSD"):
        variants.append(f"{clean}.P")
        variants.append(f"BINANCE:{clean}")
        variants.append(f"BINANCE:{clean}.P")

    try:
        for sym_var in variants:
            res = requests.get(f"{STRAPI_BASE_URL}/api/symbols?filters[Name][$eq]={sym_var}", headers=headers, timeout=5)
            if res.status_code == 200:
                data = res.json().get("data", [])
                if data:
                    return data[0].get("documentId") or str(data[0].get("id"))

        # Tạo mới nếu chưa có
        create_payload = {
            "data": {
                "Name": clean,
                "ticker": clean,
                "Description": f"Auto-created crypto symbol {clean}"
            }
        }
        create_res = requests.post(f"{STRAPI_BASE_URL}/api/symbols", json=create_payload, headers=headers, timeout=5)
        if create_res.status_code in [200, 201]:
            created_data = create_res.json().get("data", {})
            return created_data.get("documentId") or str(created_data.get("id"))
    except Exception:
        pass
    return None

def sync_candles_to_strapi_bulk(
    ticker: str,
    df: pd.DataFrame,
    symbol_id: Optional[str] = None,
    timeframe: str = "D1",
    max_sync: int = 50000
) -> int:
    """
    Đồng bộ dữ liệu nến vào bảng Strapi symbol-histories sử dụng endpoint bulk nhanh chóng.
    """
    if df is None or df.empty:
        return 0

    clean = str(ticker or "").strip().upper()
    tf = str(timeframe or "D1").strip().upper()
    headers = get_strapi_headers()

    if not symbol_id:
        symbol_id = get_or_create_symbol_in_strapi(clean)

    if not symbol_id:
        return 0

    candles_to_sync = []
    for _, row in df.tail(max_sync).iterrows():
        candles_to_sync.append({
            "date": str(row["date"]),
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "volume": float(row.get("volume", 0)),
        })

    if not candles_to_sync:
        return 0

    # Gửi theo từng batch 500 nến tới endpoint bulk
    batch_size = 500
    total_saved = 0

    for i in range(0, len(candles_to_sync), batch_size):
        chunk = candles_to_sync[i:i + batch_size]
        payload = {
            "symbolId": symbol_id,
            "symbol": clean,
            "timeframe": tf,
            "candles": chunk
        }
        try:
            res = requests.post(
                f"{STRAPI_BASE_URL}/api/symbol-histories/bulk",
                json=payload,
                headers=headers,
                timeout=15
            )
            if res.status_code == 200:
                res_data = res.json().get("data", {})
                total_saved += res_data.get("count", len(chunk))
        except Exception:
            pass

    return total_saved
