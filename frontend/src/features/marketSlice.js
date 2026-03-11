import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';
import { getCryptoHistory } from '../services/binance';

import { getStockHistory, getIntradaySnapshots, getTechnicalIndicators, updateMarketInfo } from '../services/tcbs';

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

export const fetchHistories = createAsyncThunk(
    'market/fetchHistories',
    async (filterSymbolId, { rejectWithValue }) => {
        try {
            let url = '/symbol-histories?populate=symbol&sort=date:desc';
            if (filterSymbolId) {
                url += `&filters[symbol][documentId][$eq]=${filterSymbolId}`;
            }
            const res = await api.get(url);
            return res.data.data || [];
        } catch (error) {
            console.error(error);
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const loadExternalHistory = createAsyncThunk(
    'market/loadExternalHistory',
    async ({ symbol, symbolId, marketType }, { dispatch, rejectWithValue }) => {
        try {
            let externalData = [];

            // Determine Source based on Market Type
            if (marketType === 'Crypto') {
                externalData = await getCryptoHistory(symbol);
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
            dispatch(fetchHistories(symbolId));
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

export const fetchLatestHistory = createAsyncThunk(
    'market/fetchLatestHistory',
    async (symbolId, { rejectWithValue }) => {
        try {
            const url = `/symbol-histories?filters[symbol][documentId][$eq]=${symbolId}&sort=date:desc&pagination[pageSize]=1`;
            const res = await api.get(url);
            const data = res.data.data;
            if (data && data.length > 0) {
                return data[0];
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

const marketSlice = createSlice({
    name: 'market',
    initialState: {
        symbols: [],
        histories: [],
        loading: false,
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
            state.error = null;
        });
        builder.addCase(fetchHistories.fulfilled, (state, action) => {
            state.loading = false;
            state.histories = action.payload.map(item => ({
                id: item.id || item.documentId,
                ...item
            }));
        });
        builder.addCase(fetchHistories.rejected, (state, action) => {
            state.loading = false;
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
        });
        builder.addCase(loadExternalHistory.fulfilled, (state) => {
            // Histories re-fetched by thunk dispatch
            state.loading = false;
        });
        builder.addCase(loadExternalHistory.rejected, (state, action) => {
            state.loading = false;
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
    }
});

export const { setSymbolFilter, clearError } = marketSlice.actions;
export default marketSlice.reducer;
