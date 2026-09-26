"""
fetch_crypto_history.py - Công cụ tải dữ liệu Crypto chuyên sâu từ Binance
Hỗ trợ lấy tối đa lịch sử nến khung M5 (hoặc M1, M15, M30, H1, H4, D1...) từ Binance
và lưu trữ vào Strapi Symbol-History hoặc file CSV/JSON.

Cách sử dụng CLI:
    python fetch_crypto_history.py --symbol BTCUSDT --timeframe M5 --count 50000
    python fetch_crypto_history.py --symbol ETHUSDT.P --timeframe M5 --count 100000 --save-strapi
    python fetch_crypto_history.py --symbols BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,DOGEUSDT --timeframe M5 --count 50000
    python fetch_crypto_history.py --symbol SOLUSDT --timeframe M5 --max --save-csv
"""

import sys
import os
import argparse
import time
import pandas as pd
from datetime import datetime
from binance_data_helper import (
    fetch_binance_candles,
    sync_candles_to_strapi_bulk,
    get_or_create_symbol_in_strapi,
    map_timeframe_to_binance,
    STRAPI_BASE_URL
)

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def fetch_and_save_symbol_history(
    symbol: str,
    timeframe: str = "M5",
    count: int = 50000,
    save_strapi: bool = True,
    save_csv: bool = False,
    output_dir: str = "symbol-history"
):
    clean_sym = symbol.strip().upper()
    print(f"\n=======================================================")
    print(f"🚀 Bắt đầu tải dữ liệu nến Binance cho [{clean_sym}] (Khung: {timeframe.upper()})...")
    print(f"🎯 Mục tiêu số lượng nến: {count:,} nến")
    print(f"=======================================================")

    t0 = time.time()
    df = fetch_binance_candles(clean_sym, countback=count, timeframe=timeframe, auto_boost=False)
    elapsed = time.time() - t0

    if df.empty or len(df) == 0:
        print(f"❌ Không lấy được dữ liệu nến từ Binance cho [{clean_sym}]. Vui lòng kiểm tra lại tên mã!")
        return None

    first_dt = df['date'].iloc[0]
    last_dt = df['date'].iloc[-1]
    print(f"✅ Đã tải thành công {len(df):,} nến trong {elapsed:.2f} giây!")
    print(f"📅 Khoảng thời gian: Từ [{first_dt}] Đến [{last_dt}]")

    # 1. Lưu vào file CSV nếu yêu cầu
    if save_csv:
        try:
            os.makedirs(output_dir, exist_ok=True)
            csv_path = os.path.join(output_dir, f"{clean_sym.replace(':', '_')}_{timeframe.upper()}.csv")
            df.to_csv(csv_path, index=False)
            print(f"💾 Đã lưu file CSV tại: {csv_path}")
        except Exception as e:
            print(f"⚠️ Không thể lưu CSV: {e}")

    # 2. Đồng bộ vào Strapi symbol-history
    if save_strapi:
        print(f"📡 Đang đồng bộ {len(df):,} nến vào Strapi symbol-histories ({STRAPI_BASE_URL})...")
        try:
            saved_count = sync_candles_to_strapi_bulk(clean_sym, df, timeframe=timeframe, max_sync=len(df))
            if saved_count > 0:
                print(f"🎉 Đã đồng bộ thành công {saved_count:,} nến vào Strapi symbol-history!")
            else:
                print(f"ℹ️ Không thể kết nối tới Strapi hoặc Strapi chưa chạy (URL: {STRAPI_BASE_URL}). Dữ liệu DataFrame đã sẵn sàng cho Python Strategy.")
        except Exception as e:
            print(f"⚠️ Lỗi khi lưu vào Strapi: {e}")

    return df

def main():
    parser = argparse.ArgumentParser(description="Tải dữ liệu Crypto lịch sử từ Binance & Lưu vào Symbol-History")
    parser.add_argument("--symbol", type=str, default="BTCUSDT", help="Mã crypto (VD: BTCUSDT, ETHUSDT.P, SOLUSDT, BINANCE:BTCUSDT)")
    parser.add_argument("--symbols", type=str, default=None, help="Danh sách mã cách nhau bằng dấu phẩy (VD: BTCUSDT,ETHUSDT,SOLUSDT)")
    parser.add_argument("--timeframe", "-tf", type=str, default="M5", help="Khung thời gian (M1, M5, M15, M30, H1, H4, D1...)")
    parser.add_argument("--count", "-c", type=int, default=50000, help="Số lượng nến tối đa cần lấy (Mặc định: 50,000 nến)")
    parser.add_argument("--max", action="store_true", help="Lấy tối đa lịch sử có thể (100,000+ nến)")
    parser.add_argument("--save-strapi", action="store_true", default=True, help="Lưu vào Strapi symbol-history (Mặc định: True)")
    parser.add_argument("--no-strapi", action="store_true", help="Không lưu vào Strapi")
    parser.add_argument("--save-csv", action="store_true", default=False, help="Lưu ra file CSV")
    parser.add_argument("--output-dir", type=str, default="symbol-history", help="Thư mục lưu file CSV")

    args = parser.parse_args()

    target_count = 150000 if args.max else args.count
    save_strapi = not args.no_strapi

    if args.symbols:
        symbol_list = [s.strip() for s in args.symbols.split(",") if s.strip()]
    else:
        symbol_list = [args.symbol]

    for sym in symbol_list:
        fetch_and_save_symbol_history(
            symbol=sym,
            timeframe=args.timeframe,
            count=target_count,
            save_strapi=save_strapi,
            save_csv=args.save_csv,
            output_dir=args.output_dir
        )

if __name__ == "__main__":
    main()
