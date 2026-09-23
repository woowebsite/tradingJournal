/**
 * Fetch Stock / Index / Commodity candlestick history from Yahoo Finance API directly.
 * Supports NASDAQ, QQQ, NDX, SP500, DOWJONES, GOLD, AAPL, TSLA, NVDA, etc.
 * 
 * @param {string} symbol - Ticker (e.g. 'NASDAQ', 'QQQ', 'NDX', 'SP500', 'GOLD', 'AAPL')
 * @param {string} resolution - Interval (e.g. 'D1', 'H1', 'M15', 'M5', 'M1')
 * @param {number} countBack - Number of bars
 * @returns {Promise<Array>} Array of normalized candle objects
 */
export const getYahooFinanceHistory = async (symbol, resolution = 'D1', countBack = 1000) => {
    const rawSymbol = String(symbol || '').trim().toUpperCase();
    if (!rawSymbol) return [];

    const resStr = String(resolution || 'D1').trim().toUpperCase();
    const map = {
        // NASDAQ / US Tech 100
        'USTEC': 'NQ=F',
        'USTECH': 'NQ=F',
        'USTEC.P': 'NQ=F',
        'NAS100': 'NQ=F',
        'NAS100.P': 'NQ=F',
        'NAS100USD': 'NQ=F',
        'US100': 'NQ=F',
        'US100.P': 'NQ=F',
        'NQ': 'NQ=F',
        'NQ=F': 'NQ=F',
        'NASDAQ': '^IXIC',
        'NASDAQ-COMPOSITE': '^IXIC',
        'NASDAQCOMPOSITE': '^IXIC',
        'IXIC': '^IXIC',
        '^IXIC': '^IXIC',
        'NDX': '^NDX',
        '^NDX': '^NDX',
        'NASDAQ100': '^NDX',
        'NASDAQ-100': '^NDX',
        'QQQ': 'QQQ',

        // S&P 500 / US 500
        'US500': 'ES=F',
        'US500.P': 'ES=F',
        'SPX500': 'ES=F',
        'ES': 'ES=F',
        'ES=F': 'ES=F',
        'SP500': '^GSPC',
        'S&P500': '^GSPC',
        'SPX': '^GSPC',
        'GSPC': '^GSPC',
        '^GSPC': '^GSPC',
        'SPY': 'SPY',

        // Dow Jones / US 30
        'US30': 'YM=F',
        'US30.P': 'YM=F',
        'DJ30': 'YM=F',
        'WALLSTREET': 'YM=F',
        'YM': 'YM=F',
        'YM=F': 'YM=F',
        'DOW': '^DJI',
        'DOWJONES': '^DJI',
        'DJI': '^DJI',
        '^DJI': '^DJI',
        'DIA': 'DIA',

        // Europe / Global Indices
        'GER40': '^GDAXI',
        'GER30': '^GDAXI',
        'DAX': '^GDAXI',
        'DAX40': '^GDAXI',
        'UK100': '^FTSE',
        'FTSE': '^FTSE',
        'JPN225': '^N225',
        'NIKKEI': '^N225',
        'HK50': '^HSI',
        'HANGSENG': '^HSI',

        // Commodities
        'GOLD': 'GC=F',
        'GC=F': 'GC=F',
        'XAUUSD': 'GC=F',
        'XAUUSD.P': 'GC=F',
        'SILVER': 'SI=F',
        'SI=F': 'SI=F',
        'XAGUSD': 'SI=F',
        'BRENT': 'BZ=F',
        'BZ=F': 'BZ=F',
        'UKOIL': 'BZ=F',
        'WTI': 'CL=F',
        'CL=F': 'CL=F',
        'USOIL': 'CL=F',
        'CRUDEOIL': 'CL=F',
        'NATGAS': 'NG=F',
        'COPPER': 'HG=F',

        // Currencies / FX / Volatility
        'DXY': 'DX-Y.NYB',
        'DX-Y.NYB': 'DX-Y.NYB',
        'USDX': 'DX-Y.NYB',
        'US10Y': '^TNX',
        '^TNX': '^TNX',
        'VIX': '^VIX',
        '^VIX': '^VIX',
        'EURUSD': 'EURUSD=X',
        'GBPUSD': 'GBPUSD=X',
        'USDJPY': 'USDJPY=X',
        'AUDUSD': 'AUDUSD=X',
        'USDCAD': 'USDCAD=X',
        'USDCHF': 'USDCHF=X',
        'NZDUSD': 'NZDUSD=X',
    };

    const yahooSymbol = map[rawSymbol] || rawSymbol;
    let interval = '1d';
    let range = '5y';

    switch (resStr) {
        case '1':
        case '1M':
        case 'M1':
            interval = '1m';
            range = '7d';
            break;
        case '5':
        case '5M':
        case 'M5':
            interval = '5m';
            range = '60d';
            break;
        case '15':
        case '15M':
        case 'M15':
            interval = '15m';
            range = '60d';
            break;
        case '30':
        case '30M':
        case 'M30':
            interval = '30m';
            range = '60d';
            break;
        case '60':
        case '1H':
        case 'H1':
            interval = '1h';
            range = '730d';
            break;
        case '240':
        case '4H':
        case 'H4':
            interval = '1h';
            range = '730d';
            break;
        case '1W':
        case 'W1':
        case 'W':
            interval = '1wk';
            range = '5y';
            break;
        case '1D':
        case 'D1':
        case 'D':
        default:
            interval = '1d';
            range = '5y';
            break;
    }

    const isIntraday = !['1d', '1wk', '1mo'].includes(interval);
    const includePrePost = isIntraday ? 'true' : 'false';

    // List of candidate symbols to try (e.g. for NASDAQ, try original first, then NQ=F futures / QQQ for live intraday)
    const candidateSymbols = [yahooSymbol];
    if (isIntraday) {
        if (['^IXIC', 'NASDAQ', 'IXIC'].includes(rawSymbol)) {
            candidateSymbols.push('NQ=F', 'QQQ');
        } else if (['^NDX', 'NDX', 'NASDAQ100', 'US100'].includes(rawSymbol)) {
            candidateSymbols.push('NQ=F', 'QQQ');
        } else if (['^GSPC', 'SP500', 'SPX', 'S&P500'].includes(rawSymbol)) {
            candidateSymbols.push('ES=F', 'SPY');
        }
    }

    for (const sym of candidateSymbols) {
        try {
            const isDev = import.meta.env?.DEV !== false;
            const baseUrl = isDev ? '/api-yahoo' : 'https://query1.finance.yahoo.com';
            const url = `${baseUrl}/v8/finance/chart/${encodeURIComponent(sym)}?interval=${interval}&range=${range}&includePrePost=${includePrePost}`;
            const res = await fetch(url);
            if (res.ok) {
                const json = await res.json();
                const result = json?.chart?.result?.[0];
                if (result && Array.isArray(result.timestamp) && result.timestamp.length > 0) {
                    const timestamps = result.timestamp;
                    const quote = result.indicators?.quote?.[0] || {};
                    const opens = quote.open || [];
                    const highs = quote.high || [];
                    const lows = quote.low || [];
                    const closes = quote.close || [];
                    const volumes = quote.volume || [];

                    const candles = [];
                    for (let i = 0; i < timestamps.length; i++) {
                        const ts = timestamps[i];
                        const c = closes[i];
                        const o = opens[i] ?? c;
                        const h = highs[i] ?? Math.max(o, c);
                        const l = lows[i] ?? Math.min(o, c);
                        const v = volumes[i] ?? 0;

                        if (ts && c !== null && c !== undefined && !isNaN(c) && o !== null && !isNaN(o)) {
                            const dt = new Date(ts * 1000);
                            const iso = dt.toISOString();
                            candles.push({
                                ticker: rawSymbol,
                                date: iso,
                                tradingDate: iso,
                                open: Number(Number(o).toFixed(2)),
                                high: Number(Number(h).toFixed(2)),
                                low: Number(Number(l).toFixed(2)),
                                close: Number(Number(c).toFixed(2)),
                                volume: Number(v || 0),
                            });
                        }
                    }
                    if (candles.length > 0) {
                        return candles;
                    }
                }
            }
        } catch (directErr) {
            console.warn(`Direct Yahoo Finance fetch failed for ${sym}:`, directErr);
        }
    }

    return [];
};
