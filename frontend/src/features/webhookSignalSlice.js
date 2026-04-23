import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';

export const fetchWebhookSignals = createAsyncThunk(
    'webhookSignals/fetchWebhookSignals',
    async (_, { rejectWithValue }) => {
        try {
            const res = await api.get('/webhook-signals?populate=*&sort=createdAt:desc');
            return res.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const updateWebhookSignalStatus = createAsyncThunk(
    'webhookSignals/updateStatus',
    async ({ id, status }, { rejectWithValue }) => {
        try {
            const res = await api.put(`/webhook-signals/${id}`, {
                data: { signalStatus: status }
            });
            return res.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

const webhookSignalSlice = createSlice({
    name: 'webhookSignals',
    initialState: {
        items: [],
        loading: false,
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchWebhookSignals.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchWebhookSignals.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload;
            })
            .addCase(fetchWebhookSignals.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(updateWebhookSignalStatus.fulfilled, (state, action) => {
                const updatedItem = action.payload;
                state.items = state.items.map(item =>
                    (item.id === updatedItem.id || item.documentId === updatedItem.documentId)
                        ? { ...item, ...updatedItem }
                        : item
                );
            });
    }
});

export default webhookSignalSlice.reducer;
