import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';

export const fetchWebhooks = createAsyncThunk(
    'webhooks/fetchWebhooks',
    async (_, { rejectWithValue }) => {
        try {
            const res = await api.get('/webhooks?populate=*');
            return res.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const createWebhook = createAsyncThunk(
    'webhooks/createWebhook',
    async (webhookData, { rejectWithValue }) => {
        try {
            const res = await api.post('/webhooks', { data: webhookData });
            return res.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const updateWebhook = createAsyncThunk(
    'webhooks/updateWebhook',
    async ({ id, data }, { rejectWithValue }) => {
        try {
            const res = await api.put(`/webhooks/${id}`, { data });
            return res.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const updateWebhookStatus = createAsyncThunk(
    'webhooks/updateStatus',
    async ({ id, status }, { rejectWithValue }) => {
        try {
            const res = await api.put(`/webhooks/${id}`, {
                data: { webhookStatus: status }
            });
            return res.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

const webhookSlice = createSlice({
    name: 'webhooks',
    initialState: {
        items: [],
        loading: false,
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchWebhooks.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchWebhooks.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload;
            })
            .addCase(fetchWebhooks.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(createWebhook.fulfilled, (state, action) => {
                state.items.unshift(action.payload);
            })
            .addCase(updateWebhook.fulfilled, (state, action) => {
                const updatedItem = action.payload;
                state.items = state.items.map(item =>
                    (item.id === updatedItem.id || item.documentId === updatedItem.documentId)
                        ? { ...item, ...updatedItem }
                        : item
                );
            })
            .addCase(updateWebhookStatus.fulfilled, (state, action) => {
                const updatedItem = action.payload;
                state.items = state.items.map(item =>
                    (item.id === updatedItem.id || item.documentId === updatedItem.documentId)
                        ? { ...item, ...updatedItem }
                        : item
                );
            });
    }
});

export default webhookSlice.reducer;
