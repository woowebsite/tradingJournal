import sys
import os
import time
import re
import warnings
warnings.filterwarnings('ignore')
import numpy as np
import pandas as pd
import requests
from datetime import datetime, timezone
from typing import List, Dict, Optional

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import os
import concurrent.futures

# ==============================================================================
# CẤU HÌNH HỆ THỐNG & CHIẾN LƯỢC (MÔ HÌNH 2)
# ==============================================================================
STRAPI_BASE_URL = os.environ.get("STRAPI_BASE_URL", "http://127.0.0.1:1337").rstrip("/")
STRAPI_API_TOKEN = os.environ.get("STRAPI_API_TOKEN", "")

# Tham số chiến lược
MA_PERIOD = 288                 # Chu kỳ đường MA dài hạn (MA288)
SUPERTREND_PERIOD = 10          # Chu kỳ ATR cho Supertrend
SUPERTREND_MULTIPLIER = 3.0     # Hệ số nhân ATR cho Supertrend
RISK_REWARD_RATIO = 1.5         # Tỷ lệ Risk : Reward để tính Take Profit

# Danh sách mã chứng khoán / phái sinh cần quét
DEFAULT_WATCHLIST = ["VNINDEX", "VN30F1M", "FPT", "HPG", "SSI", "MWG", "TCB", "VHM"]

# ==============================================================================
# 1. FETCH & ĐỒNG BỘ DỮ LIỆU VÀO STRAPI, SAU ĐÓ ĐỌC TỪ STRAPI
# ==============================================================================

def get_strapi_headers() -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if STRAPI_API_TOKEN:
        headers["Authorization"] = f"Bearer {STRAPI_API_TOKEN}"
    return headers

def is_crypto_symbol(ticker: str) -> bool:
    """Nhận diện mã giao dịch tiền mã hóa Crypto (Binance)"""
    clean = ticker.strip().upper()
    if clean.endswith(".P") or "PERP" in clean or clean.startswith("BINANCE:"):
        return True
    if any(clean.endswith(quote) for quote in ["USDT", "BUSD", "USDC", "FDUSD", "TUSD"]):
        return True
    return False

def map_timeframe_to_binance(timeframe: str) -> str:
    """Chuyển đổi Timeframe sang định dạng Binance (1m, 5m, 30m, 4h, 1d, 1w)"""
    tf = str(timeframe or "D1").strip().upper()
    mapping = {
        "M1": "1m", "1M": "1m",
        "M5": "5m", "5M": "5m",
        "M15": "15m", "15M": "15m",
        "M30": "30m", "30M": "30m",
        "H1": "1h", "1H": "1h",
        "H4": "4h", "4H": "4h",
        "D1": "1d", "1D": "1d", "D": "1d",
        "W1": "1w", "1W": "1w", "W": "1w"
    }
    return mapping.get(tf, "1d")

def map_timeframe_to_24h(timeframe: str) -> str:
    """Chuyển đổi Timeframe sang định dạng 24hMoney resolution (1, 5, 15, 30, 60, 240, 1D, 1W)"""
    tf = str(timeframe or "D1").strip().upper()
    mapping = {
        "M1": "1", "1M": "1", "1": "1",
        "M5": "5", "5M": "5", "5": "5",
        "M15": "15", "15M": "15", "15": "15",
        "M30": "30", "30M": "30", "30": "30",
        "H1": "60", "1H": "60", "60": "60",
        "H4": "240", "4H": "240", "240": "240",
        "D1": "1D", "1D": "1D", "D": "1D", "1d": "1D",
        "W1": "1W", "1W": "1W", "W": "1W", "1w": "1W"
    }
    return mapping.get(tf, "1D")

def get_24h_from_timestamp(resolution_24h: str, req_count: int, to_ts: int) -> int:
    res = str(resolution_24h).upper()
    if res in ["1D", "D", "1W", "W"]:
        return to_ts - 15 * 365 * 86400
    elif res in ["240", "60"]:
        seconds = min(730 * 86400, max(60 * 86400, req_count * 3600))
        return to_ts - seconds
    elif res == "30":
        seconds = min(365 * 86400, max(45 * 86400, req_count * 1800))
        return to_ts - seconds
    elif res == "15":
        seconds = min(240 * 86400, max(30 * 86400, req_count * 900))
        return to_ts - seconds
    elif res == "5":
        seconds = min(240 * 86400, max(20 * 86400, req_count * 300))
        return to_ts - seconds
    elif res == "1":
        seconds = min(45 * 86400, max(10 * 86400, req_count * 60))
        return to_ts - seconds
    return to_ts - 180 * 86400

def get_or_create_symbol_in_strapi(ticker: str) -> Optional[str]:
    """Tìm hoặc tự động tạo mới Symbol trong bảng symbols của Strapi, trả về symbolId (hoặc documentId)"""
    headers = get_strapi_headers()
    clean = ticker.strip().upper()
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
        # 1. Tìm symbol theo Name trong các variants
        for sym_var in variants:
            res = requests.get(f"{STRAPI_BASE_URL}/api/symbols?filters[Name][$eq]={sym_var}", headers=headers, timeout=10)
            if res.status_code == 200:
                data = res.json().get("data", [])
                if data:
                    return data[0].get("documentId") or str(data[0].get("id"))

        # 2. Nếu chưa có -> Tạo mới Symbol
        create_payload = {
            "data": {
                "Name": clean,
                "ticker": clean,
                "Description": f"Auto-created symbol {clean}"
            }
        }
        create_res = requests.post(f"{STRAPI_BASE_URL}/api/symbols", json=create_payload, headers=headers, timeout=10)
        if create_res.status_code in [200, 201]:
            created_data = create_res.json().get("data", {})
            return created_data.get("documentId") or str(created_data.get("id"))
    except Exception as e:
        print(f"Warning: get_or_create_symbol_in_strapi failed for {ticker}: {e}", file=sys.stderr, flush=True)
    return None

def sync_candles_to_strapi(ticker: str, df: pd.DataFrame, symbol_id: str, timeframe: str = "D1", max_sync: int = 1500):
    """Đồng bộ các nến từ external vào bảng symbol-histories của Strapi theo đúng Timeframe sử dụng đa luồng (super-fast)"""
    if df.empty or not symbol_id:
        return

    tf = str(timeframe or "D1").strip().upper()
    headers = get_strapi_headers()
    clean = ticker.strip().upper()

    try:
        # Lấy danh sách ngày đã có sẵn trong Strapi cho symbol và timeframe này (tối đa max_sync) để tránh trùng lặp
        existing_dates = set()
        page = 1
        tf_filter = f"&filters[$or][0][timeframe][$eq]={tf}&filters[$or][1][timeframe][$null]=true" if tf == "D1" else f"&filters[timeframe][$eq]={tf}"

        while len(existing_dates) < max_sync:
            check_res = requests.get(
                f"{STRAPI_BASE_URL}/api/symbol-histories?filters[symbol][Name][$eq]={clean}{tf_filter}&sort=date:desc&pagination[page]={page}&pagination[pageSize]=100",
                headers=headers,
                timeout=10
            )
            if check_res.status_code != 200:
                break
            check_json = check_res.json()
            items = check_json.get("data", [])
            if not items:
                break
            for item in items:
                attrs = item.get("attributes", item)
                d_val = attrs.get("date")
                if d_val:
                    existing_dates.add(str(d_val)[:19])

            meta_pg = check_json.get("meta", {}).get("pagination", {})
            page_count = meta_pg.get("pageCount")
            if page_count and page >= page_count:
                break
            if len(items) < 100:
                break
            page += 1

        # Lọc các nến trong df chưa có trong existing_dates
        to_insert_candles = []
        for _, row in df.tail(max_sync).iterrows():
            candle_date = str(row["date"])[:19]
            if candle_date not in existing_dates:
                to_insert_candles.append(row)

        if not to_insert_candles:
            return

        session = requests.Session()
        session.headers.update(headers)

        def insert_single_candle(candle):
            payload = {
                "data": {
                    "symbol": symbol_id,
                    "date": candle["date"],
                    "open": float(candle["open"]),
                    "high": float(candle["high"]),
                    "low": float(candle["low"]),
                    "close": float(candle["close"]),
                    "volume": float(candle.get("volume", 0)),
                    "timeframe": tf
                }
            }
            try:
                session.post(f"{STRAPI_BASE_URL}/api/symbol-histories", json=payload, timeout=8)
            except Exception:
                pass

        with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
            list(executor.map(insert_single_candle, to_insert_candles))

    except Exception as e:
        print(f"Warning: sync_candles_to_strapi failed for {ticker} ({tf}): {e}", file=sys.stderr, flush=True)

