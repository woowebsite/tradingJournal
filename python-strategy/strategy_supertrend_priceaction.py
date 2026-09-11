import sys
import os
import time
import json
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
# CẤU HÌNH HỆ THỐNG & CHIẾN LƯỢC SUPERTREND + PRICE ACTION
# ==============================================================================
STRAPI_BASE_URL = os.environ.get("STRAPI_BASE_URL", "http://127.0.0.1:1337").rstrip("/")
STRAPI_API_TOKEN = os.environ.get("STRAPI_API_TOKEN", "")

SUPERTREND_PERIOD = 10
SUPERTREND_MULTIPLIER = 3.0

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
        if not df_binance.empty:
            return df_binance

    resolution_24h = map_timeframe_to_24h(tf)
    url_24h = f"https://api.24hmoney.vn/tradingview/history?symbol={ticker_clean}&resolution={resolution_24h}&countback={req_count}"
    try:
        res = requests.get(url_24h, timeout=12)
        if res.status_code == 200:
            data = res.json()
            if data.get("s") == "ok" and "t" in data and len(data["t"]) > 0:
                candles = []
                multiplier = 1000 if ticker_clean not in ["VNINDEX", "VN30", "HNX", "UPCOM", "VN30F1M"] and float(data["c"][0]) < 500 and not is_crypto_symbol(ticker_clean) else 1
                is_daily = tf.upper() in ["D1", "1D", "D", "W1", "1W", "W"]

                for i in range(len(data["t"])):
                    dt = datetime.fromtimestamp(data["t"][i], tz=timezone.utc)
                    candles.append({
                        "date": dt.strftime("%Y-%m-%dT00:00:00.000Z") if is_daily else dt.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                        "time": dt.strftime("%Y-%m-%d") if is_daily else dt.strftime("%H:%M:%S"),
                        "open": round(float(data["o"][i]) * multiplier, 2),
                        "high": round(float(data["h"][i]) * multiplier, 2),
                        "low": round(float(data["l"][i]) * multiplier, 2),
                        "close": round(float(data["c"][i]) * multiplier, 2),
                        "volume": float(data["v"][i]),
                    })
                df_ext = pd.DataFrame(candles)
                df_ext["dt"] = pd.to_datetime(df_ext["date"])
                return df_ext.drop_duplicates(subset=["date"]).sort_values("dt").reset_index(drop=True)
    except Exception:
        pass

    return fetch_history_from_strapi(ticker_clean, countback=req_count, timeframe=tf)

# ==============================================================================
# 2. CHỈ BÁO: SUPERTREND & SPREAD PERCENTILES
# ==============================================================================

def calculate_supertrend(df: pd.DataFrame, period: int = 10, multiplier: float = 3.0) -> Tuple[pd.Series, pd.Series]:
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
        "minPrice": round(float(np.min(price_spreads)), 2),
        "p25Price": round(float(np.percentile(price_spreads, 25)), 2),
        "medianPrice": round(float(np.percentile(price_spreads, 50)), 2),
        "p75Price": round(float(np.percentile(price_spreads, 75)), 2),
        "p90Price": round(float(np.percentile(price_spreads, 90)), 2),
        "p99Price": round(float(np.percentile(price_spreads, 99)), 2),
        "maxPrice": round(float(np.max(price_spreads)), 2),
        "avgPrice": round(float(np.mean(price_spreads)), 2),

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
# 3. NHẬN DIỆN CÁC MÔ HÌNH PRICE ACTION
# ==============================================================================

def check_engulfing(df: pd.DataFrame, i: int) -> Tuple[bool, bool]:
    """
    1. Engulfing: Nến đóng cửa vượt qua nến trước
    - Long: Nến xanh (close > open) và close[i] > high[i-1] (hoặc max(open, close) nến trước)
    - Short: Nến đỏ (close < open) và close[i] < low[i-1] (hoặc min(open, close) nến trước)
    """
    if i < 1:
        return False, False
    row = df.iloc[i]
    prev = df.iloc[i - 1]

    is_bull = (row['close'] > row['open']) and (row['close'] > max(prev['high'], prev['open'], prev['close']))
    is_bear = (row['close'] < row['open']) and (row['close'] < min(prev['low'], prev['open'], prev['close']))
    return is_bull, is_bear

