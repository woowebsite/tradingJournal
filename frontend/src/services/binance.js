// Binance External API Service

/**
 * Normalizes symbols for Binance API compatibility.
 * Example: 'BINANCE:BTCUSDT.P' -> 'BTCUSDT'
 */
export const normalizeBinanceSymbol = (symbol) => {
    if (!symbol) return '';
    return symbol.toUpperCase().replace(/^.*:/, '').replace('.P', '').replace('PERP', '').trim();
};

export const normalizeBinanceInterval = (tf = '1d') => {
    const raw = String(tf || '1d').trim().toUpperCase();
    if (raw === 'M1' || raw === '1' || raw === '1M') return '1m';
    if (raw === 'M5' || raw === '5' || raw === '5M') return '5m';
    if (raw === 'M30' || raw === '30' || raw === '30M') return '30m';
    if (raw === 'W1' || raw === 'W' || raw === '1W') return '1w';
    return '1d';
};

export const getCryptoHistory = async (ticker, interval = '1d', limit = 500) => {
    // Binance Futures API: https://fapi.binance.com/fapi/v1/klines (for .P perpetual tickers)
    // Binance Spot API:   https://api.binance.com/api/v3/klines  (for regular tickers)

    const isPerpetual = ticker.endsWith('.P');
    const symbol = ticker.replace('.P', '');
    const normalizedInterval = normalizeBinanceInterval(interval);

    const baseUrl = isPerpetual ? 'https://fapi.binance.com' : 'https://api.binance.com';
    const endpoint = isPerpetual ? '/fapi/v1/klines' : '/api/v3/klines';
    const url = `${baseUrl}${endpoint}?symbol=${symbol}&interval=${normalizedInterval}&limit=${limit}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Binance API Error: ${response.statusText}`);
        }

        const data = await response.json();

        // Binance Klines Format:
        // [
        //   [
        //     1499040000000,      // Open time
        //     "0.01634790",       // Open
        //     "0.80000000",       // High
        //     "0.01575800",       // Low
        //     "0.01577100",       // Close
        //     "148976.11427815",  // Volume
        //     ...
        //   ]
        // ]

        // Map to standard internal format
        return data.map(item => ({
            tradingDate: new Date(item[0]).toISOString(),
            open: parseFloat(item[1]),
            high: parseFloat(item[2]),
            low: parseFloat(item[3]),
            close: parseFloat(item[4]),
            volume: parseFloat(item[5])
        }));

    } catch (error) {
        console.error("Failed to fetch from Binance:", error);
        return [];
    }
};