def fetch_binance_candles(ticker: str, countback: int = 500, timeframe: str = "D1") -> pd.DataFrame:
    """
    Lấy dữ liệu lịch sử nến từ Binance API (Spot & Futures).
    Hỗ trợ các ticker dạng LINKUSDT.P, BTCUSDT, ETHUSDT, BINANCE:LINKUSDT.P...
    Tự động phân trang (pagination) nếu countback > 1000/1500 để nạp dữ liệu quá khứ không giới hạn khi cuộn.
    """
    clean = ticker.strip().upper()
    is_perpetual = clean.endswith(".P") or "PERP" in clean
    symbol = re.sub(r"^.*:", "", clean).replace(".P", "").replace("PERP", "").strip()
    interval = map_timeframe_to_binance(timeframe)
    is_daily_or_weekly = interval in ["1d", "1w", "1M"]

    endpoint_configs = [
        ("https://fapi.binance.com/fapi/v1/klines", 1500) if is_perpetual else ("https://api.binance.com/api/v3/klines", 1000),
        ("https://api.binance.com/api/v3/klines", 1000) if is_perpetual else ("https://fapi.binance.com/fapi/v1/klines", 1500),
    ]

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    for base_url, max_limit in endpoint_configs:
        all_raw = []
        target_count = max(int(countback), 500)
        current_end_time = None

        try:
            while len(all_raw) < target_count:
                limit = min(target_count - len(all_raw), max_limit)
                params = f"symbol={symbol}&interval={interval}&limit={limit}"
                if current_end_time is not None:
                    params += f"&endTime={current_end_time}"

                url = f"{base_url}?{params}"
                res = requests.get(url, headers=headers, timeout=10)
                if res.status_code != 200:
                    break

                data = res.json()
                if not isinstance(data, list) or len(data) == 0:
                    break

                all_raw = data + all_raw
                oldest_open_time = data[0][0]
                current_end_time = oldest_open_time - 1

                if len(data) < limit:
                    break

            if len(all_raw) > 0:
                seen_times = set()
                deduped = []
                for item in all_raw:
                    if item[0] not in seen_times:
                        seen_times.add(item[0])
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
                df = df.sort_values("dt").reset_index(drop=True)
                if len(df) > 0:
                    return df
        except Exception:
            pass

    return pd.DataFrame()

def fetch_history_from_strapi(ticker: str, countback: int = 500, timeframe: str = "D1") -> pd.DataFrame:
    """Lấy dữ liệu nến trực tiếp từ Strapi symbol-histories theo countback và đúng Timeframe"""
    clean = ticker.strip().upper()
    tf = str(timeframe or "D1").strip().upper()
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

    target_count = max(int(countback), 10)
    tf_filter = f"&filters[$or][0][timeframe][$eq]={tf}&filters[$or][1][timeframe][$null]=true" if tf == "D1" else f"&filters[timeframe][$eq]={tf}"

    for sym_var in variants:
        try:
            records = []
            page = 1
            PAGE_SIZE = 100

            while len(records) < target_count:
                url = f"{STRAPI_BASE_URL}/api/symbol-histories?filters[symbol][Name][$eq]={sym_var}{tf_filter}&sort=date:desc&pagination[page]={page}&pagination[pageSize]={PAGE_SIZE}"
                res = requests.get(url, headers=headers, timeout=12)
                if res.status_code != 200:
                    break

                res_json = res.json()
                batch = res_json.get("data", [])
                if not batch or len(batch) == 0:
                    break

                records.extend(batch)

                meta_pg = res_json.get("meta", {}).get("pagination", {})
                page_count = meta_pg.get("pageCount")
                total = meta_pg.get("total")

                if page_count and page >= page_count:
                    break
                if total and len(records) >= total:
                    break
                if len(batch) < PAGE_SIZE:
                    break

                page += 1

            if records:
                data = []
                for item in records:
                    attrs = item.get("attributes", item)
                    d_val = attrs.get("date")
                    if not d_val:
                        continue

                    time_str = ""
                    if "T" in str(d_val):
                        parts = str(d_val).split("T")
                        if len(parts) > 1:
                            time_str = parts[1].replace(".000Z", "").replace("Z", "")
                    else:
                        d_val = f"{d_val}T00:00:00.000Z"
                        time_str = "00:00:00"

                    data.append({
                        "date": str(d_val),
                        "time": time_str,
                        "open": float(attrs.get("open", 0)),
                        "high": float(attrs.get("high", 0)),
                        "low": float(attrs.get("low", 0)),
                        "close": float(attrs.get("close", 0)),
                        "volume": float(attrs.get("volume", 0)),
                    })

                if data:
                    df = pd.DataFrame(data)
                    df["dt"] = pd.to_datetime(df["date"])
                    df = df.drop_duplicates(subset=["date"]).sort_values("dt").reset_index(drop=True)
                    if len(df) > target_count:
                        df = df.tail(target_count).reset_index(drop=True)
                    return df
        except Exception:
            pass

    return pd.DataFrame()

def fetch_yahoo_candles(ticker: str, countback: int = 1000, timeframe: str = "D1") -> pd.DataFrame:
    """Lấy dữ liệu nến từ Yahoo Finance API cho Chỉ số & Cổ phiếu Quốc tế (NASDAQ, QQQ, NDX, SP500, GOLD, AAPL...)"""
    clean = ticker.strip().upper()
    sym_map = {
        'USTEC': 'NQ=F', 'USTECH': 'NQ=F', 'USTEC.P': 'NQ=F', 'NAS100': 'NQ=F', 'NAS100.P': 'NQ=F', 'NAS100USD': 'NQ=F',
        'US100': 'NQ=F', 'US100.P': 'NQ=F', 'NQ': 'NQ=F', 'NQ=F': 'NQ=F',
        'NASDAQ': '^IXIC', 'NASDAQ-COMPOSITE': '^IXIC', 'IXIC': '^IXIC', '^IXIC': '^IXIC',
        'NDX': '^NDX', '^NDX': '^NDX', 'NASDAQ100': '^NDX', 'QQQ': 'QQQ',
        'US500': 'ES=F', 'US500.P': 'ES=F', 'SPX500': 'ES=F', 'ES': 'ES=F', 'ES=F': 'ES=F',
        'SP500': '^GSPC', 'S&P500': '^GSPC', 'SPX': '^GSPC', 'GSPC': '^GSPC', '^GSPC': '^GSPC', 'SPY': 'SPY',
        'US30': 'YM=F', 'US30.P': 'YM=F', 'DJ30': 'YM=F', 'WALLSTREET': 'YM=F', 'YM': 'YM=F', 'YM=F': 'YM=F',
        'DOW': '^DJI', 'DOWJONES': '^DJI', 'DJI': '^DJI', '^DJI': '^DJI', 'DIA': 'DIA',
        'GER40': '^GDAXI', 'GER30': '^GDAXI', 'DAX': '^GDAXI', 'UK100': '^FTSE', 'FTSE': '^FTSE',
        'JPN225': '^N225', 'NIKKEI': '^N225', 'HK50': '^HSI',
        'GOLD': 'GC=F', 'GC=F': 'GC=F', 'XAUUSD': 'GC=F', 'XAUUSD.P': 'GC=F',
        'SILVER': 'SI=F', 'SI=F': 'SI=F', 'XAGUSD': 'SI=F',
        'BRENT': 'BZ=F', 'BZ=F': 'BZ=F', 'UKOIL': 'BZ=F', 'WTI': 'CL=F', 'CL=F': 'CL=F', 'USOIL': 'CL=F',
        'DXY': 'DX-Y.NYB', 'DX-Y.NYB': 'DX-Y.NYB', 'USDX': 'DX-Y.NYB', 'US10Y': '^TNX', '^TNX': '^TNX', 'VIX': '^VIX', '^VIX': '^VIX',
        'EURUSD': 'EURUSD=X', 'GBPUSD': 'GBPUSD=X', 'USDJPY': 'USDJPY=X', 'AUDUSD': 'AUDUSD=X',
        'USDCAD': 'USDCAD=X', 'USDCHF': 'USDCHF=X', 'NZDUSD': 'NZDUSD=X'
    }
    yahoo_sym = sym_map.get(clean, clean)
    tf = str(timeframe or "D1").strip().upper()

    interval = "1d"
    range_param = "5y"
    if tf in ["M1", "1M", "1"]:
        interval, range_param = "1m", "7d"
    elif tf in ["M5", "5M", "5"]:
        interval, range_param = "5m", "60d"
    elif tf in ["M15", "15M", "15"]:
        interval, range_param = "15m", "60d"
    elif tf in ["M30", "30M", "30"]:
        interval, range_param = "30m", "60d"
    elif tf in ["H1", "1H", "60", "H4", "4H", "240"]:
        interval, range_param = "1h", "730d"
    elif tf in ["W1", "1W", "W"]:
        interval, range_param = "1wk", "5y"

    is_daily_or_weekly = interval in ["1d", "1wk", "1mo"]
    include_pre_post = "false" if is_daily_or_weekly else "true"

    candidate_symbols = [yahoo_sym]
    if not is_daily_or_weekly:
        if clean in ['^IXIC', 'NASDAQ', 'IXIC']:
            candidate_symbols.extend(['NQ=F', 'QQQ'])
        elif clean in ['^NDX', 'NDX', 'NASDAQ100', 'US100']:
            candidate_symbols.extend(['NQ=F', 'QQQ'])
        elif clean in ['^GSPC', 'SP500', 'SPX', 'S&P500']:
            candidate_symbols.extend(['ES=F', 'SPY'])

    for sym in candidate_symbols:
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval={interval}&range={range_param}&includePrePost={include_pre_post}"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept": "application/json, text/plain, */*"
            }
            res = requests.get(url, headers=headers, timeout=12)
            if res.status_code == 200:
                res_json = res.json()
                result = res_json.get("chart", {}).get("result", [{}])[0]
                timestamps = result.get("timestamp", [])
                quote = result.get("indicators", {}).get("quote", [{}])[0]
                opens = quote.get("open", [])
                highs = quote.get("high", [])
                lows = quote.get("low", [])
                closes = quote.get("close", [])
                volumes = quote.get("volume", [])

                candles = []
                for i in range(len(timestamps)):
                    ts = timestamps[i]
                    c = closes[i] if i < len(closes) else None
                    if ts is None or c is None or pd.isna(c):
                        continue
                    o = opens[i] if i < len(opens) and not pd.isna(opens[i]) else c
                    h = highs[i] if i < len(highs) and not pd.isna(highs[i]) else max(o, c)
                    l = lows[i] if i < len(lows) and not pd.isna(lows[i]) else min(o, c)
                    v = volumes[i] if i < len(volumes) and not pd.isna(volumes[i]) else 0

                    dt = datetime.fromtimestamp(ts, tz=timezone.utc)
                    if is_daily_or_weekly:
                        date_str = dt.strftime("%Y-%m-%dT00:00:00.000Z")
                        time_str = dt.strftime("%Y-%m-%d")
                    else:
                        date_str = dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
                        time_str = dt.strftime("%H:%M:%S")

                    candles.append({
                        "date": date_str,
                        "time": time_str,
                        "open": round(float(o), 2),
                        "high": round(float(h), 2),
                        "low": round(float(l), 2),
                        "close": round(float(c), 2),
                        "volume": float(v or 0)
                    })

                if candles:
                    df = pd.DataFrame(candles)
                    df["dt"] = pd.to_datetime(df["date"])
                    df = df.drop_duplicates(subset=["date"]).sort_values("dt").reset_index(drop=True)
                    if not df.empty:
                        return df
        except Exception:
            pass
    return pd.DataFrame()

