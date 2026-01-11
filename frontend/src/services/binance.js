
// Binance External API Service

export const getCryptoHistory = async (symbol) => {
    // Binance API: https://fapi.binance.com/fapi/v1/klines
    // Symbol: BTCUSDT
    // Interval: 1d
    // Limit: 500 (or 1000)

    // We assume 'symbol' is passed as "BTCUSDT" or similar.
    // If it has "Crypto" prefix or something, we might need to strip it, but usually user puts "BTCUSDT".

    // Using CORS proxy if needed?
    // Binance usually allows CORS from anywhere for public data?
    // "Code: -1002, msg: 'You are not authorized to execute this request.'" if IP restricted or blocked?
    // Usually public market data is fine. If not, we might need a proxy.
    // Let's try direct first. If blocked by CORS, we might need a backend proxy or Vite proxy.
    // Vite proxy handles /api-tcbs for TCBS. We might need /api-binance if CORS fails.
    // Let's assume direct works for now, or add proxy if it doesn't.
    // However, user said "Use this API".

    const baseUrl = 'https://fapi.binance.com';
    const endpoint = '/fapi/v1/klines';
    const interval = '1d';
    const limit = 500;

    const url = `${baseUrl}${endpoint}?symbol=${symbol}&interval=${interval}&limit=${limit}`;

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
        // Fallback or rethrow? 
        // If it fails, we return empty so as not to break the app flow
        return [];
    }
};
