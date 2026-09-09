import sys
import time
import re
import numpy as np
import pandas as pd
import requests
from datetime import datetime
from typing import List, Dict, Optional

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import os
import concurrent.futures

# ==============================================================================
# CẤU HÌNH HỆ THỐNG & CHIẾN LƯỢC (VWAP YEAR + MA9 STRATEGY)
# ==============================================================================
STRAPI_BASE_URL = os.environ.get("STRAPI_BASE_URL", "http://127.0.0.1:1337").rstrip("/")
STRAPI_API_TOKEN = os.environ.get("STRAPI_API_TOKEN", "")

# Tham số mặc định của chiến lược
DEFAULT_MA_PERIOD = 9             # Chu kỳ MA (mặc định MA9)
DEFAULT_VWAP_ANCHOR = "year"      # Anchor VWAP theo Year (Năm)
DEFAULT_MULT1 = 1.0               # Dải 1: Upper 1 / Lower 1 (1.0 Stdev)
DEFAULT_MULT2 = 2.0               # Dải 2: Upper 2 / Lower 2 (2.0 Stdev)
DEFAULT_MULT3 = 3.0               # Dải 3: Upper 3 / Lower 3 (3.0 Stdev)
DEFAULT_TP_TARGET = "tp1_vwap"    # Target Take Profit: "tp1_vwap" | "tp2_upper2" | "tp3_upper3"

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
    """Chuyển đổi Timeframe sang định dạng 24hMoney resolution (1, 5, 30, 240, 1D, 1W)"""
    tf = str(timeframe or "D1").strip().upper()
    mapping = {
        "M1": "1", "1M": "1",
        "M5": "5", "5M": "5",
        "M15": "15", "15M": "15",
        "M30": "30", "30M": "30",
        "H1": "60", "1H": "60",
        "H4": "240", "4H": "240",
        "D1": "1D", "1D": "1D", "D": "1D",
        "W1": "1W", "1W": "1W", "W": "1W"
    }
    return mapping.get(tf, "1D")

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
                    dt = datetime.utcfromtimestamp(open_time_ms / 1000.0)
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
                    df = df.sort_values("dt").reset_index(drop=True)
                    if len(df) > target_count:
                        df = df.tail(target_count).reset_index(drop=True)
                    return df
        except Exception:
            pass

    return pd.DataFrame()

def fetch_market_candles(ticker: str, resolution: str = "D1", countback: int = 500, timeframe: str = None) -> pd.DataFrame:
    """
    Quy trình chuẩn hóa 2 bước:
    1. Đọc dữ liệu từ Strapi symbol-histories theo đúng Timeframe đã chọn.
    2. Nếu Strapi chưa có hoặc thiếu nến, fetch từ External (Binance / 24hMoney) đúng Timeframe, 
       đồng bộ vào Strapi symbol-histories, sau đó đọc lại từ Strapi để chạy scan/optimize.
    """
    tf = str(timeframe or resolution or "D1").strip().upper()
    ticker_clean = ticker.strip().upper()
    req_count = max(int(countback), 500)

    # 1. Ưu tiên đọc trực tiếp từ Strapi symbol-histories theo đúng Timeframe
    df_strapi = fetch_history_from_strapi(ticker_clean, countback=req_count, timeframe=tf)
    if not df_strapi.empty and len(df_strapi) >= min(req_count, 50):
        return df_strapi

    # 2. Nếu Strapi chưa đủ nến -> Fetch từ External Provider theo đúng Timeframe
    df_external = pd.DataFrame()
    if is_crypto_symbol(ticker_clean):
        df_external = fetch_binance_candles(ticker_clean, countback=req_count, timeframe=tf)
    else:
        # 24hMoney cho Stock / Index / Derivatives
        resolution_24h = map_timeframe_to_24h(tf)
        if resolution_24h in ["1D", "D"]:
            step_sec = 86400
        elif resolution_24h in ["1W", "W"]:
            step_sec = 604800
        else:
            try:
                step_sec = int(resolution_24h) * 60
            except Exception:
                step_sec = 86400

        to_ts = int(time.time())
        from_ts = to_ts - int(req_count * 3.5 * step_sec)
        url_24h = f"https://api.24hmoney.vn/tradingview/history?symbol={ticker_clean}&resolution={resolution_24h}&from={from_ts}&to={to_ts}&countback={req_count}"

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
                        dt = datetime.utcfromtimestamp(data["t"][i])
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
                    df_external = df_external.sort_values("dt").reset_index(drop=True)
        except Exception:
            pass

    # Nếu chưa lấy được từ 24hMoney, thử lại Binance (cho trường hợp mã crypto dạng không có hậu tố .P)
    if df_external.empty:
        df_external = fetch_binance_candles(ticker_clean, countback=req_count, timeframe=tf)

    # 3. Đồng bộ nến mới nhất vào Strapi theo đúng Timeframe
    if not df_external.empty and len(df_external) > 0:
        symbol_id = get_or_create_symbol_in_strapi(ticker_clean)
        if symbol_id:
            sync_candles_to_strapi(ticker_clean, df_external, symbol_id, timeframe=tf, max_sync=req_count)

    # 4. Đọc dữ liệu trực tiếp từ Strapi symbol-histories theo đúng Timeframe
    df_strapi = fetch_history_from_strapi(ticker_clean, countback=req_count, timeframe=tf)
    if not df_strapi.empty and len(df_strapi) > 0:
        return df_strapi

    return df_external

