
// Binance External API Service

/**
 * Normalizes symbols for Binance API compatibility.
 * Example: 'BINANCE:BTCUSDT.P' -> 'BTCUSDT'
 */
export const normalizeBinanceSymbol = (symbol) => {
    if (!symbol) return '';
    return symbol.toUpperCase().replace(/^.*:/, '').replace('.P', '').replace('PERP', '').trim();
};

export const getCryptoHistory = async (ticker, interval = '1d', limit = 500) => {
    // Binance Futures API: https://fapi.binance.com/fapi/v1/klines (for .P perpetual tickers)
    // Binance Spot API:   https://api.binance.com/api/v3/klines  (for regular tickers)

    const raw = String(ticker || '').toUpperCase().trim();
    const isPerpetual = raw.endsWith('.P') || raw.includes('PERP');
    const symbol = normalizeBinanceSymbol(ticker);

    const baseUrl = isPerpetual ? 'https://fapi.binance.com' : 'https://api.binance.com';
    const endpoint = isPerpetual ? '/fapi/v1/klines' : '/api/v3/klines';
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
        return [];
    }
};

/**
 * Maps interval string to standard Binance interval
 */
export const mapToBinanceInterval = (resolution) => {
    const resStr = String(resolution || 'D1').trim().toUpperCase();
    const map = {
        '1': '1m', 'M1': '1m', '1M': '1m', '1m': '1m',
        '3': '3m', 'M3': '3m', '3m': '3m',
        '5': '5m', 'M5': '5m', '5M': '5m', '5m': '5m',
        '15': '15m', 'M15': '15m', '15M': '15m', '15m': '15m',
        '30': '30m', 'M30': '30m', '30M': '30m', '30m': '30m',
        '60': '1h', 'H1': '1h', '1H': '1h', '1h': '1h',
        '120': '2h', 'H2': '2h', '2h': '2h',
        '240': '4h', 'H4': '4h', '4H': '4h', '4h': '4h',
        'D1': '1d', '1D': '1d', 'D': '1d', '1d': '1d',
        'W1': '1w', '1W': '1w', 'W': '1w', '1w': '1w'
    };
    return map[resStr] || '1d';
};

/**
 * Creates a Binance WebSocket connection for live realtime candlestick and price updates
 * Following official Binance Spot & Futures WebSocket specs:
 * https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/ws-streams
 *
 * @param {string} ticker - Symbol name (e.g. BTCUSDT, ZECUSDT.P)
 * @param {string} resolution - Interval timeframe (e.g. M1, M5, D1)
 * @param {function} onKlineUpdate - Callback with (candle, rawKline)
 * @param {function} onStatusChange - Callback with status ('connecting' | 'connected' | 'disconnected' | 'error')
 * @returns {function} cleanup function to close the WebSocket
 */
