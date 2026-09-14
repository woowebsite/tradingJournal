import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';
import { getCryptoHistory } from '../services/binance';
import { getStockHistory, getDerivativeHistory } from '../services/24hmoney';
import { getYahooFinanceHistory } from '../services/yahooFinance';

import { getFuturesHistory, getIntradaySnapshots, getTechnicalIndicators, updateMarketInfo } from '../services/tcbs';

const HISTORY_PAGE_SIZE = 100;
const MAX_HISTORY_CANDLES = 50000;

export const fetchPagedSymbolHistories = async (filterSymbolId, fromDate, toDate, timeframe = 'D1') => {
    const histories = [];
    const tf = String(timeframe || 'D1').trim().toUpperCase();

    let urlTemplate = `/symbol-histories?populate=symbol&sort=date:desc&pagination[pageSize]=${HISTORY_PAGE_SIZE}`;
    if (filterSymbolId) {
        if (typeof filterSymbolId === 'string' && filterSymbolId.length > 5) {
            urlTemplate += `&filters[symbol][documentId][$eq]=${encodeURIComponent(filterSymbolId)}`;
        } else {
            urlTemplate += `&filters[symbol][id][$eq]=${encodeURIComponent(filterSymbolId)}`;
        }
    }
    if (tf === 'D1') {
        urlTemplate += `&filters[$or][0][timeframe][$eq]=D1&filters[$or][1][timeframe][$null]=true`;
    } else {
        urlTemplate += `&filters[timeframe][$eq]=${encodeURIComponent(tf)}`;
    }
    if (fromDate) {
        urlTemplate += `&filters[date][$gte]=${encodeURIComponent(fromDate)}`;
    }
    if (toDate) {
        urlTemplate += `&filters[date][$lte]=${encodeURIComponent(toDate)}`;
    }

    // Load first page
    const firstRes = await api.get(`${urlTemplate}&pagination[page]=1`);
    const firstItems = firstRes.data?.data || [];
    histories.push(...firstItems);

    const pageCount = firstRes.data?.meta?.pagination?.pageCount || 1;
    if (pageCount > 1) {
        const pagePromises = [];
        const maxPages = Math.min(pageCount, Math.ceil(MAX_HISTORY_CANDLES / HISTORY_PAGE_SIZE));
        for (let p = 2; p <= maxPages; p++) {
            pagePromises.push(api.get(`${urlTemplate}&pagination[page]=${p}`));
        }
        const responses = await Promise.all(pagePromises);
        responses.forEach(res => {
            histories.push(...(res.data?.data || []));
        });
    }

    return histories
        .slice(0, MAX_HISTORY_CANDLES)
        .map(h => ({
            ...h,
            timeframe: h.timeframe || tf
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
};

export const fetchSymbolHistoriesInWatchlist = async (symbolIds) => {
    if (!symbolIds || symbolIds.length === 0) return [];

    console.log(`Preloading histories for ${symbolIds.length} watchlist symbols in parallel...`);
    const results = await Promise.all(
        symbolIds.map(id => fetchPagedSymbolHistories(id))
    );

    return results.flat();
};

// Async Thunks
export const fetchSymbols = createAsyncThunk(
    'market/fetchSymbols',
    async (marketId, { rejectWithValue }) => {
        try {
            let url = '/symbols?populate=*&sort=Name:asc&pagination[pageSize]=1000';
            if (marketId) {
                const isDocumentId = typeof marketId === 'string';

                if (isDocumentId) {
                    url += `&filters[$or][0][market][documentId][$eq]=${marketId}`;
                } else {
                    url += `&filters[$or][0][market][id][$eq]=${marketId}`;
                }
            }
            const res = await api.get(url);
            return res.data.data || [];
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const hasTodayCandle = (candleList) => {
    if (!candleList || candleList.length === 0) return false;
    const today = new Date();
    const todayLocalStr = today.toLocaleDateString('en-CA');
    const todayUtcStr = today.toISOString().split('T')[0];

    return candleList.some(candle => {
        if (!candle || !candle.date) return false;
        const candleDate = new Date(candle.date);
        const candleLocalStr = candleDate.toLocaleDateString('en-CA');
        const candleUtcStr = candleDate.toISOString().split('T')[0];
        return (candleLocalStr === todayLocalStr) || (candleUtcStr === todayUtcStr);
    });
};

const checkSymbolsHaveTodayCandle = (symbolIds, historiesList) => {
    return symbolIds.every(symbolId => {
        const symbolHistories = historiesList.filter(h => {
            const symId = h.symbol?.documentId || h.symbol?.id;
            return symId && symbolId && symId.toString() === symbolId.toString();
        });
        return hasTodayCandle(symbolHistories);
    });
};

export const getSymbolCacheKey = (symbolId, symbolName, timeframe = 'D1') => {
    const tf = String(timeframe || 'D1').trim().toUpperCase();
    const idStr = symbolId ? String(symbolId).trim().toUpperCase() : '';
    const nameStr = symbolName ? String(symbolName).split(':')[0].trim().toUpperCase() : '';
    return {
        idKey: idStr ? `candledata_id_${idStr}_${tf}` : null,
        nameKey: nameStr ? `candledata_sym_${nameStr}_${tf}` : null,
    };
};

export const saveSymbolHistoriesCache = (symbolId, symbolName, timeframe = 'D1', candles = []) => {
    if (!Array.isArray(candles) || candles.length === 0) return;
    try {
        const sanitized = sanitizeHistoriesForStorage(candles);
        const tf = String(timeframe || 'D1').trim().toUpperCase();
        const { idKey, nameKey } = getSymbolCacheKey(symbolId, symbolName, tf);
        const dataStr = JSON.stringify(sanitized);
        if (idKey) localStorage.setItem(idKey, dataStr);
        if (nameKey) localStorage.setItem(nameKey, dataStr);

        // Also merge into watchlist_histories if D1 for backwards compatibility
        if (tf === 'D1') {
            const cachedStr = localStorage.getItem('watchlist_histories');
            const cached = cachedStr ? JSON.parse(cachedStr) : [];
            const targetId = symbolId ? String(symbolId).toUpperCase() : null;
            const targetName = symbolName ? String(symbolName).split(':')[0].toUpperCase() : null;
            const filtered = cached.filter(h => {
                const sId = String(h.symbol?.documentId || h.symbol?.id || '').toUpperCase();
                const sName = String(h.symbol?.Name || h.symbol?.name || '').split(':')[0].toUpperCase();
                const match = (targetId && sId === targetId) || (targetName && sName === targetName);
                return !match;
            });
            const merged = [...filtered, ...sanitized];
            localStorage.setItem('watchlist_histories', JSON.stringify(merged));
        }
    } catch (e) {
        console.warn('Failed saving symbol histories to localStorage cache:', e);
    }
};

export const getSymbolHistoriesCache = (symbolId, symbolName, timeframe = 'D1') => {
    const tf = String(timeframe || 'D1').trim().toUpperCase();
    const { idKey, nameKey } = getSymbolCacheKey(symbolId, symbolName, tf);
    try {
        if (idKey) {
            const cached = localStorage.getItem(idKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        }
        if (nameKey) {
            const cached = localStorage.getItem(nameKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        }
        // Fallback: check watchlist_histories
        const wStr = localStorage.getItem('watchlist_histories');
        if (wStr) {
            const cached = JSON.parse(wStr);
            const targetId = symbolId ? String(symbolId).toUpperCase() : null;
            const targetName = symbolName ? String(symbolName).split(':')[0].toUpperCase() : null;
            const matches = cached.filter(h => {
                const sId = String(h.symbol?.documentId || h.symbol?.id || '').toUpperCase();
                const sName = String(h.symbol?.Name || h.symbol?.name || '').split(':')[0].toUpperCase();
                const hTf = String(h.timeframe || 'D1').toUpperCase();
                const match = (targetId && sId === targetId) || (targetName && sName === targetName);
                return match && hTf === tf;
            });
            if (matches.length > 0) return matches;
        }
    } catch (e) {
        console.warn('Failed loading symbol histories from localStorage cache:', e);
    }
    return null;
};

export const sanitizeHistoriesForStorage = (items) => {
    if (!Array.isArray(items)) return [];
    return items.map(h => ({
        id: h.id || h.documentId,
        documentId: h.documentId,
        date: h.date,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume,
        timeframe: h.timeframe || 'D1',
        symbol: h.symbol ? {
            id: h.symbol.id,
            documentId: h.symbol.documentId,
            Name: h.symbol.Name || h.symbol.name
        } : null
    }));
};

export const fetchHistories = createAsyncThunk(
    'market/fetchHistories',
    async (arg, { rejectWithValue }) => {
        try {
            let filterSymbolId = arg;
            let filterSymbolName = null;
            let forceRefresh = false;
            let timeframe = 'D1';

            if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
                filterSymbolId = arg.symbolIds || arg.symbolId;
                filterSymbolName = arg.symbolName || arg.symbol || null;
                forceRefresh = arg.forceRefresh;
                if (arg.timeframe) timeframe = arg.timeframe;
            }

            // If it's a batch load (array of IDs)
            if (Array.isArray(filterSymbolId)) {
                const cachedHistoriesStr = localStorage.getItem('watchlist_histories');
                const updatedLatest = localStorage.getItem('watchlist_updated_latest') === 'true';

                if (!forceRefresh && cachedHistoriesStr && updatedLatest) {
                    console.log('Loading watchlist histories from localStorage cache...');
                    return JSON.parse(cachedHistoriesStr);
                }

                // Otherwise, fetch from database
                const histories = await fetchSymbolHistoriesInWatchlist(filterSymbolId);

                // Save to localStorage
                try {
                    const sanitized = sanitizeHistoriesForStorage(histories);
                    localStorage.setItem('watchlist_histories', JSON.stringify(sanitized));
                    localStorage.setItem('watchlist_updated_latest', 'true');

                    // Also index individually
                    sanitized.forEach(item => {
                        const sId = item.symbol?.documentId || item.symbol?.id;
                        const sName = item.symbol?.Name;
                        if (sId || sName) {
                            const symCandles = sanitized.filter(c => {
                                const cId = c.symbol?.documentId || c.symbol?.id;
                                const cName = c.symbol?.Name;
                                return (sId && cId === sId) || (sName && cName === sName);
                            });
                            saveSymbolHistoriesCache(sId, sName, 'D1', symCandles);
                        }
                    });
                } catch (e) {
                    console.error('Failed to save to localStorage:', e);
                }

                return histories;
            }

            // If it's a single symbol fetch
            const currentTf = String(timeframe || 'D1').toUpperCase();

            // 1. Check individual localStorage cache if not forced
            if (!forceRefresh) {
                const cachedHistory = getSymbolHistoriesCache(filterSymbolId, filterSymbolName, currentTf);
                if (cachedHistory && cachedHistory.length > 0) {
                    console.log(`Loading history for symbol ${filterSymbolId || filterSymbolName} (${currentTf}) from localStorage cache...`);
                    return cachedHistory;
                }
            }

            // 2. Fetch from database with exact timeframe
            const singleHistory = await fetchPagedSymbolHistories(filterSymbolId, undefined, undefined, currentTf);

            // 3. Save to localStorage cache
            if (singleHistory && singleHistory.length > 0) {
                const symName = filterSymbolName || singleHistory[0]?.symbol?.Name || singleHistory[0]?.symbol?.name;
                saveSymbolHistoriesCache(filterSymbolId, symName, currentTf, singleHistory);
            }

            return singleHistory;
        } catch (error) {
            console.error(error);
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const loadExternalHistory = createAsyncThunk(
    'market/loadExternalHistory',
    async ({ symbol, symbolId, marketType, resolution }, { dispatch, rejectWithValue }) => {
        try {
            let externalData = [];

            const isCrypto = marketType === 'Crypto' || 
                String(symbol || '').toUpperCase().includes('USDT') || 
                String(symbol || '').toUpperCase().endsWith('.P') || 
                String(symbol || '').toUpperCase().startsWith('BINANCE:');

            const resStr = String(resolution || 'D1').trim();
            const intervalMap = {
                '1': '1m', 'M1': '1m', '1m': '1m',
                '5': '5m', 'M5': '5m', '5m': '5m',
                '15': '15m', 'M15': '15m', '15m': '15m',
                '30': '30m', 'M30': '30m', '30m': '30m',
                '60': '1h', 'H1': '1h', '1h': '1h',
                '240': '4h', 'H4': '4h', '4h': '4h',
                '1D': '1d', 'D1': '1d', 'D': '1d', '1d': '1d',
                '1W': '1w', 'W1': '1w', 'W': '1w', '1w': '1w'
            };

            const tfMap = {
                '1': 'M1', '1m': 'M1', 'M1': 'M1',
                '5': 'M5', '5m': 'M5', 'M5': 'M5',
                '15': 'M15', '15m': 'M15', 'M15': 'M15',
                '30': 'M30', '30m': 'M30', 'M30': 'M30',
                '60': 'H1', '1h': 'H1', 'H1': 'H1',
                '240': 'H4', '4h': 'H4', 'H4': 'H4',
                '1D': 'D1', 'D': 'D1', '1d': 'D1', 'D1': 'D1',
                '1W': 'W1', 'W': 'W1', '1w': 'W1', 'W1': 'W1'
            };
            const currentTf = tfMap[resStr] || 'D1';

            // Determine Source based on Market Type
            if (isCrypto) {
                const interval = intervalMap[resStr] || '1d';
                externalData = await getCryptoHistory(symbol, interval, 500);
            } else if (String(marketType || '').toLowerCase() === 'derivative') {
                externalData = await getDerivativeHistory(symbol.split(':')[0], resStr || '5', 2000);
            } else {
                const ticket = symbol.split(':')[0].trim().toUpperCase();
                const isUsOrGlobalIndex = [
                    'USTEC', 'USTECH', 'USTEC.P', 'NAS100', 'NAS100.P', 'NAS100USD', 'US100', 'US100.P',
                    'NASDAQ', 'IXIC', '^IXIC', 'NDX', '^NDX', 'NASDAQ100', 'NQ', 'NQ=F', 'QQQ',
                    'US500', 'US500.P', 'SPX500', 'ES', 'ES=F', 'SP500', 'S&P500', 'SPX', 'GSPC', '^GSPC', 'SPY',
                    'US30', 'US30.P', 'DJ30', 'WALLSTREET', 'YM', 'YM=F', 'DOW', 'DOWJONES', 'DJI', '^DJI', 'DIA',
                    'GER40', 'GER30', 'DAX', 'UK100', 'FTSE', 'JPN225', 'NIKKEI', 'HK50',
                    'GOLD', 'GC=F', 'XAUUSD', 'XAUUSD.P', 'SILVER', 'SI=F', 'XAGUSD',
                    'BRENT', 'BZ=F', 'UKOIL', 'WTI', 'CL=F', 'USOIL', 'CRUDEOIL', 'NATGAS', 'COPPER',
                    'DXY', 'DX-Y.NYB', 'USDX', 'US10Y', '^TNX', 'VIX', '^VIX',
                    'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD'
                ].includes(ticket) || ticket.startsWith('^') || ticket.includes('=') || ticket.includes('-') || String(marketType || '').toLowerCase().includes('us') || String(marketType || '').toLowerCase().includes('global') || String(marketType || '').toLowerCase().includes('forex') || String(marketType || '').toLowerCase().includes('cfd');

                if (isUsOrGlobalIndex) {
                    externalData = await getYahooFinanceHistory(ticket, resStr, 1500);
                } else {
                    // Try 24hMoney (VN stocks & indices)
                    externalData = await getStockHistory(ticket, resStr);
                    // Fallback to Yahoo Finance if 24hMoney returns empty
                    if (!externalData || externalData.length === 0) {
                        externalData = await getYahooFinanceHistory(ticket, resStr, 1500);
                    }
                }
            }

            if (!externalData || externalData.length === 0) return [];

            // 1.5 Fetch latest date from Strapi to avoid duplicates for this timeframe
            let latestDate = null;
            try {
                const tfFilter = currentTf === 'D1' 
                    ? `&filters[$or][0][timeframe][$eq]=D1&filters[$or][1][timeframe][$null]=true`
                    : `&filters[timeframe][$eq]=${encodeURIComponent(currentTf)}`;
                const symFilter = (typeof symbolId === 'string' && symbolId.length > 5 && isNaN(Number(symbolId)))
                    ? `filters[symbol][documentId][$eq]=${encodeURIComponent(symbolId)}`
                    : `filters[symbol][id][$eq]=${encodeURIComponent(symbolId)}`;
                const latestRes = await api.get(`/symbol-histories?${symFilter}${tfFilter}&sort=date:desc&pagination[pageSize]=1`);
                const latestItems = latestRes.data?.data || [];
                if (latestItems && latestItems.length > 0) {
                    latestDate = new Date(latestItems[0].date);
                }
            } catch (err) {
                console.warn('Could not fetch latest history date, proceeding with full import.', err);
            }

            // Filter external data to keep only NEW records
            const newRecords = externalData.filter(item => {
                if (!latestDate) return true;
                const itemDate = new Date(item.tradingDate);
                return itemDate > latestDate;
            });

            if (newRecords.length === 0) {
                await dispatch(fetchHistories({ symbolId, timeframe: currentTf, forceRefresh: true }));
                return 0;
            }

            let count = 0;
            // 2. Fast Bulk save NEW records to Strapi with timeframe & publication
            try {
                const bulkRes = await api.post('/symbol-histories/bulk', {
                    symbolId,
                    symbol,
                    timeframe: currentTf,
                    candles: newRecords
                });
                count = bulkRes.data?.data?.count || newRecords.length;
            } catch (bulkErr) {
                console.warn('Bulk insert failed, falling back to chunked individual inserts:', bulkErr);
                const chunkSize = 25;
                for (let i = 0; i < newRecords.length; i += chunkSize) {
                    const chunk = newRecords.slice(i, i + chunkSize);
                    await Promise.all(chunk.map(async item => {
                        try {
                            await api.post('/symbol-histories', {
                                data: {
                                    symbol: symbolId,
                                    date: item.tradingDate,
                                    open: item.open,
                                    high: item.high,
                                    low: item.low,
                                    close: item.close,
                                    volume: item.volume,
                                    timeframe: currentTf,
                                    publishedAt: new Date().toISOString()
                                }
                            });
                            count++;
                        } catch (e) {}
                    }));
                }
            }

            // 3. Refresh list
            await dispatch(fetchHistories({ symbolId, timeframe: currentTf, forceRefresh: true }));
            return count;

        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const deleteAllHistories = createAsyncThunk(
    'market/deleteAllHistories',
    async (payload, { dispatch, rejectWithValue }) => {
        try {
            const symbolId = typeof payload === 'object' && payload !== null ? payload.symbolId : payload;
            const timeframe = typeof payload === 'object' && payload !== null ? payload.timeframe : undefined;

            if (!symbolId) {
                throw new Error('Symbol ID is required to clear histories.');
            }

            // Gọi endpoint SQL siêu tốc trong backend (1 request duy nhất thực thi câu lệnh SQL DELETE)
            const res = await api.post('/symbol-histories/clear', {
                symbolId,
                timeframe,
            });

            const deletedCount = res.data?.data?.count ?? res.data?.count ?? 0;
            return deletedCount;
        } catch (error) {
            console.error('Fast clear history error:', error);
            const errDetail = error.response?.data?.error?.message || error.response?.data?.error || error.message;
            return rejectWithValue(typeof errDetail === 'object' ? JSON.stringify(errDetail) : String(errDetail));
        }
    }
);

export const fetchBatchLatestPrices = createAsyncThunk(
    'market/fetchBatchLatestPrices',
    async (symbolIds, { rejectWithValue }) => {
        try {
            if (!symbolIds || symbolIds.length === 0) return {};

            const queryParams = symbolIds.map((id, index) => `filters[symbol][documentId][$in][${index}]=${id}`).join('&');
            const url = `/symbol-histories?${queryParams}&populate=symbol&sort=date:desc&pagination[pageSize]=1000`;
            const res = await api.get(url);
            const data = res.data.data;

            const pricesMap = {};
            data.forEach(item => {
                const symId = item.symbol?.documentId || item.symbol?.id;
                if (symId && pricesMap[symId] === undefined) {
                    pricesMap[symId] = item.close;
                }
            });

            return pricesMap;
        } catch (error) {
            console.error(error);
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const fetchBatchLatestMinutePrices = createAsyncThunk(
    'market/fetchBatchLatestMinutePrices',
    async (symbolsList, { rejectWithValue }) => {
        try {
            if (!symbolsList || symbolsList.length === 0) return {};

            const pricesMap = {};

            await Promise.all(symbolsList.map(async (symbol) => {
                const symbolId = symbol?.documentId || symbol?.id;
                const symbolName = symbol?.Name || symbol?.name || '';
                const marketName = symbol?.market?.Name || symbol?.market?.name || '';
                const isCrypto = /crypto|binance/i.test(marketName)
                    || /^BINANCE:/i.test(symbolName)
                    || /(?:USDT|USDC|BUSD)(?:\.P)?$/i.test(symbolName);
                const ticker = isCrypto
                    ? (symbolName.includes(':') ? symbolName.split(':').pop() : symbolName)
                    : symbolName.split(':')[0];
                if (!symbolId || !ticker) return;

                const isDerivative = /derivative|future|phái sinh|phai sinh/i.test(marketName)
                    || /\d/.test(ticker);

                try {
                    const minuteBars = isCrypto
                        ? await getCryptoHistory(ticker, '1m', 2)
                        : isDerivative
                            ? await getDerivativeHistory(ticker, '1', 2)
                            : await getStockHistory(ticker, 'stock', '1');

                    if (!Array.isArray(minuteBars) || minuteBars.length === 0) return;

                    const latestBar = [...minuteBars].sort((a, b) => new Date(b.tradingDate) - new Date(a.tradingDate))[0];
                    const price = latestBar?.close ?? latestBar?.price;
                    if (price !== undefined && price !== null) {
                        pricesMap[symbolId] = price;
                    }
                } catch (error) {
                    console.warn(`Failed to fetch latest 1-minute market price for ${ticker}:`, error);
                }
            }));

            return pricesMap;
        } catch (error) {
            console.error(error);
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const fetchLatestHistory = createAsyncThunk(
    'market/fetchLatestHistory',
    async (symbolId, { rejectWithValue }) => {
        try {
            const url = `/symbol-histories?filters[symbol][documentId][$eq]=${symbolId}&sort=date:desc&pagination[pageSize]=1&populate=symbol`;
            const res = await api.get(url);
            const data = res.data.data;
            if (data && data.length > 0) {
                const item = data[0];
                const symId = item.symbol?.documentId || item.symbol?.id || symbolId;
                return { symbolId: symId, close: item.close };
            }
            return null;
        } catch (error) {
            console.error(error);
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const fetchBatchSnapshots = createAsyncThunk(
    'market/fetchBatchSnapshots',
    async (symbolsList, { rejectWithValue }) => {
        try {
            if (!symbolsList || symbolsList.length === 0) return 0;

            // batch by 20 or 50 if list is huge? TCBS URL length limit?
            // User list was ~20. URL length is usually safe up to 2k chars.
            // 20 tickers * 4 chars = 80 chars. Safe.
            const tickers = symbolsList.map(s => s.Name.split(':')[0]).join(',');
            const snapshots = await getIntradaySnapshots(tickers);

            if (!snapshots || snapshots.length === 0) return 0;

            let count = 0;
            const promises = snapshots.map(async (item) => {
                const ticker = item.ticker;
                const symbolObj = symbolsList.find(s => s.Name.split(':')[0] === ticker);
                if (!symbolObj) return;

                const symId = symbolObj.documentId || symbolObj.id;

                // TCBS Snapshot Structure Assumption:
                // { ticker, price, volume, open, high, low, tradingDate, ... }
                // If 'tradingDate' missing, use today.

                const payload = {
                    data: {
                        symbol: symId,
                        date: item.tradingDate || new Date().toISOString(),
                        open: item.open,
                        high: item.high,
                        low: item.low,
                        close: item.price,
                        volume: item.volume
                    }
                };

                try {
                    await api.post('/symbol-histories', payload);
                    count++;
                } catch (e) {
                    // ignore
                }
            });

            await Promise.all(promises);
            return count;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const fetchExternalIndicators = createAsyncThunk(
    'market/fetchExternalIndicators',
    async (symbol, { rejectWithValue }) => {
        try {
            const ticker = String(symbol || '').split(':')[0].trim().toUpperCase();
            if (!ticker || /USDT|\.P|BINANCE:/i.test(ticker) || !/^[A-Z0-9]{1,10}$/.test(ticker)) {
                return null;
            }
            // Check localStorage cache first (valid for 30 mins)
            try {
                const cacheKey = `ext_indicators_${ticker}`;
                const cachedStr = localStorage.getItem(cacheKey);
                if (cachedStr) {
                    const parsed = JSON.parse(cachedStr);
                    if (parsed && parsed.data && (Date.now() - (parsed.timestamp || 0) < 30 * 60 * 1000)) {
                        return parsed.data;
                    }
                }
            } catch (e) {}

            const data = await getTechnicalIndicators(ticker);
            try {
                if (data) {
                    localStorage.setItem(`ext_indicators_${ticker}`, JSON.stringify({
                        timestamp: Date.now(),
                        data
                    }));
                }
            } catch (e) {}
            return data;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);
export const syncSymbolMetadata = createAsyncThunk(
    'market/syncSymbolMetadata',
    async ({ ticker, symbolId }, { rejectWithValue }) => {
        try {
            const cleanTicker = String(ticker || '').split(':')[0].trim().toUpperCase();
            if (!cleanTicker || /USDT|\.P|BINANCE:/i.test(cleanTicker) || !/^[A-Z0-9]{1,10}$/.test(cleanTicker)) {
                return null;
            }
            const updatedSymbol = await updateMarketInfo(cleanTicker, symbolId);
            return updatedSymbol;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

const getInitialHistories = () => {
    try {
        const cached = localStorage.getItem('watchlist_histories');
        if (cached) return JSON.parse(cached);
    } catch (e) {
        console.error(e);
    }
    return [];
};

const marketSlice = createSlice({
    name: 'market',
    initialState: {
        symbols: [],
        histories: getInitialHistories(),
        latestPricesMap: {},
        loading: false,
        historyLoading: false,
        error: null,
        selectedSymbolFilter: '',
        externalIndicators: [],
    },
    reducers: {
        loadCachedSymbolHistories: (state, action) => {
            const { candles, timeframe, symbolId, symbolName } = action.payload || {};
            if (!Array.isArray(candles) || candles.length === 0) return;
            const targetTf = String(timeframe || candles[0]?.timeframe || 'D1').toUpperCase();
            const targetSymId = symbolId ? String(symbolId).trim().toUpperCase() : null;
            const targetSymName = symbolName ? String(symbolName).split(':')[0].trim().toUpperCase() : null;

            const sanitized = candles.map(item => ({
                id: item.id || item.documentId,
                ...item,
                timeframe: item.timeframe || targetTf
            }));

            const filteredHistories = state.histories.filter(h => {
                const symDocId = h.symbol?.documentId ? String(h.symbol.documentId).toUpperCase() : '';
                const symNumId = h.symbol?.id ? String(h.symbol.id).toUpperCase() : '';
                const symName = (h.symbol?.Name || h.symbol?.name) ? String(h.symbol.Name || h.symbol.name).split(':')[0].toUpperCase() : '';
                const isSameSymbol = (targetSymId && (symDocId === targetSymId || symNumId === targetSymId)) ||
                                     (targetSymName && symName === targetSymName);
                const hTf = String(h.timeframe || 'D1').toUpperCase();
                return !(isSameSymbol && hTf === targetTf);
            });

            state.histories = [...filteredHistories, ...sanitized];
            state.loading = false;
            state.historyLoading = false;

            if (targetSymId && sanitized.length > 0) {
                const sorted = [...sanitized].sort((a, b) => new Date(b.date) - new Date(a.date));
                if (sorted[0]?.close !== undefined) {
                    state.latestPricesMap[targetSymId] = sorted[0].close;
                }
            }
        },
        setSymbolFilter: (state, action) => {
            state.selectedSymbolFilter = action.payload;
        },
        clearError: (state) => {
            state.error = null;
        },
        updateRealtimeCandle: (state, action) => {
            const { symbolId, symbolName, candle, timeframe } = action.payload;
            if (!candle) return;
            const targetTf = String(timeframe || candle.timeframe || 'D1').toUpperCase();
            const targetSymId = symbolId ? String(symbolId) : null;
            const targetSymName = symbolName ? String(symbolName).trim().toUpperCase() : null;

            // Update latest price in map
            if (targetSymId && candle.close !== undefined) {
                state.latestPricesMap[targetSymId] = candle.close;
            }

            // Find if candle for this time already exists in state.histories
            const candleDate = candle.date;

            let updatedExisting = false;
            state.histories = state.histories.map(h => {
                const symDocId = h.symbol?.documentId;
                const symNumId = h.symbol?.id;
                const symName = h.symbol?.Name ? String(h.symbol.Name).trim().toUpperCase() : null;
                const isSameSym = (targetSymId && (String(symDocId) === targetSymId || String(symNumId) === targetSymId)) ||
                                  (targetSymName && symName === targetSymName);
                const hTf = String(h.timeframe || 'D1').toUpperCase();
                if (isSameSym && hTf === targetTf) {
                    const hDate = new Date(h.date).getTime();
                    const cDate = new Date(candleDate).getTime();
                    if (hDate === cDate || Math.abs(hDate - cDate) < 1000) {
                        updatedExisting = true;
                        return {
                            ...h,
                            open: candle.open !== undefined ? candle.open : h.open,
                            high: candle.high !== undefined ? Math.max(Number(h.high) || candle.high, candle.high) : h.high,
                            low: candle.low !== undefined ? Math.min(Number(h.low) || candle.low, candle.low) : h.low,
                            close: candle.close !== undefined ? candle.close : h.close,
                            volume: candle.volume !== undefined ? candle.volume : h.volume,
                            date: candle.date || h.date,
                        };
                    }
                }
                return h;
            });

            if (!updatedExisting && candle.isClosed) {
                const symObj = state.symbols.find(s => 
                    (targetSymId && (String(s.documentId) === targetSymId || String(s.id) === targetSymId)) ||
                    (targetSymName && String(s.Name).trim().toUpperCase() === targetSymName)
                );
                state.histories.push({
                    id: `realtime-${Date.now()}`,
                    symbol: symObj || { id: targetSymId, documentId: targetSymId, Name: targetSymName },
                    date: candle.date,
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                    volume: candle.volume,
                    timeframe: targetTf
                });
            }
        }
    },
    extraReducers: (builder) => {
        // Fetch Symbols
        builder.addCase(fetchSymbols.pending, (state) => {
            // state.loading = true; // Don't block whole UI for dropdown
        });
        builder.addCase(fetchSymbols.fulfilled, (state, action) => {
            state.symbols = action.payload.map(item => ({
                id: item.documentId || item.id,
                ...item
            }));
            // state.loading = false;
        });
        builder.addCase(syncSymbolMetadata.fulfilled, (state, action) => {
            if (action.payload) {
                const updated = action.payload;
                const index = state.symbols.findIndex(s => s.id === (updated.documentId || updated.id));
                if (index !== -1) {
                    state.symbols[index] = { ...state.symbols[index], ...updated };
                }
            }
        });

        // Fetch Histories
        builder.addCase(fetchHistories.pending, (state) => {
            state.loading = true;
            state.historyLoading = true;
            state.error = null;
        });
        builder.addCase(fetchHistories.fulfilled, (state, action) => {
            state.loading = false;
            state.historyLoading = false;
            const newHistories = action.payload.map(item => ({
                id: item.id || item.documentId,
                ...item
            }));

            const isBatch = Array.isArray(action.meta.arg) || 
                            (action.meta.arg && Array.isArray(action.meta.arg.symbolIds));

            if (isBatch) {
                // Batch load: replace completely
                state.histories = newHistories;
            } else {
                // Single symbol load: merge/update existing histories for this symbol and timeframe
                let singleSymbolId = action.meta.arg;
                let argTf = 'D1';
                if (singleSymbolId && typeof singleSymbolId === 'object') {
                    if (singleSymbolId.timeframe) argTf = singleSymbolId.timeframe;
                    singleSymbolId = singleSymbolId.symbolId;
                }
                const targetTf = String(argTf || 'D1').toUpperCase();
                const filteredHistories = state.histories.filter(h => {
                    const symDocId = h.symbol?.documentId;
                    const symNumId = h.symbol?.id;
                    const target = singleSymbolId ? singleSymbolId.toString() : '';
                    const isSameSymbol = (symDocId && symDocId.toString() === target) ||
                                         (symNumId && symNumId.toString() === target);
                    const hTf = String(h.timeframe || 'D1').toUpperCase();
                    return !(isSameSymbol && hTf === targetTf);
                });
                state.histories = [...filteredHistories, ...newHistories];
            }
        });
        builder.addCase(fetchHistories.rejected, (state, action) => {
            state.loading = false;
            state.historyLoading = false;
            state.error = action.payload;
        });

        // External Indicators
        builder.addCase(fetchExternalIndicators.pending, (state) => {
            // Optional: set loading state specific to indicators if we want independent loading
        });
        builder.addCase(fetchExternalIndicators.fulfilled, (state, action) => {
            state.externalIndicators = action.payload;
        });
        builder.addCase(fetchExternalIndicators.rejected, (state, action) => {
            console.error('Failed to fetch external indicators:', action.payload);
            state.externalIndicators = [];
        });

        // Load External
        builder.addCase(loadExternalHistory.pending, (state) => {
            state.loading = true;
            state.historyLoading = true;
        });
        builder.addCase(loadExternalHistory.fulfilled, (state) => {
            // Histories re-fetched by thunk dispatch
            state.loading = false;
            state.historyLoading = false;
        });
        builder.addCase(loadExternalHistory.rejected, (state, action) => {
            state.loading = false;
            state.historyLoading = false;
            state.error = action.payload;
        });

        // Delete All
        builder.addCase(deleteAllHistories.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(deleteAllHistories.fulfilled, (state) => {
            state.loading = false;
            state.histories = [];
        });
        builder.addCase(deleteAllHistories.rejected, (state, action) => {
            state.loading = false;
            state.error = action.payload;
        });

        // Batch Latest Prices
        builder.addCase(fetchBatchLatestPrices.fulfilled, (state, action) => {
            state.latestPricesMap = { ...state.latestPricesMap, ...action.payload };
        });

        // Batch Latest Minute Market Prices
        builder.addCase(fetchBatchLatestMinutePrices.fulfilled, (state, action) => {
            state.latestPricesMap = { ...state.latestPricesMap, ...action.payload };
        });

        // Fetch Latest History
        builder.addCase(fetchLatestHistory.fulfilled, (state, action) => {
            if (action.payload && action.payload.symbolId) {
                state.latestPricesMap[action.payload.symbolId] = action.payload.close;
            }
        });
    }
});

export const { setSymbolFilter, clearError, updateRealtimeCandle, loadCachedSymbolHistories } = marketSlice.actions;
export default marketSlice.reducer;


