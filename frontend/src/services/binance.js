
// Binance External API Service

export const getCryptoHistory = async (ticker) => {
    // Binance Futures API: https://fapi.binance.com/fapi/v1/klines (for .P perpetual tickers)
    // Binance Spot API:   https://api.binance.com/api/v3/klines  (for regular tickers)

    const isPerpetual = ticker.endsWith('.P');
    const symbol = ticker.replace('.P', '');

    const baseUrl = isPerpetual ? 'https://fapi.binance.com' : 'https://api.binance.com';
    const endpoint = isPerpetual ? '/fapi/v1/klines' : '/api/v3/klines';
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
