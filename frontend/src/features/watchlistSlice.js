import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';

// Fetch Watchlists (populate account and symbols)
export const fetchWatchlists = createAsyncThunk(
    'watchlists/fetchWatchlists',
    async (_, { rejectWithValue }) => {
        try {
            const res = await api.get('/watch-lists?populate=*&sort=name:asc');
            return res.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

// Create Watchlist
export const createWatchlist = createAsyncThunk(
    'watchlists/createWatchlist',
    async (data, { rejectWithValue }) => {
        try {
            const res = await api.post('/watch-lists', { data });
            const createdId = res.data.data.documentId || res.data.data.id;
            // Fetch the fully populated record to ensure Redux state is correct
            const populatedRes = await api.get(`/watch-lists/${createdId}?populate=*`);
            return populatedRes.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

// Update Watchlist
export const updateWatchlist = createAsyncThunk(
    'watchlists/updateWatchlist',
    async ({ id, data }, { rejectWithValue }) => {
        try {
            await api.put(`/watch-lists/${id}`, { data });
            // Fetch populated data to update state correctly
            const populatedRes = await api.get(`/watch-lists/${id}?populate=*`);
            return populatedRes.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

// Delete Watchlist
export const deleteWatchlist = createAsyncThunk(
    'watchlists/deleteWatchlist',
    async (id, { rejectWithValue }) => {
        try {
            await api.delete(`/watch-lists/${id}`);
            return id;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

const watchlistSlice = createSlice({
    name: 'watchlists',
    initialState: {
        items: [],
        loading: false,
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            // Fetch
            .addCase(fetchWatchlists.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchWatchlists.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload.map(item => ({
                    id: item.documentId || item.id,
                    ...item
                }));
            })
            .addCase(fetchWatchlists.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Create
            .addCase(createWatchlist.fulfilled, (state, action) => {
                state.items.push({
                    id: action.payload.documentId || action.payload.id,
                    ...action.payload
                });
            })
            // Update
            .addCase(updateWatchlist.fulfilled, (state, action) => {
                const updatedItem = action.payload;
                const id = updatedItem.documentId || updatedItem.id;
                const index = state.items.findIndex(item => item.id === id);
                if (index !== -1) {
                    state.items[index] = { ...state.items[index], ...updatedItem, id };
                }
            })
            // Delete
            .addCase(deleteWatchlist.fulfilled, (state, action) => {
                const id = action.payload;
                state.items = state.items.filter(item => item.id !== id && item.documentId !== id);
            });
    }
});

export default watchlistSlice.reducer;
