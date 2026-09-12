import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';

export const fetchRules = createAsyncThunk(
    'rules/fetchRules',
    async (filterStatus, { rejectWithValue }) => {
        try {
            const pageSize = 100;
            let page = 1;
            let rules = [];
            let pageCount = 1;

            // Strapi limits REST responses to 100 records per page. Keep
            // requesting pages until the API reports that every page is read.
            do {
                const res = await api.get(
                    `/rules?populate=*&pagination[page]=${page}&pagination[pageSize]=${pageSize}`
                );
                const responseData = res.data;

                rules = rules.concat(responseData.data || []);
                pageCount = responseData.meta?.pagination?.pageCount || page;
                page += 1;
            } while (page <= pageCount);

            return rules;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const createRule = createAsyncThunk(
    'rules/createRule',
    async (ruleData, { rejectWithValue }) => {
        try {
            const res = await api.post('/rules', { data: ruleData });
            return res.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const updateRule = createAsyncThunk(
    'rules/updateRule',
    async ({ id, data }, { rejectWithValue }) => {
        try {
            const res = await api.put(`/rules/${id}`, { data });
            return res.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const updateRuleStatus = createAsyncThunk(
    'rules/updateStatus',
    async ({ id, status }, { rejectWithValue }) => {
        try {
            const res = await api.put(`/rules/${id}`, {
                data: { Active: status } // Map 'status' to 'Active' field
            });
            return res.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

const ruleSlice = createSlice({
    name: 'rules',
    initialState: {
        items: [],
        loading: false,
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchRules.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchRules.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload;
            })
            .addCase(fetchRules.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(updateRuleStatus.fulfilled, (state, action) => {
                const updatedItem = action.payload;
                state.items = state.items.map(item =>
                    (item.id === updatedItem.id || item.documentId === updatedItem.documentId)
                        ? { ...item, ...updatedItem }
                        : item
                );
            })
            .addCase(createRule.fulfilled, (state, action) => {
                state.items.unshift(action.payload);
            })
            .addCase(updateRule.fulfilled, (state, action) => {
                const updatedItem = action.payload;
                state.items = state.items.map(item =>
                    (item.id === updatedItem.id || item.documentId === updatedItem.documentId)
                        ? { ...item, ...updatedItem }
                        : item
                );
            });
    }
});

export default ruleSlice.reducer;