def check_bd3bu2(df: pd.DataFrame, i: int) -> Tuple[bool, bool]:
    """
    2. BD3BU2 & BU3BD2:
    - Mô hình gồm 6 nến (từ i-5 đến i, với nến i là nến 0 bên phải ngoài cùng).
    - BD3BU2 (Bullish): Nến số 2 (i-2) thấp nhất trong 6 nến. Nến 0 (i) cao hơn 2 nến trước nó (i-1 và i-2).
    - BU3BD2 (Bearish): Nến số 2 (i-2) cao nhất trong 6 nến. Nến 0 (i) thấp hơn 2 nến trước nó (i-1 và i-2).
    """
    if i < 5:
        return False, False

    lows = df['low'].iloc[i - 5 : i + 1].values
    highs = df['high'].iloc[i - 5 : i + 1].values
    closes = df['close'].iloc[i - 5 : i + 1].values

    # nến số 2 tính từ phải sang trái là index 3 trong cửa sổ 6 nến [0, 1, 2, 3, 4, 5], tương ứng i-2
    # lows[3] là nến i-2
    is_bd3bu2 = (lows[3] == np.min(lows)) and (closes[5] > closes[4]) and (closes[5] > closes[3])
    is_bu3bd2 = (highs[3] == np.max(highs)) and (closes[5] < closes[4]) and (closes[5] < closes[3])

    return is_bd3bu2, is_bu3bd2

def check_include_opposite(df: pd.DataFrame, i: int) -> Tuple[bool, bool]:
    """
    3. IncludeOpposite:
    - Long: Nến xanh cao hơn 2 nến trước đó (Close[i] > max(Close[i-1], Close[i-2])). Trong đó có ít nhất 1 nến đỏ trong 2 nến trước.
    - Short: Nến đỏ thấp hơn 2 nến trước đó (Close[i] < min(Close[i-1], Close[i-2])). Trong đó có ít nhất 1 nến xanh trong 2 nến trước.
    """
    if i < 2:
        return False, False

    c0 = df['close'].iloc[i]
    o0 = df['open'].iloc[i]
    c1 = df['close'].iloc[i - 1]
    o1 = df['open'].iloc[i - 1]
    c2 = df['close'].iloc[i - 2]
    o2 = df['open'].iloc[i - 2]

    # Long: Nến xanh, cao hơn 2 nến trước, có ít nhất 1 nến đỏ
    is_long = (c0 > o0) and (c0 > max(c1, c2)) and ((c1 < o1) or (c2 < o2))

    # Short: Nến đỏ, thấp hơn 2 nến trước, có ít nhất 1 nến xanh
    is_short = (c0 < o0) and (c0 < min(c1, c2)) and ((c1 > o1) or (c2 > o2))

    return is_long, is_short

def check_point_pattern(df: pd.DataFrame, i: int) -> Tuple[bool, bool]:
    """
    4. PointUp / PointDown:
    - PointUp: Bộ 3 nến (i-2, i-1, i), nến ở giữa (i-1) có High cao nhất.
    - PointDown: Bộ 3 nến (i-2, i-1, i), nến ở giữa (i-1) có Low thấp nhất.
    - Tín hiệu Long: PointDown tạo xong tại nến i-1 (bắt đầu đảo chiều lên)
    - Tín hiệu Short: PointUp tạo xong tại nến i-1 (bắt đầu đảo chiều xuống)
    """
    if i < 2:
        return False, False

    h0, h1, h2 = df['high'].iloc[i], df['high'].iloc[i - 1], df['high'].iloc[i - 2]
    l0, l1, l2 = df['low'].iloc[i], df['low'].iloc[i - 1], df['low'].iloc[i - 2]

    is_point_up = (h1 > h2) and (h1 > h0)
    is_point_down = (l1 < l2) and (l1 < l0)

    return is_point_down, is_point_up  # PointDown -> kích hoạt tín hiệu Long; PointUp -> kích hoạt tín hiệu Short

def check_swing_pattern(df: pd.DataFrame, i: int) -> Tuple[bool, bool]:
    """
    5. SwingUp / SwingDown:
    - SwingUp: Là PointUp cao nhất, cao hơn PointUp bên trái và bên phải.
    - SwingDown: Là PointDown thấp nhất, thấp hơn PointDown bên trái và bên phải.
    - Tín hiệu Long: Vừa hoàn thành 1 SwingDown (đáy cấu trúc lớn hơn)
    - Tín hiệu Short: Vừa hoàn thành 1 SwingUp (đỉnh cấu trúc lớn hơn)
    """
    if i < 6:
        return False, False

    # Tìm PointUp và PointDown trong cửa sổ 7 nến gần nhất (i-6 đến i)
    lows = df['low'].iloc[i - 6 : i + 1].values
    highs = df['high'].iloc[i - 6 : i + 1].values

    # SwingDown: Đáy i-3 là đáy thấp nhất trong cụm 7 nến và nến hiện tại i đang hồi phục lên
    is_swing_down = (lows[3] == np.min(lows)) and (lows[3] < lows[1]) and (lows[3] < lows[5]) and (df['close'].iloc[i] > df['close'].iloc[i - 1])
    is_swing_up = (highs[3] == np.max(highs)) and (highs[3] > highs[1]) and (highs[3] > highs[5]) and (df['close'].iloc[i] < df['close'].iloc[i - 1])

    return is_swing_down, is_swing_up