# ==============================================================================
# 2. TÍNH TOÁN CHỈ BÁO: SMA & YEARLY ANCHORED VWAP KÈM BANDS
# ==============================================================================

def calculate_sma(df: pd.DataFrame, period: int = 9, price_col: str = "close") -> pd.Series:
    """Tính Simple Moving Average (SMA)"""
    return df[price_col].rolling(window=period).mean()

def calculate_anchored_vwap_with_bands(
    df: pd.DataFrame,
    anchor: str = "year",
    mult1: float = 1.0,
    mult2: float = 2.0,
    mult3: float = 3.0
) -> pd.DataFrame:
    """
    Tính Yearly Anchored VWAP kèm 3 dải độ lệch chuẩn Standard Deviation Bands:
    - VWAP
    - Upper 1 & Lower 1 (1.0 x Stdev)
    - Upper 2 & Lower 2 (2.0 x Stdev)
    - Upper 3 & Lower 3 (3.0 x Stdev)
    """
    n = len(df)
    vwap_arr = np.zeros(n)
    up1_arr = np.zeros(n)
    low1_arr = np.zeros(n)
    up2_arr = np.zeros(n)
    low2_arr = np.zeros(n)
    up3_arr = np.zeros(n)
    low3_arr = np.zeros(n)

    tp = (df['high'].values + df['low'].values + df['close'].values) / 3.0
    vol = df['volume'].values
    dates = pd.to_datetime(df['date']).values

    cum_pv = 0.0
    cum_vol = 0.0
    cum_tp2_vol = 0.0
    current_anchor_val = None

    for i in range(n):
        dt = pd.Timestamp(dates[i])
        anc = str(anchor or "year").lower().strip()
        if anc in ["day", "daily", "d"]:
            anchor_val = (dt.year, dt.month, dt.day)
        elif anc in ["week", "weekly", "w"]:
            anchor_val = (dt.year, dt.isocalendar().week)
        elif anc in ["month", "monthly", "m"]:
            anchor_val = (dt.year, dt.month)
        elif anc in ["quarter", "quarterly", "q"]:
            anchor_val = (dt.year, dt.quarter)
        else:
            anchor_val = dt.year

        if anchor_val != current_anchor_val:
            current_anchor_val = anchor_val
            cum_pv = 0.0
            cum_vol = 0.0
            cum_tp2_vol = 0.0

        v = vol[i] if vol[i] > 0 else 1.0
        p = tp[i]
        cum_pv += p * v
        cum_vol += v
        cum_tp2_vol += (p ** 2) * v

        vwap = cum_pv / cum_vol
        vwap_arr[i] = vwap

        variance = max(0.0, (cum_tp2_vol / cum_vol) - (vwap ** 2))
        stdev = np.sqrt(variance)

        up1_arr[i] = vwap + mult1 * stdev
        low1_arr[i] = vwap - mult1 * stdev
        up2_arr[i] = vwap + mult2 * stdev
        low2_arr[i] = vwap - mult2 * stdev
        up3_arr[i] = vwap + mult3 * stdev
        low3_arr[i] = vwap - mult3 * stdev

    df['vwap'] = vwap_arr
    df['vwap_upper1'] = up1_arr
    df['vwap_lower1'] = low1_arr
    df['vwap_upper2'] = up2_arr
    df['vwap_lower2'] = low2_arr
    df['vwap_upper3'] = up3_arr
    df['vwap_lower3'] = low3_arr

    return df

# ==============================================================================
# 3. QUY TẮC VÀO LỆNH & QUẢN LÝ VỊ THẾ (SINGLE POSITION LIFECYCLE)
# ==============================================================================

