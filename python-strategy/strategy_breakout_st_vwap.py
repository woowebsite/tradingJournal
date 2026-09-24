import sys
import os
import time
import json
import re
import warnings
warnings.filterwarnings('ignore')
import numpy as np
import pandas as pd
import requests
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import concurrent.futures

# ==============================================================================
# CẤU HÌNH HỆ THỐNG & CHIẾN LƯỢC: BREAKOUT + SUPERTREND & YEARLY VWAP
# ==============================================================================
# Quy tắc vào lệnh:
# 1. LONG / MUA:
#    - Rule 1 (Breakout High): Vượt đỉnh hôm trước (high[i] > high[i-1]), Supertrend Up -> Stoploss: Đáy hiện tại (low[i])
#    - Rule 2 (Sweep Low / Phá Đáy): Phá đáy hôm trước (low[i] < low[i-1]) kết hợp 1 trong 2 điều kiện:
#           + Supertrend (10,3) đang Up
#           + Hoặc Giá nằm trên VWAP (Year)
#           -> Stoploss: Khoảng Spread (SP 75) sau khi entry
# 2. SHORT / BÁN (Symmetrical):
#    - Rule 1 (Breakdown Low): Phá đáy hôm trước (low[i] < low[i-1]), Supertrend Down -> Stoploss: Đỉnh hiện tại (high[i])
#    - Rule 2 (Sweep High / Vượt Đỉnh): Vượt đỉnh hôm trước (high[i] > high[i-1]) kết hợp 1 trong 2 điều kiện:
#           + Supertrend (10,3) đang Down
#           + Hoặc Giá nằm dưới VWAP (Year)
#           -> Stoploss: Khoảng Spread (SP 75) sau khi entry
# ==============================================================================

STRAPI_BASE_URL = os.environ.get("STRAPI_BASE_URL", "http://127.0.0.1:1337").rstrip("/")
STRAPI_API_TOKEN = os.environ.get("STRAPI_API_TOKEN", "")

SUPERTREND_PERIOD = 10
SUPERTREND_MULTIPLIER = 3.0
VWAP_ANCHOR = "year"

def get_strapi_headers() -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if STRAPI_API_TOKEN:
        headers["Authorization"] = f"Bearer {STRAPI_API_TOKEN}"
    return headers

def is_crypto_symbol(ticker: str) -> bool:
    clean = ticker.strip().upper()
    if clean.endswith(".P") or "PERP" in clean or clean.startswith("BINANCE:"):
        return True
    if any(clean.endswith(quote) for quote in ["USDT", "BUSD", "USDC", "FDUSD", "TUSD"]):
        return True
    return False

def map_timeframe_to_binance(timeframe: str) -> str:
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

