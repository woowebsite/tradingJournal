// 24hMoney External API Service

/**
 * Fetch stock history from 24hMoney API.
 * @param {string} ticker - The stock ticker (e.g. VNM)
 * @param {string} resolution - The interval resolution (e.g. 1D)
 * @param {number} countBack - Number of bars to fetch back
 * @returns {Array} - Array of normalized candle objects
 */
export const getStockHistory = async (ticker, resolution = '1D', countBack = 351) => {
    const to = Math.floor(Date.now() / 1000);
    // Allocate double the countback in seconds to cover weekends and holidays safely
    const from = to - countBack * 2 * 24 * 3600;

    const normalizedTicker = String(ticker || '').trim().toUpperCase();
    const normalizedResolution = resolution === 'D' ? '1D' : resolution;

    const url = `https://api.24hmoney.vn/tradingview/history?symbol=${normalizedTicker}&resolution=${normalizedResolution}&from=${from}&to=${to}&countback=${countBack}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`24hMoney API Error: ${response.statusText}`);
        }

        const data = await response.json();

        // 24hMoney UDF Format:
        // {
        //   "s": "ok",
        //   "t": [1744588800, ...], // timestamps
        //   "o": [50.828, ...],       // Open
        //   "h": [51.721, ...],       // High
        //   "l": [50.47, ...],        // Low
        //   "c": [50.828, ...],       // Close
        //   "v": [5487359, ...]       // Volume
        // }

        if (data && data.s === 'ok' && Array.isArray(data.t)) {
            const tickerName = data.symbol || normalizedTicker;
            const result = [];
            for (let i = 0; i < data.t.length; i++) {
                result.push({
                    ticker: tickerName,
                    open: parseFloat(data.o[i]) * 1000,
                    high: parseFloat(data.h[i]) * 1000,
                    low: parseFloat(data.l[i]) * 1000,
                    close: parseFloat(data.c[i]) * 1000,
                    volume: parseFloat(data.v[i]),
                    tradingDate: new Date(data.t[i] * 1000).toISOString()
                });
            }
            return result;
        }
        return [];

    } catch (error) {
        console.error("Failed to fetch from 24hMoney:", error);
        return [];
    }
};

/**
 * Fetch derivative (futures) history from 24hMoney API.
 * Endpoint example: https://api.24hmoney.vn/tradingview/history?symbol=VN30F1M&resolution=1&from=1787474444&to=1788536844&countback=350
 * @param {string} symbol - The derivative symbol (e.g. VN30F1M)
 * @param {string|number} resolution - The interval resolution (e.g. 1, 5, 15, 1D)
 * @param {number} countBack - Number of bars to fetch back (default 350)
 * @param {number} [from] - Start timestamp in seconds
 * @param {number} [to] - End timestamp in seconds
 * @returns {Array} - Array of normalized candle objects
 */
export const getDerivativeHistory = async (symbol = 'VN30F1M', resolution = '1', countBack = 350, from, to) => {
    const toTimestamp = to || Math.floor(Date.now() / 1000);
    const resolutionInSeconds = resolution === '1D' || resolution === 'D'
        ? 86400
        : (parseInt(resolution, 10) * 60 || 60);
    // Allocate 3x countback in seconds to safely cover market pauses/weekends
    const fromTimestamp = from || (toTimestamp - countBack * 3 * resolutionInSeconds);

    let normalizedSymbol = String(symbol || 'VN30F1M').trim().toUpperCase();
    if (normalizedSymbol.startsWith('41I') || normalizedSymbol === 'DERIVATIVE' || !normalizedSymbol) {
        normalizedSymbol = 'VN30F1M';
    }

    const normalizedResolution = resolution === 'D' ? '1D' : String(resolution);
    const url = `https://api.24hmoney.vn/tradingview/history?symbol=${normalizedSymbol}&resolution=${normalizedResolution}&from=${fromTimestamp}&to=${toTimestamp}&countback=${countBack}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`24hMoney API Error: ${response.statusText}`);
        }

        const data = await response.json();

        if (data && data.s === 'ok' && Array.isArray(data.t)) {
            const tickerName = data.symbol || normalizedSymbol;
            const result = [];
            for (let i = 0; i < data.t.length; i++) {
                const timeSec = data.t[i];
                result.push({
                    time: timeSec,
                    tradingDate: new Date(timeSec * 1000).toISOString(),
                    open: parseFloat(data.o[i]),
                    high: parseFloat(data.h[i]),
                    low: parseFloat(data.l[i]),
                    close: parseFloat(data.c[i]),
                    volume: parseFloat(data.v ? data.v[i] : 1) || 1,
                    ticker: tickerName
                });
            }
            return result;
        }
        return [];

    } catch (error) {
        console.error("Failed to fetch derivative history from 24hMoney:", error);
        return [];
    }
};
