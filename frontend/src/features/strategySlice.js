import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';

export const fetchStrategies = createAsyncThunk(
    'strategies/fetchStrategies',
    async (_, { rejectWithValue }) => {
        try {
            const res = await api.get('/strategies?sort=name:asc&populate=rules');
            return res.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const createStrategy = createAsyncThunk(
    'strategies/createStrategy',
    async (data, { rejectWithValue }) => {
        try {
            const res = await api.post('/strategies', { data });
            return res.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const updateStrategy = createAsyncThunk(
    'strategies/updateStrategy',
    async ({ id, data }, { rejectWithValue }) => {
        try {
            const res = await api.put(`/strategies/${id}`, { data });
            return res.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const deleteStrategy = createAsyncThunk(
    'strategies/deleteStrategy',
    async (id, { rejectWithValue }) => {
        try {
            await api.delete(`/strategies/${id}`);
            return id;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

const strategySlice = createSlice({
    name: 'strategies',
    initialState: {
        items: [],
        loading: false,
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            // Fetch
            .addCase(fetchStrategies.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchStrategies.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload;
            })
            .addCase(fetchStrategies.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Create
            .addCase(createStrategy.fulfilled, (state, action) => {
                state.items.push(action.payload);
            })
            // Update
            .addCase(updateStrategy.fulfilled, (state, action) => {
                const updatedItem = action.payload;
                const index = state.items.findIndex(item => item.id === updatedItem.id || item.documentId === updatedItem.documentId);
                if (index !== -1) {
                    state.items[index] = { ...state.items[index], ...updatedItem };
                }
            })
            // Delete
            .addCase(deleteStrategy.fulfilled, (state, action) => {
                const id = action.payload;
                state.items = state.items.filter(item => item.id !== id && item.documentId !== id);
            });
    }
});

export default strategySlice.reducer;
