// 24hMoney External API Service

export const normalize24hResolution = (resolution = '1D') => {
    const r = String(resolution || '1D').trim().toUpperCase();
    const map = {
        '1': '1', '1M': '1', 'M1': '1',
        '5': '5', '5M': '5', 'M5': '5',
        '15': '15', '15M': '15', 'M15': '15',
        '30': '30', '30M': '30', 'M30': '30',
        '60': '60', '1H': '60', 'H1': '60',
        '240': '240', '4H': '240', 'H4': '240',
        '1D': '1D', 'D1': '1D', 'D': '1D', '1d': '1D',
        '1W': '1W', 'W1': '1W', 'W': '1W', '1w': '1W',
    };
    return map[r] || '1D';
};

export const getOptimalFromTimestamp = (resolution, countBack = 1000, to = Math.floor(Date.now() / 1000)) => {
    const res = normalize24hResolution(resolution);
    if (res === '1D' || res === '1W') {
        return to - Math.max(countBack * 2 * 86400, 30 * 86400); // Tối thiểu 30 ngày
    } else if (res === '240' || res === '60') {
        return to - Math.max(countBack * 2 * 3600, 7 * 86400);   // Tối thiểu 7 ngày
    } else if (res === '30') {
        return to - Math.max(countBack * 2 * 1800, 3 * 86400);   // Tối thiểu 3 ngày
    } else if (res === '15') {
        return to - Math.max(countBack * 2 * 900, 2 * 86400);    // Tối thiểu 2 ngày
    } else if (res === '5') {
        return to - Math.max(countBack * 2 * 300, 86400);        // Tối thiểu 1 ngày
    } else if (res === '1') {
        return to - Math.max(countBack * 2 * 60, 3600);          // Tối thiểu 1 giờ
    }
    return to - 86400;
};

/**
 * Fetch stock history from 24hMoney API.
 * @param {string} ticker - The stock ticker (e.g. VNM)
 * @param {string} resolution - The interval resolution (e.g. 1D, 5, 15)
 * @param {number} countBack - Number of bars to fetch back
 * @returns {Array} - Array of normalized candle objects
 */
export const getStockHistory = async (ticker, resolution = '1D', countBack = 1000) => {
    const to = Math.floor(Date.now() / 1000);
    const from = getOptimalFromTimestamp(resolution, countBack, to);

    const normalizedTicker = String(ticker || '').trim().toUpperCase();
    const normalizedResolution = normalize24hResolution(resolution);

    const url = `https://api.24hmoney.vn/tradingview/history?symbol=${normalizedTicker}&resolution=${normalizedResolution}&from=${from}&to=${to}&countback=${countBack}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`24hMoney API Error: ${response.statusText}`);
        }

        const data = await response.json();

        if (data && data.s === 'ok' && Array.isArray(data.t) && data.t.length > 0) {
            const tickerName = data.symbol || normalizedTicker;
            const multiplier = normalizedTicker !== 'VNINDEX' && normalizedTicker !== 'VN30' && parseFloat(data.c[0]) < 500 ? 1000 : 1;
            const result = [];
            for (let i = 0; i < data.t.length; i++) {
                result.push({
                    ticker: tickerName,
                    open: parseFloat(data.o[i]) * multiplier,
                    high: parseFloat(data.h[i]) * multiplier,
                    low: parseFloat(data.l[i]) * multiplier,
                    close: parseFloat(data.c[i]) * multiplier,
                    volume: parseFloat(data.v ? data.v[i] : 0) || 0,
                    tradingDate: new Date(data.t[i] * 1000).toISOString()
                });
            }
            return result;
        }
        return [];

    } catch (error) {
        clearTimeout(timeoutId);
        console.error("Failed to fetch from 24hMoney:", error);
        return [];
    }
};

/**
 * Fetch derivative (futures) history from 24hMoney API.
 * Endpoint example: https://api.24hmoney.vn/tradingview/history?symbol=VN30F1M&resolution=5&from=1787474444&to=1788536844&countback=2000
 * @param {string} symbol - The derivative symbol (e.g. VN30F1M)
 * @param {string|number} resolution - The interval resolution (e.g. 1, 5, 15, 1D)
 * @param {number} countBack - Number of bars to fetch back (default 1000)
 * @param {number} [from] - Start timestamp in seconds
 * @param {number} [to] - End timestamp in seconds
 * @returns {Array} - Array of normalized candle objects
 */
export const getDerivativeHistory = async (symbol = 'VN30F1M', resolution = '5', countBack = 1500, from, to) => {
    const toTimestamp = to || Math.floor(Date.now() / 1000);
    const normalizedResolution = normalize24hResolution(resolution);
    const fromTimestamp = from || getOptimalFromTimestamp(normalizedResolution, countBack, toTimestamp);

    let normalizedSymbol = String(symbol || 'VN30F1M').trim().toUpperCase();
    if (normalizedSymbol.startsWith('41I') || normalizedSymbol === 'DERIVATIVE' || !normalizedSymbol) {
        normalizedSymbol = 'VN30F1M';
    }

    const url = `https://api.24hmoney.vn/tradingview/history?symbol=${normalizedSymbol}&resolution=${normalizedResolution}&from=${fromTimestamp}&to=${toTimestamp}&countback=${countBack}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`24hMoney API Error: ${response.statusText}`);
        }

        const data = await response.json();

        if (data && data.s === 'ok' && Array.isArray(data.t) && data.t.length > 0) {
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
        clearTimeout(timeoutId);
        console.error("Failed to fetch derivative history from 24hMoney:", error);
        return [];
    }
};

