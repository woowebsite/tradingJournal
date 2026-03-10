import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';
import { createBlocksFromText } from '../utils/textUtils';

export const fetchTrades = createAsyncThunk(
    'trades/fetchTrades',
    async (params = {}, { rejectWithValue }) => {
        try {
            // params can handle filters, sorting, pagination
            // e.g. { filters: { account: { documentId: { $eq: id } } }, sort: 'entry_date:desc' }
            // For simplicity, let's accept a query string or object builder
            // But to keep it flexible: accepting an object and enabling api.get with params

            // Construct query string manually or use qs if available, but here we likely pass a constructed URL suffix 
            // OR we pass specific named args.
            // Let's expect 'accountId' and 'sort' for now specific to this use case, or generic 'query'.

            // If the user passes a raw query string or object, adapting is tricky without 'qs'.
            // Let's implement specific action for Account Detail first: fetchAccountTrades

            let url = '/trades?populate[0]=symbol&populate[1]=trade_details&populate[2]=trade_details.screenshot';
            if (params.accountId) {
                // Determine if documentId or id
                // Assuming documentId is safer for v5, relying on caller to pass correct ID type
                url += `&filters[account][documentId][$eq]=${params.accountId}`;
            }
            if (params.symbolId) {
                // Filter by symbol
                url += `&filters[symbol][documentId][$eq]=${params.symbolId}`;
            }
            if (params.sort) {
                url += `&sort=${params.sort}`;
            } else {
                url += `&sort=date:desc`;
            }
            if (params.pageSize) {
                url += `&pagination[pageSize]=${params.pageSize}`;
            }

            const res = await api.get(url);
            return res.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const fetchOpenTrades = createAsyncThunk(
    'trades/fetchOpenTrades',
    async ({ accountId }, { rejectWithValue }) => {
        try {
            const url = `/trades?filters[account][documentId][$eq]=${accountId}&filters[trade_status][$eq]=Open&pagination[pageSize]=1000&populate[0]=symbol&populate[1]=trade_details`;
            const res = await api.get(url);
            return res.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const fetchClosedTrades = createAsyncThunk(
    'trades/fetchClosedTrades',
    async ({ accountId, strategyId }, { rejectWithValue }) => {
        try {
            let url = `/trades?filters[account][documentId][$eq]=${accountId}&filters[trade_status][$eq]=Closed&pagination[pageSize]=1000&populate[0]=symbol&populate[1]=trade_details`;
            // if (strategyId) {
            //     url += `&filters[strategy][documentId][$eq]=${strategyId}`;
            // }
            const res = await api.get(url);
            return res.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);



export const saveTrade = createAsyncThunk(
    'trades/saveTrade',
    async ({ tradeData, tradeToEdit }, { dispatch, rejectWithValue }) => {
        try {
            const token = localStorage.getItem('strapi_token');
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337/api';

            // 1. Separate Details and Clean Payload
            const { trade_details: formDetails, ...tradePayload } = tradeData;

            // Remove derived or temporary fields
            delete tradePayload.screenshotFile;
            delete tradePayload.screenshot;

            // Convert Note to Blocks
            tradePayload.note = createBlocksFromText(tradePayload.note);

            // 2. Save Parent Trade (Create or Update)
            let savedTradeId;
            try {
                if (tradeToEdit) {
                    savedTradeId = tradeToEdit.documentId || tradeToEdit.id;
                    await api.put(`/trades/${savedTradeId}`, { data: tradePayload });
                } else {
                    const res = await api.post('/trades', { data: tradePayload });
                    // Strapi v4 vs v5 ID
                    savedTradeId = res.data.data.documentId || res.data.data.id;
                }
            } catch (err) {
                console.error("Error saving parent trade:", err.response?.data || err);
                throw err;
            }

            // 3. Handle Trade Details (Manual Sync)

            // A. Identify Deletions
            if (tradeToEdit && tradeToEdit.trade_details) {
                const currentIds = formDetails.filter(d => d.id).map(d => d.id);
                const idsToDelete = tradeToEdit.trade_details
                    .filter(d => !currentIds.includes(d.id))
                    .map(d => d.id || d.documentId);

                await Promise.all(idsToDelete.map(id => api.delete(`/trade-details/${id}`).catch(e => console.warn(`Failed to delete detail ${id}`, e))));
            }

            // B. Process Updates and Creations
            await Promise.all(formDetails.map(async (detail) => {
                let screenshotId = null;

                // Upload screenshot if new file exists
                if (detail.screenshotFile) {
                    const formData = new FormData();
                    formData.append('files', detail.screenshotFile);

                    try {
                        const uploadRes = await fetch(`${API_URL}/upload`, {
                            method: 'POST',
                            headers: { 'Authorization': token ? `Bearer ${token}` : '' },
                            body: formData
                        });
                        if (uploadRes.ok) {
                            const files = await uploadRes.json();
                            const fileObj = Array.isArray(files) ? files[0] : files;
                            screenshotId = fileObj.id || fileObj.documentId;
                        }
                    } catch (e) {
                        console.error("Screenshot upload failed", e);
                    }
                } else if (detail.existingScreenshot) {
                    screenshotId = detail.existingScreenshot.id || detail.existingScreenshot.documentId;
                }

                // Construct Detail Payload
                const detailPayload = {
                    date: detail.date,
                    signal: detail.signal,
                    type: detail.type,
                    price: detail.price,
                    volume: detail.volume,
                    note: createBlocksFromText(detail.note),
                    screenshot: screenshotId,
                    trade: savedTradeId
                };

                try {
                    if (detail.documentId) {
                        await api.put(`/trade-details/${detail.documentId}`, { data: detailPayload });
                    } else {
                        await api.post('/trade-details', { data: detailPayload });
                    }
                } catch (err) {
                    console.error(`Error saving detail (Signal: ${detail.signal})`, err.response?.data || err);
                }
            }));

            return { savedTradeId };

        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

const tradeSlice = createSlice({
    name: 'trades',
    initialState: {
        items: [],       // For general list/search
        openTrades: [],  // Special list for metrics
        closedTrades: [], // Fast access to closed trades
        loading: false,
        openTradesLoading: false,
        closedTradesLoading: false,
        error: null,
    },
    reducers: {
        // CRUD reducers if needed later
    },
    extraReducers: (builder) => {
        builder
            // Generic Fetch
            .addCase(fetchTrades.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchTrades.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload.map(item => ({
                    id: item.documentId || item.id,
                    ...item
                }));
            })
            .addCase(fetchTrades.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Fetch Open Trades
            .addCase(fetchOpenTrades.pending, (state) => {
                state.openTradesLoading = true;
            })
            .addCase(fetchOpenTrades.fulfilled, (state, action) => {
                state.openTradesLoading = false;
                state.openTrades = action.payload.map(item => ({
                    id: item.documentId || item.id,
                    ...item
                }));
            })
            .addCase(fetchOpenTrades.rejected, (state, action) => {
                state.openTradesLoading = false;
                console.error("Failed to fetch open trades:", action.payload);
            })
            // Fetch Closed Trades
            .addCase(fetchClosedTrades.pending, (state) => {
                state.closedTradesLoading = true;
            })
            .addCase(fetchClosedTrades.fulfilled, (state, action) => {
                state.closedTradesLoading = false;
                state.closedTrades = action.payload.map(item => ({
                    id: item.documentId || item.id,
                    ...item
                }));
            })
            .addCase(fetchClosedTrades.rejected, (state, action) => {
                state.closedTradesLoading = false;
                console.error("Failed to fetch closed trades:", action.payload);
            });
    }
});

export default tradeSlice.reducer;
