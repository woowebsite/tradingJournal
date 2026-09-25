import sys
import os
import time
import json
import argparse
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

# ==============================================================================
# CẤU HÌNH HỆ THỐNG & THAM SỐ MẶC ĐỊNH
# ==============================================================================
STRAPI_BASE_URL = os.environ.get("STRAPI_BASE_URL", "http://127.0.0.1:1337").rstrip("/")
STRAPI_API_TOKEN = os.environ.get("STRAPI_API_TOKEN", "")

DEFAULT_BB_PERIOD = 26
DEFAULT_BB_STD = 1.0
DEFAULT_ST_PERIOD = 10
DEFAULT_ST_MULTIPLIER = 3.0

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

def clean_candle_df(df: pd.DataFrame) -> pd.DataFrame:
    """Làm sạch DataFrame nến, loại bỏ các nến lỗi NaN, <= 0"""
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

# ==============================================================================
# 1. FETCH DATA TỪ CÁC NGUỒN (BINANCE, YAHOO, 24HMONEY, STRAPI)
# ==============================================================================

def fetch_binance_candles(ticker: str, countback: int = 500, timeframe: str = "D1") -> pd.DataFrame:
    clean = ticker.strip().upper().replace("BINANCE:", "").replace(".P", "").replace("PERP", "")
    interval = map_timeframe_to_binance(timeframe)
    url = f"https://fapi.binance.com/fapi/v1/klines?symbol={clean}&interval={interval}&limit={min(max(countback, 100), 1500)}"
    try:
        res = requests.get(url, timeout=10)
        if res.status_code == 200:
            data = res.json()
            if isinstance(data, list) and len(data) > 0:
                candles = []
                is_daily = interval in ["1d", "1w"]
                for item in data:
                    dt = datetime.fromtimestamp(item[0] / 1000, tz=timezone.utc)
                    candles.append({
                        "date": dt.strftime("%Y-%m-%dT00:00:00.000Z") if is_daily else dt.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                        "time": dt.strftime("%Y-%m-%d") if is_daily else dt.strftime("%H:%M:%S"),
                        "open": float(item[1]),
                        "high": float(item[2]),
                        "low": float(item[3]),
                        "close": float(item[4]),
                        "volume": float(item[5])
                    })
                df = pd.DataFrame(candles)
                df["dt"] = pd.to_datetime(df["date"])
                return df
    except Exception:
        pass
    return pd.DataFrame()

def fetch_yahoo_candles(ticker: str, countback: int = 1000, timeframe: str = "D1") -> pd.DataFrame:
    clean = ticker.strip().upper()
    sym_map = {
        'USTEC': 'NQ=F', 'USTECH': 'NQ=F', 'USTEC.P': 'NQ=F', 'NAS100': 'NQ=F', 'NAS100.P': 'NQ=F',
        'US100': 'NQ=F', 'US100.P': 'NQ=F', 'NQ': 'NQ=F', 'NQ=F': 'NQ=F', 'NASDAQ': '^IXIC', 'QQQ': 'QQQ',
        'SP500': '^GSPC', 'SPX': '^GSPC', 'ES=F': 'ES=F', 'US500': 'ES=F', 'SPY': 'SPY',
        'US30': 'YM=F', 'DJ30': 'YM=F', 'DOW': '^DJI', 'GOLD': 'GC=F', 'XAUUSD': 'GC=F',
        'SILVER': 'SI=F', 'WTI': 'CL=F', 'BRENT': 'BZ=F', 'DXY': 'DX-Y.NYB',
        'EURUSD': 'EURUSD=X', 'GBPUSD': 'GBPUSD=X', 'USDJPY': 'USDJPY=X'
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
    for sym in candidate_symbols:
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval={interval}&range={range_param}&includePrePost={include_pre_post}"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json, text/plain, */*"
            }
            res = requests.get(url, headers=headers, timeout=12)
            if res.status_code == 200:
                result = res.json().get("chart", {}).get("result", [{}])[0]
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

def fetch_history_from_strapi(ticker: str, countback: int = 500, timeframe: str = "D1") -> pd.DataFrame:
    clean = ticker.strip().upper()
    tf = str(timeframe or "D1").strip().upper()
    headers = get_strapi_headers()
    tf_filter = f"&filters[$or][0][timeframe][$eq]={tf}&filters[$or][1][timeframe][$null]=true" if tf == "D1" else f"&filters[timeframe][$eq]={tf}"
    url = f"{STRAPI_BASE_URL}/api/symbol-histories?filters[symbol][Name][$eq]={clean}{tf_filter}&sort=date:desc&pagination[pageSize]={min(countback, 1000)}"
    try:
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code == 200:
            records = res.json().get("data", [])
            if records:
                data = []
                for item in records:
                    attrs = item.get("attributes", item)
                    d_val = attrs.get("date")
                    if not d_val:
                        continue
                    data.append({
                        "date": str(d_val),
                        "time": str(d_val)[:10],
                        "open": float(attrs.get("open", 0)),
                        "high": float(attrs.get("high", 0)),
                        "low": float(attrs.get("low", 0)),
                        "close": float(attrs.get("close", 0)),
                        "volume": float(attrs.get("volume", 0)),
                    })
                if data:
                    df = pd.DataFrame(data)
                    df["dt"] = pd.to_datetime(df["date"])
                    return df.drop_duplicates(subset=["date"]).sort_values("dt").reset_index(drop=True)
    except Exception:
        pass
    return pd.DataFrame()

def fetch_market_candles(ticker: str, resolution: str = "D1", countback: int = 500, timeframe: str = None) -> pd.DataFrame:
    tf = str(timeframe or resolution or "D1").strip().upper()
    ticker_clean = ticker.strip().upper()
    req_count = max(int(countback), 300)

    if is_crypto_symbol(ticker_clean):
        df_binance = fetch_binance_candles(ticker_clean, countback=req_count, timeframe=tf)
        cleaned_b = clean_candle_df(df_binance)
        if not cleaned_b.empty:
            return cleaned_b

    resolution_24h = map_timeframe_to_24h(tf)
    to_ts = int(time.time())
    from_ts = get_24h_from_timestamp(resolution_24h, req_count, to_ts)
    url_24h = f"https://api.24hmoney.vn/tradingview/history?symbol={ticker_clean}&resolution={resolution_24h}&from={from_ts}&to={to_ts}&countback={min(req_count, 10000)}"
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
                is_daily = resolution_24h in ["1D", "1W", "D", "W"]
                for i in range(len(data["t"])):
                    dt = datetime.fromtimestamp(data["t"][i], tz=timezone.utc)
                    candles.append({
                        "date": dt.strftime("%Y-%m-%dT00:00:00.000Z") if is_daily else dt.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                        "time": dt.strftime("%Y-%m-%d") if is_daily else dt.strftime("%H:%M:%S"),
                        "open": float(data["o"][i]) * multiplier,
                        "high": float(data["h"][i]) * multiplier,
                        "low": float(data["l"][i]) * multiplier,
                        "close": float(data["c"][i]) * multiplier,
                        "volume": float(data["v"][i])
                    })
                df = pd.DataFrame(candles)
                df["dt"] = pd.to_datetime(df["date"])
                cleaned_24h = clean_candle_df(df)
                if not cleaned_24h.empty:
                    return cleaned_24h
    except Exception:
        pass

    df_strapi = fetch_history_from_strapi(ticker_clean, countback=req_count, timeframe=tf)
    cleaned_s = clean_candle_df(df_strapi)
    if not cleaned_s.empty:
        return cleaned_s

    df_yahoo = fetch_yahoo_candles(ticker_clean, countback=req_count, timeframe=tf)
    return clean_candle_df(df_yahoo)