# ==============================================================================
# 4. CHIẾN LƯỢC SUPERTREND + PRICE ACTION & SIMULATION (SINGLE POSITION)
# ==============================================================================

def scan_strategy_signals(
    df: pd.DataFrame,
    st_period: int = 10,
    st_multiplier: float = 3.0,
    allow_long: bool = True,
    allow_short: bool = True,
    tp_supertrend: bool = False,
    pa_engulfing: bool = True,
    pa_bd3bu2: bool = True,
    pa_include_opposite: bool = True,
    pa_point_up: bool = False,
    pa_swing_up: bool = False,
    tp_type: str = "P50",
    sl_type: str = "P75",
    custom_tp_val: float = 0.0,
    custom_sl_val: float = 0.0,
    spread_stats: Dict[str, float] = None
) -> Dict:
    if len(df) < st_period + 5:
        return {"trades": [], "signals": []}

    df['supertrend'], df['st_dir'] = calculate_supertrend(df, period=st_period, multiplier=st_multiplier)
    if spread_stats is None:
        spread_stats = calculate_spread_percentiles(df)

    # Xác định giá trị Spread cho TP và SL
    def get_spread_val(target_type: str, custom_val: float) -> float:
        tt = str(target_type or "").upper()
        if custom_val > 0:
            return custom_val
        if tt == "P25":
            return spread_stats.get("p25Price", 0)
        elif tt == "P50" or tt == "MEDIAN":
            return spread_stats.get("medianPrice", 0)
        elif tt == "P75":
            return spread_stats.get("p75Price", 0)
        elif tt == "P90":
            return spread_stats.get("p90Price", 0)
        elif tt == "P99":
            return spread_stats.get("p99Price", 0)
        elif tt == "MIN":
            return spread_stats.get("minPrice", 0)
        elif tt == "MAX":
            return spread_stats.get("maxPrice", 0)
        return spread_stats.get("medianPrice", 0)

    tp_dist = get_spread_val(tp_type, custom_tp_val)
    sl_dist = get_spread_val(sl_type, custom_sl_val)

    # Đảm bảo TP và SL có giá trị tối thiểu hợp lý
    if tp_dist <= 0:
        tp_dist = max(df['close'].iloc[-1] * 0.01, 1.0)
    if sl_dist <= 0:
        sl_dist = max(df['close'].iloc[-1] * 0.015, 1.5)

    has_pa_filter = pa_engulfing or pa_bd3bu2 or pa_include_opposite or pa_point_up or pa_swing_up

    trades = []
    signals = []
    current_trade = None

    for i in range(st_period + 5, len(df)):
        row = df.iloc[i]
        candle_date = str(row['date'])
        time_str = candle_date[:10]
        close_p = float(row['close'])
        open_p = float(row['open'])
        high_p = float(row['high'])
        low_p = float(row['low'])
        st_val = float(row['supertrend']) if not pd.isna(row['supertrend']) else None
        st_dir = int(row['st_dir']) if not pd.isna(row['st_dir']) else 0

        if st_val is None:
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
                if low_p <= sl_p:
                    is_closed = True
                    exit_reason = f'StopLoss ({sl_type})'
                    exit_price = sl_p
                elif high_p >= tp_p:
                    is_closed = True
                    exit_reason = f'TakeProfit ({tp_type})'
                    exit_price = tp_p
                elif tp_supertrend and (st_dir == -1 or close_p < st_val):
                    is_closed = True
                    exit_reason = 'Exit (ST Reversal)'
                    exit_price = close_p

            elif pos_type == 'Short':
                if high_p >= sl_p:
                    is_closed = True
                    exit_reason = f'StopLoss ({sl_type})'
                    exit_price = sl_p
                elif low_p <= tp_p:
                    is_closed = True
                    exit_reason = f'TakeProfit ({tp_type})'
                    exit_price = tp_p
                elif tp_supertrend and (st_dir == 1 or close_p > st_val):
                    is_closed = True
                    exit_reason = 'Exit (ST Reversal)'
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

                is_win = "TakeProfit" in str(exit_reason) or pnl_percent > 0
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
            # Kiểm tra các mô hình Price Action
            pa_long_matched = []
            pa_short_matched = []

            if pa_engulfing:
                b_long, b_short = check_engulfing(df, i)
                if b_long: pa_long_matched.append("Engulfing")
                if b_short: pa_short_matched.append("Engulfing")

            if pa_bd3bu2:
                b_long, b_short = check_bd3bu2(df, i)
                if b_long: pa_long_matched.append("BD3BU2")
                if b_short: pa_short_matched.append("BU3BD2")

            if pa_include_opposite:
                b_long, b_short = check_include_opposite(df, i)
                if b_long: pa_long_matched.append("IncludeOpposite")
                if b_short: pa_short_matched.append("IncludeOpposite")

            if pa_point_up:
                b_long, b_short = check_point_pattern(df, i)
                if b_long: pa_long_matched.append("PointDown")
                if b_short: pa_short_matched.append("PointUp")

            if pa_swing_up:
                b_long, b_short = check_swing_pattern(df, i)
                if b_long: pa_long_matched.append("SwingDown")
                if b_short: pa_short_matched.append("SwingUp")

            # Entry condition: Supertrend Up + (Checked Price Actions matched)
            is_long_entry = False
            is_short_entry = False

            if allow_long and st_dir == 1:
                if has_pa_filter:
                    is_long_entry = len(pa_long_matched) > 0
                else:
                    is_long_entry = close_p > open_p

            if allow_short and st_dir == -1:
                if has_pa_filter:
                    is_short_entry = len(pa_short_matched) > 0
                else:
                    is_short_entry = close_p < open_p

            if is_long_entry:
                entry = close_p
                tp = round(entry + tp_dist, 2)
                sl = round(entry - sl_dist, 2) if sl_type != "supertrend" else round(st_val, 2)
                if sl >= entry:
                    sl = round(entry - sl_dist, 2)

                pa_tag = ", ".join(pa_long_matched) if pa_long_matched else "Standard ST"

                current_trade = {
                    "trade_no": len(trades) + 1,
                    "type": "Long",
                    "entry_date": candle_date,
                    "entry_time": time_str,
                    "entry_price": round(entry, 2),
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
                    "price_action": pa_tag
                }

                signals.append({
                    "date": candle_date,
                    "time": time_str,
                    "type": "entry_long",
                    "action": "Buy",
                    "price": round(entry, 2),
                    "pos_type": "Long",
                    "entry": round(entry, 2),
                    "stop_loss": sl,
                    "take_profit": tp,
                    "pnl_percent": 0.0,
                    "rule": {
                        "Name": f"Long [{pa_tag}] @ {round(entry, 2)} (TP:{tp_type} {tp}, SL:{sl_type} {sl})",
                        "Type": "entry"
                    }
                })

            elif is_short_entry:
                entry = close_p
                tp = round(entry - tp_dist, 2)
                sl = round(entry + sl_dist, 2) if sl_type != "supertrend" else round(st_val, 2)
                if sl <= entry:
                    sl = round(entry + sl_dist, 2)

                pa_tag = ", ".join(pa_short_matched) if pa_short_matched else "Standard ST"

                current_trade = {
                    "trade_no": len(trades) + 1,
                    "type": "Short",
                    "entry_date": candle_date,
                    "entry_time": time_str,
                    "entry_price": round(entry, 2),
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
                    "price_action": pa_tag
                }

                signals.append({
                    "date": candle_date,
                    "time": time_str,
                    "type": "entry_short",
                    "action": "Sell",
                    "price": round(entry, 2),
                    "pos_type": "Short",
                    "entry": round(entry, 2),
                    "stop_loss": sl,
                    "take_profit": tp,
                    "pnl_percent": 0.0,
                    "rule": {
                        "Name": f"Short [{pa_tag}] @ {round(entry, 2)} (TP:{tp_type} {tp}, SL:{sl_type} {sl})",
                        "Type": "entry"
                    }
                })

    # Nếu lệnh cuối cùng còn Open
    if current_trade is not None:
        last_close = float(df['close'].iloc[-1])
        last_pnl_amt = (last_close - current_trade['entry_price']) if current_trade['type'] == 'Long' else (current_trade['entry_price'] - last_close)
        current_trade['pnl_amount'] = round(last_pnl_amt, 2)
        current_trade['pnl_percent'] = round((last_pnl_amt / current_trade['entry_price']) * 100.0, 2)
        current_trade['holding_bars'] = len(df) - 1 - current_trade['entry_index']
        trades.append(current_trade)

    return {"trades": trades, "signals": signals, "spreadStats": spread_stats}