def fetch_market_candles(ticker: str, resolution: str = "D1", countback: int = 500, timeframe: str = None) -> pd.DataFrame:
    """
    Quy trình chuẩn hóa lấy dữ liệu nến:
    1. Đối với Crypto (Binance): LUÔN LẤY DỮ LIỆU MỚI NHẤT TỪ BINANCE API để đảm bảo nến đóng thời gian thực.
    2. Đối với Cổ phiếu / Chỉ số / Phái sinh VN: Ưu tiên lấy từ 24hMoney API.
    3. Fallback: Nếu không kết nối được nguồn ngoài mới đọc từ Strapi symbol-histories.
    """
    tf = str(timeframe or resolution or "D1").strip().upper()
    ticker_clean = ticker.strip().upper()
    req_count = max(int(countback), 500)

    # 1. Ưu tiên dữ liệu Binance đối với tiền mã hóa Crypto
    if is_crypto_symbol(ticker_clean):
        df_binance = fetch_binance_candles(ticker_clean, countback=req_count, timeframe=tf)
        if not df_binance.empty and len(df_binance) > 0:
            df_binance = df_binance.drop_duplicates(subset=["date"]).sort_values("dt").reset_index(drop=True)
            return df_binance

    # 2. Lấy dữ liệu 24hMoney cho Stock / Index / Derivatives
    df_external = pd.DataFrame()
    resolution_24h = map_timeframe_to_24h(tf)
    to_ts = int(time.time())
    from_ts = get_24h_from_timestamp(resolution_24h, req_count, to_ts)
    url_24h = f"https://api.24hmoney.vn/tradingview/history?symbol={ticker_clean}&resolution={resolution_24h}&from={from_ts}&to={to_ts}&countback={min(req_count, 10000)}"

    is_daily_or_weekly = tf.upper() in ["D1", "1D", "D", "W1", "1W", "W"]
    try:
        res = requests.get(url_24h, timeout=15)
        if res.status_code == 200:
            data = res.json()
            if data.get("s") == "ok" and "t" in data and len(data["t"]) > 0:
                candles = []
                multiplier = 1000 if ticker_clean not in ["VNINDEX", "VN30", "HNX", "UPCOM", "VN30F1M"] else 1
                first_close = float(data["c"][0])
                if first_close < 500 and ticker_clean not in ["VNINDEX", "VN30", "VN30F1M"] and not is_crypto_symbol(ticker_clean):
                    multiplier = 1000
                else:
                    multiplier = 1

                for i in range(len(data["t"])):
                    dt = datetime.fromtimestamp(data["t"][i], tz=timezone.utc)
                    if is_daily_or_weekly:
                        date_str = dt.strftime("%Y-%m-%dT00:00:00.000Z")
                        time_str = dt.strftime("%Y-%m-%d")
                    else:
                        date_str = dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
                        time_str = dt.strftime("%H:%M:%S")

                    candles.append({
                        "date": date_str,
                        "time": time_str,
                        "open": round(float(data["o"][i]) * multiplier, 2),
                        "high": round(float(data["h"][i]) * multiplier, 2),
                        "low": round(float(data["l"][i]) * multiplier, 2),
                        "close": round(float(data["c"][i]) * multiplier, 2),
                        "volume": float(data["v"][i]),
                    })

                df_external = pd.DataFrame(candles)
                df_external["dt"] = pd.to_datetime(df_external["date"])
                df_external = df_external.drop_duplicates(subset=["date"]).sort_values("dt").reset_index(drop=True)
    except Exception:
        pass

    if not df_external.empty and len(df_external) > 0:
        return df_external

    # 3. Ưu tiên Yahoo Finance cho các Chỉ số / Cổ phiếu Quốc tế (NASDAQ, QQQ, SP500, GOLD, AAPL...)
    df_yahoo = fetch_yahoo_candles(ticker_clean, countback=req_count, timeframe=tf)
    if not df_yahoo.empty and len(df_yahoo) > 0:
        return df_yahoo

    # Nếu chưa lấy được từ 24hMoney, thử lại Binance (cho trường hợp mã crypto không có hậu tố .P)
    df_binance_fallback = fetch_binance_candles(ticker_clean, countback=req_count, timeframe=tf)
    if not df_binance_fallback.empty and len(df_binance_fallback) > 0:
        df_binance_fallback = df_binance_fallback.drop_duplicates(subset=["date"]).sort_values("dt").reset_index(drop=True)
        return df_binance_fallback

    # 4. Fallback đọc từ Strapi symbol-histories
    df_strapi = fetch_history_from_strapi(ticker_clean, countback=req_count, timeframe=tf)
    if not df_strapi.empty and len(df_strapi) > 0:
        df_strapi = df_strapi.drop_duplicates(subset=["date"]).sort_values("dt").reset_index(drop=True)
        return df_strapi

    return pd.DataFrame()

# ==============================================================================
# 2. TÍNH TOÁN CHỈ BÁO: SMA(288) & SUPERTREND(10, 3)
# ==============================================================================

def calculate_sma(df: pd.DataFrame, period: int = 288, price_col: str = "close") -> pd.Series:
    """Tính Simple Moving Average (SMA)"""
    return df[price_col].rolling(window=period).mean()

def calculate_supertrend(df: pd.DataFrame, period: int = 10, multiplier: float = 3.0):
    """
    Tính Supertrend chuẩn xác (khớp 100% với Pine Script và Lightweight Charts frontend)
    Output:
      - supertrend: Chuỗi giá trị dải Supertrend
      - direction: Chuỗi xu hướng (1 = Bullish / Xanh, -1 = Bearish / Đỏ)
    """
    high = df['high'].values
    low = df['low'].values
    close = df['close'].values
    n = len(df)

    # 1. Tính True Range (TR)
    tr = np.zeros(n)
    tr[0] = high[0] - low[0]
    for i in range(1, n):
        hl = high[i] - low[i]
        hc = abs(high[i] - close[i - 1])
        lc = abs(low[i] - close[i - 1])
        tr[i] = max(hl, hc, lc)

    # 2. Tính ATR (Wilder's Smoothing)
    atr = np.zeros(n)
    if n >= period:
        atr[period - 1] = np.mean(tr[:period])
        for i in range(period, n):
            atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period
    else:
        atr[:] = np.mean(tr)

    # 3. Tính Basic & Final Bands
    hl2 = (high + low) / 2.0
    basic_upper = hl2 + (multiplier * atr)
    basic_lower = hl2 - (multiplier * atr)

    final_upper = np.zeros(n)
    final_lower = np.zeros(n)
    supertrend = np.zeros(n)
    direction = np.zeros(n)

    final_upper[0] = basic_upper[0]
    final_lower[0] = basic_lower[0]
    supertrend[0] = final_upper[0]
    direction[0] = -1

    for i in range(1, n):
        prev_close = close[i - 1]

        # Final Upper Band
        if basic_upper[i] < final_upper[i - 1] or prev_close > final_upper[i - 1]:
            final_upper[i] = basic_upper[i]
        else:
            final_upper[i] = final_upper[i - 1]

        # Final Lower Band
        if basic_lower[i] > final_lower[i - 1] or prev_close < final_lower[i - 1]:
            final_lower[i] = basic_lower[i]
        else:
            final_lower[i] = final_lower[i - 1]

        # Xác định chiều Supertrend
        if supertrend[i - 1] == final_upper[i - 1]:
            if close[i] > final_upper[i]:
                supertrend[i] = final_lower[i]
                direction[i] = 1
            else:
                supertrend[i] = final_upper[i]
                direction[i] = -1
        else:
            if close[i] < final_lower[i]:
                supertrend[i] = final_upper[i]
                direction[i] = -1
            else:
                supertrend[i] = final_lower[i]
                direction[i] = 1

    return pd.Series(supertrend, index=df.index), pd.Series(direction, index=df.index)

# ==============================================================================
# 3. QUY TẮC VÀO LỆNH & QUẢN LÝ VỊ THẾ (SINGLE POSITION LIFECYCLE)
# ==============================================================================

