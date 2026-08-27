// 24hMoney External API Service

/**
 * Fetch stock history from 24hMoney API.
 * @param {string} ticker - The stock ticker (e.g. VNM)
 * @param {string} resolution - The interval resolution (e.g. 1D)
 * @param {number} countBack - Number of bars to fetch back
 * @returns {Array} - Array of normalized candle objects
 */
export const normalize24hMoneyResolution = (resolution = '1D') => {
    const raw = String(resolution || '1D').trim().toUpperCase();
    if (raw === 'M1' || raw === '1') return { resolution: '1', defaultCount: 350, daysBack: 10 };
    if (raw === 'M5' || raw === '5') return { resolution: '5', defaultCount: 350, daysBack: 25 };
    if (raw === 'M30' || raw === '30') return { resolution: '30', defaultCount: 350, daysBack: 90 };
    if (raw === 'W1' || raw === 'W' || raw === '1W') return { resolution: '1W', defaultCount: 350, daysBack: 2500 };
    return { resolution: '1D', defaultCount: 350, daysBack: 700 };
};

export const getStockHistory = async (ticker, resolution = '1D', countBack) => {
    const { resolution: normalizedResolution, defaultCount, daysBack } = normalize24hMoneyResolution(resolution);
    const count = countBack || defaultCount;
    const to = Math.floor(Date.now() / 1000);
    const from = to - daysBack * 86400;

    const normalizedTicker = String(ticker || '').trim().toUpperCase();
    const url = `https://api.24hmoney.vn/tradingview/history?symbol=${normalizedTicker}&resolution=${normalizedResolution}&from=${from}&to=${to}&countback=${count}`;

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

        if (data && Array.isArray(data.t) && data.t.length > 0) {
            const tickerName = data.symbol || normalizedTicker;
            const isDerivativeOrIndex = normalizedTicker.startsWith('VN30') ||
                                        normalizedTicker.startsWith('VNINDEX') ||
                                        normalizedTicker.startsWith('HNX') ||
                                        normalizedTicker.startsWith('UPCOM');

            const result = [];
            for (let i = 0; i < data.t.length; i++) {
                const rawOpen = parseFloat(data.o?.[i] ?? data.c?.[i] ?? 0);
                const rawHigh = parseFloat(data.h?.[i] ?? data.c?.[i] ?? 0);
                const rawLow = parseFloat(data.l?.[i] ?? data.c?.[i] ?? 0);
                const rawClose = parseFloat(data.c?.[i] ?? 0);
                const rawVolume = parseFloat(data.v?.[i] ?? 0);

                // Stocks on 24hmoney are quoted in thousands (e.g. 50.8 -> 50,800 VND)
                // Derivatives (VN30F1M) and Indices (VNINDEX) are quoted in points (e.g. 1300.5)
                const priceMultiplier = (!isDerivativeOrIndex && rawClose > 0 && rawClose <= 500) ? 1000 : 1;

                result.push({
                    ticker: tickerName,
                    open: rawOpen * priceMultiplier,
                    high: rawHigh * priceMultiplier,
                    low: rawLow * priceMultiplier,
                    close: rawClose * priceMultiplier,
                    volume: rawVolume || 0,
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