# ==============================================================================
# 5. SCAN SYMBOL JSON RESPONSE (FOR UI)
# ==============================================================================

def scan_symbol_json(
    ticker: str,
    countback: int = 1000,
    st_period: int = 10,
    st_multiplier: float = 3.0,
    allow_long: bool = True,
    allow_short: bool = True,
    tp_supertrend: bool = False,
    pa_engulfing: bool = True,
    pa_bd3bu2: bool = True,
    pa_include_opposite: bool = True,
    pa_point_up: bool = False,
    pa_swing_up: bool = False,
    tp_type: str = "P50",
    sl_type: str = "P75",
    custom_tp_val: float = 0.0,
    custom_sl_val: float = 0.0,
    timeframe: str = "D1"
) -> Dict:
    df = fetch_market_candles(ticker, countback=countback, timeframe=timeframe)
    if df.empty or len(df) < st_period + 5:
        return {
            "ticker": ticker,
            "error": f"Không đủ dữ liệu nến để phân tích (hiện có {len(df)} nến, cần tối thiểu {st_period + 10} nến)",
            "candles": [],
            "signals": [],
            "trades": []
        }

    spread_stats = calculate_spread_percentiles(df)

    res = scan_strategy_signals(
        df,
        st_period=st_period,
        st_multiplier=st_multiplier,
        allow_long=allow_long,
        allow_short=allow_short,
        tp_supertrend=tp_supertrend,
        pa_engulfing=pa_engulfing,
        pa_bd3bu2=pa_bd3bu2,
        pa_include_opposite=pa_include_opposite,
        pa_point_up=pa_point_up,
        pa_swing_up=pa_swing_up,
        tp_type=tp_type,
        sl_type=sl_type,
        custom_tp_val=custom_tp_val,
        custom_sl_val=custom_sl_val,
        spread_stats=spread_stats
    )

    trades = res.get("trades", [])
    signals = res.get("signals", [])

    # Chuẩn bị candles serialization
    chart_df = df.tail(3000) if len(df) > 3000 else df
    dates = chart_df['date'].astype(str).values
    opens = chart_df['open'].astype(float).values
    highs = chart_df['high'].astype(float).values
    lows = chart_df['low'].astype(float).values
    closes = chart_df['close'].astype(float).values
    volumes = chart_df['volume'].astype(float).values
    st_vals = chart_df['supertrend'].values if 'supertrend' in chart_df.columns else [None] * len(chart_df)
    st_dirs = chart_df['st_dir'].values if 'st_dir' in chart_df.columns else [None] * len(chart_df)

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
            "slType": sl_type
        },
        "strategyParams": {
            "stPeriod": st_period,
            "stMultiplier": st_multiplier,
            "allowLong": allow_long,
            "allowShort": allow_short,
            "paEngulfing": pa_engulfing,
            "paBd3bu2": pa_bd3bu2,
            "paIncludeOpposite": pa_include_opposite,
            "paPointUp": pa_point_up,
            "paSwingUp": pa_swing_up,
            "tpType": tp_type,
            "slType": sl_type
        }
    }