# ==============================================================================
# 2. CHỈ BÁO KỸ THUẬT: BOLLINGER BANDS (26, 1) & SUPERTREND (10, 3)
# ==============================================================================

def calculate_bollinger_bands(
    df: pd.DataFrame,
    period: int = 26,
    std_dev: float = 1.0,
    price_col: str = "close"
) -> Tuple[pd.Series, pd.Series, pd.Series]:
    """
    Tính Bollinger Bands:
    - Middle Band (SMA): SMA(close, period)
    - Upper Band: Middle + std_dev * Stdev(close, period)
    - Lower Band: Middle - std_dev * Stdev(close, period)
    """
    if len(df) < period:
        nan_series = pd.Series([np.nan] * len(df), index=df.index)
        return nan_series, nan_series, nan_series

    prices = df[price_col].astype(float)
    middle = prices.rolling(window=period).mean()
    std = prices.rolling(window=period).std(ddof=0)

    upper = middle + (std_dev * std)
    lower = middle - (std_dev * std)
    return upper, middle, lower

def calculate_supertrend(
    df: pd.DataFrame,
    period: int = 10,
    multiplier: float = 3.0
) -> Tuple[pd.Series, pd.Series]:
    """
    Tính Supertrend (period=10, multiplier=3.0):
    - True Range & ATR(period)
    - Basic Upper / Lower Bands
    - Final Bands & Supertrend line
    - Direction: +1 (Bullish/Up), -1 (Bearish/Down)
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

# ==============================================================================
# 3. LOGIC CHIẾN LƯỢC BOLLINGER BAND (26, 1) + SUPERTREND (10, 3) BREAKOUT
# ==============================================================================
# Logic:
# Entry:
# - Long: Nến signal có (Open < Upper Band VÀ Close > Upper Band) VÀ Close > Supertrend (st_dir == 1).
#         Entry khi giá Breakout qua High của nến signal.
# - Stoploss: Tại Lower Band (của nến signal lúc kích hoạt).
# - Exit: Khi giá close < Upper Band.
#
# - Short: Nến signal có (Open > Lower Band VÀ Close < Lower Band) VÀ Close < Supertrend (st_dir == -1).
#          Entry khi giá Breakout qua Low của nến signal.
# - Stoploss: Tại Upper Band (của nến signal lúc kích hoạt).
# - Exit: Khi giá close > Lower Band.
# ==============================================================================

def scan_strategy_signals(
    df: pd.DataFrame,
    bb_period: int = 26,
    bb_std: float = 1.0,
    st_period: int = 10,
    st_multiplier: float = 3.0,
    allow_long: bool = True,
    allow_short: bool = True,
    max_pending_bars: int = 5,
    signal_candle_type: str = "upper_band",
    sl_type: str = "touch_lower_band",
    tp_type: str = "rr_2",
    pyramiding: int = 1
) -> Dict:
    """
    Backtest và quét tín hiệu chiến lược Bollinger Band (26, 1) + Supertrend (10, 3) Breakout
    Tùy chọn Signal Candle (signal_candle_type):
      - 'both': Cả 2 (Thỏa mãn nến bứt phá Upper Band HOẶC nến hồi phục Lower Band)
      - 'upper_band': Long: Close > Upper Band, Open < Upper Band | Short: Close < Lower Band, Open > Lower Band
      - 'lower_band': Long: Close > Lower Band, Open < Lower Band | Short: Close < Upper Band, Open > Upper Band
    Tùy chọn Stoploss (sl_type):
      - 'break_supertrend': Break Supertrend (Close < Supertrend hoặc ST đảo chiều cho Long / Close > Supertrend hoặc ST đảo chiều cho Short)
      - 'close_below_ma': Giá đóng cửa dưới MA (Middle Band) cho Long / trên MA cho Short
      - 'touch_lower_band': Giá chạm Lower Band cho Long / Upper Band cho Short
      - 'signal_candle_low': Đáy nến signal cho Long / Đỉnh nến signal cho Short
      - 'entry_candle_low': Đáy nến entry cho Long / Đỉnh nến entry cho Short
    Tùy chọn Take Profit (tp_type):
      - 'rr_1': Tỷ lệ RRR 1:1
      - 'rr_1_5': Tỷ lệ RRR 1.5:1
      - 'rr_2': Tỷ lệ RRR 2:1
      - 'rr_3': Tỷ lệ RRR 3:1
      - 'rr_5': Tỷ lệ RRR 5:1
      - 'close_upper_band': Giá đóng cửa < Upper Band cho Long / > Lower Band cho Short
      - 'next_candle_1': Thoát lệnh sau 1 nến kể từ nến entry
      - 'next_candle_2': Thoát lệnh sau 2 nến kể từ nến entry
    Tham số Pyramiding (pyramiding):
      - Số lượng lệnh tối đa có thể mở đồng thời khi tiếp tục xuất hiện tín hiệu entry hợp lệ.
    """
    min_bars = max(bb_period, st_period) + 5
    if len(df) < min_bars:
        return {"trades": [], "signals": []}

    # Tính các chỉ báo
    upper_band, middle_band, lower_band = calculate_bollinger_bands(df, period=bb_period, std_dev=bb_std)
    st_series, st_dir_series = calculate_supertrend(df, period=st_period, multiplier=st_multiplier)

    df['bb_upper'] = upper_band
    df['bb_middle'] = middle_band
    df['bb_lower'] = lower_band
    df['supertrend'] = st_series
    df['st_dir'] = st_dir_series

    trades = []
    signals = []
    open_trades = []  # Danh sách các vị thế đang mở (hỗ trợ Pyramiding)
    pending_signal = None  # Lưu nến signal đang chờ breakout

    for i in range(min_bars, len(df)):
        row = df.iloc[i]
        candle_date = str(row['date'])
        time_str = candle_date[:10]
        open_p = float(row['open'])
        high_p = float(row['high'])
        low_p = float(row['low'])
        close_p = float(row['close'])

        bb_up = float(row['bb_upper']) if not pd.isna(row['bb_upper']) else None
        bb_mid = float(row['bb_middle']) if not pd.isna(row['bb_middle']) else None
        bb_low = float(row['bb_lower']) if not pd.isna(row['bb_lower']) else None
        st_val = float(row['supertrend']) if not pd.isna(row['supertrend']) else None
        st_dir = int(row['st_dir']) if not pd.isna(row['st_dir']) else 0

        if bb_up is None or bb_mid is None or bb_low is None or st_val is None:
            continue

        # -------------------------------------------------------------
        # 1. KIỂM TRA ĐÓNG VỊ THẾ CHO TỪNG LỆNH ĐANG MỞ (OPEN TRADES)
        # -------------------------------------------------------------
        active_trades = []
        for current_trade in open_trades:
            pos_type = current_trade['type']
            entry_p = current_trade['entry_price']
            sl_p = current_trade['stop_loss']
            tp_p = current_trade.get('take_profit')
            trade_sl_type = current_trade.get('sl_type', sl_type)
            trade_tp_type = current_trade.get('tp_type', tp_type)
            sl_label = current_trade.get('sl_label', 'SL')
            tp_label = current_trade.get('tp_label', 'TP')

            is_closed = False
            exit_reason = None
            exit_price = None

            if pos_type == 'Long':
                # a. Stop Loss: Break Supertrend (Close < Supertrend hoặc ST đảo chiều)
                if trade_sl_type == 'break_supertrend' and (close_p < st_val or st_dir == -1):
                    is_closed = True
                    exit_reason = 'StopLoss (Break Supertrend)'
                    exit_price = close_p
                # b. Stop Loss: Chạm Lower Band (Stop order tại Lower Band của nến hiện tại, khớp ngay khi low chạm Lower Band)
                elif trade_sl_type == 'touch_lower_band' and low_p <= bb_low:
                    is_closed = True
                    exit_reason = 'StopLoss (Chạm Lower Band)'
                    exit_price = min(open_p, bb_low)
                # c. Stop Loss: Đáy nến signal / Đáy nến entry (Stop order cố định tại mức sl_p)
                elif trade_sl_type in ['signal_candle_low', 'entry_candle_low'] and low_p <= sl_p:
                    is_closed = True
                    exit_reason = f'StopLoss ({sl_label})'
                    exit_price = min(open_p, sl_p)
                # d. Stop Loss: Giá đóng cửa dưới MA (Chờ đóng nến Close < Middle Band)
                elif trade_sl_type == 'close_below_ma' and close_p < bb_mid:
                    is_closed = True
                    exit_reason = 'StopLoss (Close < MA)'
                    exit_price = close_p
                # e. Take Profit RRR (1:1, 1.5:1, 2:1, 3:1, 5:1 - Limit order chạm giá TP)
                elif tp_p is not None and high_p >= tp_p:
                    is_closed = True
                    exit_reason = f'TakeProfit ({tp_label})'
                    exit_price = max(open_p, tp_p) if open_p >= tp_p else tp_p
                # f. Exit condition: Close < Upper Band (Chờ đóng nến < Upper Band)
                elif trade_tp_type == 'close_upper_band' and close_p < bb_up:
                    is_closed = True
                    exit_reason = 'Exit (Close < Upper Band)'
                    exit_price = close_p
                # g. Exit condition: Next Candle 1 (Thoát sau 1 nến kể từ nến entry)
                elif trade_tp_type == 'next_candle_1' and (i - current_trade['entry_index']) >= 1:
                    is_closed = True
                    exit_reason = 'Exit (Next Candle 1)'
                    exit_price = close_p
                # h. Exit condition: Next Candle 2 (Thoát sau 2 nến kể từ nến entry)
                elif trade_tp_type == 'next_candle_2' and (i - current_trade['entry_index']) >= 2:
                    is_closed = True
                    exit_reason = 'Exit (Next Candle 2)'
                    exit_price = close_p

            elif pos_type == 'Short':
                # a. Stop Loss: Break Supertrend (Close > Supertrend hoặc ST đảo chiều)
                if trade_sl_type == 'break_supertrend' and (close_p > st_val or st_dir == 1):
                    is_closed = True
                    exit_reason = 'StopLoss (Break Supertrend)'
                    exit_price = close_p
                # b. Stop Loss: Chạm Upper Band (Stop order tại Upper Band của nến hiện tại, khớp ngay khi high chạm Upper Band)
                elif trade_sl_type == 'touch_lower_band' and high_p >= bb_up:
                    is_closed = True
                    exit_reason = 'StopLoss (Chạm Upper Band)'
                    exit_price = max(open_p, bb_up)
                # c. Stop Loss: Đỉnh nến signal / Đỉnh nến entry (Stop order cố định tại mức sl_p)
                elif trade_sl_type in ['signal_candle_low', 'entry_candle_low'] and high_p >= sl_p:
                    is_closed = True
                    exit_reason = f'StopLoss ({sl_label})'
                    exit_price = max(open_p, sl_p)
                # d. Stop Loss: Giá đóng cửa trên MA (Chờ đóng nến Close > Middle Band)
                elif trade_sl_type == 'close_below_ma' and close_p > bb_mid:
                    is_closed = True
                    exit_reason = 'StopLoss (Close > MA)'
                    exit_price = close_p
                # e. Take Profit RRR (1:1, 1.5:1, 2:1, 3:1, 5:1 - Limit order chạm giá TP)
                elif tp_p is not None and low_p <= tp_p:
                    is_closed = True
                    exit_reason = f'TakeProfit ({tp_label})'
                    exit_price = min(open_p, tp_p) if open_p <= tp_p else tp_p
                # f. Exit condition: Close > Lower Band (Chờ đóng nến > Lower Band)
                elif trade_tp_type == 'close_upper_band' and close_p > bb_low:
                    is_closed = True
                    exit_reason = 'Exit (Close > Lower Band)'
                    exit_price = close_p
                # g. Exit condition: Next Candle 1 (Thoát sau 1 nến kể từ nến entry)
                elif trade_tp_type == 'next_candle_1' and (i - current_trade['entry_index']) >= 1:
                    is_closed = True
                    exit_reason = 'Exit (Next Candle 1)'
                    exit_price = close_p
                # h. Exit condition: Next Candle 2 (Thoát sau 2 nến kể từ nến entry)
                elif trade_tp_type == 'next_candle_2' and (i - current_trade['entry_index']) >= 2:
                    is_closed = True
                    exit_reason = 'Exit (Next Candle 2)'
                    exit_price = close_p

            if is_closed:
                pnl_amount = (exit_price - entry_p) if pos_type == 'Long' else (entry_p - exit_price)
                pnl_percent = (pnl_amount / entry_p) * 100.0

                current_trade['exit_date'] = candle_date
                current_trade['exit_time'] = time_str
                current_trade['exit_price'] = round(exit_price, 2)
                current_trade['exit_reason'] = exit_reason
                current_trade['status'] = 'Closed'
                current_trade['pnl_amount'] = round(pnl_amount, 2)
                current_trade['pnl_percent'] = round(pnl_percent, 2)
                current_trade['holding_bars'] = i - current_trade['entry_index']
                trades.append(current_trade)

                is_win = "TakeProfit" in str(exit_reason) or pnl_amount > 0
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
            else:
                active_trades.append(current_trade)

        open_trades = active_trades

        # -------------------------------------------------------------
        # 2. KIỂM TRA KHỚP LỆNH PENDING TỪ NẾN SIGNAL TRƯỚC ĐÓ
        # -------------------------------------------------------------
        if pending_signal is not None:
            # Kiểm tra thời hạn hiệu lực của pending signal
            bars_elapsed = i - pending_signal['signal_index']
            if bars_elapsed > max_pending_bars:
                pending_signal = None
            elif len(open_trades) < pyramiding:
                p_type = pending_signal['type']
                breakout_price = pending_signal['breakout_price']

                # Chỉ cho phép vào thêm lệnh cùng chiều nếu đã có lệnh mở
                can_entry = (not open_trades or open_trades[0]['type'] == p_type)

                if can_entry and p_type == 'Long' and allow_long:
                    # Breakout qua High nến signal: high_p > breakout_price
                    if high_p > breakout_price:
                        entry_price = max(open_p, breakout_price)

                        # Xác định Stop Loss cho vị thế Long
                        if sl_type == 'break_supertrend':
                            calc_sl = round(st_val, 2)
                            sl_label = 'Break Supertrend'
                        elif sl_type == 'close_below_ma':
                            calc_sl = round(bb_mid, 2)
                            sl_label = 'Close < MA'
                        elif sl_type == 'signal_candle_low':
                            calc_sl = round(pending_signal['signal_low'], 2)
                            sl_label = 'Đáy Signal'
                        elif sl_type == 'entry_candle_low':
                            calc_sl = round(low_p, 2)
                            sl_label = 'Đáy Entry'
                        else:  # touch_lower_band
                            calc_sl = round(bb_low, 2)
                            sl_label = 'Chạm Lower Band'

                        if calc_sl >= entry_price:
                            calc_sl = round(entry_price * 0.99, 2)

                        risk_dist = entry_price - calc_sl

                        # Xác định Take Profit cho vị thế Long
                        if tp_type == 'rr_1':
                            tp_price = round(entry_price + 1.0 * risk_dist, 2)
                            tp_label = 'RRR 1:1'
                        elif tp_type == 'rr_1_5':
                            tp_price = round(entry_price + 1.5 * risk_dist, 2)
                            tp_label = 'RRR 1.5:1'
                        elif tp_type == 'rr_3':
                            tp_price = round(entry_price + 3.0 * risk_dist, 2)
                            tp_label = 'RRR 3:1'
                        elif tp_type == 'rr_5':
                            tp_price = round(entry_price + 5.0 * risk_dist, 2)
                            tp_label = 'RRR 5:1'
                        elif tp_type == 'close_upper_band':
                            tp_price = None
                            tp_label = 'Close < Upper Band'
                        elif tp_type == 'next_candle_1':
                            tp_price = None
                            tp_label = 'Next Candle 1'
                        elif tp_type == 'next_candle_2':
                            tp_price = None
                            tp_label = 'Next Candle 2'
                        else:  # rr_2
                            tp_price = round(entry_price + 2.0 * risk_dist, 2)
                            tp_label = 'RRR 2:1'

                        new_trade = {
                            "type": "Long",
                            "entry_date": candle_date,
                            "entry_time": time_str,
                            "entry_price": round(entry_price, 2),
                            "stop_loss": round(calc_sl, 2),
                            "take_profit": tp_price,
                            "sl_type": sl_type,
                            "tp_type": tp_type,
                            "sl_label": sl_label,
                            "tp_label": tp_label,
                            "entry_index": i,
                            "signal_index": pending_signal['signal_index'],
                            "signal_date": pending_signal['signal_date'],
                            "status": "Open",
                            "rule_name": f"Breakout BB({bb_period},{bb_std}) Upper & ST({st_period},{st_multiplier})"
                        }
                        open_trades.append(new_trade)
                        signals.append({
                            "date": candle_date,
                            "time": time_str,
                            "type": "entry",
                            "action": "Buy",
                            "pos_type": "Long",
                            "price": round(entry_price, 2),
                            "stop_loss": round(calc_sl, 2),
                            "take_profit": tp_price,
                            "rule": {
                                "Name": f"Long Breakout @ {round(entry_price, 2)} | SL ({sl_label}): {round(calc_sl, 2)}" + (f" | TP ({tp_label}): {tp_price}" if tp_price else ""),
                                "Type": "entry"
                            }
                        })
                        pending_signal = None

                elif can_entry and p_type == 'Short' and allow_short:
                    # Breakout qua Low nến signal: low_p < breakout_price
                    if low_p < breakout_price:
                        entry_price = min(open_p, breakout_price)

                        # Xác định Stop Loss cho vị thế Short
                        if sl_type == 'break_supertrend':
                            calc_sl = round(st_val, 2)
                            sl_label = 'Break Supertrend'
                        elif sl_type == 'close_below_ma':
                            calc_sl = round(bb_mid, 2)
                            sl_label = 'Close > MA'
                        elif sl_type == 'signal_candle_low':
                            calc_sl = round(pending_signal['signal_high'], 2)
                            sl_label = 'Đỉnh Signal'
                        elif sl_type == 'entry_candle_low':
                            calc_sl = round(high_p, 2)
                            sl_label = 'Đỉnh Entry'
                        else:  # touch_lower_band
                            calc_sl = round(bb_up, 2)
                            sl_label = 'Chạm Upper Band'

                        if calc_sl <= entry_price:
                            calc_sl = round(entry_price * 1.01, 2)

                        risk_dist = calc_sl - entry_price

                        # Xác định Take Profit cho vị thế Short
                        if tp_type == 'rr_1':
                            tp_price = round(entry_price - 1.0 * risk_dist, 2)
                            tp_label = 'RRR 1:1'
                        elif tp_type == 'rr_1_5':
                            tp_price = round(entry_price - 1.5 * risk_dist, 2)
                            tp_label = 'RRR 1.5:1'
                        elif tp_type == 'rr_3':
                            tp_price = round(entry_price - 3.0 * risk_dist, 2)
                            tp_label = 'RRR 3:1'
                        elif tp_type == 'rr_5':
                            tp_price = round(entry_price - 5.0 * risk_dist, 2)
                            tp_label = 'RRR 5:1'
                        elif tp_type == 'close_upper_band':
                            tp_price = None
                            tp_label = 'Close > Lower Band'
                        elif tp_type == 'next_candle_1':
                            tp_price = None
                            tp_label = 'Next Candle 1'
                        elif tp_type == 'next_candle_2':
                            tp_price = None
                            tp_label = 'Next Candle 2'
                        else:  # rr_2
                            tp_price = round(entry_price - 2.0 * risk_dist, 2)
                            tp_label = 'RRR 2:1'

                        new_trade = {
                            "type": "Short",
                            "entry_date": candle_date,
                            "entry_time": time_str,
                            "entry_price": round(entry_price, 2),
                            "stop_loss": round(calc_sl, 2),
                            "take_profit": tp_price,
                            "sl_type": sl_type,
                            "tp_type": tp_type,
                            "sl_label": sl_label,
                            "tp_label": tp_label,
                            "entry_index": i,
                            "signal_index": pending_signal['signal_index'],
                            "signal_date": pending_signal['signal_date'],
                            "status": "Open",
                            "rule_name": f"Breakout BB({bb_period},{bb_std}) Lower & ST({st_period},{st_multiplier})"
                        }
                        open_trades.append(new_trade)
                        signals.append({
                            "date": candle_date,
                            "time": time_str,
                            "type": "entry",
                            "action": "Sell",
                            "pos_type": "Short",
                            "price": round(entry_price, 2),
                            "stop_loss": round(calc_sl, 2),
                            "take_profit": tp_price,
                            "rule": {
                                "Name": f"Short Breakout @ {round(entry_price, 2)} | SL ({sl_label}): {round(calc_sl, 2)}" + (f" | TP ({tp_label}): {tp_price}" if tp_price else ""),
                                "Type": "entry"
                            }
                        })
                        pending_signal = None

        # -------------------------------------------------------------
        # 3. NHẬN DIỆN NẾN SIGNAL MỚI (CHỈ KHI SỐ LỆNH MỞ < PYRAMIDING)
        # -------------------------------------------------------------
        if len(open_trades) < pyramiding:
            if signal_candle_type == 'both':
                # Cả 2: Thỏa mãn 1 trong 2 điều kiện nến Signal (Upper Band HOẶC Lower Band)
                # Long: (Open < Upper Band và Close > Upper Band) HOẶC (Open < Lower Band và Close > Lower Band)
                #       VÀ (Supertrend tăng: st_dir == 1 hoặc close_p > st_val)
                is_long_upper = (open_p < bb_up) and (close_p > bb_up)
                is_long_lower = (open_p < bb_low) and (close_p > bb_low)
                is_long_signal = (is_long_upper or is_long_lower) and (st_dir == 1 or close_p > st_val)

                # Short: (Open > Lower Band và Close < Lower Band) HOẶC (Open > Upper Band và Close < Upper Band)
                #        VÀ (Supertrend giảm: st_dir == -1 hoặc close_p < st_val)
                is_short_lower = (open_p > bb_low) and (close_p < bb_low)
                is_short_upper = (open_p > bb_up) and (close_p < bb_up)
                is_short_signal = (is_short_lower or is_short_upper) and (st_dir == -1 or close_p < st_val)
            elif signal_candle_type == 'lower_band':
                # Điều kiện nến Signal Long (Bắt đáy/Hồi phục từ Lower Band):
                # - Open < Lower Band (nến mở cửa dưới Lower Band)
                # - Close > Lower Band (nến đóng cửa cắt lên trên Lower Band)
                # - Close > Supertrend (st_dir == 1 hoặc close_p > st_val)
                is_long_signal = (open_p < bb_low) and (close_p > bb_low) and (st_dir == 1 or close_p > st_val)

                # Điều kiện nến Signal Short (Bắt đỉnh/Đảo chiều từ Upper Band):
                # - Open > Upper Band (nến mở cửa trên Upper Band)
                # - Close < Upper Band (nến đóng cửa cắt xuống dưới Upper Band)
                # - Close < Supertrend (st_dir == -1 hoặc close_p < st_val)
                is_short_signal = (open_p > bb_up) and (close_p < bb_up) and (st_dir == -1 or close_p < st_val)
            else:
                # Điều kiện nến Signal Long (Mặc định - Bứt phá Upper Band):
                # - Open < Upper Band (nến mở cửa bên trong/dưới Upper Band)
                # - Close > Upper Band (nến đóng cửa vượt qua Upper Band)
                # - Close > Supertrend (st_dir == 1 hoặc close_p > st_val)
                is_long_signal = (open_p < bb_up) and (close_p > bb_up) and (st_dir == 1 or close_p > st_val)

                # Điều kiện nến Signal Short (Mặc định - Sập gãy Lower Band):
                # - Open > Lower Band (nến mở cửa bên trong/trên Lower Band)
                # - Close < Lower Band (nến đóng cửa xuyên thủng Lower Band)
                # - Close < Supertrend (st_dir == -1 hoặc close_p < st_val)
                is_short_signal = (open_p > bb_low) and (close_p < bb_low) and (st_dir == -1 or close_p < st_val)

            allow_new_long = (not open_trades or open_trades[0]['type'] == 'Long')
            allow_new_short = (not open_trades or open_trades[0]['type'] == 'Short')

            if is_long_signal and allow_long and allow_new_long:
                pending_signal = {
                    "type": "Long",
                    "signal_index": i,
                    "signal_date": candle_date,
                    "breakout_price": high_p,     # Đặt ngưỡng Breakout là High của nến signal
                    "signal_low": low_p,
                    "signal_high": high_p,
                    "bb_low": bb_low,
                    "bb_up": bb_up,
                    "bb_mid": bb_mid
                }

            elif is_short_signal and allow_short and allow_new_short:
                pending_signal = {
                    "type": "Short",
                    "signal_index": i,
                    "signal_date": candle_date,
                    "breakout_price": low_p,      # Đặt ngưỡng Breakout là Low của nến signal
                    "signal_low": low_p,
                    "signal_high": high_p,
                    "bb_low": bb_low,
                    "bb_up": bb_up,
                    "bb_mid": bb_mid
                }

    # Nếu còn lệnh mở ở nến cuối cùng
    if open_trades:
        last_row = df.iloc[-1]
        last_close = float(last_row['close'])
        for current_trade in open_trades:
            pos_type = current_trade['type']
            entry_p = current_trade['entry_price']
            pnl_amount = (last_close - entry_p) if pos_type == 'Long' else (entry_p - last_close)
            pnl_percent = (pnl_amount / entry_p) * 100.0

            current_trade['current_price'] = round(last_close, 2)
            current_trade['unrealized_pnl_percent'] = round(pnl_percent, 2)
            current_trade['unrealized_pnl_amount'] = round(pnl_amount, 2)
            current_trade['holding_bars'] = len(df) - 1 - current_trade['entry_index']
            trades.append(current_trade)

    return {"trades": trades, "signals": signals}

# ==============================================================================
# 4. TÍNH TOÁN HIỆU SUẤT & THỐNG KÊ CHI TIẾT
# ==============================================================================

def calculate_performance_summary(trades: List[Dict]) -> Dict:
    closed_trades = [t for t in trades if t.get("status") == "Closed"]
    open_trades = [t for t in trades if t.get("status") == "Open"]

    if not closed_trades:
        return {
            "totalTrades": len(trades),
            "closedTrades": 0,
            "openTrades": len(open_trades),
            "winTrades": 0,
            "lossTrades": 0,
            "winRate": 0.0,
            "profitFactor": 0.0,
            "totalPnlPercent": 0.0,
            "avgPnlPercent": 0.0,
            "maxWinPercent": 0.0,
            "maxLossPercent": 0.0,
            "maxDrawdown": 0.0,
            "avgHoldingBars": 0.0
        }

    wins = [t for t in closed_trades if t.get("pnl_amount", 0) > 0]
    losses = [t for t in closed_trades if t.get("pnl_amount", 0) <= 0]

    win_count = len(wins)
    loss_count = len(losses)
    total_closed = len(closed_trades)
    win_rate = (win_count / total_closed) * 100.0 if total_closed > 0 else 0.0

    total_profit = sum(t.get("pnl_amount", 0) for t in wins)
    total_loss = abs(sum(t.get("pnl_amount", 0) for t in losses))

    profit_factor = round(total_profit / total_loss, 2) if total_loss > 0 else (99.0 if total_profit > 0 else 0.0)
    total_pnl_pct = sum(t.get("pnl_percent", 0) for t in closed_trades)
    avg_pnl_pct = total_pnl_pct / total_closed if total_closed > 0 else 0.0

    pnl_percents = [t.get("pnl_percent", 0) for t in closed_trades]
    max_win = max(pnl_percents) if pnl_percents else 0.0
    max_loss = min(pnl_percents) if pnl_percents else 0.0

    # Max Drawdown calculation
    equity_curve = [0.0]
    curr = 0.0
    for p in pnl_percents:
        curr += p
        equity_curve.append(curr)

    peak = equity_curve[0]
    max_dd = 0.0
    for val in equity_curve:
        if val > peak:
            peak = val
        dd = peak - val
        if dd > max_dd:
            max_dd = dd

    holding_bars = [t.get("holding_bars", 0) for t in closed_trades]
    avg_bars = sum(holding_bars) / len(holding_bars) if holding_bars else 0.0

    return {
        "totalTrades": len(trades),
        "closedTrades": total_closed,
        "openTrades": len(open_trades),
        "winTrades": win_count,
        "lossTrades": loss_count,
        "winRate": round(win_rate, 2),
        "profitFactor": profit_factor,
        "totalPnlPercent": round(total_pnl_pct, 2),
        "avgPnlPercent": round(avg_pnl_pct, 2),
        "maxWinPercent": round(max_win, 2),
        "maxLossPercent": round(max_loss, 2),
        "maxDrawdown": round(max_dd, 2),
        "avgHoldingBars": round(avg_bars, 1)
    }

def scan_symbol_json(
    ticker: str,
    countback: int = 500,
    bb_period: int = 26,
    bb_std: float = 1.0,
    st_period: int = 10,
    st_multiplier: float = 3.0,
    allow_long: bool = True,
    allow_short: bool = True,
    max_pending_bars: int = 5,
    signal_candle_type: str = "upper_band",
    sl_type: str = "touch_lower_band",
    tp_type: str = "rr_2",
    pyramiding: int = 1,
    timeframe: str = "D1"
) -> Dict:
    """Quét tín hiệu & backtest, trả về JSON chuẩn"""
    df = fetch_market_candles(ticker, countback=countback, timeframe=timeframe)
    if df.empty or len(df) < max(bb_period, st_period) + 5:
        return {
            "success": False,
            "message": f"Không có đủ dữ liệu nến cho mã {ticker} ({timeframe})",
            "trades": [],
            "signals": [],
            "summary": {}
        }

    res = scan_strategy_signals(
        df=df,
        bb_period=bb_period,
        bb_std=bb_std,
        st_period=st_period,
        st_multiplier=st_multiplier,
        allow_long=allow_long,
        allow_short=allow_short,
        max_pending_bars=max_pending_bars,
        signal_candle_type=signal_candle_type,
        sl_type=sl_type,
        tp_type=tp_type,
        pyramiding=pyramiding
    )

    trades = res.get("trades", [])
    signals = res.get("signals", [])
    summary = calculate_performance_summary(trades)

    # Chuẩn bị candles serialization cho TradingViewChart
    chart_df = df.tail(3000) if len(df) > 3000 else df
    dates = chart_df['date'].astype(str).values
    opens = chart_df['open'].astype(float).values
    highs = chart_df['high'].astype(float).values
    lows = chart_df['low'].astype(float).values
    closes = chart_df['close'].astype(float).values
    volumes = chart_df['volume'].astype(float).values
    st_vals = chart_df['supertrend'].values if 'supertrend' in chart_df.columns else [None] * len(chart_df)
    st_dirs = chart_df['st_dir'].values if 'st_dir' in chart_df.columns else [None] * len(chart_df)
    bb_ups = chart_df['bb_upper'].values if 'bb_upper' in chart_df.columns else [None] * len(chart_df)
    bb_mids = chart_df['bb_middle'].values if 'bb_middle' in chart_df.columns else [None] * len(chart_df)
    bb_lows = chart_df['bb_lower'].values if 'bb_lower' in chart_df.columns else [None] * len(chart_df)

    candles_list = []
    for i in range(len(chart_df)):
        d_str = str(dates[i])
        time_str = d_str[11:19] if "T" in d_str else d_str[:10]
        candles_list.append({
            "date": d_str,
            "time": time_str,
            "open": float(opens[i]),
            "high": float(highs[i]),
            "low": float(lows[i]),
            "close": float(closes[i]),
            "volume": float(volumes[i]),
            "supertrend": round(float(st_vals[i]), 2) if pd.notna(st_vals[i]) else None,
            "st_direction": int(st_dirs[i]) if pd.notna(st_dirs[i]) else None,
            "bb_upper": round(float(bb_ups[i]), 2) if pd.notna(bb_ups[i]) else None,
            "bb_middle": round(float(bb_mids[i]), 2) if pd.notna(bb_mids[i]) else None,
            "bb_lower": round(float(bb_lows[i]), 2) if pd.notna(bb_lows[i]) else None,
        })

    return {
        "success": True,
        "ticker": ticker.upper(),
        "timeframe": timeframe,
        "totalCandles": len(df),
        "candles": candles_list,
        "params": {
            "bb_period": bb_period,
            "bb_std": bb_std,
            "st_period": st_period,
            "st_multiplier": st_multiplier,
            "allow_long": allow_long,
            "allow_short": allow_short,
            "max_pending_bars": max_pending_bars,
            "signal_candle_type": signal_candle_type,
            "sl_type": sl_type,
            "tp_type": tp_type,
            "pyramiding": pyramiding
        },
        "summary": summary,
        "trades": trades,
        "signals": signals
    }

# ==============================================================================
# 5. TỐI ƯU HÓA CHIẾN LƯỢC (OPTIMIZATION ENGINE)
# ==============================================================================

def optimize_bollinger_supertrend(
    ticker: str,
    timeframe: str = "D1",
    countback: int = 1000,
    allow_long: bool = True,
    allow_short: bool = True,
    current_bb_period: int = 26,
    current_bb_std: float = 1.0,
    current_st_period: int = 10,
    current_st_multiplier: float = 3.0,
    current_max_pending_bars: int = 5,
    current_signal_candle_type: str = "upper_band",
    current_sl_type: str = "touch_lower_band",
    current_tp_type: str = "rr_2",
    current_pyramiding: int = 1,
    opt_config: Dict = None
) -> Dict:
    df = fetch_market_candles(ticker, countback=countback, timeframe=timeframe)
    if df.empty or len(df) < 50:
        return {
            "success": False,
            "message": f"Không đủ dữ liệu để tối ưu hóa ({len(df)} nến)",
            "summary": {},
            "bestParams": {},
            "topConfigs": []
        }

    opt_cfg = opt_config or {}

    bb_periods = [14, 20, 26, 34, 50] if opt_cfg.get("bbPeriod", True) else [current_bb_period]
    bb_stds = [0.8, 1.0, 1.5, 2.0] if opt_cfg.get("bbStd", True) else [current_bb_std]
    st_periods = [7, 10, 14, 20] if opt_cfg.get("stPeriod", True) else [current_st_period]
    st_mults = [1.5, 2.0, 2.5, 3.0, 3.5] if opt_cfg.get("stMultiplier", True) else [current_st_multiplier]
    pending_bars = [2, 3, 5, 8] if opt_cfg.get("maxPendingBars", False) else [current_max_pending_bars]
    signal_candle_types = ["upper_band", "lower_band", "both"] if opt_cfg.get("signalCandleType", False) else [current_signal_candle_type]
    sl_types = ["break_supertrend", "close_below_ma", "touch_lower_band", "signal_candle_low", "entry_candle_low"] if opt_cfg.get("slType", False) else [current_sl_type]
    tp_types = ["rr_1", "rr_1_5", "rr_2", "rr_3", "rr_5", "close_upper_band", "next_candle_1", "next_candle_2"] if opt_cfg.get("tpType", False) else [current_tp_type]
    pyramidings = [1, 2, 3, 5] if opt_cfg.get("pyramiding", False) else [current_pyramiding]

    all_candidates = []
    best_score = None
    best_combo = None

    for bbp in bb_periods:
        for bbs in bb_stds:
            for stp in st_periods:
                for stm in st_mults:
                    for pb in pending_bars:
                        for sct in signal_candle_types:
                            for sl_t in sl_types:
                                for tp_t in tp_types:
                                    for pyr in pyramidings:
                                        res = scan_strategy_signals(
                                            df=df,
                                            bb_period=bbp,
                                            bb_std=bbs,
                                            st_period=stp,
                                            st_multiplier=stm,
                                            allow_long=allow_long,
                                            allow_short=allow_short,
                                            max_pending_bars=pb,
                                            signal_candle_type=sct,
                                            sl_type=sl_t,
                                            tp_type=tp_t,
                                            pyramiding=pyr
                                        )
                                        trades = res.get("trades", [])
                                        closed_trades = [t for t in trades if t.get("status") == "Closed"]
                                        if not closed_trades:
                                            continue

                                        wins = [t for t in closed_trades if t.get("pnl_amount", 0) > 0]
                                        losses = [t for t in closed_trades if t.get("pnl_amount", 0) <= 0]
                                        trades_count = len(closed_trades)
                                        win_count = len(wins)
                                        loss_count = len(losses)
                                        win_rate = (win_count / trades_count) * 100.0 if trades_count > 0 else 0.0

                                        gross_profit = sum(t.get("pnl_amount", 0) for t in wins)
                                        gross_loss = abs(sum(t.get("pnl_amount", 0) for t in losses))
                                        total_pnl = sum(t.get("pnl_percent", 0) for t in closed_trades)

                                        pf = round(gross_profit / gross_loss, 2) if gross_loss > 0 else (99.0 if gross_profit > 0 else 0.0)
                                        capped_pf = min(pf, 10.0)

                                        if trades_count >= 15 and total_pnl > 0 and pf >= 1.2:
                                            tier = 4
                                        elif trades_count >= 8 and total_pnl > 0 and pf >= 1.1:
                                            tier = 3
                                        elif trades_count >= 4 and total_pnl > 0:
                                            tier = 2
                                        elif trades_count >= 2:
                                            tier = 1
                                        else:
                                            tier = 0

                                        trade_weight = np.sqrt(trades_count)
                                        wr_factor = 1.0 if win_rate >= 40.0 else max(0.2, win_rate / 40.0)
                                        pnl_weight = max(0.1, total_pnl) if total_pnl > 0 else (total_pnl / 10.0)
                                        fitness = capped_pf * trade_weight * pnl_weight * wr_factor
                                        score = (tier, round(fitness, 4), total_pnl, capped_pf, trades_count)

                                        candidate = {
                                            "score": score,
                                            "profitFactor": pf,
                                            "winRate": round(win_rate, 2),
                                            "totalTrades": trades_count,
                                            "winTrades": win_count,
                                            "lossTrades": loss_count,
                                            "totalPnlPercent": round(total_pnl, 2),
                                            "bbPeriod": bbp,
                                            "bbStd": bbs,
                                            "stPeriod": stp,
                                            "stMultiplier": stm,
                                            "maxPendingBars": pb,
                                            "signalCandleType": sct,
                                            "slType": sl_t,
                                            "tpType": tp_t,
                                            "pyramiding": pyr
                                        }
                                        all_candidates.append(candidate)

                                        if best_score is None or score > best_score:
                                            best_score = score
                                            best_combo = {
                                                "bbPeriod": bbp,
                                                "bbStd": bbs,
                                                "stPeriod": stp,
                                                "stMultiplier": stm,
                                                "maxPendingBars": pb,
                                                "signalCandleType": sct,
                                                "slType": sl_t,
                                                "tpType": tp_t,
                                                "pyramiding": pyr
                                            }

    top_configs = []
    if all_candidates:
        all_candidates.sort(key=lambda x: x["score"], reverse=True)
        seen = set()
        for c in all_candidates:
            key = (c["bbPeriod"], c["bbStd"], c["stPeriod"], c["stMultiplier"], c["maxPendingBars"], c["signalCandleType"], c["slType"], c["tpType"], c["pyramiding"])
            if key not in seen:
                seen.add(key)
                item = {k: v for k, v in c.items() if k != "score"}
                top_configs.append(item)
                if len(top_configs) >= 20:
                    break

    if not best_combo:
        best_combo = {
            "bbPeriod": current_bb_period,
            "bbStd": current_bb_std,
            "stPeriod": current_st_period,
            "stMultiplier": current_st_multiplier,
            "maxPendingBars": current_max_pending_bars,
            "signalCandleType": current_signal_candle_type,
            "slType": current_sl_type,
            "tpType": current_tp_type,
            "pyramiding": current_pyramiding
        }

    # Chạy lại với best combo để lấy full kết quả trades và signals
    final_res = scan_strategy_signals(
        df=df,
        bb_period=best_combo["bbPeriod"],
        bb_std=best_combo["bbStd"],
        st_period=best_combo["stPeriod"],
        st_multiplier=best_combo["stMultiplier"],
        allow_long=allow_long,
        allow_short=allow_short,
        max_pending_bars=best_combo["maxPendingBars"],
        signal_candle_type=best_combo["signalCandleType"],
        sl_type=best_combo["slType"],
        tp_type=best_combo["tpType"],
        pyramiding=best_combo.get("pyramiding", 1)
    )
    final_summary = calculate_performance_summary(final_res.get("trades", []))

    chart_df = df.tail(3000) if len(df) > 3000 else df
    dates = chart_df['date'].astype(str).values
    opens = chart_df['open'].astype(float).values
    highs = chart_df['high'].astype(float).values
    lows = chart_df['low'].astype(float).values
    closes = chart_df['close'].astype(float).values
    volumes = chart_df['volume'].astype(float).values
    st_vals = chart_df['supertrend'].values if 'supertrend' in chart_df.columns else [None] * len(chart_df)
    st_dirs = chart_df['st_dir'].values if 'st_dir' in chart_df.columns else [None] * len(chart_df)
    bb_ups = chart_df['bb_upper'].values if 'bb_upper' in chart_df.columns else [None] * len(chart_df)
    bb_mids = chart_df['bb_middle'].values if 'bb_middle' in chart_df.columns else [None] * len(chart_df)
    bb_lows = chart_df['bb_lower'].values if 'bb_lower' in chart_df.columns else [None] * len(chart_df)

    candles_list = []
    for i in range(len(chart_df)):
        d_str = str(dates[i])
        time_str = d_str[11:19] if "T" in d_str else d_str[:10]
        candles_list.append({
            "date": d_str,
            "time": time_str,
            "open": float(opens[i]),
            "high": float(highs[i]),
            "low": float(lows[i]),
            "close": float(closes[i]),
            "volume": float(volumes[i]),
            "supertrend": round(float(st_vals[i]), 2) if pd.notna(st_vals[i]) else None,
            "st_direction": int(st_dirs[i]) if pd.notna(st_dirs[i]) else None,
            "bb_upper": round(float(bb_ups[i]), 2) if pd.notna(bb_ups[i]) else None,
            "bb_middle": round(float(bb_mids[i]), 2) if pd.notna(bb_mids[i]) else None,
            "bb_lower": round(float(bb_lows[i]), 2) if pd.notna(bb_lows[i]) else None,
        })

    return {
        "success": True,
        "ticker": ticker.upper(),
        "timeframe": timeframe,
        "totalCandles": len(df),
        "candles": candles_list,
        "summary": final_summary,
        "bestParams": best_combo,
        "topConfigs": top_configs,
        "trades": final_res.get("trades", []),
        "signals": final_res.get("signals", [])
    }

# ==============================================================================
# 6. CLI & MAIN RUNNER
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(description="Bollinger Bands (26, 1) + Supertrend (10, 3) Breakout Strategy")
    parser.add_argument("--ticker", type=str, default="BTCUSDT", help="Mã cổ phiếu / Crypto (VD: BTCUSDT, VNINDEX, FPT, QQQ)")
    parser.add_argument("--timeframe", type=str, default="D1", help="Khung thời gian (M1, M5, M15, M30, H1, H4, D1, W1)")
    parser.add_argument("--countback", type=int, default=1000, help="Số lượng nến lịch sử")

    # Tham số chỉ báo
    parser.add_argument("--bb-period", type=int, default=DEFAULT_BB_PERIOD, help="Chu kỳ Bollinger Band (mặc định: 26)")
    parser.add_argument("--bb-std", type=float, default=DEFAULT_BB_STD, help="Độ lệch chuẩn Bollinger Band (mặc định: 1.0)")
    parser.add_argument("--st-period", type=int, default=DEFAULT_ST_PERIOD, help="Chu kỳ Supertrend (mặc định: 10)")
    parser.add_argument("--st-multiplier", type=float, default=DEFAULT_ST_MULTIPLIER, help="Hệ số Supertrend ATR Multiplier (mặc định: 3.0)")

    # Tùy chọn Signal Candle, Stop Loss, Take Profit & Pyramiding
    parser.add_argument("--signal-candle-type", type=str, default="upper_band", help="Loại nến Signal (both: Cả 2 | upper_band: Close > Upper, Open < Upper | lower_band: Close > Lower, Open < Lower)")
    parser.add_argument("--sl-type", type=str, default="touch_lower_band", help="Phương pháp Stop Loss (break_supertrend, close_below_ma, touch_lower_band, signal_candle_low, entry_candle_low)")
    parser.add_argument("--tp-type", type=str, default="rr_2", help="Phương pháp Take Profit (rr_1, rr_1_5, rr_2, rr_3, rr_5, close_upper_band, next_candle_1, next_candle_2)")
    parser.add_argument("--pyramiding", type=int, default=1, help="Số lượng lệnh vào tối đa đồng thời (Pyramiding)")

    # Tùy chọn vị thế
    parser.add_argument("--allow-long", dest="allow_long", action="store_true", default=True, help="Cho phép lệnh Long")
    parser.add_argument("--no-long", dest="allow_long", action="store_false", help="Tắt lệnh Long")
    parser.add_argument("--allow-short", dest="allow_short", action="store_true", default=True, help="Cho phép lệnh Short")
    parser.add_argument("--no-short", dest="allow_short", action="store_false", help="Tắt lệnh Short")
    parser.add_argument("--max-pending-bars", type=int, default=5, help="Số nến tối đa chờ breakout sau nến signal")

    # Tối ưu hóa
    parser.add_argument("--optimize", action="store_true", default=False, help="Chạy tối ưu hóa tham số")
    parser.add_argument("--opt-config", type=str, default="{}", help="Cấu hình cờ tối ưu hóa JSON")

    # Định dạng output
    parser.add_argument("--json", action="store_true", default=False, help="In kết quả dưới dạng JSON")

    args = parser.parse_args()

    if args.optimize:
        opt_cfg = {}
        if args.opt_config:
            try:
                opt_cfg = json.loads(args.opt_config)
            except Exception:
                opt_cfg = {}

        result = optimize_bollinger_supertrend(
            ticker=args.ticker,
            timeframe=args.timeframe,
            countback=args.countback,
            allow_long=args.allow_long,
            allow_short=args.allow_short,
            current_bb_period=args.bb_period,
            current_bb_std=args.bb_std,
            current_st_period=args.st_period,
            current_st_multiplier=args.st_multiplier,
            current_max_pending_bars=args.max_pending_bars,
            current_signal_candle_type=args.signal_candle_type,
            current_sl_type=args.sl_type,
            current_tp_type=args.tp_type,
            current_pyramiding=args.pyramiding,
            opt_config=opt_cfg
        )
    else:
        result = scan_symbol_json(
            ticker=args.ticker,
            countback=args.countback,
            bb_period=args.bb_period,
            bb_std=args.bb_std,
            st_period=args.st_period,
            st_multiplier=args.st_multiplier,
            allow_long=args.allow_long,
            allow_short=args.allow_short,
            max_pending_bars=args.max_pending_bars,
            signal_candle_type=args.signal_candle_type,
            sl_type=args.sl_type,
            tp_type=args.tp_type,
            pyramiding=args.pyramiding,
            timeframe=args.timeframe
        )

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        if not result.get("success"):
            print(f"[!] Lỗi: {result.get('message')}")
            return

        summary = result.get("summary", {})
        trades = result.get("trades", [])

        if args.optimize:
            bp = result.get("bestParams", {})
            print("=" * 75)
            print(f" KẾT QUẢ TỐI ƯU HÓA: BOLLINGER BAND + SUPERTREND BREAKOUT")
            print(f" Mã: {result.get('ticker')} | Timeframe: {result.get('timeframe')} | Số nến: {result.get('totalCandles')}")
            print(f" Tham số tốt nhất: BB({bp.get('bbPeriod')}, {bp.get('bbStd')}) | ST({bp.get('stPeriod')}, {bp.get('stMultiplier')}) | SL: {bp.get('slType')} | TP: {bp.get('tpType')} | Pyramiding: {bp.get('pyramiding', 1)}")
            print("=" * 75)
            print(f"  • Tỷ lệ Thắng (WinRate): {summary.get('winRate')}% ({summary.get('closedTrades')} lệnh)")
            print(f"  • Profit Factor        : {summary.get('profitFactor')}")
            print(f"  • Tổng Lợi nhuận PnL   : {summary.get('totalPnlPercent'):+.2f}%")
            print(f"  • Max Drawdown         : {summary.get('maxDrawdown'):.2f}%")
            print("=" * 75)
        else:
            print("=" * 75)
            print(f" CHIẾN LƯỢC: BOLLINGER BAND ({args.bb_period}, {args.bb_std}) + SUPERTREND ({args.st_period}, {args.st_multiplier}) BREAKOUT")
            print(f" Mã: {result.get('ticker')} | Timeframe: {result.get('timeframe')} | SL: {args.sl_type} | TP: {args.tp_type} | Pyramiding: {args.pyramiding}")
            print("=" * 75)
            print(f"  • Tổng số lệnh       : {summary.get('totalTrades')} (Đã đóng: {summary.get('closedTrades')}, Đang mở: {summary.get('openTrades')})")
            print(f"  • Lệnh Thắng / Thua  : {summary.get('winTrades')} Thắng / {summary.get('lossTrades')} Thua")
            print(f"  • Tỷ lệ Thắng (WinRate): {summary.get('winRate')}%")
            print(f"  • Profit Factor      : {summary.get('profitFactor')}")
            print(f"  • Tổng Lợi nhuận PnL : {summary.get('totalPnlPercent'):+.2f}%")
            print(f"  • PnL Trung bình/Lệnh: {summary.get('avgPnlPercent'):+.2f}%")
            print(f"  • Max Drawdown       : {summary.get('maxDrawdown'):.2f}%")
            print("=" * 75)

        if trades:
            print(f"\n[*] 10 LỆNH GẦN NHẤT:")
            print(f"{'Loại':<6} | {'Ngày Vào':<12} | {'Giá Vào':<10} | {'Stop Loss':<10} | {'Take Profit':<11} | {'Ngày Ra':<12} | {'Giá Ra':<10} | {'PnL %':<9} | {'Lý do thoát'}")
            print("-" * 105)
            for t in trades[-10:]:
                p_type = t.get("type", "")
                e_date = t.get("entry_time", "") or t.get("entry_date", "")[:10]
                e_price = f"{t.get('entry_price', 0):.2f}"
                sl_price = f"{t.get('stop_loss', 0):.2f}"
                tp_price = f"{t.get('take_profit', 0):.2f}" if t.get('take_profit') else "-"
                x_date = t.get("exit_time", "") or (t.get("exit_date", "")[:10] if t.get("exit_date") else "Đang mở")
                x_price = f"{t.get('exit_price', 0):.2f}" if t.get("exit_price") else "-"
                pnl = f"{t.get('pnl_percent', t.get('unrealized_pnl_percent', 0)):+.2f}%"
                reason = t.get("exit_reason", "Đang mở vị thế")
                print(f"{p_type:<6} | {e_date:<12} | {e_price:<10} | {sl_price:<10} | {tp_price:<11} | {x_date:<12} | {x_price:<10} | {pnl:<9} | {reason}")
            print("=" * 105)

if __name__ == "__main__":
    main()

