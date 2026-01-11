import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';

// Fetch Symbols
export const fetchSymbols = createAsyncThunk(
    'symbols/fetchSymbols',
    async (marketId, { rejectWithValue }) => {
        try {
            let url = '/symbols?populate=*&sort=Name:asc&pagination[pageSize]=1000';
            if (marketId) {
                const isDocumentId = typeof marketId === 'string';

                // Construct OR filters safely based on ID type
                // Prevent sending string ID to integer 'id' field which causes API errors
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

// Create Symbol
export const createSymbol = createAsyncThunk(
    'symbols/createSymbol',
    async (data, { rejectWithValue }) => {
        try {
            const res = await api.post('/symbols', { data });
            return res.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

// Update Symbol
export const updateSymbol = createAsyncThunk(
    'symbols/updateSymbol',
    async ({ id, data }, { rejectWithValue }) => {
        try {
            const res = await api.put(`/symbols/${id}`, { data });
            return res.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

// Delete Symbol
export const deleteSymbol = createAsyncThunk(
    'symbols/deleteSymbol',
    async (id, { rejectWithValue }) => {
        try {
            await api.delete(`/symbols/${id}`);
            return id;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

const symbolSlice = createSlice({
    name: 'symbols',
    initialState: {
        items: [],
        loading: false,
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        // Fetch
        builder
            .addCase(fetchSymbols.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchSymbols.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload.map(item => ({
                    ...item,
                    id: item.documentId || item.id
                }));
            })
            .addCase(fetchSymbols.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });

        // Create
        builder.addCase(createSymbol.fulfilled, (state, action) => {
            state.items.push({
                ...action.payload,
                id: action.payload.documentId || action.payload.id
            });
        });

        // Update
        builder.addCase(updateSymbol.fulfilled, (state, action) => {
            const updatedItem = action.payload;
            const index = state.items.findIndex(item =>
                (updatedItem.documentId && item.documentId === updatedItem.documentId) ||
                (updatedItem.id && item.id === updatedItem.id) ||
                (item.id === (updatedItem.documentId || updatedItem.id))
            );
            if (index !== -1) {
                const normalizedId = updatedItem.documentId || updatedItem.id;
                state.items[index] = { ...state.items[index], ...updatedItem, id: normalizedId };
            }
        });

        // Delete
        builder.addCase(deleteSymbol.fulfilled, (state, action) => {
            const id = action.payload;
            state.items = state.items.filter(item => item.id !== id && item.documentId !== id);
        });
    }
});

export default symbolSlice.reducer;