# ==============================================================================
# 6. TỐI ƯU HÓA THAM SỐ (BEST PARAMS OPTIMIZER)
# ==============================================================================

def optimize_price_action_strategy(
    ticker: str = "VNINDEX",
    timeframe: str = "D1",
    countback: int = 5000,
    allow_long: bool = True,
    allow_short: bool = True
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

    st_period_grid = [7, 10, 14]
    st_multiplier_grid = [2.0, 3.0, 4.0]
    tp_type_grid = ["P25", "P50", "P75", "P90", "P99"]
    sl_type_grid = ["P50", "P75", "P90", "supertrend"]
    tp_st_grid = [False, True]

    pa_combos = [
        {"pa_engulfing": True, "pa_bd3bu2": True, "pa_include_opposite": True, "pa_point_up": True, "pa_swing_up": True, "name": "All 5 PA"},
        {"pa_engulfing": True, "pa_bd3bu2": True, "pa_include_opposite": True, "pa_point_up": False, "pa_swing_up": False, "name": "Top 3 PA"},
        {"pa_engulfing": False, "pa_bd3bu2": False, "pa_include_opposite": False, "pa_point_up": True, "pa_swing_up": True, "name": "Reversals"},
        {"pa_engulfing": True, "pa_bd3bu2": False, "pa_include_opposite": False, "pa_point_up": False, "pa_swing_up": False, "name": "Engulfing Only"},
        {"pa_engulfing": False, "pa_bd3bu2": True, "pa_include_opposite": False, "pa_point_up": False, "pa_swing_up": False, "name": "BD3BU2 Only"},
        {"pa_engulfing": False, "pa_bd3bu2": False, "pa_include_opposite": True, "pa_point_up": False, "pa_swing_up": False, "name": "IncludeOpposite Only"},
        {"pa_engulfing": False, "pa_bd3bu2": False, "pa_include_opposite": False, "pa_point_up": True, "pa_swing_up": False, "name": "PointUp Only"},
        {"pa_engulfing": False, "pa_bd3bu2": False, "pa_include_opposite": False, "pa_point_up": False, "pa_swing_up": True, "name": "SwingUp Only"},
    ]

    st_cache = {}
    for p in st_period_grid:
        for m in st_multiplier_grid:
            st_cache[(p, m)] = calculate_supertrend(df, period=p, multiplier=m)

    n = len(df)
    engulfing_arr = [check_engulfing(df, i) for i in range(n)]
    bd3bu2_arr = [check_bd3bu2(df, i) for i in range(n)]
    inc_opp_arr = [check_include_opposite(df, i) for i in range(n)]
    point_arr = [check_point_pattern(df, i) for i in range(n)]
    swing_arr = [check_swing_pattern(df, i) for i in range(n)]

    def get_spread_val(target_type: str) -> float:
        tt = str(target_type or "").upper()
        if tt == "P25": return spread_stats.get("p25Price", 0)
        elif tt == "P50" or tt == "MEDIAN": return spread_stats.get("medianPrice", 0)
        elif tt == "P75": return spread_stats.get("p75Price", 0)
        elif tt == "P90": return spread_stats.get("p90Price", 0)
        elif tt == "P99": return spread_stats.get("p99Price", 0)
        return spread_stats.get("medianPrice", 0)

    close_arr = df['close'].values
    high_arr = df['high'].values
    low_arr = df['low'].values

    best_score = None
    best_combo = None

    for p in st_period_grid:
        for m in st_multiplier_grid:
            st_vals, st_dirs = st_cache[(p, m)]
            st_val_arr = st_vals.values
            st_dir_arr = st_dirs.values

            for pa in pa_combos:
                pa_eng = pa["pa_engulfing"]
                pa_bd = pa["pa_bd3bu2"]
                pa_inc = pa["pa_include_opposite"]
                pa_pt = pa["pa_point_up"]
                pa_sw = pa["pa_swing_up"]

                for tp_t in tp_type_grid:
                    tp_dist = get_spread_val(tp_t)
                    if tp_dist <= 0:
                        tp_dist = max(close_arr[-1] * 0.01, 1.0)

                    for sl_t in sl_type_grid:
                        sl_dist = get_spread_val(sl_t)
                        if sl_dist <= 0:
                            sl_dist = max(close_arr[-1] * 0.015, 1.5)

                        for tp_st in tp_st_grid:
                            trades_count = 0
                            win_count = 0
                            loss_count = 0
                            gross_profit = 0.0
                            gross_loss = 0.0
                            total_pnl = 0.0

                            current_trade = None

                            for i in range(p + 5, n):
                                c_p = close_arr[i]
                                h_p = high_arr[i]
                                l_p = low_arr[i]
                                st_v = st_val_arr[i]
                                st_d = st_dir_arr[i]

                                if pd.isna(st_v):
                                    continue

                                if current_trade is not None:
                                    pos_t, entry_p, tp_p, sl_p = current_trade
                                    is_closed = False
                                    exit_p = 0.0

                                    if pos_t == 1:
                                        if l_p <= sl_p:
                                            is_closed = True
                                            exit_p = sl_p
                                        elif h_p >= tp_p:
                                            is_closed = True
                                            exit_p = tp_p
                                        elif tp_st and (st_d == -1 or c_p < st_v):
                                            is_closed = True
                                            exit_p = c_p
                                    else:
                                        if h_p >= sl_p:
                                            is_closed = True
                                            exit_p = sl_p
                                        elif l_p <= tp_p:
                                            is_closed = True
                                            exit_p = tp_p
                                        elif tp_st and (st_d == 1 or c_p > st_v):
                                            is_closed = True
                                            exit_p = c_p

                                    if is_closed:
                                        pnl_pct = ((exit_p - entry_p) / entry_p) * 100.0 if pos_t == 1 else ((entry_p - exit_p) / entry_p) * 100.0
                                        trades_count += 1
                                        total_pnl += pnl_pct
                                        if pnl_pct > 0:
                                            win_count += 1
                                            gross_profit += pnl_pct
                                        else:
                                            loss_count += 1
                                            gross_loss += abs(pnl_pct)

                                        current_trade = None
                                        continue

                                if current_trade is None:
                                    long_matched = False
                                    short_matched = False

                                    if pa_eng:
                                        if engulfing_arr[i][0]: long_matched = True
                                        if engulfing_arr[i][1]: short_matched = True
                                    if pa_bd:
                                        if bd3bu2_arr[i][0]: long_matched = True
                                        if bd3bu2_arr[i][1]: short_matched = True
                                    if pa_inc:
                                        if inc_opp_arr[i][0]: long_matched = True
                                        if inc_opp_arr[i][1]: short_matched = True
                                    if pa_pt:
                                        if point_arr[i][0]: long_matched = True
                                        if point_arr[i][1]: short_matched = True
                                    if pa_sw:
                                        if swing_arr[i][0]: long_matched = True
                                        if swing_arr[i][1]: short_matched = True

                                    if allow_long and st_d == 1 and long_matched:
                                        entry_p = c_p
                                        tp_p = entry_p + tp_dist
                                        sl_p = (entry_p - sl_dist) if sl_t != "supertrend" else st_v
                                        if sl_p >= entry_p:
                                            sl_p = entry_p - sl_dist
                                        current_trade = (1, entry_p, tp_p, sl_p)

                                    elif allow_short and st_d == -1 and short_matched:
                                        entry_p = c_p
                                        tp_p = entry_p - tp_dist
                                        sl_p = (entry_p + sl_dist) if sl_t != "supertrend" else st_v
                                        if sl_p <= entry_p:
                                            sl_p = entry_p + sl_dist
                                        current_trade = (-1, entry_p, tp_p, sl_p)

                            if trades_count == 0:
                                continue

                            pf = round(gross_profit / gross_loss, 2) if gross_loss > 0 else (99.9 if gross_profit > 0 else 0.0)
                            wr = round((win_count / trades_count) * 100.0, 1)
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
                            wr_factor = 1.0 if wr >= 45.0 else max(0.2, wr / 45.0)
                            pnl_weight = max(0.1, total_pnl) if total_pnl > 0 else (total_pnl / 10.0)
                            fitness = capped_pf * trade_weight * pnl_weight * wr_factor

                            score = (tier, round(fitness, 4), total_pnl, capped_pf, trades_count)

                            if best_score is None or score > best_score:
                                best_score = score
                                best_combo = {
                                    "st_period": p,
                                    "st_multiplier": m,
                                    "pa_engulfing": pa_eng,
                                    "pa_bd3bu2": pa_bd,
                                    "pa_include_opposite": pa_inc,
                                    "pa_point_up": pa_pt,
                                    "pa_swing_up": pa_sw,
                                    "tp_type": tp_t,
                                    "sl_type": sl_t,
                                    "tp_supertrend": tp_st,
                                }

    if not best_combo:
        best_combo = {
            "st_period": 10,
            "st_multiplier": 3.0,
            "pa_engulfing": True,
            "pa_bd3bu2": True,
            "pa_include_opposite": True,
            "pa_point_up": False,
            "pa_swing_up": False,
            "tp_type": "P50",
            "sl_type": "P75",
            "tp_supertrend": False
        }

    full_result = scan_symbol_json(
        ticker=ticker,
        countback=len(df),
        st_period=best_combo["st_period"],
        st_multiplier=best_combo["st_multiplier"],
        allow_long=allow_long,
        allow_short=allow_short,
        tp_supertrend=best_combo["tp_supertrend"],
        pa_engulfing=best_combo["pa_engulfing"],
        pa_bd3bu2=best_combo["pa_bd3bu2"],
        pa_include_opposite=best_combo["pa_include_opposite"],
        pa_point_up=best_combo["pa_point_up"],
        pa_swing_up=best_combo["pa_swing_up"],
        tp_type=best_combo["tp_type"],
        sl_type=best_combo["sl_type"],
        timeframe=timeframe
    )

    full_result["bestParams"] = {
        "stPeriod": best_combo["st_period"],
        "stMultiplier": best_combo["st_multiplier"],
        "paEngulfing": best_combo["pa_engulfing"],
        "paBd3bu2": best_combo["pa_bd3bu2"],
        "paIncludeOpposite": best_combo["pa_include_opposite"],
        "paPointUp": best_combo["pa_point_up"],
        "paSwingUp": best_combo["pa_swing_up"],
        "tpType": best_combo["tp_type"],
        "slType": best_combo["sl_type"],
        "tpSupertrend": best_combo["tp_supertrend"],
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
# 7. CLI ENTRY POINT
# ==============================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Supertrend + Price Action Strategy Scanner & Optimizer")
    parser.add_argument("--ticker", type=str, default="VNINDEX", help="Ticker symbol")
    parser.add_argument("--timeframe", type=str, default="D1", help="Timeframe (D1, H1, M15, M5, M1)")
    parser.add_argument("--json", action="store_true", help="Output JSON format")
    parser.add_argument("--optimize", action="store_true", help="Auto optimize best parameters")
    parser.add_argument("--countback", type=int, default=1000, help="Number of candles")

    # Supertrend
    parser.add_argument("--st-period", type=int, default=10, help="Supertrend period")
    parser.add_argument("--st-multiplier", type=float, default=3.0, help="Supertrend multiplier")

    # Direction
    parser.add_argument("--allow-long", dest="allow_long", action="store_true", default=True, help="Allow Long")
    parser.add_argument("--no-long", dest="allow_long", action="store_false", help="Disable Long")
    parser.add_argument("--allow-short", dest="allow_short", action="store_true", default=True, help="Allow Short")
    parser.add_argument("--no-short", dest="allow_short", action="store_false", help="Disable Short")

    # TP Supertrend
    parser.add_argument("--tp-supertrend", dest="tp_supertrend", action="store_true", default=False, help="Exit on Supertrend reversal")
    parser.add_argument("--no-tp-supertrend", dest="tp_supertrend", action="store_false", help="Do not exit on Supertrend reversal")

    # Price Action Checkboxes
    parser.add_argument("--pa-engulfing", dest="pa_engulfing", action="store_true", default=True, help="Engulfing pattern")
    parser.add_argument("--no-pa-engulfing", dest="pa_engulfing", action="store_false", help="Disable Engulfing")

    parser.add_argument("--pa-bd3bu2", dest="pa_bd3bu2", action="store_true", default=True, help="BD3BU2 / BU3BD2 pattern")
    parser.add_argument("--no-pa-bd3bu2", dest="pa_bd3bu2", action="store_false", help="Disable BD3BU2")

    parser.add_argument("--pa-include-opposite", dest="pa_include_opposite", action="store_true", default=True, help="IncludeOpposite pattern")
    parser.add_argument("--no-pa-include-opposite", dest="pa_include_opposite", action="store_false", help="Disable IncludeOpposite")

    parser.add_argument("--pa-point-up", dest="pa_point_up", action="store_true", default=False, help="PointUp / PointDown pattern")
    parser.add_argument("--no-pa-point-up", dest="pa_point_up", action="store_false", help="Disable PointUp")

    parser.add_argument("--pa-swing-up", dest="pa_swing_up", action="store_true", default=False, help="SwingUp / SwingDown pattern")
    parser.add_argument("--no-pa-swing-up", dest="pa_swing_up", action="store_false", help="Disable SwingUp")

    # TP & SL Spread Dropdowns
    parser.add_argument("--tp-type", type=str, default="P50", help="Take Profit spread percentile (P25, P50, P75, P90, P99)")
    parser.add_argument("--sl-type", type=str, default="P75", help="Stop Loss spread percentile (P25, P50, P75, P90, supertrend)")
    parser.add_argument("--custom-tp-val", type=float, default=0.0, help="Custom Take Profit spread value")
    parser.add_argument("--custom-sl-val", type=float, default=0.0, help="Custom Stop Loss spread value")

    args = parser.parse_args()

    if args.optimize:
        res = optimize_price_action_strategy(
            ticker=args.ticker,
            timeframe=args.timeframe,
            countback=args.countback,
            allow_long=args.allow_long,
            allow_short=args.allow_short
        )
    else:
        res = scan_symbol_json(
            ticker=args.ticker,
            countback=args.countback,
            st_period=args.st_period,
            st_multiplier=args.st_multiplier,
            allow_long=args.allow_long,
            allow_short=args.allow_short,
            tp_supertrend=args.tp_supertrend,
            pa_engulfing=args.pa_engulfing,
            pa_bd3bu2=args.pa_bd3bu2,
            pa_include_opposite=args.pa_include_opposite,
            pa_point_up=args.pa_point_up,
            pa_swing_up=args.pa_swing_up,
            tp_type=args.tp_type,
            sl_type=args.sl_type,
            custom_tp_val=args.custom_tp_val,
            custom_sl_val=args.custom_sl_val,
            timeframe=args.timeframe
        )

    if args.json:
        print(json.dumps(res, ensure_ascii=False))
    else:
        summary = res.get("summary", {})
        bp = res.get("bestParams", {})
        if args.optimize:
            print(f"[*] KẾT QUẢ TỐI ƯU HÓA SUPERTREND + PRICE ACTION ({args.ticker} • {args.timeframe}):")
            print(f"    - Bộ tham số tốt nhất: ST({bp.get('stPeriod')}, {bp.get('stMultiplier')}) | TP: {bp.get('tpType')} | SL: {bp.get('slType')}")
            print(f"    - Profit Factor: {summary.get('profitFactor')} | Win Rate: {summary.get('winRate')}% ({summary.get('closedTrades')} trades)")
            print(f"    - Tổng PnL: {summary.get('totalPnlPercent')}%")
        else:
            print(f"[*] KẾT QUẢ QUÉT SUPERTREND + PRICE ACTION ({args.ticker} • {args.timeframe}):")
            print(f"    - Tổng số Trades: {summary.get('totalTrades')} (Thắng: {summary.get('winTrades')}, Thua: {summary.get('lossTrades')})")
            print(f"    - Win Rate: {summary.get('winRate')}% | Profit Factor: {summary.get('profitFactor')}")
            print(f"    - Tổng PnL: {summary.get('totalPnlPercent')}%")