def scan_strategy_signals(
    df: pd.DataFrame,
    rr_ratio: float = RISK_REWARD_RATIO,
    tp_supertrend: bool = True,
    tp_rr: bool = True,
    entry_type: str = "candle_close",
    st_period: int = SUPERTREND_PERIOD,
    st_multiplier: float = SUPERTREND_MULTIPLIER,
    ma_period: int = MA_PERIOD,
    allow_long: bool = True,
    allow_short: bool = True
) -> Dict:
    """
    Quy tắc quản lý lệnh (Single Position at a time):
    - Chỉ mở TỐI ĐA 1 VỊ THẾ tại một thời điểm.
    - Sau khi vị thế chạm Take Profit hoặc Stop Loss, lệnh mới đóng và hệ thống mới tìm cơ hội vào lệnh tiếp theo.
    - Entry Type:
        1. "candle_close": Giá đóng cửa nến xanh (Long) hoặc nến đỏ (Short)
        2. "st_reversal": Supertrend đảo chiều từ Downtrend -> Uptrend (Long) hoặc Uptrend -> Downtrend (Short)
    - Stop Loss : Đặt tại giá trị Supertrend của nến tín hiệu
    - Take Profit:
        1. tp_supertrend: Chốt khi Supertrend đảo chiều (Long -> Downtrend, Short -> Uptrend)
        2. tp_rr: Chốt theo tỷ lệ Risk:Reward (Entry +/- (Risk * R:R))
    """
    if len(df) < ma_period:
        print(f"Cảnh báo: Dữ liệu hiện có {len(df)} nến, cần tối thiểu {ma_period} nến để tính MA{ma_period}.", flush=True)
        return {"trades": [], "signals": []}

    # Tính toán các chỉ báo
    df['ma288'] = calculate_sma(df, period=ma_period, price_col='close')
    df['supertrend'], df['st_dir'] = calculate_supertrend(df, period=st_period, multiplier=st_multiplier)

    trades = []
    signals = []
    current_trade = None

    for i in range(1, len(df)):
        row = df.iloc[i]
        prev_row = df.iloc[i - 1]
        candle_date = str(row['date'])
        time_str = candle_date[:10]
        close_p = float(row['close'])
        open_p = float(row['open'])
        high_p = float(row['high'])
        low_p = float(row['low'])
        st_val = float(row['supertrend']) if not pd.isna(row['supertrend']) else None
        st_dir = int(row['st_dir']) if not pd.isna(row['st_dir']) else 0
        prev_st_dir = int(prev_row['st_dir']) if not pd.isna(prev_row['st_dir']) else 0
        ma_val = float(row['ma288']) if not pd.isna(row['ma288']) else None

        if ma_val is None or st_val is None:
            continue

        # -------------------------------------------------------------
        # 1. KIỂM TRA ĐÓNG LỆNH (NẾU ĐANG CÓ LỆNH MỞ)
        # -------------------------------------------------------------
        if current_trade is not None:
            pos_type = current_trade['type']
            entry_p = current_trade['entry_price']
            sl_p = current_trade['stop_loss']
            tp_p = current_trade['take_profit']

            is_closed = False
            exit_reason = None
            exit_price = None

            if pos_type == 'Long':
                # 1. Chạm Stop Loss (Giá thấp nhất thủng hoặc bằng SL)
                if low_p <= sl_p:
                    is_closed = True
                    exit_reason = 'StopLoss'
                    exit_price = sl_p
                # 2. Chốt theo tỷ lệ RRR (nếu bật tp_rr)
                elif tp_rr and (tp_p is not None) and (high_p >= tp_p):
                    is_closed = True
                    exit_reason = 'TakeProfit (RR)'
                    exit_price = tp_p
                # 3. Chốt khi Supertrend đảo sang Downtrend (nếu bật tp_supertrend)
                elif tp_supertrend and (st_dir == -1 or close_p < st_val):
                    is_closed = True
                    exit_reason = 'TakeProfit (ST)' if close_p >= entry_p else 'Exit (ST Reversal)'
                    exit_price = close_p

            elif pos_type == 'Short':
                # 1. Chạm Stop Loss (Giá cao nhất vượt hoặc bằng SL)
                if high_p >= sl_p:
                    is_closed = True
                    exit_reason = 'StopLoss'
                    exit_price = sl_p
                # 2. Chốt theo tỷ lệ RRR (nếu bật tp_rr)
                elif tp_rr and (tp_p is not None) and (low_p <= tp_p):
                    is_closed = True
                    exit_reason = 'TakeProfit (RR)'
                    exit_price = tp_p
                # 3. Chốt khi Supertrend đảo sang Uptrend (nếu bật tp_supertrend)
                elif tp_supertrend and (st_dir == 1 or close_p > st_val):
                    is_closed = True
                    exit_reason = 'TakeProfit (ST)' if close_p <= entry_p else 'Exit (ST Reversal)'
                    exit_price = close_p

            if is_closed:
                if pos_type == 'Long':
                    pnl_amount = exit_price - entry_p
                    pnl_percent = (pnl_amount / entry_p) * 100
                else:
                    pnl_amount = entry_p - exit_price
                    pnl_percent = (pnl_amount / entry_p) * 100

                current_trade['exit_date'] = candle_date
                current_trade['exit_time'] = time_str
                current_trade['exit_price'] = round(exit_price, 2)
                current_trade['exit_reason'] = exit_reason
                current_trade['status'] = 'Closed'
                current_trade['pnl_amount'] = round(pnl_amount, 2)
                current_trade['pnl_percent'] = round(pnl_percent, 2)
                current_trade['holding_bars'] = i - current_trade['entry_index']
                trades.append(current_trade)

                # Marker hiển thị đóng lệnh trên biểu đồ
                is_win = str(exit_reason).startswith("TakeProfit") or pnl_percent > 0
                signals.append({
                    "date": candle_date,
                    "time": time_str,
                    "type": "takeprofit" if is_win else "stoploss",
                    "action": "Close",
                    "price": round(exit_price, 2),
                    "pos_type": pos_type,
                    "entry": entry_p,
                    "stop_loss": sl_p,
                    "take_profit": tp_p,
                    "pnl_percent": round(pnl_percent, 2),
                    "pnl_amount": round(pnl_amount, 2),
                    "rule": {
                        "Name": f"{exit_reason} ({pos_type}) @ {round(exit_price, 2)} | PnL: {pnl_percent:+.2f}%",
                        "Type": "takeprofit" if is_win else "stoploss"
                    }
                })

                # Đã đóng vị thế -> sẵn sàng tìm Entry mới từ nến sau
                current_trade = None
                continue

        # -------------------------------------------------------------
        # 2. TÌM KIẾM ENTRY MỚI (CHỈ KHI KHÔNG CÓ LỆNH ĐANG MỞ)
        # -------------------------------------------------------------
        if current_trade is None:
            # 1. KIỂM TRA ĐIỀU KIỆN LONG ENTRY (khi bật allow_long)
            is_long_entry = False
            if allow_long:
                if entry_type == "st_reversal":
                    # Supertrend đảo chiều từ Downtrend sang Uptrend (nến trước -1, nến này 1) + ST > MA288
                    is_long_entry = (prev_st_dir == -1 and st_dir == 1) and (st_val > ma_val)
                else:
                    # Mặc định: Nến xanh (Close > Open) + Close > Supertrend xanh + Supertrend > MA288
                    is_green_candle = close_p > open_p
                    is_above_green_st = (close_p > st_val) and (st_dir == 1)
                    is_st_above_ma288 = st_val > ma_val
                    is_long_entry = is_green_candle and is_above_green_st and is_st_above_ma288

            if is_long_entry:
                entry = close_p
                sl = round(st_val, 2)
                risk = entry - sl
                if risk > 0:
                    tp = round(entry + (risk * rr_ratio), 2) if tp_rr else None
                    current_trade = {
                        "trade_no": len(trades) + 1,
                        "type": "Long",
                        "status": "Open",
                        "entry_date": candle_date,
                        "entry_time": time_str,
                        "entry_price": entry,
                        "entry_index": i,
                        "stop_loss": sl,
                        "take_profit": tp,
                        "risk_reward": rr_ratio if tp_rr else None,
                        "supertrend": round(st_val, 2),
                        "ma288": round(ma_val, 2),
                        "exit_date": None,
                        "exit_time": None,
                        "exit_price": None,
                        "exit_reason": None,
                        "pnl_percent": 0.0,
                        "pnl_amount": 0.0,
                    }

                    # Marker hiển thị vào lệnh trên biểu đồ
                    signals.append({
                        "date": candle_date,
                        "time": time_str,
                        "type": "Long",
                        "action": "Entry",
                        "entry": entry,
                        "price": entry,
                        "stop_loss": sl,
                        "take_profit": tp,
                        "risk_reward": rr_ratio if tp_rr else None,
                        "supertrend": round(st_val, 2),
                        "ma288": round(ma_val, 2),
                        "rule": {
                            "Name": f"Long ({'ST Reversal' if entry_type == 'st_reversal' else 'ST+MA288'}) Entry: {entry} | SL: {sl} | TP: {tp if tp else 'Theo ST'}",
                            "Type": "entry"
                        }
                    })
                    continue

            # 2. KIỂM TRA ĐIỀU KIỆN SHORT ENTRY (khi bật allow_short)
            is_short_entry = False
            if allow_short:
                if entry_type == "st_reversal":
                    # Supertrend đảo chiều từ Uptrend sang Downtrend (nến trước 1, nến này -1) + ST < MA288
                    is_short_entry = (prev_st_dir == 1 and st_dir == -1) and (st_val < ma_val)
                else:
                    # Mặc định: Nến đỏ (Close < Open) + Close < Supertrend đỏ + Supertrend < MA288
                    is_red_candle = close_p < open_p
                    is_below_red_st = (close_p < st_val) and (st_dir == -1)
                    is_st_below_ma288 = st_val < ma_val
                    is_short_entry = is_red_candle and is_below_red_st and is_st_below_ma288

            if is_short_entry:
                entry = close_p
                sl = round(st_val, 2)
                risk = sl - entry
                if risk > 0:
                    tp = round(entry - (risk * rr_ratio), 2) if tp_rr else None
                    current_trade = {
                        "trade_no": len(trades) + 1,
                        "type": "Short",
                        "status": "Open",
                        "entry_date": candle_date,
                        "entry_time": time_str,
                        "entry_price": entry,
                        "entry_index": i,
                        "stop_loss": sl,
                        "take_profit": tp,
                        "risk_reward": rr_ratio if tp_rr else None,
                        "supertrend": round(st_val, 2),
                        "ma288": round(ma_val, 2),
                        "exit_date": None,
                        "exit_time": None,
                        "exit_price": None,
                        "exit_reason": None,
                        "pnl_percent": 0.0,
                        "pnl_amount": 0.0,
                    }

                    # Marker hiển thị vào lệnh trên biểu đồ
                    signals.append({
                        "date": candle_date,
                        "time": time_str,
                        "type": "Short",
                        "action": "Entry",
                        "entry": entry,
                        "price": entry,
                        "stop_loss": sl,
                        "take_profit": tp,
                        "risk_reward": rr_ratio if tp_rr else None,
                        "supertrend": round(st_val, 2),
                        "ma288": round(ma_val, 2),
                        "rule": {
                            "Name": f"Short ({'ST Reversal' if entry_type == 'st_reversal' else 'ST+MA288'}) Entry: {entry} | SL: {sl} | TP: {tp if tp else 'Theo ST'}",
                            "Type": "entry"
                        }
                    })
                    continue

    # Nếu lệnh vẫn còn đang mở tại nến cuối cùng
    if current_trade is not None:
        last_close = float(df.iloc[-1]['close'])
        if current_trade['type'] == 'Long':
            unrealized_pnl = ((last_close - current_trade['entry_price']) / current_trade['entry_price']) * 100
        else:
            unrealized_pnl = ((current_trade['entry_price'] - last_close) / current_trade['entry_price']) * 100
        current_trade['pnl_percent'] = round(unrealized_pnl, 2)
        current_trade['pnl_amount'] = round(last_close - current_trade['entry_price'] if current_trade['type'] == 'Long' else current_trade['entry_price'] - last_close, 2)
        current_trade['holding_bars'] = len(df) - 1 - current_trade['entry_index']
        trades.append(current_trade)

    return {"trades": trades, "signals": signals}