def scan_strategy_signals(
    df: pd.DataFrame,
    ma_period: int = DEFAULT_MA_PERIOD,
    vwap_anchor: str = DEFAULT_VWAP_ANCHOR,
    mult1: float = DEFAULT_MULT1,
    mult2: float = DEFAULT_MULT2,
    mult3: float = DEFAULT_MULT3,
    tp_target: str = DEFAULT_TP_TARGET,
    allow_long: bool = True,
    allow_short: bool = True
) -> Dict:
    """
    Quy tắc Chiến lược VWAP Year + MA9:
    1. Long Entry:
       - Giá đóng cửa trên MA9: close > ma9
       - Giá nằm trên Lower 2 của VWAP: close > vwap_lower2
       - MA9 nằm dưới VWAP: ma9 < vwap
    2. Take Profit (Long):
       - TP 1: Tại VWAP (high >= vwap)
       - TP 2: Tại Upper 2 (high >= vwap_upper2)
       - TP 3: Tại Upper 3 (high >= vwap_upper3)
    3. Stop Loss (Long):
       - Tại Lower 2 (low <= vwap_lower2)

    4. Short Entry (khi bật allow_short):
       - Giá đóng cửa dưới MA9: close < ma9
       - Giá nằm dưới Upper 2 của VWAP: close < vwap_upper2
       - MA9 nằm trên VWAP: ma9 > vwap
       - Stoploss: Upper 2 (high >= vwap_upper2)
       - Take Profit: TP1 (VWAP), TP2 (Lower 2), TP3 (Lower 3)
    """
    if len(df) < max(ma_period, 10):
        print(f"Cảnh báo: Dữ liệu có {len(df)} nến, cần tối thiểu {ma_period} nến để tính toán.", flush=True)
        return {"trades": [], "signals": []}

    df['ma'] = calculate_sma(df, period=ma_period, price_col='close')
    df = calculate_anchored_vwap_with_bands(df, anchor=vwap_anchor, mult1=mult1, mult2=mult2, mult3=mult3)

    trades = []
    signals = []
    current_trade = None

    for i in range(1, len(df)):
        row = df.iloc[i]
        candle_date = str(row['date'])
        time_str = candle_date[:10]
        close_p = float(row['close'])
        open_p = float(row['open'])
        high_p = float(row['high'])
        low_p = float(row['low'])
        ma_val = float(row['ma']) if not pd.isna(row['ma']) else None
        vwap_val = float(row['vwap']) if not pd.isna(row['vwap']) else None
        upper1_val = float(row['vwap_upper1']) if not pd.isna(row['vwap_upper1']) else None
        lower1_val = float(row['vwap_lower1']) if not pd.isna(row['vwap_lower1']) else None
        upper2_val = float(row['vwap_upper2']) if not pd.isna(row['vwap_upper2']) else None
        lower2_val = float(row['vwap_lower2']) if not pd.isna(row['vwap_lower2']) else None
        upper3_val = float(row['vwap_upper3']) if not pd.isna(row['vwap_upper3']) else None
        lower3_val = float(row['vwap_lower3']) if not pd.isna(row['vwap_lower3']) else None

        if ma_val is None or vwap_val is None or lower2_val is None or upper2_val is None:
            continue

        # -------------------------------------------------------------
        # 1. KIỂM TRA ĐÓNG LỆNH (NẾU ĐANG CÓ VỊ THẾ MỞ)
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
                # 1. Chạm Stop Loss (Thủng Lower 2)
                # Cập nhật trailing SL theo Lower 2 hiện tại hoặc dùng SL cố định lúc entry
                sl_check = lower2_val
                if low_p <= sl_check:
                    is_closed = True
                    exit_reason = 'StopLoss (Lower 2)'
                    exit_price = sl_check

                # 2. Chốt lời theo mục tiêu cấu hình
                elif tp_target == "tp3_upper3" and upper3_val and (high_p >= upper3_val):
                    is_closed = True
                    exit_reason = 'TakeProfit (Upper 3)'
                    exit_price = upper3_val
                elif tp_target == "tp2_upper2" and upper2_val and (high_p >= upper2_val):
                    is_closed = True
                    exit_reason = 'TakeProfit (Upper 2)'
                    exit_price = upper2_val
                elif (tp_target == "tp1_vwap" or tp_target is None) and (high_p >= vwap_val):
                    is_closed = True
                    exit_reason = 'TakeProfit (VWAP)'
                    exit_price = vwap_val

            elif pos_type == 'Short':
                # 1. Chạm Stop Loss (Vượt Upper 2)
                sl_check = upper2_val
                if high_p >= sl_check:
                    is_closed = True
                    exit_reason = 'StopLoss (Upper 2)'
                    exit_price = sl_check

                # 2. Chốt lời theo mục tiêu cấu hình
                elif tp_target == "tp3_upper3" and lower3_val and (low_p <= lower3_val):
                    is_closed = True
                    exit_reason = 'TakeProfit (Lower 3)'
                    exit_price = lower3_val
                elif tp_target == "tp2_upper2" and lower2_val and (low_p <= lower2_val):
                    is_closed = True
                    exit_reason = 'TakeProfit (Lower 2)'
                    exit_price = lower2_val
                elif (tp_target == "tp1_vwap" or tp_target is None) and (low_p <= vwap_val):
                    is_closed = True
                    exit_reason = 'TakeProfit (VWAP)'
                    exit_price = vwap_val

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

                current_trade = None
                continue

        # -------------------------------------------------------------
        # 2. TÌM KIẾM ENTRY MỚI (CHỈ KHI KHÔNG CÓ LỆNH ĐANG MỞ)
        # -------------------------------------------------------------
        if current_trade is None:
            # 1. KIỂM TRA ĐIỀU KIỆN LONG ENTRY
            # - Giá đóng cửa trên MA: close_p > ma_val
            # - Giá > Lower 2 của VWAP: close_p > lower2_val
            # - MA nằm dưới VWAP: ma_val < vwap_val
            is_long_entry = False
            if allow_long:
                is_close_above_ma = close_p > ma_val
                is_above_lower2 = close_p > lower2_val
                is_ma_below_vwap = ma_val < vwap_val
                is_long_entry = is_close_above_ma and is_above_lower2 and is_ma_below_vwap

            if is_long_entry:
                entry = close_p
                sl = round(lower2_val, 2)
                tp_val = vwap_val if tp_target == "tp1_vwap" else (upper2_val if tp_target == "tp2_upper2" else upper3_val)
                tp = round(tp_val, 2) if tp_val else None

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
                    "tp_target": tp_target,
                    "ma": round(ma_val, 2),
                    "vwap": round(vwap_val, 2),
                    "lower2": round(lower2_val, 2),
                    "upper2": round(upper2_val, 2),
                    "exit_date": None,
                    "exit_time": None,
                    "exit_price": None,
                    "exit_reason": None,
                    "pnl_percent": 0.0,
                    "pnl_amount": 0.0,
                }

                tp_label = "VWAP" if tp_target == "tp1_vwap" else ("Upper 2" if tp_target == "tp2_upper2" else "Upper 3")
                signals.append({
                    "date": candle_date,
                    "time": time_str,
                    "type": "Long",
                    "action": "Entry",
                    "entry": entry,
                    "price": entry,
                    "stop_loss": sl,
                    "take_profit": tp,
                    "ma": round(ma_val, 2),
                    "vwap": round(vwap_val, 2),
                    "rule": {
                        "Name": f"Long (VWAP+MA{ma_period}) Entry: {entry} | SL(Lower2): {sl} | TP({tp_label}): {tp}",
                        "Type": "entry"
                    }
                })
                continue

            # 2. KIỂM TRA ĐIỀU KIỆN SHORT ENTRY (khi bật allow_short)
            is_short_entry = False
            if allow_short:
                is_close_below_ma = close_p < ma_val
                is_below_upper2 = close_p < upper2_val
                is_ma_above_vwap = ma_val > vwap_val
                is_short_entry = is_close_below_ma and is_below_upper2 and is_ma_above_vwap

            if is_short_entry:
                entry = close_p
                sl = round(upper2_val, 2)
                tp_val = vwap_val if tp_target == "tp1_vwap" else (lower2_val if tp_target == "tp2_upper2" else lower3_val)
                tp = round(tp_val, 2) if tp_val else None

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
                    "tp_target": tp_target,
                    "ma": round(ma_val, 2),
                    "vwap": round(vwap_val, 2),
                    "upper2": round(upper2_val, 2),
                    "lower2": round(lower2_val, 2),
                    "exit_date": None,
                    "exit_time": None,
                    "exit_price": None,
                    "exit_reason": None,
                    "pnl_percent": 0.0,
                    "pnl_amount": 0.0,
                }

                tp_label = "VWAP" if tp_target == "tp1_vwap" else ("Lower 2" if tp_target == "tp2_upper2" else "Lower 3")
                signals.append({
                    "date": candle_date,
                    "time": time_str,
                    "type": "Short",
                    "action": "Entry",
                    "entry": entry,
                    "price": entry,
                    "stop_loss": sl,
                    "take_profit": tp,
                    "ma": round(ma_val, 2),
                    "vwap": round(vwap_val, 2),
                    "rule": {
                        "Name": f"Short (VWAP+MA{ma_period}) Entry: {entry} | SL(Upper2): {sl} | TP({tp_label}): {tp}",
                        "Type": "entry"
                    }
                })
                continue

    return {"trades": trades, "signals": signals}