def fetch_binance_candles(ticker: str, countback: int = 500, timeframe: str = "D1") -> pd.DataFrame:
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
                url = f"{base_url}?symbol={symbol}&interval={interval}&limit={limit}"
                if current_end_time:
                    url += f"&endTime={current_end_time}"

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

            if all_raw:
                seen_times = set()
                candles = []
                for item in all_raw:
                    ts = item[0]
                    if ts in seen_times:
                        continue
                    seen_times.add(ts)

                    dt = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
                    time_str = dt.strftime("%Y-%m-%d") if is_daily_or_weekly else dt.strftime("%H:%M:%S")
                    iso_str = dt.strftime("%Y-%m-%dT00:00:00.000Z") if is_daily_or_weekly else dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")

                    candles.append({
                        "date": iso_str,
                        "time": time_str,
                        "open": float(item[1]),
                        "high": float(item[2]),
                        "low": float(item[3]),
                        "close": float(item[4]),
                        "volume": float(item[5])
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
                res = requests.get(url, headers=headers, timeout=10)
                if res.status_code != 200:
                    break

                res_json = res.json()
                batch = res_json.get("data", [])
                if not batch:
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
                    candles.append({
                        "date": dt.strftime("%Y-%m-%dT00:00:00.000Z") if is_daily_or_weekly else dt.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                        "time": dt.strftime("%Y-%m-%d") if is_daily_or_weekly else dt.strftime("%H:%M:%S"),
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

def clean_candle_df(df: pd.DataFrame) -> pd.DataFrame:
    """Làm sạch DataFrame nến, loại bỏ các nến có giá <= 0 hoặc NaN, đảm bảo không bị lỗi chia 0"""
    if df is None or df.empty or len(df) == 0:
        return pd.DataFrame()
    req_cols = ['open', 'high', 'low', 'close', 'date']
    if not all(col in df.columns for col in req_cols):
        return pd.DataFrame()
    df = df.copy()
    for col in ['open', 'high', 'low', 'close', 'volume']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    df = df.dropna(subset=['open', 'high', 'low', 'close'])
    df = df[(df['open'] > 0) & (df['high'] > 0) & (df['low'] > 0) & (df['close'] > 0)]
    if 'volume' in df.columns:
        df['volume'] = df['volume'].fillna(0.0).clip(lower=0.0)
    if 'dt' not in df.columns:
        df['dt'] = pd.to_datetime(df['date'])
    df = df.drop_duplicates(subset=['date']).sort_values('dt').reset_index(drop=True)
    return df

def fetch_market_candles(ticker: str, resolution: str = "D1", countback: int = 500, timeframe: str = None) -> pd.DataFrame:
    tf = str(timeframe or resolution or "D1").strip().upper()
    ticker_clean = ticker.strip().upper()
    req_count = max(int(countback), 500)

    if is_crypto_symbol(ticker_clean):
        df_binance = fetch_binance_candles(ticker_clean, countback=req_count, timeframe=tf)
        cleaned_binance = clean_candle_df(df_binance)
        if not cleaned_binance.empty and len(cleaned_binance) > 0:
            return cleaned_binance

    resolution_24h = map_timeframe_to_24h(tf)
    to_ts = int(time.time())
    from_ts = get_24h_from_timestamp(resolution_24h, req_count, to_ts)
    url_24h = f"https://api.24hmoney.vn/tradingview/history?symbol={ticker_clean}&resolution={resolution_24h}&from={from_ts}&to={to_ts}&countback={min(req_count, 10000)}"
    is_daily_or_weekly = tf in ["D1", "1D", "D", "W1", "1W", "W"]

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
                    c_val = float(data["c"][i]) * multiplier
                    if c_val <= 0 or pd.isna(c_val):
                        continue
                    o_val = float(data["o"][i]) * multiplier if float(data["o"][i]) > 0 else c_val
                    h_val = float(data["h"][i]) * multiplier if float(data["h"][i]) > 0 else max(o_val, c_val)
                    l_val = float(data["l"][i]) * multiplier if float(data["l"][i]) > 0 else min(o_val, c_val)

                    dt = datetime.fromtimestamp(data["t"][i], tz=timezone.utc)
                    candles.append({
                        "date": dt.strftime("%Y-%m-%dT00:00:00.000Z") if is_daily_or_weekly else dt.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                        "time": dt.strftime("%Y-%m-%d") if is_daily_or_weekly else dt.strftime("%H:%M:%S"),
                        "open": round(o_val, 2),
                        "high": round(h_val, 2),
                        "low": round(l_val, 2),
                        "close": round(c_val, 2),
                        "volume": float(data["v"][i]) if data.get("v") else 0.0,
                    })
                df_ext = pd.DataFrame(candles)
                cleaned_ext = clean_candle_df(df_ext)
                if not cleaned_ext.empty and len(cleaned_ext) > 0:
                    return cleaned_ext
    except Exception:
        pass

    # Yahoo Finance fallback for US/Global indices & stocks
    df_yahoo = fetch_yahoo_candles(ticker_clean, countback=req_count, timeframe=tf)
    cleaned_yahoo = clean_candle_df(df_yahoo)
    if not cleaned_yahoo.empty and len(cleaned_yahoo) > 0:
        return cleaned_yahoo

    df_strapi = fetch_history_from_strapi(ticker_clean, countback=req_count, timeframe=tf)
    return clean_candle_df(df_strapi)


# ==============================================================================
# 2. TÍNH TOÁN CHỈ BÁO: SUPERTREND, ANCHORED VWAP & SPREAD PERCENTILES
# ==============================================================================

def calculate_supertrend(df: pd.DataFrame, period: int = 10, multiplier: float = 3.0) -> Tuple[pd.Series, pd.Series]:
    """
    Tính Supertrend tiêu chuẩn:
    - Trả về: (supertrend_series, direction_series) với 1 = Up (Bullish), -1 = Down (Bearish)
    """
    if len(df) < period:
        return pd.Series([np.nan] * len(df), index=df.index), pd.Series([0] * len(df), index=df.index)

    high = df['high'].values
    low = df['low'].values
    close = df['close'].values

    hl2 = (high + low) / 2.0
    prev_close = np.roll(close, 1)
    prev_close[0] = close[0]

    tr1 = high - low
    tr2 = np.abs(high - prev_close)
    tr3 = np.abs(low - prev_close)
    tr = np.maximum(tr1, np.maximum(tr2, tr3))

    atr = np.zeros(len(df))
    atr[period - 1] = np.mean(tr[:period])
    for i in range(period, len(df)):
        atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period

    basic_upper = hl2 + (multiplier * atr)
    basic_lower = hl2 - (multiplier * atr)

    final_upper = np.copy(basic_upper)
    final_lower = np.copy(basic_lower)
    supertrend = np.zeros(len(df))
    direction = np.zeros(len(df), dtype=int)

    for i in range(period, len(df)):
        if basic_upper[i] < final_upper[i - 1] or close[i - 1] > final_upper[i - 1]:
            final_upper[i] = basic_upper[i]
        else:
            final_upper[i] = final_upper[i - 1]

        if basic_lower[i] > final_lower[i - 1] or close[i - 1] < final_lower[i - 1]:
            final_lower[i] = basic_lower[i]
        else:
            final_lower[i] = final_lower[i - 1]

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

def calculate_anchored_vwap(
    df: pd.DataFrame,
    anchor: str = "year",
    mult1: float = 1.0,
    mult2: float = 2.0,
    mult3: float = 3.0
) -> pd.DataFrame:
    """
    Tính Anchored VWAP (mặc định Yearly) kèm các dải Standard Deviation Bands
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

    res_df = pd.DataFrame({
        "vwap": vwap_arr,
        "vwap_upper1": up1_arr,
        "vwap_lower1": low1_arr,
        "vwap_upper2": up2_arr,
        "vwap_lower2": low2_arr,
        "vwap_upper3": up3_arr,
        "vwap_lower3": low3_arr,
    }, index=df.index)

    return res_df

def calculate_spread_percentiles(df: pd.DataFrame) -> Dict[str, float]:
    if df.empty or len(df) == 0:
        return {
            "minPrice": 0, "p25Price": 0, "medianPrice": 0, "p75Price": 0, "p90Price": 0, "p99Price": 0, "maxPrice": 0, "avgPrice": 0,
            "minPercent": 0, "p25Percent": 0, "medianPercent": 0, "p75Percent": 0, "p90Percent": 0, "p99Percent": 0, "maxPercent": 0, "avgPercent": 0
        }

    price_spreads = (df['high'] - df['low']).clip(lower=0).values
    base_prices = np.where(df['low'].values > 0, df['low'].values, np.where(df['open'].values > 0, df['open'].values, 1.0))
    percent_spreads = (price_spreads / base_prices) * 100.0

    return {
        "minPrice": round(float(np.min(price_spreads)), 4),
        "p25Price": round(float(np.percentile(price_spreads, 25)), 4),
        "medianPrice": round(float(np.percentile(price_spreads, 50)), 4),
        "p75Price": round(float(np.percentile(price_spreads, 75)), 4),
        "p90Price": round(float(np.percentile(price_spreads, 90)), 4),
        "p99Price": round(float(np.percentile(price_spreads, 99)), 4),
        "maxPrice": round(float(np.max(price_spreads)), 4),
        "avgPrice": round(float(np.mean(price_spreads)), 4),

        "minPercent": round(float(np.min(percent_spreads)), 2),
        "p25Percent": round(float(np.percentile(percent_spreads, 25)), 2),
        "medianPercent": round(float(np.percentile(percent_spreads, 50)), 2),
        "p75Percent": round(float(np.percentile(percent_spreads, 75)), 2),
        "p90Percent": round(float(np.percentile(percent_spreads, 90)), 2),
        "p99Percent": round(float(np.percentile(percent_spreads, 99)), 2),
        "maxPercent": round(float(np.max(percent_spreads)), 2),
        "avgPercent": round(float(np.mean(percent_spreads)), 2)
    }

# ==============================================================================
# 3. CORE STRATEGY LOGIC & BACKTESTING ENGINE
# ==============================================================================

def scan_strategy_signals(
    df: pd.DataFrame,
    st_period: int = 10,
    st_multiplier: float = 3.0,
    vwap_anchor: str = "year",
    allow_long: bool = True,
    allow_short: bool = True,
    allow_breakout_high: bool = True,
    allow_sweep_low: bool = True,
    indicator_filter: str = "st_or_vwap", # "st_or_vwap", "st_and_vwap", "st_only", "vwap_only", "none"
    vwap_band_filter: str = "all", # "all", "inside", "outside"
    tp_type: str = "P90",
    sl_type: str = "P75",
    tp_supertrend: bool = False,
    custom_tp_val: float = 0.0,
    custom_sl_val: float = 0.0,
    risk_reward: float = 1.5,
    spread_stats: Dict = None
) -> Dict:
    """
    Quét và backtest chiến lược Supertrend + Yearly VWAP + Breakout / Sweep:
    - Long Setup 1: Vượt đỉnh hôm trước (high[i] > high[i-1]), Supertrend Up -> SL = Đáy hiện tại (low[i])
    - Long Setup 2: Phá đáy hôm trước (low[i] < low[i-1]), Supertrend Up HOẶC Giá > VWAP (Year) -> SL = Entry - SP75
    - Short Setup 1: Phá đáy hôm trước (low[i] < low[i-1]), Supertrend Down -> SL = Đỉnh hiện tại (high[i])
    - Short Setup 2: Vượt đỉnh hôm trước (high[i] > high[i-1]), Supertrend Down HOẶC Giá < VWAP (Year) -> SL = Entry + SP75
    - VWAP Band Filter: "all" (Tất cả), "inside" (Entry trong Upperband 1 & Lowerband 1), "outside" (Entry ngoài Upperband 1 & Lowerband 1)
    """
    if len(df) < max(st_period, 5) + 2:
        return {"trades": [], "signals": [], "spreadStats": spread_stats or {}}

    if spread_stats is None:
        spread_stats = calculate_spread_percentiles(df)

    # 1. Tính toán Indicators
    st_series, st_dir_series = calculate_supertrend(df, period=st_period, multiplier=st_multiplier)
    vwap_df = calculate_anchored_vwap(df, anchor=vwap_anchor)

    df = df.copy()
    df['supertrend'] = st_series
    df['st_dir'] = st_dir_series
    df['vwap'] = vwap_df['vwap']
    df['vwap_upper1'] = vwap_df['vwap_upper1']
    df['vwap_lower1'] = vwap_df['vwap_lower1']
    df['vwap_upper2'] = vwap_df['vwap_upper2']
    df['vwap_lower2'] = vwap_df['vwap_lower2']
    df['vwap_upper3'] = vwap_df['vwap_upper3']
    df['vwap_lower3'] = vwap_df['vwap_lower3']

    # 2. Tính khoảng cách TP & SL mặc định theo Spread Percentile
    sp75_val = float(spread_stats.get("p75Price", 0))
    if sp75_val <= 0:
        sp75_val = float(df['close'].iloc[-1] * 0.02)

    def get_spread_val(target_type: str, custom_val: float) -> float:
        t_type = str(target_type or "").upper()
        if t_type == "CUSTOM" and custom_val > 0:
            return float(custom_val)
        if t_type == "P25": return float(spread_stats.get("p25Price", 0))
        if t_type == "P50": return float(spread_stats.get("medianPrice", 0))
        if t_type == "P75": return float(spread_stats.get("p75Price", 0))
        if t_type == "P90": return float(spread_stats.get("p90Price", 0))
        if t_type == "P99": return float(spread_stats.get("p99Price", 0))
        return float(spread_stats.get("medianPrice", 0))

    tp_dist_spread = get_spread_val(tp_type, custom_tp_val)
    if tp_dist_spread <= 0:
        tp_dist_spread = sp75_val * 1.5

    sl_dist_spread = get_spread_val(sl_type, custom_sl_val)
    if sl_dist_spread <= 0:
        sl_dist_spread = sp75_val

    trades = []
    signals = []
    current_trade = None

    start_idx = max(st_period, 5)

    for i in range(start_idx, len(df)):
        row = df.iloc[i]
        prev_row = df.iloc[i - 1]

        candle_date = str(row['date'])
        time_str = str(row.get('time', ''))
        open_p = float(row['open'])
        high_p = float(row['high'])
        low_p = float(row['low'])
        close_p = float(row['close'])

        prev_high = float(prev_row['high'])
        prev_low = float(prev_row['low'])

        st_val = float(row['supertrend']) if pd.notna(row['supertrend']) else 0.0
        st_dir = int(row['st_dir']) if pd.notna(row['st_dir']) else 0
        vwap_val = float(row['vwap']) if pd.notna(row['vwap']) else 0.0
        vwap_up1 = float(row['vwap_upper1']) if pd.notna(row['vwap_upper1']) else 0.0
        vwap_low1 = float(row['vwap_lower1']) if pd.notna(row['vwap_lower1']) else 0.0

        # Kiểm tra điều kiện bộ lọc Trend Indicator
        is_st_up = (st_dir == 1)
        is_st_down = (st_dir == -1)
        is_vwap_up = (close_p > vwap_val) if vwap_val > 0 else True
        is_vwap_down = (close_p < vwap_val) if vwap_val > 0 else True

        filter_mode = str(indicator_filter or "st_or_vwap").lower()
        if filter_mode == "st_and_vwap":
            trend_up = is_st_up and is_vwap_up
            trend_down = is_st_down and is_vwap_down
        elif filter_mode == "st_only":
            trend_up = is_st_up
            trend_down = is_st_down
        elif filter_mode == "vwap_only":
            trend_up = is_vwap_up
            trend_down = is_vwap_down
        elif filter_mode == "none":
            trend_up = True
            trend_down = True
        else: # st_or_vwap (mặc định: ST Up HOẶC Giá > VWAP)
            trend_up = is_st_up or is_vwap_up
            trend_down = is_st_down or is_vwap_down

        # -------------------------------------------------------------
        # 1. QUẢN LÝ LỆNH ĐANG MỞ (CLOSE LỆNH THEO TP / SL / ST REVERSAL)
        # -------------------------------------------------------------
        if current_trade is not None:
            pos_type = current_trade['type']
            entry_p = current_trade['entry_price']
            sl_p = current_trade['stop_loss']
            tp_p = current_trade['take_profit']
            holding_bars = i - current_trade['entry_index']

            is_closed = False
            exit_reason = ''
            exit_price = close_p

            if pos_type == 'Long':
                if low_p <= sl_p:
                    is_closed = True
                    exit_reason = f"StopLoss ({current_trade.get('sl_type_label', 'SL')})"
                    exit_price = min(open_p, sl_p) if open_p < sl_p else sl_p
                elif tp_type in ["close_today", "close_current_bar"] and holding_bars >= 0:
                    is_closed = True
                    exit_reason = "TakeProfit (Close ngày hiện tại)"
                    exit_price = close_p
                elif tp_type in ["close_next_day", "close_next_bar"] and holding_bars >= 1:
                    is_closed = True
                    exit_reason = "TakeProfit (Close ngày hôm sau)"
                    exit_price = close_p
                elif tp_p is not None and high_p >= tp_p:
                    is_closed = True
                    exit_reason = f"TakeProfit ({tp_type})"
                    exit_price = max(open_p, tp_p) if open_p > tp_p else tp_p
                elif tp_supertrend and (st_dir == -1 or close_p < st_val):
                    is_closed = True
                    exit_reason = 'Exit (ST Reversal)'
                    exit_price = close_p

            elif pos_type == 'Short':
                if high_p >= sl_p:
                    is_closed = True
                    exit_reason = f"StopLoss ({current_trade.get('sl_type_label', 'SL')})"
                    exit_price = max(open_p, sl_p) if open_p > sl_p else sl_p
                elif tp_type in ["close_today", "close_current_bar"] and holding_bars >= 0:
                    is_closed = True
                    exit_reason = "TakeProfit (Close ngày hiện tại)"
                    exit_price = close_p
                elif tp_type in ["close_next_day", "close_next_bar"] and holding_bars >= 1:
                    is_closed = True
                    exit_reason = "TakeProfit (Close ngày hôm sau)"
                    exit_price = close_p
                elif tp_p is not None and low_p <= tp_p:
                    is_closed = True
                    exit_reason = f"TakeProfit ({tp_type})"
                    exit_price = min(open_p, tp_p) if open_p < tp_p else tp_p
                elif tp_supertrend and (st_dir == 1 or close_p > st_val):
                    is_closed = True
                    exit_reason = 'Exit (ST Reversal)'
                    exit_price = close_p

            if is_closed:
                pnl_amount = (exit_price - entry_p) if pos_type == 'Long' else (entry_p - exit_price)
                pnl_percent = (pnl_amount / entry_p) * 100.0

                current_trade['exit_date'] = candle_date
                current_trade['exit_time'] = time_str
                current_trade['exit_price'] = round(exit_price, 4)
                current_trade['exit_reason'] = exit_reason
                current_trade['status'] = 'Closed'
                current_trade['pnl_amount'] = round(pnl_amount, 4)
                current_trade['pnl_percent'] = round(pnl_percent, 2)
                current_trade['holding_bars'] = i - current_trade['entry_index']
                trades.append(current_trade)

                is_win = "TakeProfit" in str(exit_reason) or pnl_percent > 0
                signals.append({
                    "date": candle_date,
                    "time": time_str,
                    "type": "takeprofit" if is_win else "stoploss",
                    "action": "Close",
                    "price": round(exit_price, 4),
                    "pos_type": pos_type,
                    "entry": entry_p,
                    "stop_loss": sl_p,
                    "take_profit": tp_p,
                    "pnl_percent": round(pnl_percent, 2),
                    "pnl_amount": round(pnl_amount, 4),
                    "rule": {
                        "Name": f"{exit_reason} ({pos_type}) @ {round(exit_price, 4)} | PnL: {pnl_percent:+.2f}%",
                        "Type": "takeprofit" if is_win else "stoploss"
                    }
                })

                current_trade = None
                continue

        # -------------------------------------------------------------
        # 2. TÌM KIẾM ENTRY MỚI (CHỈ KHI KHÔNG CÓ LỆNH ĐANG MỞ)
        # -------------------------------------------------------------
        if current_trade is None:
            # Điều kiện Long
            is_long_breakout = allow_breakout_high and (high_p > prev_high) and trend_up
            is_long_sweep = allow_sweep_low and (low_p < prev_low) and trend_up

            # Điều kiện Short
            is_short_breakdown = allow_breakout_high and (low_p < prev_low) and trend_down
            is_short_sweep = allow_sweep_low and (high_p > prev_high) and trend_down

            if allow_long and (is_long_breakout or is_long_sweep):
                setup_name = ""
                sl_type_label = ""
                sl = 0.0

                if is_long_breakout:
                    # Setup 1 Long: Buy Stop vượt đỉnh hôm trước (prev_high), ST Up
                    setup_name = "Buy Stop Vượt Đỉnh (ST Up)"
                    entry = prev_high if open_p <= prev_high else open_p
                    action_name = "Buy Stop"
                else:
                    # Setup 2 Long: Phá đáy hôm trước (Sweep Low)
                    setup_name = "Phá Đáy Hôm Trước (ST/VWAP)"
                    entry = close_p
                    action_name = "Buy"

                # Kiểm tra điều kiện vị trí VWAP Band (Inside / Outside)
                band_mode = str(vwap_band_filter or "all").lower().strip()
                band_passed = True
                if band_mode in ["inside", "outside"] and vwap_up1 > 0 and vwap_low1 > 0:
                    min_band = min(vwap_up1, vwap_low1)
                    max_band = max(vwap_up1, vwap_low1)
                    is_inside = (min_band <= entry <= max_band)
                    if (band_mode == "inside" and not is_inside) or (band_mode == "outside" and is_inside):
                        band_passed = False

                if band_passed:
                    # Stoploss chung cho cả 2 setup theo cấu hình sl_type
                    sl_mode = str(sl_type or "").lower().strip()
                    if sl_mode in ["prev_bar", "prev_candle", "prev_low", "day_before", "prev_bar_low_high"]:
                        sl_type_label = "Đáy hôm trước"
                        sl = prev_low
                        if sl >= entry:
                            sl = entry - sl_dist_spread
                    elif sl_mode in ["current_bar", "current_candle", "current_low", "current_bar_low_high"]:
                        sl_type_label = "Đáy hiện tại"
                        sl = low_p
                        if sl >= entry:
                            sl = min(low_p, prev_low)
                        if sl >= entry:
                            sl = entry - sl_dist_spread
                    else: # Dạng khoảng cách Spread: P25, P50, P75, P90, P99, CUSTOM
                        sl_type_label = f"Spread ({sl_type.upper()})"
                        sl = entry - sl_dist_spread

                    # Tính Take Profit
                    if tp_type in ["close_today", "close_current_bar"]:
                        tp = None
                        tp_str = "Close ngày hiện tại"
                    elif tp_type in ["close_next_day", "close_next_bar"]:
                        tp = None
                        tp_str = "Close ngày hôm sau"
                    elif tp_type.startswith("RR") or tp_type == "RR":
                        risk_dist = max(entry - sl, entry * 0.005)
                        tp = round(entry + (risk_dist * risk_reward), 4)
                        tp_str = f"{tp_type} {tp}"
                    else:
                        tp = round(entry + tp_dist_spread, 4)
                        tp_str = f"{tp_type} {tp}"

                    entry = round(entry, 4)
                    sl = round(sl, 4)

                    # Kiểm tra đóng lệnh ngay trong ngày (Close ngày hiện tại)
                    if tp_type in ["close_today", "close_current_bar"]:
                        exit_price = close_p
                        exit_reason = "TakeProfit (Close ngày hiện tại)"
                        if low_p <= sl:
                            exit_price = min(open_p, sl) if open_p < sl else sl
                            exit_reason = f"StopLoss ({sl_type_label})"

                        pnl_amount = exit_price - entry
                        pnl_percent = (pnl_amount / entry) * 100.0

                        completed_trade = {
                            "trade_no": len(trades) + 1,
                            "type": "Long",
                            "entry_date": candle_date,
                            "entry_time": time_str,
                            "entry_price": entry,
                            "stop_loss": sl,
                            "take_profit": tp,
                            "exit_date": candle_date,
                            "exit_time": time_str,
                            "exit_price": round(exit_price, 4),
                            "exit_reason": exit_reason,
                            "status": "Closed",
                            "pnl_amount": round(pnl_amount, 4),
                            "pnl_percent": round(pnl_percent, 2),
                            "holding_bars": 0,
                            "entry_index": i,
                            "price_action": setup_name,
                            "sl_type_label": sl_type_label
                        }
                        trades.append(completed_trade)

                        signals.append({
                            "date": candle_date,
                            "time": time_str,
                            "type": "entry_long",
                            "action": action_name,
                            "price": entry,
                            "pos_type": "Long",
                            "entry": entry,
                            "stop_loss": sl,
                            "take_profit": tp,
                            "pnl_percent": 0.0,
                            "rule": {
                                "Name": f"Long [{setup_name}] @ {entry} (TP:{tp_str}, SL:{sl_type_label} {sl})",
                                "Type": "entry"
                            }
                        })

                        is_win = "TakeProfit" in str(exit_reason) or pnl_percent > 0
                        signals.append({
                            "date": candle_date,
                            "time": time_str,
                            "type": "takeprofit" if is_win else "stoploss",
                            "action": "Close",
                            "price": round(exit_price, 4),
                            "pos_type": "Long",
                            "entry": entry,
                            "stop_loss": sl,
                            "take_profit": tp,
                            "pnl_percent": round(pnl_percent, 2),
                            "pnl_amount": round(pnl_amount, 4),
                            "rule": {
                                "Name": f"{exit_reason} (Long) @ {round(exit_price, 4)} | PnL: {pnl_percent:+.2f}%",
                                "Type": "takeprofit" if is_win else "stoploss"
                            }
                        })
                        current_trade = None
                    else:
                        current_trade = {
                            "trade_no": len(trades) + 1,
                            "type": "Long",
                            "entry_date": candle_date,
                            "entry_time": time_str,
                            "entry_price": entry,
                            "stop_loss": sl,
                            "take_profit": tp,
                            "exit_date": None,
                            "exit_time": None,
                            "exit_price": None,
                            "exit_reason": None,
                            "status": "Open",
                            "pnl_amount": 0.0,
                            "pnl_percent": 0.0,
                            "holding_bars": 0,
                            "entry_index": i,
                            "price_action": setup_name,
                            "sl_type_label": sl_type_label
                        }

                        signals.append({
                            "date": candle_date,
                            "time": time_str,
                            "type": "entry_long",
                            "action": action_name,
                            "price": entry,
                            "pos_type": "Long",
                            "entry": entry,
                            "stop_loss": sl,
                            "take_profit": tp,
                            "pnl_percent": 0.0,
                            "rule": {
                                "Name": f"Long [{setup_name}] @ {entry} (TP:{tp_str}, SL:{sl_type_label} {sl})",
                                "Type": "entry"
                            }
                        })

            elif allow_short and (is_short_breakdown or is_short_sweep):
                setup_name = ""
                sl_type_label = ""
                sl = 0.0

                if is_short_breakdown:
                    # Setup 1 Short: Sell Stop phá đáy hôm trước (prev_low), ST Down
                    setup_name = "Sell Stop Phá Đáy (ST Down)"
                    entry = prev_low if open_p >= prev_low else open_p
                    action_name = "Sell Stop"
                else:
                    # Setup 2 Short: Vượt đỉnh hôm trước (Sweep High)
                    setup_name = "Vượt Đỉnh Hôm Trước (ST/VWAP)"
                    entry = close_p
                    action_name = "Sell"

                # Kiểm tra điều kiện vị trí VWAP Band (Inside / Outside)
                band_mode = str(vwap_band_filter or "all").lower().strip()
                band_passed = True
                if band_mode in ["inside", "outside"] and vwap_up1 > 0 and vwap_low1 > 0:
                    min_band = min(vwap_up1, vwap_low1)
                    max_band = max(vwap_up1, vwap_low1)
                    is_inside = (min_band <= entry <= max_band)
                    if (band_mode == "inside" and not is_inside) or (band_mode == "outside" and is_inside):
                        band_passed = False

                if band_passed:
                    # Stoploss chung cho cả 2 setup theo cấu hình sl_type
                    sl_mode = str(sl_type or "").lower().strip()
                    if sl_mode in ["prev_bar", "prev_candle", "prev_high", "day_before", "prev_bar_low_high"]:
                        sl_type_label = "Đỉnh hôm trước"
                        sl = prev_high
                        if sl <= entry:
                            sl = entry + sl_dist_spread
                    elif sl_mode in ["current_bar", "current_candle", "current_high", "current_bar_low_high"]:
                        sl_type_label = "Đỉnh hiện tại"
                        sl = high_p
                        if sl <= entry:
                            sl = max(high_p, prev_high)
                        if sl <= entry:
                            sl = entry + sl_dist_spread
                    else: # Dạng khoảng cách Spread: P25, P50, P75, P90, P99, CUSTOM
                        sl_type_label = f"Spread ({sl_type.upper()})"
                        sl = entry + sl_dist_spread

                    if tp_type in ["close_today", "close_current_bar"]:
                        tp = None
                        tp_str = "Close ngày hiện tại"
                    elif tp_type in ["close_next_day", "close_next_bar"]:
                        tp = None
                        tp_str = "Close ngày hôm sau"
                    elif tp_type.startswith("RR") or tp_type == "RR":
                        risk_dist = max(sl - entry, entry * 0.005)
                        tp = round(entry - (risk_dist * risk_reward), 4)
                        tp_str = f"{tp_type} {tp}"
                    else:
                        tp = round(entry - tp_dist_spread, 4)
                        tp_str = f"{tp_type} {tp}"

                    entry = round(entry, 4)
                    sl = round(sl, 4)

                    # Kiểm tra đóng lệnh ngay trong ngày (Close ngày hiện tại)
                    if tp_type in ["close_today", "close_current_bar"]:
                        exit_price = close_p
                        exit_reason = "TakeProfit (Close ngày hiện tại)"
                        if high_p >= sl:
                            exit_price = max(open_p, sl) if open_p > sl else sl
                            exit_reason = f"StopLoss ({sl_type_label})"

                        pnl_amount = entry - exit_price
                        pnl_percent = (pnl_amount / entry) * 100.0

                        completed_trade = {
                            "trade_no": len(trades) + 1,
                            "type": "Short",
                            "entry_date": candle_date,
                            "entry_time": time_str,
                            "entry_price": entry,
                            "stop_loss": sl,
                            "take_profit": tp,
                            "exit_date": candle_date,
                            "exit_time": time_str,
                            "exit_price": round(exit_price, 4),
                            "exit_reason": exit_reason,
                            "status": "Closed",
                            "pnl_amount": round(pnl_amount, 4),
                            "pnl_percent": round(pnl_percent, 2),
                            "holding_bars": 0,
                            "entry_index": i,
                            "price_action": setup_name,
                            "sl_type_label": sl_type_label
                        }
                        trades.append(completed_trade)

                        signals.append({
                            "date": candle_date,
                            "time": time_str,
                            "type": "entry_short",
                            "action": action_name,
                            "price": entry,
                            "pos_type": "Short",
                            "entry": entry,
                            "stop_loss": sl,
                            "take_profit": tp,
                            "pnl_percent": 0.0,
                            "rule": {
                                "Name": f"Short [{setup_name}] @ {entry} (TP:{tp_str}, SL:{sl_type_label} {sl})",
                                "Type": "entry"
                            }
                        })

                        is_win = "TakeProfit" in str(exit_reason) or pnl_percent > 0
                        signals.append({
                            "date": candle_date,
                            "time": time_str,
                            "type": "takeprofit" if is_win else "stoploss",
                            "action": "Close",
                            "price": round(exit_price, 4),
                            "pos_type": "Short",
                            "entry": entry,
                            "stop_loss": sl,
                            "take_profit": tp,
                            "pnl_percent": round(pnl_percent, 2),
                            "pnl_amount": round(pnl_amount, 4),
                            "rule": {
                                "Name": f"{exit_reason} (Short) @ {round(exit_price, 4)} | PnL: {pnl_percent:+.2f}%",
                                "Type": "takeprofit" if is_win else "stoploss"
                            }
                        })
                        current_trade = None
                    else:
                        current_trade = {
                            "trade_no": len(trades) + 1,
                            "type": "Short",
                            "entry_date": candle_date,
                            "entry_time": time_str,
                            "entry_price": entry,
                            "stop_loss": sl,
                            "take_profit": tp,
                            "exit_date": None,
                            "exit_time": None,
                            "exit_price": None,
                            "exit_reason": None,
                            "status": "Open",
                            "pnl_amount": 0.0,
                            "pnl_percent": 0.0,
                            "holding_bars": 0,
                            "entry_index": i,
                            "price_action": setup_name,
                            "sl_type_label": sl_type_label
                        }

                        signals.append({
                            "date": candle_date,
                            "time": time_str,
                            "type": "entry_short",
                            "action": action_name,
                            "price": entry,
                            "pos_type": "Short",
                            "entry": entry,
                            "stop_loss": sl,
                            "take_profit": tp,
                            "pnl_percent": 0.0,
                            "rule": {
                                "Name": f"Short [{setup_name}] @ {entry} (TP:{tp_str}, SL:{sl_type_label} {sl})",
                                "Type": "entry"
                            }
                        })

    # Nếu lệnh cuối cùng còn Open
    if current_trade is not None:
        last_close = float(df['close'].iloc[-1])
        last_pnl_amt = (last_close - current_trade['entry_price']) if current_trade['type'] == 'Long' else (current_trade['entry_price'] - last_close)
        current_trade['pnl_amount'] = round(last_pnl_amt, 4)
        current_trade['pnl_percent'] = round((last_pnl_amt / current_trade['entry_price']) * 100.0, 2)
        current_trade['holding_bars'] = len(df) - 1 - current_trade['entry_index']
        trades.append(current_trade)

    return {"trades": trades, "signals": signals, "spreadStats": spread_stats, "df": df}

# ==============================================================================
# 4. JSON SERIALIZATION (FOR UI & SCAN API)
# ==============================================================================

def scan_symbol_json(
    ticker: str,
    countback: int = 1000,
    st_period: int = 10,
    st_multiplier: float = 3.0,
    vwap_anchor: str = "year",
    allow_long: bool = True,
    allow_short: bool = True,
    allow_breakout_high: bool = True,
    allow_sweep_low: bool = True,
    indicator_filter: str = "st_or_vwap",
    vwap_band_filter: str = "all",
    tp_type: str = "P90",
    sl_type: str = "P75",
    tp_supertrend: bool = False,
    custom_tp_val: float = 0.0,
    custom_sl_val: float = 0.0,
    risk_reward: float = 1.5,
    timeframe: str = "D1"
) -> Dict:
    df = fetch_market_candles(ticker, countback=countback, timeframe=timeframe)
    if df.empty or len(df) < max(st_period, 5) + 5:
        return {
            "ticker": ticker,
            "error": f"Không đủ dữ liệu nến để phân tích (hiện có {len(df)} nến, cần tối thiểu {max(st_period, 5) + 10} nến)",
            "candles": [],
            "signals": [],
            "trades": []
        }

    spread_stats = calculate_spread_percentiles(df)

    res = scan_strategy_signals(
        df,
        st_period=st_period,
        st_multiplier=st_multiplier,
        vwap_anchor=vwap_anchor,
        allow_long=allow_long,
        allow_short=allow_short,
        allow_breakout_high=allow_breakout_high,
        allow_sweep_low=allow_sweep_low,
        indicator_filter=indicator_filter,
        vwap_band_filter=vwap_band_filter,
        tp_type=tp_type,
        sl_type=sl_type,
        tp_supertrend=tp_supertrend,
        custom_tp_val=custom_tp_val,
        custom_sl_val=custom_sl_val,
        risk_reward=risk_reward,
        spread_stats=spread_stats
    )

    trades = res.get("trades", [])
    signals = res.get("signals", [])
    processed_df = res.get("df", df)

    chart_df = processed_df.tail(3000) if len(processed_df) > 3000 else processed_df
    dates = chart_df['date'].astype(str).values
    opens = chart_df['open'].astype(float).values
    highs = chart_df['high'].astype(float).values
    lows = chart_df['low'].astype(float).values
    closes = chart_df['close'].astype(float).values
    volumes = chart_df['volume'].astype(float).values

    st_vals = chart_df['supertrend'].values if 'supertrend' in chart_df.columns else [None] * len(chart_df)
    st_dirs = chart_df['st_dir'].values if 'st_dir' in chart_df.columns else [None] * len(chart_df)
    vwap_vals = chart_df['vwap'].values if 'vwap' in chart_df.columns else [None] * len(chart_df)
    vwap_up1 = chart_df['vwap_upper1'].values if 'vwap_upper1' in chart_df.columns else [None] * len(chart_df)
    vwap_low1 = chart_df['vwap_lower1'].values if 'vwap_lower1' in chart_df.columns else [None] * len(chart_df)

    candles_list = []
    for i in range(len(chart_df)):
        candles_list.append({
            "date": str(dates[i]),
            "time": str(dates[i])[:10] if "T" not in str(dates[i]) else str(dates[i]).split("T")[0],
            "open": float(opens[i]),
            "high": float(highs[i]),
            "low": float(lows[i]),
            "close": float(closes[i]),
            "volume": float(volumes[i]),
            "supertrend": round(float(st_vals[i]), 4) if pd.notna(st_vals[i]) else None,
            "st_direction": int(st_dirs[i]) if pd.notna(st_dirs[i]) else None,
            "vwap": round(float(vwap_vals[i]), 4) if pd.notna(vwap_vals[i]) else None,
            "vwap_upper1": round(float(vwap_up1[i]), 4) if pd.notna(vwap_up1[i]) else None,
            "vwap_lower1": round(float(vwap_low1[i]), 4) if pd.notna(vwap_low1[i]) else None,
        })

    closed_trades = [t for t in trades if t.get("status") == "Closed"]
    win_trades = [t for t in closed_trades if str(t.get("exit_reason", "")).startswith("TakeProfit") or t.get("pnl_percent", 0) > 0]
    loss_trades = [t for t in closed_trades if str(t.get("exit_reason", "")).startswith("StopLoss") or t.get("pnl_percent", 0) <= 0]

    total_closed = len(closed_trades)
    win_rate = round((len(win_trades) / total_closed * 100.0), 1) if total_closed > 0 else 0.0
    total_pnl = round(sum(t.get("pnl_percent", 0) for t in trades), 2)
    avg_pnl = round(total_pnl / total_closed, 2) if total_closed > 0 else 0.0

    gross_profit = sum(t.get("pnl_percent", 0) for t in win_trades)
    gross_loss = abs(sum(t.get("pnl_percent", 0) for t in loss_trades))
    profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else (99.9 if gross_profit > 0 else 0.0)

    # Active trade (nếu có vị thế đang mở ở nến mới nhất)
    active_trade = trades[-1] if (trades and trades[-1].get("status") == "Open") else None

    return {
        "ticker": ticker,
        "timeframe": timeframe,
        "candles": candles_list,
        "signals": signals,
        "trades": trades,
        "spreadStats": spread_stats,
        "summary": {
            "totalTrades": len(trades),
            "closedTrades": total_closed,
            "openTrades": len(trades) - total_closed,
            "winTrades": len(win_trades),
            "lossTrades": len(loss_trades),
            "winRate": win_rate,
            "totalPnlPercent": total_pnl,
            "avgPnlPercent": avg_pnl,
            "profitFactor": profit_factor,
            "grossProfit": round(gross_profit, 2),
            "grossLoss": round(gross_loss, 2),
            "tpType": tp_type,
            "slType": sl_type,
            "activeTrade": active_trade
        },
        "strategyParams": {
            "stPeriod": st_period,
            "stMultiplier": st_multiplier,
            "vwapAnchor": vwap_anchor,
            "allowLong": allow_long,
            "allowShort": allow_short,
            "allowBreakoutHigh": allow_breakout_high,
            "allowSweepLow": allow_sweep_low,
            "indicatorFilter": indicator_filter,
            "vwapBandFilter": vwap_band_filter,
            "tpType": tp_type,
            "slType": sl_type,
            "tpSupertrend": tp_supertrend,
            "riskReward": risk_reward
        }
    }

# ==============================================================================
# 5. TỐI ƯU HÓA THAM SỐ (BEST PARAMS OPTIMIZER)
# ==============================================================================

def optimize_strategy(
    ticker: str = "VNINDEX",
    timeframe: str = "D1",
    countback: int = 5000,
    allow_long: bool = True,
    allow_short: bool = True,
    allow_breakout_high: bool = True,
    allow_sweep_low: bool = True,
    current_entry_setup: str = "both",
    current_st_period: int = 10,
    current_st_multiplier: float = 3.0,
    current_vwap_anchor: str = "year",
    current_tp_type: str = "P90",
    current_sl_type: str = "current_bar",
    current_tp_supertrend: bool = False,
    current_indicator_filter: str = "st_or_vwap",
    current_vwap_band_filter: str = "all",
    opt_config: Dict = None
) -> Dict:
    df = fetch_market_candles(ticker, countback=countback, timeframe=timeframe)
    if df.empty or len(df) < 30:
        return {
            "ticker": ticker,
            "error": f"Không đủ dữ liệu nến để tối ưu hóa (hiện có {len(df)} nến)",
            "candles": [],
            "signals": [],
            "trades": []
        }

    spread_stats = calculate_spread_percentiles(df)
    if opt_config is None:
        opt_config = {}

    opt_st_period = opt_config.get("stPeriod", True)
    opt_st_multiplier = opt_config.get("stMultiplier", True)
    opt_entry_setup = opt_config.get("entrySetup", True)
    opt_tp_type = opt_config.get("tpType", True)
    opt_sl_type = opt_config.get("slType", True)
    opt_tp_supertrend = opt_config.get("tpSupertrend", True)
    opt_filter = opt_config.get("indicatorFilter", True)
    opt_vwap_band = opt_config.get("vwapBandFilter", True)

    st_periods = [7, 10, 14] if opt_st_period else [int(current_st_period or 10)]
    st_mults = [2.0, 3.0, 4.0] if opt_st_multiplier else [float(current_st_multiplier or 3.0)]
    
    # Xác định entry setups
    fallback_setup = "setup1" if (allow_breakout_high and not allow_sweep_low) else ("setup2" if (not allow_breakout_high and allow_sweep_low) else "both")
    eff_setup = current_entry_setup or fallback_setup
    entry_setups = ["setup1", "setup2", "both"] if opt_entry_setup else [str(eff_setup)]

    tp_types = ["P50", "P75", "P90", "P99", "RR1.5", "RR2.0", "close_today", "close_next_day"] if opt_tp_type else [str(current_tp_type or "P90")]
    sl_types = ["current_bar", "prev_bar", "P50", "P75", "P90"] if opt_sl_type else [str(current_sl_type or "current_bar")]
    tp_sts = [False, True] if opt_tp_supertrend else [bool(current_tp_supertrend)]
    filters = ["st_or_vwap", "st_and_vwap", "st_only", "vwap_only"] if opt_filter else [str(current_indicator_filter or "st_or_vwap")]
    vwap_bands = ["all", "inside", "outside"] if opt_vwap_band else [str(current_vwap_band_filter or "all")]

    combinations = []
    for st_p in st_periods:
        for st_m in st_mults:
            for e_setup in entry_setups:
                for tp_t in tp_types:
                    for sl_t in sl_types:
                        for tp_s in tp_sts:
                            for f_mode in filters:
                                for b_mode in vwap_bands:
                                    combinations.append({
                                        "st_period": st_p,
                                        "st_multiplier": st_m,
                                        "vwap_anchor": current_vwap_anchor,
                                        "entry_setup": e_setup,
                                        "allow_breakout_high": e_setup in ["setup1", "both"],
                                        "allow_sweep_low": e_setup in ["setup2", "both"],
                                        "tp_type": tp_t,
                                        "sl_type": sl_t,
                                        "tp_supertrend": tp_s,
                                        "indicator_filter": f_mode,
                                        "vwap_band_filter": b_mode
                                    })

    def run_eval(c):
        res = scan_strategy_signals(
            df,
            st_period=c["st_period"],
            st_multiplier=c["st_multiplier"],
            vwap_anchor=c["vwap_anchor"],
            allow_long=allow_long,
            allow_short=allow_short,
            allow_breakout_high=c["allow_breakout_high"],
            allow_sweep_low=c["allow_sweep_low"],
            indicator_filter=c["indicator_filter"],
            vwap_band_filter=c["vwap_band_filter"],
            tp_type=c["tp_type"],
            sl_type=c["sl_type"],
            tp_supertrend=c["tp_supertrend"],
            spread_stats=spread_stats
        )
        trades = res.get("trades", [])
        closed = [t for t in trades if t.get("status") == "Closed"]
        win = [t for t in closed if str(t.get("exit_reason", "")).startswith("TakeProfit") or t.get("pnl_percent", 0) > 0]
        loss = [t for t in closed if str(t.get("exit_reason", "")).startswith("StopLoss") or t.get("pnl_percent", 0) <= 0]
        tot = len(closed)
        wr = round((len(win) / tot * 100.0), 1) if tot > 0 else 0.0
        pnl = round(sum(t.get("pnl_percent", 0) for t in trades), 2)
        gp = sum(t.get("pnl_percent", 0) for t in win)
        gl = abs(sum(t.get("pnl_percent", 0) for t in loss))
        pf = round(gp / gl, 2) if gl > 0 else (99.9 if gp > 0 else 0.0)

        # Tính điểm fitness
        capped_pf = min(pf, 10.0)
        trade_weight = np.sqrt(len(trades))
        wr_factor = 1.0 if wr >= 40.0 else max(0.2, wr / 40.0)
        pnl_weight = max(0.1, pnl) if pnl > 0 else (pnl / 10.0)
        fitness = capped_pf * trade_weight * pnl_weight * wr_factor

        return {
            "config": c,
            "score": fitness,
            "profitFactor": pf,
            "winRate": wr,
            "totalPnlPercent": pnl,
            "grossProfit": round(gp, 2),
            "grossLoss": round(gl, 2),
            "totalTrades": len(trades),
            "closedTrades": tot,
            "winTrades": len(win),
            "lossTrades": len(loss)
        }

    evaluated = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        evaluated = list(executor.map(run_eval, combinations))

    evaluated.sort(key=lambda x: (x["score"], x["profitFactor"], x["totalPnlPercent"], x["winRate"]), reverse=True)

    top_configs = []
    seen = set()
    for item in evaluated:
        cfg = item["config"]
        key = (cfg["st_period"], cfg["st_multiplier"], cfg["vwap_anchor"], cfg["indicator_filter"], cfg["vwap_band_filter"], cfg["entry_setup"], cfg["tp_type"], cfg["sl_type"], cfg["tp_supertrend"])
        if key not in seen:
            seen.add(key)
            top_configs.append({
                "rank": len(top_configs) + 1,
                "stPeriod": cfg["st_period"],
                "stMultiplier": cfg["st_multiplier"],
                "vwapAnchor": cfg["vwap_anchor"],
                "indicatorFilter": cfg["indicator_filter"],
                "vwapBandFilter": cfg["vwap_band_filter"],
                "entrySetup": cfg["entry_setup"],
                "allowBreakoutHigh": cfg["allow_breakout_high"],
                "allowSweepLow": cfg["allow_sweep_low"],
                "tpType": cfg["tp_type"],
                "slType": cfg["sl_type"],
                "tpSupertrend": cfg["tp_supertrend"],
                "allowLong": allow_long,
                "allowShort": allow_short,
                "profitFactor": item["profitFactor"],
                "winRate": item["winRate"],
                "totalPnlPercent": item["totalPnlPercent"],
                "grossProfit": item["grossProfit"],
                "grossLoss": item["grossLoss"],
                "totalTrades": item["totalTrades"],
                "closedTrades": item["closedTrades"],
                "winTrades": item["winTrades"],
                "lossTrades": item["lossTrades"]
            })
            if len(top_configs) >= 25:
                break

    best = top_configs[0] if top_configs else None

    best_combo = best if best else {
        "stPeriod": current_st_period,
        "stMultiplier": current_st_multiplier,
        "vwapAnchor": current_vwap_anchor,
        "indicatorFilter": current_indicator_filter,
        "vwapBandFilter": current_vwap_band_filter,
        "entrySetup": eff_setup,
        "allowBreakoutHigh": eff_setup in ["setup1", "both"],
        "allowSweepLow": eff_setup in ["setup2", "both"],
        "tpType": current_tp_type,
        "slType": current_sl_type,
        "tpSupertrend": current_tp_supertrend,
    }

    full_result = scan_symbol_json(
        ticker=ticker,
        countback=len(df),
        st_period=best_combo["stPeriod"],
        st_multiplier=best_combo["stMultiplier"],
        vwap_anchor=best_combo["vwapAnchor"],
        allow_long=allow_long,
        allow_short=allow_short,
        allow_breakout_high=best_combo["allowBreakoutHigh"],
        allow_sweep_low=best_combo["allowSweepLow"],
        indicator_filter=best_combo["indicatorFilter"],
        vwap_band_filter=best_combo["vwapBandFilter"],
        tp_type=best_combo["tpType"],
        sl_type=best_combo["slType"],
        tp_supertrend=best_combo["tpSupertrend"],
        timeframe=timeframe
    )

    full_result["bestParams"] = {
        "rank": 1,
        "stPeriod": best_combo["stPeriod"],
        "stMultiplier": best_combo["stMultiplier"],
        "vwapAnchor": best_combo["vwapAnchor"],
        "indicatorFilter": best_combo["indicatorFilter"],
        "vwapBandFilter": best_combo["vwapBandFilter"],
        "entrySetup": best_combo["entrySetup"],
        "allowBreakoutHigh": best_combo["allowBreakoutHigh"],
        "allowSweepLow": best_combo["allowSweepLow"],
        "tpType": best_combo["tpType"],
        "slType": best_combo["slType"],
        "tpSupertrend": best_combo["tpSupertrend"],
        "allowLong": allow_long,
        "allowShort": allow_short,
        "profitFactor": full_result.get("summary", {}).get("profitFactor", 0.0),
        "winRate": full_result.get("summary", {}).get("winRate", 0.0),
        "totalTrades": full_result.get("summary", {}).get("totalTrades", 0),
        "totalPnlPercent": full_result.get("summary", {}).get("totalPnlPercent", 0.0),
        "grossProfit": full_result.get("summary", {}).get("grossProfit", 0.0),
        "grossLoss": full_result.get("summary", {}).get("grossLoss", 0.0),
        "closedTrades": full_result.get("summary", {}).get("closedTrades", 0)
    }
    full_result["topConfigs"] = top_configs

    return full_result

# ==============================================================================
# 6. CLI ENTRY POINT
# ==============================================================================

if __name__ == "__main__":
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Breakout + Supertrend & VWAP Strategy Scanner & Optimizer")
    parser.add_argument("--ticker", type=str, default="VNINDEX", help="Ticker symbol")
    parser.add_argument("--timeframe", type=str, default="D1", help="Timeframe (D1, H1, M15, M5, M1)")
    parser.add_argument("--json", action="store_true", help="Output JSON format")
    parser.add_argument("--optimize", action="store_true", help="Auto optimize best parameters")
    parser.add_argument("--countback", type=int, default=1000, help="Number of candles")
    parser.add_argument("--opt-config", type=str, default="", help="JSON config xác định các tham số được tối ưu")

    # Supertrend
    parser.add_argument("--st-period", type=int, default=10, help="Supertrend period")
    parser.add_argument("--st-multiplier", type=float, default=3.0, help="Supertrend multiplier")

    # VWAP
    parser.add_argument("--vwap-anchor", type=str, default="year", help="VWAP Anchor (year, month, week, day)")

    # Indicator Filter Condition
    parser.add_argument("--indicator-filter", type=str, default="st_or_vwap", help="Indicator filter: st_or_vwap, st_and_vwap, st_only, vwap_only, none")

    # VWAP Band Filter (Inside / Outside VWAP Upper1 & Lower1)
    parser.add_argument("--vwap-band-filter", "--vwap-band", dest="vwap_band_filter", type=str, default="all", choices=["all", "inside", "outside"], help="VWAP Band filter: all, inside, outside")

    # Entry Setup
    parser.add_argument("--entry-setup", type=str, default="both", choices=["setup1", "setup2", "both"], help="Entry setup (setup1, setup2, both)")

    # Setup triggers
    parser.add_argument("--allow-breakout-high", dest="allow_breakout_high", action="store_true", default=True, help="Cho phép Mua vượt đỉnh / Bán phá đáy")
    parser.add_argument("--no-breakout-high", dest="allow_breakout_high", action="store_false", help="Tắt setup vượt đỉnh")
    parser.add_argument("--allow-sweep-low", dest="allow_sweep_low", action="store_true", default=True, help="Cho phép Mua phá đáy quét thanh khoản / Bán vượt đỉnh")
    parser.add_argument("--no-sweep-low", dest="allow_sweep_low", action="store_false", help="Tắt setup phá đáy")

    # Direction
    parser.add_argument("--allow-long", dest="allow_long", action="store_true", default=True, help="Allow Long")
    parser.add_argument("--no-long", dest="allow_long", action="store_false", help="Disable Long")
    parser.add_argument("--allow-short", dest="allow_short", action="store_true", default=True, help="Allow Short")
    parser.add_argument("--no-short", dest="allow_short", action="store_false", help="Disable Short")

    # TP & SL Spread Dropdowns
    parser.add_argument("--tp-type", type=str, default="P90", help="Take Profit type (P25, P50, P75, P90, P99, RR1.5, RR2.0)")
    parser.add_argument("--sl-type", type=str, default="current_bar", help="Stop Loss type (current_bar, prev_bar, P25, P50, P75, P90)")
    parser.add_argument("--custom-tp-val", type=float, default=0.0, help="Custom TP spread value")
    parser.add_argument("--custom-sl-val", type=float, default=0.0, help="Custom SL spread value")
    parser.add_argument("--rr", "--risk-reward", dest="risk_reward", type=float, default=1.5, help="Risk : Reward ratio")

    # TP Supertrend
    parser.add_argument("--tp-supertrend", dest="tp_supertrend", action="store_true", default=False, help="Exit on Supertrend reversal")
    parser.add_argument("--no-tp-supertrend", dest="tp_supertrend", action="store_false", help="Do not exit on Supertrend reversal")

    args = parser.parse_args()

    if args.optimize:
        opt_cfg = {}
        if args.opt_config:
            try:
                opt_cfg = json.loads(args.opt_config)
            except Exception:
                opt_cfg = {}

        res = optimize_strategy(
            ticker=args.ticker,
            timeframe=args.timeframe,
            countback=args.countback,
            allow_long=args.allow_long,
            allow_short=args.allow_short,
            allow_breakout_high=args.allow_breakout_high,
            allow_sweep_low=args.allow_sweep_low,
            current_entry_setup=args.entry_setup,
            current_st_period=args.st_period,
            current_st_multiplier=args.st_multiplier,
            current_vwap_anchor=args.vwap_anchor,
            current_tp_type=args.tp_type,
            current_sl_type=args.sl_type,
            current_tp_supertrend=args.tp_supertrend,
            current_indicator_filter=args.indicator_filter,
            current_vwap_band_filter=args.vwap_band_filter,
            opt_config=opt_cfg
        )
    else:
        res = scan_symbol_json(
            ticker=args.ticker,
            countback=args.countback,
            st_period=args.st_period,
            st_multiplier=args.st_multiplier,
            vwap_anchor=args.vwap_anchor,
            allow_long=args.allow_long,
            allow_short=args.allow_short,
            allow_breakout_high=args.allow_breakout_high,
            allow_sweep_low=args.allow_sweep_low,
            indicator_filter=args.indicator_filter,
            vwap_band_filter=args.vwap_band_filter,
            tp_type=args.tp_type,
            sl_type=args.sl_type,
            tp_supertrend=args.tp_supertrend,
            custom_tp_val=args.custom_tp_val,
            custom_sl_val=args.custom_sl_val,
            risk_reward=args.risk_reward,
            timeframe=args.timeframe
        )

    if args.json:
        print(json.dumps(res, ensure_ascii=False))
    else:
        summary = res.get("summary", {})
        bp = res.get("bestParams", {})
        if args.optimize:
            print(f"[*] KẾT QUẢ TỐI ƯU HÓA BREAKOUT + ST & VWAP ({args.ticker} • {args.timeframe}):")
            print(f"    - Bộ tham số tốt nhất: ST({bp.get('stPeriod')}, {bp.get('stMultiplier')}) | Setup: {bp.get('entrySetup')} | Filter: {bp.get('indicatorFilter')} | VWAP Band: {bp.get('vwapBandFilter')} | TP: {bp.get('tpType')} | SL: {bp.get('slType')}")
            print(f"    - Profit Factor: {summary.get('profitFactor')} | Win Rate: {summary.get('winRate')}% ({summary.get('closedTrades')} trades)")
            print(f"    - Tổng PnL: {summary.get('totalPnlPercent')}%")
        else:
            print(f"[*] KẾT QUẢ QUÉT BREAKOUT + ST & VWAP ({args.ticker} • {args.timeframe}):")
            print(f"    - Tổng số Trades: {summary.get('totalTrades')} (Thắng: {summary.get('winTrades')}, Thua: {summary.get('lossTrades')})")
            print(f"    - Win Rate: {summary.get('winRate')}% | Profit Factor: {summary.get('profitFactor')}")
            print(f"    - Tổng PnL: {summary.get('totalPnlPercent')}%")