# ==============================================================================
# 4. ĐỒNG BỘ DATA & PUSH SIGNAL LÊN STRAPI (/trade-station)
# ==============================================================================

get_or_create_symbol = get_or_create_symbol_in_strapi

def get_or_create_rule(rule_name: str, rule_type: str = "entry") -> Optional[str]:
    """Tìm hoặc tạo Rule tương ứng trong Strapi để Trade Station hiển thị màu marker đúng"""
    headers = get_strapi_headers()
    try:
        res = requests.get(f"{STRAPI_BASE_URL}/api/rules?filters[Name][$eq]={rule_name}", headers=headers, timeout=10)
        data = res.json().get("data", [])
        if data:
            return data[0].get("documentId") or str(data[0].get("id"))
        
        # Tạo mới rule
        create_res = requests.post(f"{STRAPI_BASE_URL}/api/rules", json={
            "data": {
                "Name": rule_name,
                "Type": rule_type,
                "Description": f"Auto rule for {rule_name}",
                "Active": "Enable"
            }
        }, headers=headers, timeout=10)
        if create_res.status_code in [200, 201]:
            return create_res.json().get("data", {}).get("documentId")
    except Exception as e:
        print(f"Lỗi get_or_create_rule: {e}")
    return None

def push_signal_to_trade_station(ticker: str, signal: Dict, symbol_id: str):
    """
    Đẩy tín hiệu vào Strapi (/api/signals):
    - Tự động kiểm tra chống trùng lặp theo ngày và mã.
    - Hiển thị marker Mũi tên (Xanh cho Long, Đỏ cho Short) trên biểu đồ Trade Station.
    - Hiển thị trong Panel Signals & Strategy.
    """
    headers = get_strapi_headers()
    sig_date = signal["date"]
    sig_type = signal["type"]

    # 1. Kiểm tra trùng lặp
    check_url = f"{STRAPI_BASE_URL}/api/signals?filters[symbol][Name][$eq]={ticker}&filters[date][$eq]={sig_date}"
    try:
        check_res = requests.get(check_url, headers=headers, timeout=10)
        existing = check_res.json().get("data", [])
        if existing:
            return  # Đã có tín hiệu trong ngày này, không tạo trùng lặp
    except Exception:
        pass

    # 2. Lấy rule ID
    rule_id = get_or_create_rule(f"ST_MA288_{sig_type}", rule_type="entry" if sig_type == "Long" else "exit")

    # 3. Tạo Signal
    sig_name = f"{ticker} - {sig_type} (ST+MA288) | Entry: {signal['entry']} | SL: {signal['stop_loss']} | TP: {signal['take_profit']}"
    payload = {
        "data": {
            "name": sig_name,
            "date": sig_date,
            "symbol": symbol_id,
            "rules": [rule_id] if rule_id else [],
            "expired": False
        }
    }

    try:
        post_res = requests.post(f"{STRAPI_BASE_URL}/api/signals", json=payload, headers=headers, timeout=10)
        if post_res.status_code in [200, 201]:
            print(f" [SIGNAL ĐÃ ĐẨY LÊN TRADE-STATION] {sig_type.upper()} {ticker} @ {signal['entry']} (SL: {signal['stop_loss']}, TP: {signal['take_profit']})", flush=True)
        else:
            print(f"Lỗi đẩy Signal cho {ticker}: {post_res.text}", flush=True)
    except Exception as e:
        print(f"Lỗi khi gửi Signal: {e}", flush=True)

# ==============================================================================
# 5. CHƯƠNG TRÌNH CHÍNH QUÉT TÍN HIỆU TOÀN DIỆN (MAIN)
# ==============================================================================