# ==============================================================================
# 4. FAST BACKTEST EVAL & TỐI ƯU HÓA (OPTIMIZER)
# ==============================================================================

def fast_backtest_eval_vwap(
    close_arr: np.ndarray,
    high_arr: np.ndarray,
    low_arr: np.ndarray,
    ma_arr: np.ndarray,
    vwap_arr: np.ndarray,
    up2_arr: np.ndarray,
    low2_arr: np.ndarray,
    up3_arr: np.ndarray,
    low3_arr: np.ndarray,
    tp_target: str,
    allow_long: bool,
    allow_short: bool,
    start_idx: int
) -> Dict:
    """Mô phỏng backtest tốc độ cao bằng mảng numpy thuần túy để tối ưu hóa trong <1 giây"""
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
        high_p = high_arr[i]
        low_p = low_arr[i]
        ma_val = ma_arr[i]
        vwap_val = vwap_arr[i]
        up2_val = up2_arr[i]
        low2_val = low2_arr[i]
        up3_val = up3_arr[i]
        low3_val = low3_arr[i]

        if np.isnan(ma_val) or np.isnan(vwap_val):
            continue

        # 1. Kiểm tra đóng vị thế
        if current_pos_type != 0:
            is_closed = False
            exit_price = 0.0

            if current_pos_type == 1:  # Long
                if low_p <= low2_val:
                    is_closed = True
                    exit_price = low2_val
                elif tp_target == "tp3_upper3" and high_p >= up3_val:
                    is_closed = True
                    exit_price = up3_val
                elif tp_target == "tp2_upper2" and high_p >= up2_val:
                    is_closed = True
                    exit_price = up2_val
                elif (tp_target == "tp1_vwap" or tp_target is None) and high_p >= vwap_val:
                    is_closed = True
                    exit_price = vwap_val

            elif current_pos_type == -1:  # Short
                if high_p >= up2_val:
                    is_closed = True
                    exit_price = up2_val
                elif tp_target == "tp3_upper3" and low_p <= low3_val:
                    is_closed = True
                    exit_price = low3_val
                elif tp_target == "tp2_upper2" and low_p <= low2_val:
                    is_closed = True
                    exit_price = low2_val
                elif (tp_target == "tp1_vwap" or tp_target is None) and low_p <= vwap_val:
                    is_closed = True
                    exit_price = vwap_val

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

        # 2. Kiểm tra vào lệnh mới
        if current_pos_type == 0:
            is_long_entry = False
            if allow_long:
                is_long_entry = (close_p > ma_val) and (close_p > low2_val) and (ma_val < vwap_val)

            if is_long_entry:
                entry = close_p
                sl = low2_val
                tp = vwap_val if tp_target == "tp1_vwap" else (up2_val if tp_target == "tp2_upper2" else up3_val)
                current_pos_type = 1
                entry_p = entry
                sl_p = sl
                tp_p = tp
                total_trades += 1
                continue

            is_short_entry = False
            if allow_short:
                is_short_entry = (close_p < ma_val) and (close_p < up2_val) and (ma_val > vwap_val)

            if is_short_entry:
                entry = close_p
                sl = up2_val
                tp = vwap_val if tp_target == "tp1_vwap" else (low2_val if tp_target == "tp2_upper2" else low3_val)
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
    vwap_anchor: str = "year"
) -> Dict:
    """
    Tự động quét Grid Search tìm bộ tham số MA, VWAP Bands và TP Target
    mang lại Profit Factor cao nhất dựa trên TOÀN BỘ dữ liệu có trong Strapi.
    """
    req_count = 50000 if not countback or int(countback) < 5000 else int(countback)
    df = fetch_market_candles(ticker, countback=req_count, timeframe=timeframe)
    if df.empty or len(df) < 30:
        return {
            "ticker": ticker,
            "error": f"Không đủ dữ liệu lịch sử nến cho {ticker} (có {len(df)} nến)",
            "candles": [],
            "signals": [],
            "trades": []
        }

    close_arr = df['close'].values
    high_arr = df['high'].values
    low_arr = df['low'].values
    n = len(df)

    ma_period_grid = [5, 7, 9, 13, 20, 34, 50]
    ma_period_grid = [m for m in ma_period_grid if m <= n - 10]
    if not ma_period_grid:
        ma_period_grid = [min(9, n - 5)]

    tp_target_grid = ["tp1_vwap", "tp2_upper2", "tp3_upper3"]
    mult2_grid = [1.5, 2.0, 2.5]
    mult3_grid = [2.5, 3.0, 3.5]

    # Precalculate MA
    ma_cache = {}
    for m in ma_period_grid:
        ma_series = calculate_sma(df, period=m, price_col='close')
        ma_cache[m] = ma_series.values

    # Precalculate VWAP Bands
    clean_anchor = str(vwap_anchor or "year").lower().strip()
    vwap_cache = {}
    for m2 in mult2_grid:
        for m3 in mult3_grid:
            df_vwap = calculate_anchored_vwap_with_bands(df.copy(), anchor=clean_anchor, mult1=1.0, mult2=m2, mult3=m3)
            vwap_cache[(m2, m3)] = {
                "vwap": df_vwap['vwap'].values,
                "up2": df_vwap['vwap_upper2'].values,
                "low2": df_vwap['vwap_lower2'].values,
                "up3": df_vwap['vwap_upper3'].values,
                "low3": df_vwap['vwap_lower3'].values,
            }

    # Phân loại độ tin cậy mẫu (Sample Size Reliability Tiers) dựa trên tổng số nến n
    target_trades = max(15, min(30, int(n / 35))) if n >= 300 else max(8, int(n / 25))
    min_solid_trades = max(8, min(15, int(n / 60)))
    start_idx = max(max(ma_period_grid), 10)

    best_score = None
    best_combo = None

    for m in ma_period_grid:
        ma_arr = ma_cache[m]
        for m2 in mult2_grid:
            for m3 in mult3_grid:
                v_data = vwap_cache[(m2, m3)]
                for tp_t in tp_target_grid:
                    res = fast_backtest_eval_vwap(
                        close_arr=close_arr,
                        high_arr=high_arr,
                        low_arr=low_arr,
                        ma_arr=ma_arr,
                        vwap_arr=v_data["vwap"],
                        up2_arr=v_data["up2"],
                        low2_arr=v_data["low2"],
                        up3_arr=v_data["up3"],
                        low3_arr=v_data["low3"],
                        tp_target=tp_t,
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
                    # Thưởng điểm cho số lượng lệnh mẫu sqrt(closed), PF thực tế và PnL
                    trade_weight = np.sqrt(closed)
                    wr_factor = 1.0 if wr >= 40.0 else max(0.2, wr / 40.0)
                    pnl_weight = max(0.1, pnl) if pnl > 0 else (pnl / 10.0)

                    fitness = capped_pf * trade_weight * pnl_weight * wr_factor

                    score = (tier, round(fitness, 4), pnl, capped_pf, closed)

                    if best_score is None or score > best_score:
                        best_score = score
                        best_combo = {
                            "ma_period": m,
                            "tp_target": tp_t,
                            "mult2": m2,
                            "mult3": m3
                        }

    if not best_combo:
        best_combo = {
            "ma_period": DEFAULT_MA_PERIOD,
            "tp_target": DEFAULT_TP_TARGET,
            "mult2": DEFAULT_MULT2,
            "mult3": DEFAULT_MULT3
        }

    # Chạy lại bản chi tiết với combo tối ưu nhất trên TOÀN BỘ tập nến
    full_result = scan_symbol_json(
        ticker=ticker,
        countback=len(df),
        ma_period=best_combo["ma_period"],
        vwap_anchor=clean_anchor,
        mult1=DEFAULT_MULT1,
        mult2=best_combo["mult2"],
        mult3=best_combo["mult3"],
        tp_target=best_combo["tp_target"],
        allow_long=allow_long,
        allow_short=allow_short,
        timeframe=timeframe
    )

    full_result["bestParams"] = {
        "maPeriod": best_combo["ma_period"],
        "tpTarget": best_combo["tp_target"],
        "mult2": best_combo["mult2"],
        "mult3": best_combo["mult3"],
        "vwapAnchor": clean_anchor,
        "allowLong": allow_long,
        "allowShort": allow_short,
        "profitFactor": full_result.get("summary", {}).get("profitFactor", 0.0),
        "winRate": full_result.get("summary", {}).get("winRate", 0.0),
        "totalTrades": full_result.get("summary", {}).get("totalTrades", 0),
        "totalPnlPercent": full_result.get("summary", {}).get("totalPnlPercent", 0.0),
        "closedTrades": full_result.get("summary", {}).get("closedTrades", 0)
    }

    return full_result

# ==============================================================================
# 5. SCAN SYMBOL JSON CHO FRONTEND & BACKEND CONTROLLER
# ==============================================================================

def scan_symbol_json(
    ticker: str,
    countback: int = 500,
    ma_period: int = DEFAULT_MA_PERIOD,
    vwap_anchor: str = DEFAULT_VWAP_ANCHOR,
    mult1: float = DEFAULT_MULT1,
    mult2: float = DEFAULT_MULT2,
    mult3: float = DEFAULT_MULT3,
    tp_target: str = DEFAULT_TP_TARGET,
    allow_long: bool = True,
    allow_short: bool = True,
    timeframe: str = "D1"
) -> Dict:
    """Quét dữ liệu và trả về JSON chuẩn để hiển thị trên UI Chart & Table"""
    df = fetch_market_candles(ticker, countback=countback, timeframe=timeframe)
    if df.empty or len(df) < max(ma_period, 10):
        return {
            "ticker": ticker,
            "error": f"Khong du du lieu (co {len(df)} nen, can toi thieu {ma_period} nen)",
            "candles": [],
            "signals": [],
            "trades": [],
            "summary": {}
        }

    # 1. Tính toán Indicators
    df['ma'] = calculate_sma(df, period=ma_period, price_col='close')
    df = calculate_anchored_vwap_with_bands(df, anchor=vwap_anchor, mult1=mult1, mult2=mult2, mult3=mult3)

    # 2. Quét Tín hiệu & Lệnh
    res = scan_strategy_signals(
        df,
        ma_period=ma_period,
        vwap_anchor=vwap_anchor,
        mult1=mult1,
        mult2=mult2,
        mult3=mult3,
        tp_target=tp_target,
        allow_long=allow_long,
        allow_short=allow_short
    )
    trades = res.get("trades", [])
    signals = res.get("signals", [])

    # 3. Chuẩn bị dữ liệu nến cho Lightweight Chart
    candles_list = []
    for _, r in df.iterrows():
        candles_list.append({
            "date": str(r["date"]),
            "time": r.get("time", str(r["date"])[:10]),
            "open": float(r["open"]),
            "high": float(r["high"]),
            "low": float(r["low"]),
            "close": float(r["close"]),
            "volume": float(r.get("volume", 0)),
            "ma": round(float(r["ma"]), 2) if pd.notna(r["ma"]) else None,
            "vwap": round(float(r["vwap"]), 2) if pd.notna(r["vwap"]) else None,
            "upper1": round(float(r["vwap_upper1"]), 2) if pd.notna(r["vwap_upper1"]) else None,
            "lower1": round(float(r["vwap_lower1"]), 2) if pd.notna(r["vwap_lower1"]) else None,
            "upper2": round(float(r["vwap_upper2"]), 2) if pd.notna(r["vwap_upper2"]) else None,
            "lower2": round(float(r["vwap_lower2"]), 2) if pd.notna(r["vwap_lower2"]) else None,
            "upper3": round(float(r["vwap_upper3"]), 2) if pd.notna(r["vwap_upper3"]) else None,
            "lower3": round(float(r["vwap_lower3"]), 2) if pd.notna(r["vwap_lower3"]) else None,
        })

    # 4. Thống kê hiệu suất
    closed_trades = [t for t in trades if t.get("status") == "Closed"]
    win_trades = [t for t in closed_trades if str(t.get("exit_reason", "")).startswith("TakeProfit") or t.get("pnl_percent", 0) > 0]
    loss_trades = [t for t in closed_trades if t not in win_trades]
    active_trade = next((t for t in trades if t.get("status") == "Open"), None)

    win_rate = round(len(win_trades) / len(closed_trades) * 100, 2) if closed_trades else 0.0
    total_pnl_percent = round(sum(t.get("pnl_percent", 0) for t in closed_trades), 2)
    gross_profit = sum(t.get("pnl_percent", 0) for t in closed_trades if t.get("pnl_percent", 0) > 0)
    gross_loss = sum(abs(t.get("pnl_percent", 0)) for t in closed_trades if t.get("pnl_percent", 0) < 0)
    profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else (round(gross_profit, 2) if gross_profit > 0 else 0.0)

    last_candle = candles_list[-1] if candles_list else {}

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
            "currentPrice": last_candle.get("close"),
            "ma": last_candle.get("ma"),
            "vwap": last_candle.get("vwap"),
            "lower2": last_candle.get("lower2"),
            "upper2": last_candle.get("upper2"),
        }
    }

