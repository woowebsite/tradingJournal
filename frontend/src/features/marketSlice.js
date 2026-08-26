import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';
import { getCryptoHistory } from '../services/binance';
import { getStockHistory } from '../services/24hmoney';

import { getFuturesHistory, getIntradaySnapshots, getTechnicalIndicators, updateMarketInfo } from '../services/tcbs';

const HISTORY_PAGE_SIZE = 100;
const MAX_HISTORY_CANDLES = 50000;

export const fetchPagedSymbolHistories = async (filterSymbolId, fromDate, toDate) => {
    const histories = [];

    let urlTemplate = `/symbol-histories?populate=symbol&sort=date:desc&pagination[pageSize]=${HISTORY_PAGE_SIZE}`;
    if (filterSymbolId) {
        if (typeof filterSymbolId === 'string' && filterSymbolId.length > 5) {
            urlTemplate += `&filters[symbol][documentId][$eq]=${encodeURIComponent(filterSymbolId)}`;
        } else {
            urlTemplate += `&filters[symbol][id][$eq]=${encodeURIComponent(filterSymbolId)}`;
        }
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

const sanitizeHistoriesForStorage = (items) => {
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
            let forceRefresh = false;

            if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
                filterSymbolId = arg.symbolIds || arg.symbolId;
                forceRefresh = arg.forceRefresh;
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

                // Save to localStorage and set watchlist_updated_latest = 'true'
                try {
                    const sanitized = sanitizeHistoriesForStorage(histories);
                    localStorage.setItem('watchlist_histories', JSON.stringify(sanitized));
                    localStorage.setItem('watchlist_updated_latest', 'true');
                } catch (e) {
                    console.error('Failed to save to localStorage:', e);
                }

                return histories;
            }

            // If it's a single symbol fetch
            const cachedHistoriesStr = localStorage.getItem('watchlist_histories');

            if (!forceRefresh && cachedHistoriesStr) {
                try {
                    const cached = JSON.parse(cachedHistoriesStr);
                    const symbolHistory = cached.filter(h => {
                        const symId = h.symbol?.documentId || h.symbol?.id;
                        return symId && filterSymbolId && symId.toString() === filterSymbolId.toString();
                    });

                    if (symbolHistory.length > 0) {
                        console.log(`Loading history for symbol ${filterSymbolId} from localStorage cache...`);
                        return symbolHistory;
                    }
                } catch (e) {
                    console.error('Failed reading from localStorage:', e);
                }
            }

            // Fallback to fetch from database
            const singleHistory = await fetchPagedSymbolHistories(filterSymbolId);

            // Merge into localStorage if present
            if (cachedHistoriesStr) {
                try {
                    const cached = JSON.parse(cachedHistoriesStr);
                    const filtered = cached.filter(h => {
                        const symId = h.symbol?.documentId || h.symbol?.id;
                        return !symId || symId.toString() !== filterSymbolId.toString();
                    });
                    const merged = [...filtered, ...sanitizeHistoriesForStorage(singleHistory)];
                    localStorage.setItem('watchlist_histories', JSON.stringify(merged));
                } catch (e) {
                    console.error('Failed to update localStorage:', e);
                }
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

            // Determine Source based on Market Type
            if (marketType === 'Crypto') {
                externalData = await getCryptoHistory(symbol);
            } else if (String(marketType || '').toLowerCase() === 'derivative') {
                externalData = await getFuturesHistory(symbol.split(':')[0], 'derivative', resolution || '1');
            } else {
                // Default to TCBS (Stocks)
                const ticket = symbol.split(':')[0];
                externalData = await getStockHistory(ticket);
            }

            if (!externalData || externalData.length === 0) return [];

            // 1.5 Fetch latest date from Strapi to avoid duplicates
            // We sort by date descending and take the first one.
            let latestDate = null;
            try {
                // Fetch documentId as well for Strapi v5 compatibility
                const latestRes = await api.get(`/symbol-histories?filters[symbol][documentId][$eq]=${symbolId}&sort=date:desc&pagination[pageSize]=1`);
                const latestItems = latestRes.data.data;
                if (latestItems && latestItems.length > 0) {
                    latestDate = new Date(latestItems[0].date);
                }
            } catch (err) {
                console.warn('Could not fetch latest history date, proceeding with full import.', err);
            }

            // Filter external data to keep only NEW records
            const newRecords = externalData.filter(item => {
                if (!latestDate) return true; // No history, import all
                const itemDate = new Date(item.tradingDate);
                // Return true if itemDate is NEWER than latestDate
                return itemDate > latestDate;
            });

            if (newRecords.length === 0) {
                return 0; // Nothing to add
            }

            let count = 0;
            // 2. Save NEW records to Strapi
            const promises = newRecords.map(async (item) => {
                // Formatting payload for Strapi
                // TCBS: { ticker, open, high, low, close, volume, tradingDate }
                // Strapi: { symbol: ID, date, open, high, low, close, volume }

                const payload = {
                    data: {
                        symbol: symbolId,
                        date: item.tradingDate, // ISO string likely needed? TCBS might return '2025-01-01T...'
                        open: item.open,
                        high: item.high,
                        low: item.low,
                        close: item.close,
                        volume: item.volume
                    }
                };

                // Simple duplication check could be: try create, ignore error?
                // Or assume this is a manual "sync" action.
                try {
                    // We verify duplicates by querying? Too slow.
                    // Just fire and forget for now or handle errors.
                    await api.post('/symbol-histories', payload);
                    count++;
                } catch (e) {
                    // Ignore duplicate errors if they arise (assuming constraints)
                    // Or logging
                }
            });

            await Promise.all(promises);

            // 3. Refresh list
            dispatch(fetchHistories({ symbolId, forceRefresh: true }));
            return count;

        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const deleteAllHistories = createAsyncThunk(
    'market/deleteAllHistories',
    async (symbolId, { dispatch, rejectWithValue }) => {
        try {
            // 1. Fetch all histories for this symbol to get their IDs
            // We need to loop or set a high limit.
            // Strapi usually paginates.
            let allIds = [];
            let page = 1;
            let pageSize = 100;
            let hasMore = true;

            while (hasMore) {
                // Fetch documentId as well for Strapi v5 compatibility
                const url = `/symbol-histories?filters[symbol][documentId][$eq]=${symbolId}&pagination[page]=${page}&pagination[pageSize]=${pageSize}&fields[0]=id&fields[1]=documentId`;
                const res = await api.get(url);
                const data = res.data.data;
                const meta = res.data.meta;

                if (data.length > 0) {
                    allIds = [...allIds, ...data];
                }

                if (page >= meta.pagination.pageCount) {
                    hasMore = false;
                } else {
                    page++;
                }
            }

            if (allIds.length === 0) return 0;

            // 2. Delete each one
            // NOTE: Strapi v4 doesn't support bulk delete by default without a plugin or custom controller.
            // We have to delete one by one.
            const deletePromises = allIds.map(item => {
                const idToDelete = item.documentId || item.id;
                return api.delete(`/symbol-histories/${idToDelete}`);
            });
            await Promise.all(deletePromises);
            return allIds.length;

        } catch (error) {
            console.error(error);
            return rejectWithValue(error.message);
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
                            ? await getFuturesHistory(ticker, 'derivative', '1')
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
            const ticker = symbol.split(':')[0];
            const data = await getTechnicalIndicators(ticker);
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
            const updatedSymbol = await updateMarketInfo(ticker, symbolId);
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
        setSymbolFilter: (state, action) => {
            state.selectedSymbolFilter = action.payload;
        },
        clearError: (state) => {
            state.error = null;
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
                // Single symbol load: merge/update existing histories for this symbol
                let singleSymbolId = action.meta.arg;
                if (singleSymbolId && typeof singleSymbolId === 'object') {
                    singleSymbolId = singleSymbolId.symbolId;
                }
                const filteredHistories = state.histories.filter(h => {
                    const symId = h.symbol?.documentId || h.symbol?.id;
                    return !symId || !singleSymbolId || symId.toString() !== singleSymbolId.toString();
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

export const { setSymbolFilter, clearError } = marketSlice.actions;
export default marketSlice.reducer;