def run_scanner(
    watchlist: List[str] = DEFAULT_WATCHLIST,
    sync_history: bool = True,
    rr_ratio: float = RISK_REWARD_RATIO,
    tp_supertrend: bool = True,
    tp_rr: bool = True,
    entry_type: str = "candle_close",
    st_period: int = SUPERTREND_PERIOD,
    st_multiplier: float = SUPERTREND_MULTIPLIER,
    ma_period: int = MA_PERIOD,
    allow_long: bool = True,
    allow_short: bool = True
):
    print("=" * 90, flush=True)
    print(f"[*] QUET CHIEN LUOC SUPERTREND({st_period},{st_multiplier}) + MA({ma_period}) (SINGLE ENTRY 1 LUC)", flush=True)
    print(f"[*] Thoi gian: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
    print(f"[*] Danh sach Watchlist: {', '.join(watchlist)}", flush=True)
    print(f"[*] Che do vao lenh: EntryType={entry_type} | Long={allow_long} | Short={allow_short}", flush=True)
    print(f"[*] Che do chot loi: Supertrend Reversal={tp_supertrend}, RR({rr_ratio})={tp_rr}", flush=True)
    print("=" * 90, flush=True)

    summary_results = []

    for ticker in watchlist:
        print(f"\n[*] Dang phan tich ma: {ticker} ...", flush=True)
        
        # 1. Tự động tải dữ liệu trực tiếp
        df = fetch_market_candles(ticker, countback=500)
        if df.empty or len(df) < ma_period:
            print(f"[-] Khong du du lieu ({len(df)} nen). Bo qua {ticker}.", flush=True)
            continue

        symbol_id = get_or_create_symbol(ticker)

        # 2. Tự động đồng bộ nến vào Strapi nếu cần
        if sync_history and symbol_id:
            sync_candles_to_strapi(ticker, df, symbol_id, max_sync=15)

        # 3. Quét tín hiệu theo rules (Single Position)
        result = scan_strategy_signals(
            df,
            rr_ratio=rr_ratio,
            tp_supertrend=tp_supertrend,
            tp_rr=tp_rr,
            entry_type=entry_type,
            st_period=st_period,
            st_multiplier=st_multiplier,
            ma_period=ma_period,
            allow_long=allow_long,
            allow_short=allow_short
        )
        trades = result.get("trades", [])
        signals = result.get("signals", [])

        closed_trades = [t for t in trades if t.get("status") == "Closed"]
        win_trades = [t for t in closed_trades if str(t.get("exit_reason", "")).startswith("TakeProfit") or t.get("pnl_percent", 0) > 0]
        win_rate = round(len(win_trades) / len(closed_trades) * 100, 1) if closed_trades else 0.0
        total_pnl = round(sum(t.get("pnl_percent", 0) for t in trades), 1)

        print(f"-> Tong so Trades: {len(trades)} (Closed: {len(closed_trades)} | Win Rate: {win_rate}% | Tong PnL: {total_pnl:+0.1f}%)", flush=True)

        if trades:
            last_trade = trades[-1]
            summary_results.append({
                "Ticker": ticker,
                "Trades": len(trades),
                "WinRate": f"{win_rate}%",
                "TotalPnL": f"{total_pnl:+0.1f}%",
                "LastType": last_trade["type"],
                "EntryDate": last_trade["entry_time"],
                "Entry": last_trade["entry_price"],
                "SL": last_trade["stop_loss"],
                "TP": last_trade["take_profit"],
                "Status": last_trade["status"],
                "ExitReason": last_trade["exit_reason"] or "Dang giu",
                "LastPnL": f"{last_trade['pnl_percent']:+0.1f}%"
            })

            # 4. Đẩy 3 tín hiệu gần nhất lên Trade Station
            for sig in signals[-3:]:
                if symbol_id:
                    push_signal_to_trade_station(ticker, sig, symbol_id)

    # In bảng tổng kết
    if summary_results:
        print("\n" + "=" * 90, flush=True)
        print("[*] BANG TONG KET HIEU QUA CHIEN LUOC (1 ENTRY 1 LUC)", flush=True)
        print("=" * 90, flush=True)
        res_df = pd.DataFrame(summary_results)
        print(res_df.to_string(index=False), flush=True)
        print("=" * 90, flush=True)
    else:
        print("\n[-] Khong co tin hieu nao phu hop trong dot quet nay.", flush=True)

def scan_symbol_json(
    ticker: str,
    countback: int = 500,
    rr_ratio: float = RISK_REWARD_RATIO,
    tp_supertrend: bool = True,
    tp_rr: bool = True,
    entry_type: str = "candle_close",
    st_period: int = SUPERTREND_PERIOD,
    st_multiplier: float = SUPERTREND_MULTIPLIER,
    ma_period: int = MA_PERIOD,
    allow_long: bool = True,
    allow_short: bool = True,
    timeframe: str = "D1"
) -> Dict:
    """Quét dữ liệu và trả về JSON chuẩn để hiển thị trực tiếp trên UI Chart & Table mà không cần lưu vào DB"""
    df = fetch_market_candles(ticker, countback=countback, timeframe=timeframe)
    if df.empty or len(df) < ma_period:
        return {
            "ticker": ticker,
            "error": f"Khong du du lieu (co {len(df)} nen, can toi thieu {ma_period} nen)",
            "candles": [],
            "signals": [],
            "trades": []
        }

    res = scan_strategy_signals(
        df,
        rr_ratio=rr_ratio,
        tp_supertrend=tp_supertrend,
        tp_rr=tp_rr,
        entry_type=entry_type,
        st_period=st_period,
        st_multiplier=st_multiplier,
        ma_period=ma_period,
        allow_long=allow_long,
        allow_short=allow_short
    )
    trades = res.get("trades", [])
    signals = res.get("signals", [])

    # Tối ưu hóa serialization cho UI Lightweight Charts (chỉ lấy tối đa 3000 nến gần nhất)
    chart_df = df.tail(3000) if len(df) > 3000 else df
    dates = chart_df['date'].astype(str).values
    opens = chart_df['open'].astype(float).values
    highs = chart_df['high'].astype(float).values
    lows = chart_df['low'].astype(float).values
    closes = chart_df['close'].astype(float).values
    volumes = chart_df['volume'].astype(float).values
    st_vals = chart_df['supertrend'].values if 'supertrend' in chart_df.columns else [None]*len(chart_df)
    st_dirs = chart_df['st_dir'].values if 'st_dir' in chart_df.columns else [None]*len(chart_df)
    ma_vals = chart_df['ma288'].values if 'ma288' in chart_df.columns else [None]*len(chart_df)

    candles_list = []
    for i in range(len(chart_df)):
        candles_list.append({
            "date": str(dates[i]),
            "time": str(dates[i])[:10],
            "open": float(opens[i]),
            "high": float(highs[i]),
            "low": float(lows[i]),
            "close": float(closes[i]),
            "volume": float(volumes[i]),
            "supertrend": round(float(st_vals[i]), 2) if pd.notna(st_vals[i]) else None,
            "st_direction": int(st_dirs[i]) if pd.notna(st_dirs[i]) else None,
            "ma288": round(float(ma_vals[i]), 2) if pd.notna(ma_vals[i]) else None
        })

    # Thống kê hiệu suất (Metrics)
    closed_trades = [t for t in trades if t.get("status") == "Closed"]
    win_trades = [t for t in closed_trades if str(t.get("exit_reason", "")).startswith("TakeProfit") or t.get("pnl_percent", 0) > 0]
    loss_trades = [t for t in closed_trades if t.get("exit_reason") == "StopLoss" or t.get("pnl_percent", 0) <= 0]
    win_rate = round(len(win_trades) / len(closed_trades) * 100, 2) if closed_trades else 0.0
    total_pnl_percent = round(sum(t.get("pnl_percent", 0) for t in trades), 2)
    active_trade = next((t for t in trades if t.get("status") == "Open"), None)

    # Tính Profit Factor (Tổng Lãi / Tổng Lỗ)
    gross_profit = sum(t.get("pnl_percent", 0) for t in closed_trades if t.get("pnl_percent", 0) > 0)
    gross_loss = sum(abs(t.get("pnl_percent", 0)) for t in closed_trades if t.get("pnl_percent", 0) < 0)
    profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else (round(gross_profit, 2) if gross_profit > 0 else 0.0)

    return {
        "ticker": ticker,
        "candles": candles_list,
        "signals": signals,
        "trades": trades,
        "summary": {
            "totalTrades": len(trades),
            "closedTrades": len(closed_trades),
            "winTrades": len(win_trades),
            "lossTrades": len(loss_trades),
            "winRate": win_rate,
            "totalPnlPercent": total_pnl_percent,
            "profitFactor": profit_factor,
            "grossProfit": round(gross_profit, 2),
            "grossLoss": round(gross_loss, 2),
            "activeTrade": active_trade,
            "latestTrade": trades[-1] if trades else None,
            "currentPrice": candles_list[-1]['close'] if candles_list else None,
            "supertrend": candles_list[-1]['supertrend'] if candles_list else None,
            "ma288": candles_list[-1]['ma288'] if candles_list else None,
        }
    }

def fast_backtest_eval(
    close_arr: np.ndarray,
    open_arr: np.ndarray,
    high_arr: np.ndarray,
    low_arr: np.ndarray,
    st_val_arr: np.ndarray,
    st_dir_arr: np.ndarray,
    ma_arr: np.ndarray,
    rr_ratio: float,
    tp_supertrend: bool,
    tp_rr: bool,
    entry_type: str,
    allow_long: bool,
    allow_short: bool,
    start_idx: int
) -> Dict:
    """Đánh giá backtest tốc độ cao bằng mảng numpy thuần túy để quét Grid Search hàng ngàn tổ hợp trong <1 giây"""
    n = len(close_arr)
    current_pos_type = 0  # 0: None, 1: Long, -1: Short
    entry_p = 0.0
    sl_p = 0.0
    tp_p = 0.0

    total_trades = 0
    closed_trades = 0
    gross_profit = 0.0
    gross_loss = 0.0
    total_pnl = 0.0
    win_trades = 0

    for i in range(start_idx, n):
        close_p = close_arr[i]
        open_p = open_arr[i]
        high_p = high_arr[i]
        low_p = low_arr[i]
        st_val = st_val_arr[i]
        st_dir = st_dir_arr[i]
        prev_st_dir = st_dir_arr[i - 1]
        ma_val = ma_arr[i]

        if np.isnan(ma_val) or np.isnan(st_val):
            continue

        # 1. Kiểm tra đóng vị thế nếu đang có lệnh
        if current_pos_type != 0:
            is_closed = False
            exit_price = 0.0

            if current_pos_type == 1:  # Long
                if low_p <= sl_p:
                    is_closed = True
                    exit_price = sl_p
                elif tp_rr and (tp_p > 0) and (high_p >= tp_p):
                    is_closed = True
                    exit_price = tp_p
                elif tp_supertrend and (st_dir == -1 or close_p < st_val):
                    is_closed = True
                    exit_price = close_p
            elif current_pos_type == -1:  # Short
                if high_p >= sl_p:
                    is_closed = True
                    exit_price = sl_p
                elif tp_rr and (tp_p > 0) and (low_p <= tp_p):
                    is_closed = True
                    exit_price = tp_p
                elif tp_supertrend and (st_dir == 1 or close_p > st_val):
                    is_closed = True
                    exit_price = close_p

            if is_closed:
                closed_trades += 1
                if current_pos_type == 1:
                    pnl_pct = ((exit_price - entry_p) / entry_p) * 100
                else:
                    pnl_pct = ((entry_p - exit_price) / entry_p) * 100

                total_pnl += pnl_pct
                if pnl_pct > 0:
                    gross_profit += pnl_pct
                    win_trades += 1
                elif pnl_pct < 0:
                    gross_loss += abs(pnl_pct)

                current_pos_type = 0
                continue

        # 2. Kiểm tra vào lệnh mới nếu không có vị thế mở
        if current_pos_type == 0:
            is_long_entry = False
            if allow_long:
                if entry_type == "st_reversal":
                    is_long_entry = (prev_st_dir == -1 and st_dir == 1) and (st_val > ma_val)
                else:
                    is_green_candle = close_p > open_p
                    is_above_green_st = (close_p > st_val) and (st_dir == 1)
                    is_st_above_ma288 = st_val > ma_val
                    is_long_entry = is_green_candle and is_above_green_st and is_st_above_ma288

            if is_long_entry:
                entry = close_p
                sl = st_val
                risk = entry - sl
                if risk > 0:
                    tp = (entry + (risk * rr_ratio)) if tp_rr else 0.0
                    current_pos_type = 1
                    entry_p = entry
                    sl_p = sl
                    tp_p = tp
                    total_trades += 1
                    continue

            is_short_entry = False
            if allow_short:
                if entry_type == "st_reversal":
                    is_short_entry = (prev_st_dir == 1 and st_dir == -1) and (st_val < ma_val)
                else:
                    is_red_candle = close_p < open_p
                    is_below_red_st = (close_p < st_val) and (st_dir == -1)
                    is_st_below_ma288 = st_val < ma_val
                    is_short_entry = is_red_candle and is_below_red_st and is_st_below_ma288

            if is_short_entry:
                entry = close_p
                sl = st_val
                risk = sl - entry
                if risk > 0:
                    tp = (entry - (risk * rr_ratio)) if tp_rr else 0.0
                    current_pos_type = -1
                    entry_p = entry
                    sl_p = sl
                    tp_p = tp
                    total_trades += 1
                    continue

    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (gross_profit if gross_profit > 0 else 0.0)
    win_rate = (win_trades / closed_trades * 100) if closed_trades > 0 else 0.0

    return {
        "total_trades": total_trades,
        "closed_trades": closed_trades,
        "win_trades": win_trades,
        "loss_trades": closed_trades - win_trades,
        "win_rate": round(win_rate, 2),
        "total_pnl": round(total_pnl, 2),
        "gross_profit": round(gross_profit, 2),
        "gross_loss": round(gross_loss, 2),
        "profit_factor": round(profit_factor, 2)
    }

def optimize_strategy_parameters(
    ticker: str,
    countback: int = 50000,
    allow_long: bool = True,
    allow_short: bool = True,
    timeframe: str = "D1",
    current_st_period: int = 10,
    current_st_multiplier: float = 3.0,
    current_ma_period: int = 288,
    current_rr: float = 1.5,
    current_entry_type: str = "candle_close",
    current_tp_supertrend: bool = True,
    current_tp_rr: bool = True,
    opt_config: Dict = None
) -> Dict:
    """
    Tự động chạy Grid Search tối ưu hóa các tham số dựa trên TOÀN BỘ dữ liệu lịch sử
    có trong Strapi theo Timeframe đã chọn. Tham số nào được tick Opt mới tìm kiếm thay đổi,
    các tham số không tick sẽ được giữ cố định theo giá trị hiện tại.
    """
    # Tối ưu hóa số lượng nến mẫu (tối đa 5,000 nến để đảm bảo phản hồi nhanh < 10 giây)
    req_count = min(int(countback), 5000) if countback else 5000
    df = fetch_market_candles(ticker, countback=req_count, timeframe=timeframe)
    if df.empty or len(df) < 50:
        return {
            "ticker": ticker,
            "error": f"Không đủ dữ liệu lịch sử nến cho {ticker} (có {len(df)} nến)",
            "candles": [],
            "signals": [],
            "trades": []
        }

    close_arr = df['close'].values
    open_arr = df['open'].values
    high_arr = df['high'].values
    low_arr = df['low'].values
    n = len(df)

    if opt_config is None:
        opt_config = {}

    opt_st_period = opt_config.get("stPeriod", True)
    opt_st_multiplier = opt_config.get("stMultiplier", True)
    opt_ma_period = opt_config.get("maPeriod", True)
    opt_risk_reward = opt_config.get("riskReward", True)
    opt_entry_type = opt_config.get("entryType", True)
    opt_tp_mode = opt_config.get("tpMode", True)

    # 1. Grid tham số cần tối ưu (Tinh chỉnh tập giá trị cốt lõi)
    if opt_st_period:
        st_period_grid = [7, 10, 14]
        if current_st_period and int(current_st_period) not in st_period_grid:
            st_period_grid.append(int(current_st_period))
            st_period_grid.sort()
    else:
        st_period_grid = [int(current_st_period or 10)]

    if opt_st_multiplier:
        st_multiplier_grid = [2.0, 2.5, 3.0, 3.5]
        if current_st_multiplier and float(current_st_multiplier) not in st_multiplier_grid:
            st_multiplier_grid.append(float(current_st_multiplier))
            st_multiplier_grid.sort()
    else:
        st_multiplier_grid = [float(current_st_multiplier or 3.0)]

    if opt_ma_period:
        all_ma_periods = [34, 50, 89, 150, 200, 288]
        if current_ma_period and int(current_ma_period) not in all_ma_periods:
            all_ma_periods.append(int(current_ma_period))
        ma_period_grid = sorted([m for m in all_ma_periods if m <= n - 10])
        if not ma_period_grid:
            ma_period_grid = [min(20, n - 5)]
    else:
        curr_m = int(current_ma_period or 288)
        ma_period_grid = [min(curr_m, max(5, n - 5))]

    if opt_risk_reward:
        rr_ratio_grid = [1.2, 1.5, 2.0, 2.5]
        if current_rr and float(current_rr) not in rr_ratio_grid:
            rr_ratio_grid.append(float(current_rr))
            rr_ratio_grid.sort()
    else:
        rr_ratio_grid = [float(current_rr or 1.5)]

    if opt_entry_type:
        entry_type_grid = ["candle_close", "st_reversal"]
    else:
        entry_type_grid = [str(current_entry_type or "candle_close")]

    if opt_tp_mode:
        tp_modes = [
            (True, False),  # Chỉ theo Supertrend đảo chiều
            (False, True),  # Chỉ theo R:R
            (True, True)    # Cả hai: Chốt theo phương thức nào chạm trước
        ]
    else:
        cur_st = bool(current_tp_supertrend)
        cur_rr = bool(current_tp_rr)
        if not cur_st and not cur_rr:
            cur_st = True
        tp_modes = [(cur_st, cur_rr)]

    # 2. Precalculate MA indicators
    ma_cache = {}
    for m in ma_period_grid:
        ma_series = calculate_sma(df, period=m, price_col='close')
        ma_cache[m] = ma_series.values

    # 3. Precalculate Supertrend indicators
    st_cache = {}
    for p in st_period_grid:
        for mult in st_multiplier_grid:
            st_val, st_dir = calculate_supertrend(df, period=p, multiplier=mult)
            st_cache[(p, mult)] = (st_val.values, st_dir.values)

    # Phân loại độ tin cậy mẫu (Sample Size Reliability Tiers) dựa trên tổng số nến n
    # Đảm bảo số lượng lệnh tối thiểu phải đủ lớn để tránh Overfitting / Fluke
    target_trades = max(15, min(30, int(n / 35))) if n >= 300 else max(8, int(n / 25))
    min_solid_trades = max(8, min(15, int(n / 60)))
    start_idx = max(max(ma_period_grid), 20)

    best_score = None
    best_combo = None
    all_candidates = []

    for m in ma_period_grid:
        ma_arr = ma_cache[m]
        for p in st_period_grid:
            for mult in st_multiplier_grid:
                st_val_arr, st_dir_arr = st_cache[(p, mult)]
                for rr in rr_ratio_grid:
                    for entry_t in entry_type_grid:
                        for (tp_st, tp_rr) in tp_modes:
                            res = fast_backtest_eval(
                                close_arr=close_arr,
                                open_arr=open_arr,
                                high_arr=high_arr,
                                low_arr=low_arr,
                                st_val_arr=st_val_arr,
                                st_dir_arr=st_dir_arr,
                                ma_arr=ma_arr,
                                rr_ratio=rr,
                                tp_supertrend=tp_st,
                                tp_rr=tp_rr,
                                entry_type=entry_t,
                                allow_long=allow_long,
                                allow_short=allow_short,
                                start_idx=start_idx
                            )

                            closed = res['closed_trades']
                            if closed == 0:
                                continue

                            pf = res['profit_factor']
                            pnl = res['total_pnl']
                            wr = res['win_rate']

                            # 1. Giới hạn PF trần (Capped PF) ở mức 10.0 để tránh trường hợp ít lệnh không loss đẩy PF ảo lên 100-200
                            capped_pf = min(pf, 10.0)

                            # 2. Xếp hạng Tier theo độ tin cậy thống kê (Số lượng lệnh mẫu)
                            if closed >= target_trades and pnl > 0 and pf >= 1.2:
                                tier = 4  # Rất đáng tin cậy: Mẫu lớn, PnL dương, PF tốt
                            elif closed >= min_solid_trades and pnl > 0 and pf >= 1.1:
                                tier = 3  # Đáng tin cậy: Mẫu khá, PnL dương
                            elif closed >= 6 and pnl > 0:
                                tier = 2  # Chấp nhận được
                            elif closed >= 3:
                                tier = 1  # Mẫu nhỏ
                            else:
                                tier = 0  # Mẫu quá ít (< 3 lệnh)

                            # 3. Điểm đánh giá tổng hợp (Composite Fitness Score):
                            trade_weight = np.sqrt(closed)
                            wr_factor = 1.0 if wr >= 40.0 else max(0.2, wr / 40.0)
                            pnl_weight = max(0.1, pnl) if pnl > 0 else (pnl / 10.0)

                            fitness = capped_pf * trade_weight * pnl_weight * wr_factor

                            score = (tier, round(fitness, 4), pnl, capped_pf, closed)

                            candidate_data = {
                                "score": score,
                                "profitFactor": pf,
                                "winRate": wr,
                                "totalTrades": closed,
                                "winTrades": res.get('win_trades', 0),
                                "lossTrades": res.get('loss_trades', 0),
                                "totalPnlPercent": round(pnl, 2),
                                "grossProfit": round(res.get('gross_profit', 0.0), 2),
                                "grossLoss": round(res.get('gross_loss', 0.0), 2),
                                "stPeriod": p,
                                "stMultiplier": mult,
                                "maPeriod": m,
                                "riskReward": rr,
                                "entryType": entry_t,
                                "tpSupertrend": tp_st,
                                "tpRR": tp_rr,
                                "allowLong": allow_long,
                                "allowShort": allow_short
                            }
                            all_candidates.append(candidate_data)

                            if best_score is None or score > best_score:
                                best_score = score
                                best_combo = {
                                    "st_period": p,
                                    "st_multiplier": mult,
                                    "ma_period": m,
                                    "rr_ratio": rr,
                                    "entry_type": entry_t,
                                    "tp_supertrend": tp_st,
                                    "tp_rr": tp_rr
                                }

    top_configs = []
    if all_candidates:
        all_candidates.sort(key=lambda x: x["score"], reverse=True)
        seen = set()
        for c in all_candidates:
            key = (c["stPeriod"], c["stMultiplier"], c["maPeriod"], c["riskReward"], c["entryType"], c["tpSupertrend"], c["tpRR"])
            if key not in seen:
                seen.add(key)
                item = {k: v for k, v in c.items() if k != "score"}
                item["rank"] = len(top_configs) + 1
                top_configs.append(item)
                if len(top_configs) >= 25:
                    break

    if not best_combo:
        best_combo = {
            "st_period": SUPERTREND_PERIOD,
            "st_multiplier": SUPERTREND_MULTIPLIER,
            "ma_period": min(MA_PERIOD, max(ma_period_grid)),
            "rr_ratio": RISK_REWARD_RATIO,
            "entry_type": "candle_close",
            "tp_supertrend": True,
            "tp_rr": True
        }

    # Chạy lại bản chi tiết với combo tối ưu nhất trên TOÀN BỘ tập nến
    full_result = scan_symbol_json(
        ticker=ticker,
        countback=len(df),
        rr_ratio=best_combo["rr_ratio"],
        tp_supertrend=best_combo["tp_supertrend"],
        tp_rr=best_combo["tp_rr"],
        entry_type=best_combo["entry_type"],
        st_period=best_combo["st_period"],
        st_multiplier=best_combo["st_multiplier"],
        ma_period=best_combo["ma_period"],
        allow_long=allow_long,
        allow_short=allow_short,
        timeframe=timeframe
    )

    full_result["bestParams"] = {
        "stPeriod": best_combo["st_period"],
        "stMultiplier": best_combo["st_multiplier"],
        "maPeriod": best_combo["ma_period"],
        "riskReward": best_combo["rr_ratio"],
        "entryType": best_combo["entry_type"],
        "tpSupertrend": best_combo["tp_supertrend"],
        "tpRR": best_combo["tp_rr"],
        "allowLong": allow_long,
        "allowShort": allow_short,
        "profitFactor": full_result.get("summary", {}).get("profitFactor", 0.0),
        "winRate": full_result.get("summary", {}).get("winRate", 0.0),
        "totalTrades": full_result.get("summary", {}).get("totalTrades", 0),
        "totalPnlPercent": full_result.get("summary", {}).get("totalPnlPercent", 0.0),
        "closedTrades": full_result.get("summary", {}).get("closedTrades", 0)
    }
    full_result["topConfigs"] = top_configs

    return full_result

if __name__ == "__main__":
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Supertrend + MA Strategy Scanner & Optimizer")
    parser.add_argument("--ticker", type=str, default=None, help="Mã cổ phiếu cần quét (e.g. FPT, VNINDEX, VN30F1M)")
    parser.add_argument("--timeframe", type=str, default="D1", help="Timeframe (M1, M5, M30, H4, D1, W1)")
    parser.add_argument("--json", action="store_true", help="Trả về kết quả định dạng JSON")
    parser.add_argument("--optimize", action="store_true", help="Tự động tìm bộ tham số mang lại Profit Factor cao nhất")
    parser.add_argument("--countback", type=int, default=500, help="Số lượng nến lịch sử cần lấy")
    parser.add_argument("--rr", type=float, default=RISK_REWARD_RATIO, help="Tỷ lệ Risk:Reward cho Take Profit")
    parser.add_argument("--entry-type", type=str, default="candle_close", choices=["candle_close", "st_reversal"], help="Loại điều kiện vào lệnh (candle_close / st_reversal)")
    parser.add_argument("--st-period", type=int, default=SUPERTREND_PERIOD, help="Supertrend ATR Period")
    parser.add_argument("--st-multiplier", type=float, default=SUPERTREND_MULTIPLIER, help="Supertrend Multiplier")
    parser.add_argument("--ma-period", type=int, default=MA_PERIOD, help="MA Period (SMA)")
    parser.add_argument("--opt-config", type=str, default="", help="JSON config xác định các tham số được tick để tối ưu")

    # Lựa chọn loại lệnh: Long / Short
    parser.add_argument("--allow-long", dest="allow_long", action="store_true", default=True, help="Cho phép mở lệnh Long")
    parser.add_argument("--no-long", dest="allow_long", action="store_false", help="Không mở lệnh Long")
    parser.add_argument("--allow-short", dest="allow_short", action="store_true", default=True, help="Cho phép mở lệnh Short")
    parser.add_argument("--no-short", dest="allow_short", action="store_false", help="Không mở lệnh Short")

    # 2 Phương thức chốt lời: Supertrend và RR
    parser.add_argument("--tp-supertrend", dest="tp_supertrend", action="store_true", default=True, help="Chốt lời khi Supertrend đảo chiều")
    parser.add_argument("--no-tp-supertrend", dest="tp_supertrend", action="store_false", help="Không chốt lời theo Supertrend đảo chiều")
    parser.add_argument("--tp-rr", dest="tp_rr", action="store_true", default=True, help="Chốt lời theo tỷ lệ Risk:Reward")
    parser.add_argument("--no-tp-rr", dest="tp_rr", action="store_false", help="Không chốt lời theo Risk:Reward")

    args = parser.parse_args()

    if args.optimize:
        ticker = args.ticker or "VNINDEX"
        opt_cfg = {}
        if args.opt_config:
            try:
                opt_cfg = json.loads(args.opt_config)
            except Exception:
                opt_cfg = {}

        res = optimize_strategy_parameters(
            ticker=ticker,
            countback=args.countback,
            allow_long=args.allow_long,
            allow_short=args.allow_short,
            timeframe=args.timeframe,
            current_st_period=args.st_period,
            current_st_multiplier=args.st_multiplier,
            current_ma_period=args.ma_period,
            current_rr=args.rr,
            current_entry_type=args.entry_type,
            current_tp_supertrend=args.tp_supertrend,
            current_tp_rr=args.tp_rr,
            opt_config=opt_cfg
        )
        if args.json:
            print(json.dumps(res, ensure_ascii=False))
        else:
            bp = res.get("bestParams", {})
            print(f"[*] THAM SỐ TỐI ƯU NHẤT CHO {ticker} ({args.timeframe}):")
            print(f"    - Supertrend: Period = {bp.get('stPeriod')}, Multiplier = {bp.get('stMultiplier')}")
            print(f"    - MA Period: {bp.get('maPeriod')}")
            print(f"    - Entry Type: {bp.get('entryType')}")
            print(f"    - R:R Ratio: {bp.get('riskReward')}")
            print(f"    - TP Supertrend: {bp.get('tpSupertrend')} | TP RR: {bp.get('tpRR')}")
            print(f"    -> Profit Factor: {bp.get('profitFactor')} | Win Rate: {bp.get('winRate')}% | PnL: {bp.get('totalPnlPercent')}%")
    elif args.json:
        ticker = args.ticker or "VNINDEX"
        res = scan_symbol_json(
            ticker,
            countback=args.countback,
            rr_ratio=args.rr,
            tp_supertrend=args.tp_supertrend,
            tp_rr=args.tp_rr,
            entry_type=args.entry_type,
            st_period=args.st_period,
            st_multiplier=args.st_multiplier,
            ma_period=args.ma_period,
            allow_long=args.allow_long,
            allow_short=args.allow_short,
            timeframe=args.timeframe
        )
        print(json.dumps(res, ensure_ascii=False))
    elif args.ticker:
        run_scanner(
            watchlist=[args.ticker],
            sync_history=False,
            rr_ratio=args.rr,
            tp_supertrend=args.tp_supertrend,
            tp_rr=args.tp_rr,
            entry_type=args.entry_type,
            st_period=args.st_period,
            st_multiplier=args.st_multiplier,
            ma_period=args.ma_period,
            allow_long=args.allow_long,
            allow_short=args.allow_short
        )
    else:
        # Chạy quét danh sách cổ phiếu & chỉ số mặc định
        run_scanner(
            watchlist=["VNINDEX", "VN30F1M", "FPT", "HPG", "SSI", "MWG"],
            sync_history=True,
            rr_ratio=args.rr,
            tp_supertrend=args.tp_supertrend,
            tp_rr=args.tp_rr,
            entry_type=args.entry_type,
            st_period=args.st_period,
            st_multiplier=args.st_multiplier,
            ma_period=args.ma_period,
            allow_long=args.allow_long,
            allow_short=args.allow_short
        )