# ==============================================================================
# 6. CLI ENTRY POINT
# ==============================================================================

if __name__ == "__main__":
    import argparse
    import json

    parser = argparse.ArgumentParser(description="VWAP + MA9 Strategy Scanner & Optimizer")
    parser.add_argument("--ticker", type=str, default=None, help="Mã cổ phiếu cần quét (e.g. FPT, VNINDEX, VN30F1M)")
    parser.add_argument("--timeframe", type=str, default="D1", help="Timeframe (M1, M5, M30, H4, D1, W1)")
    parser.add_argument("--json", action="store_true", help="Trả về kết quả định dạng JSON")
    parser.add_argument("--optimize", action="store_true", help="Tự động tìm bộ tham số mang lại Profit Factor cao nhất")
    parser.add_argument("--countback", type=int, default=500, help="Số lượng nến lịch sử cần lấy")
    parser.add_argument("--ma-period", type=int, default=DEFAULT_MA_PERIOD, help="MA Period (SMA, mặc định 9)")
    parser.add_argument("--vwap-anchor", type=str, default=DEFAULT_VWAP_ANCHOR, choices=["day", "daily", "week", "weekly", "month", "monthly", "quarter", "quarterly", "year", "yearly"], help="Chu kỳ Anchor cho VWAP")
    parser.add_argument("--mult1", type=float, default=DEFAULT_MULT1, help="Hệ số dải 1 (Upper1/Lower1)")
    parser.add_argument("--mult2", type=float, default=DEFAULT_MULT2, help="Hệ số dải 2 (Upper2/Lower2)")
    parser.add_argument("--mult3", type=float, default=DEFAULT_MULT3, help="Hệ số dải 3 (Upper3/Lower3)")
    parser.add_argument("--tp-target", type=str, default=DEFAULT_TP_TARGET, choices=["tp1_vwap", "tp2_upper2", "tp3_upper3"], help="Mục tiêu chốt lời")

    # Lựa chọn loại lệnh: Long / Short
    parser.add_argument("--allow-long", dest="allow_long", action="store_true", default=True, help="Cho phép mở lệnh Long")
    parser.add_argument("--no-long", dest="allow_long", action="store_false", help="Không mở lệnh Long")
    parser.add_argument("--allow-short", dest="allow_short", action="store_true", default=True, help="Cho phép mở lệnh Short")
    parser.add_argument("--no-short", dest="allow_short", action="store_false", help="Không mở lệnh Short")

    args = parser.parse_args()

    if args.optimize:
        ticker = args.ticker or "VNINDEX"
        res = optimize_strategy_parameters(
            ticker=ticker,
            countback=args.countback,
            allow_long=args.allow_long,
            allow_short=args.allow_short,
            timeframe=args.timeframe,
            vwap_anchor=args.vwap_anchor
        )
        if args.json:
            print(json.dumps(res, ensure_ascii=False))
        else:
            bp = res.get("bestParams", {})
            print(f"[*] THAM SỐ TỐI ƯU NHẤT CHO {ticker} ({args.timeframe}):")
            print(f"    - MA Period: {bp.get('maPeriod')}")
            print(f"    - TP Target: {bp.get('tpTarget')}")
            print(f"    - Mult2: {bp.get('mult2')} | Mult3: {bp.get('mult3')}")
            print(f"    -> Profit Factor: {bp.get('profitFactor')} | Win Rate: {bp.get('winRate')}% | PnL: {bp.get('totalPnlPercent')}%")
    elif args.json:
        ticker = args.ticker or "VNINDEX"
        res = scan_symbol_json(
            ticker=ticker,
            countback=args.countback,
            ma_period=args.ma_period,
            vwap_anchor=args.vwap_anchor,
            mult1=args.mult1,
            mult2=args.mult2,
            mult3=args.mult3,
            tp_target=args.tp_target,
            allow_long=args.allow_long,
            allow_short=args.allow_short,
            timeframe=args.timeframe
        )
        print(json.dumps(res, ensure_ascii=False))
    else:
        # CLI print
        ticker = args.ticker or "VNINDEX"
        res = scan_symbol_json(
            ticker=ticker,
            countback=args.countback,
            ma_period=args.ma_period,
            vwap_anchor=args.vwap_anchor,
            mult1=args.mult1,
            mult2=args.mult2,
            mult3=args.mult3,
            tp_target=args.tp_target,
            allow_long=args.allow_long,
            allow_short=args.allow_short,
            timeframe=args.timeframe
        )
        print(f"[*] Quét hoàn tất cho {ticker}: {res.get('summary')}")