export const subscribeBinanceKlineWS = (ticker, resolution, onKlineUpdate, onStatusChange) => {
    if (!ticker) return () => { };

    const raw = String(ticker || '').toUpperCase().trim();
    const isPerpetual = raw.endsWith('.P') || raw.includes('PERP');
    const symbol = normalizeBinanceSymbol(ticker).toLowerCase();
    const interval = mapToBinanceInterval(resolution);

    if (!symbol) return () => { };

    let ws = null;
    let isClosedByUser = false;
    let reconnectTimeout = null;
    let pingInterval = null;
    let currentCandle = null;
    let pendingCandle = null;
    let pendingRawKline = null;
    let rafId = null;

    const flushUpdate = () => {
        if (pendingCandle && onKlineUpdate && !isClosedByUser) {
            onKlineUpdate(pendingCandle, pendingRawKline);
            pendingCandle = null;
            pendingRawKline = null;
        }
        rafId = null;
    };

    const scheduleUpdate = (candle, rawKline = null, immediate = false) => {
        pendingCandle = candle;
        if (rawKline) pendingRawKline = rawKline;

        if (immediate) {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            flushUpdate();
            return;
        }

        if (!rafId) {
            rafId = requestAnimationFrame(flushUpdate);
        }
    };

    // Use combined streams on standard port 443 with kline + ticker + trade for ultra high frequency streaming
    const streams = `${symbol}@kline_${interval}/${symbol}@ticker/${symbol}@trade`;
    const primaryUrl = `wss://stream.binance.com:443/stream?streams=${streams}`;
    const fallbackUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    let currentUrl = primaryUrl;

    const connect = () => {
        if (isClosedByUser) return;
        if (onStatusChange) onStatusChange('connecting');

        try {
            console.log(`[Binance WS Connecting] -> ${currentUrl}`);
            ws = new WebSocket(currentUrl);

            ws.onopen = () => {
                console.log(`[Binance WS Connected] -> ${currentUrl}`);
                if (onStatusChange) onStatusChange('connected');

                // Keep-alive ping every 3 minutes
                if (pingInterval) clearInterval(pingInterval);
                pingInterval = setInterval(() => {
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        try {
                            ws.send(JSON.stringify({ method: 'PING' }));
                        } catch (e) { }
                    }
                }, 180000);
            };

            ws.onmessage = (event) => {
                try {
                    const rawMsg = JSON.parse(event.data);
                    const data = rawMsg.data || rawMsg;

                    // 1. Handle Kline events (from `${symbol}@kline_${interval}`)
                    if (data && data.e === 'kline' && data.k) {
                        const k = data.k;
                        const isClosed = Boolean(k.x);
                        const candle = {
                            date: new Date(k.t).toISOString(),
                            tradingDate: new Date(k.t).toISOString(),
                            open: parseFloat(k.o),
                            high: parseFloat(k.h),
                            low: parseFloat(k.l),
                            close: parseFloat(k.c),
                            volume: parseFloat(k.v),
                            isClosed,
                            timeframe: String(resolution || 'D1').toUpperCase(),
                            rawTime: Math.floor(k.t / 1000),
                        };
                        currentCandle = candle;
                        // If candle just closed, flush immediately to ensure zero latency
                        scheduleUpdate(candle, k, isClosed);
                    }
                    // 2. Handle Trade / AggTrade events for instant price update
                    else if (data && (data.e === 'trade' || data.e === 'aggTrade') && data.p) {
                        const price = parseFloat(data.p);
                        if (!isNaN(price) && onKlineUpdate) {
                            if (currentCandle) {
                                const updatedCandle = {
                                    ...currentCandle,
                                    close: price,
                                    high: Math.max(currentCandle.high || price, price),
                                    low: Math.min(currentCandle.low || price, price),
                                };
                                currentCandle = updatedCandle;
                                scheduleUpdate(updatedCandle, null, false);
                            } else {
                                const now = Number(data.T || data.E || Date.now());
                                const initCandle = {
                                    date: new Date(now).toISOString(),
                                    tradingDate: new Date(now).toISOString(),
                                    open: price,
                                    high: price,
                                    low: price,
                                    close: price,
                                    volume: parseFloat(data.q || 0),
                                    isClosed: false,
                                    timeframe: String(resolution || 'D1').toUpperCase(),
                                    rawTime: Math.floor(now / 1000),
                                };
                                currentCandle = initCandle;
                                scheduleUpdate(initCandle, null, false);
                            }
                        }
                    }
                    // 3. Handle 24hrTicker / MiniTicker events
                    else if (data && (data.e === '24hrTicker' || data.e === '24hrMiniTicker') && data.c) {
                        const price = parseFloat(data.c);
                        if (!isNaN(price) && onKlineUpdate) {
                            if (currentCandle) {
                                const updatedCandle = {
                                    ...currentCandle,
                                    close: price,
                                    high: Math.max(currentCandle.high || price, price),
                                    low: Math.min(currentCandle.low || price, price),
                                };
                                currentCandle = updatedCandle;
                                scheduleUpdate(updatedCandle, null, false);
                            } else {
                                const now = Number(data.E || Date.now());
                                const initCandle = {
                                    date: new Date(now).toISOString(),
                                    tradingDate: new Date(now).toISOString(),
                                    open: price,
                                    high: price,
                                    low: price,
                                    close: price,
                                    volume: parseFloat(data.v || 0),
                                    isClosed: false,
                                    timeframe: String(resolution || 'D1').toUpperCase(),
                                    rawTime: Math.floor(now / 1000),
                                };
                                currentCandle = initCandle;
                                scheduleUpdate(initCandle, null, false);
                            }
                        }
                    }
                } catch (e) {
                    console.error('[Binance WS Message Error]', e);
                }
            };

            ws.onerror = (err) => {
                console.warn(`[Binance WS Error on ${currentUrl}]`, err);
                if (currentUrl === primaryUrl && primaryUrl !== fallbackUrl) {
                    console.log(`[Binance WS] Switching to fallback endpoint: ${fallbackUrl}`);
                    currentUrl = fallbackUrl;
                }
                if (onStatusChange) onStatusChange('error');
            };

            ws.onclose = () => {
                if (onStatusChange) onStatusChange('disconnected');
                if (pingInterval) clearInterval(pingInterval);
                if (!isClosedByUser) {
                    reconnectTimeout = setTimeout(connect, 3000);
                }
            };
        } catch (err) {
            console.error('[Binance WS Fatal Error]', err);
            if (onStatusChange) onStatusChange('error');
            if (!isClosedByUser) {
                reconnectTimeout = setTimeout(connect, 5000);
            }
        }
    };

    connect();

    return () => {
        isClosedByUser = true;
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        if (pingInterval) clearInterval(pingInterval);
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        if (ws) {
            ws.close();
            ws = null;
        }
        if (onStatusChange) onStatusChange('disconnected');
    };
};

