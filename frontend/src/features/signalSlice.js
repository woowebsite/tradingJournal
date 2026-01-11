import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';
import { evaluateRule } from '../utils/ruleEngine';

export const fetchSignals = createAsyncThunk(
    'signals/fetchSignals',
    async (_, { rejectWithValue }) => {
        try {
            const res = await api.get('/signals?populate=*&sort=date:desc');
            return res.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const scanSignals = createAsyncThunk(
    'signals/scanSignals',
    async ({ selectedRuleId, accountId }, { dispatch, getState, rejectWithValue }) => {
        try {
            const state = getState();
            // Find rule object (handle both id and documentId)
            const rule = state.rules.items.find(r =>
                (r.documentId && r.documentId === selectedRuleId) ||
                (r.id && r.id.toString() === selectedRuleId.toString())
            );

            if (!rule) throw new Error('Selected rule not found.');
            if (!rule.Rule) throw new Error('Rule has no logic defined.');

            // Fetch Symbols
            const symbolsRes = await api.get('/symbols');
            const symbols = symbolsRes.data.data;

            let matchCount = 0;

            // Process sequentially or parallel (limit concurrency if needed)
            const scanPromises = symbols.map(async (symbol) => {
                try {
                    const symId = symbol.documentId || symbol.id;
                    // Fetch recent history (DESC)
                    const historyRes = await api.get(`/symbol-histories?filters[symbol][documentId][$eq]=${symId}&pagination[limit]=50&sort=date:desc`);
                    const history = historyRes.data.data;

                    if (!history || history.length === 0) return;

                    // Loop through history to find the first match (most recent interaction)
                    for (let i = 0; i < history.length; i++) {
                        const isMatch = evaluateRule(history, rule.Rule, i);

                        if (isMatch) {
                            // Uniqueness Check: Prevent duplicate signal for same Symbol + Date
                            const checkDate = history[i].date;
                            let checkUrl = `/signals?filters[date][$eq]=${checkDate}`;
                            if (typeof symId === 'string') {
                                checkUrl += `&filters[symbol][documentId][$eq]=${symId}`;
                            } else {
                                checkUrl += `&filters[symbol][id][$eq]=${symId}`;
                            }

                            const existing = await api.get(checkUrl);
                            if (existing.data.data && existing.data.data.length > 0) {
                                console.log(`Signal already exists for ${symbol.Name} on ${checkDate}. Skipping.`);
                                break;
                            }

                            const payload = {
                                data: {
                                    name: `${symbol.Name} - ${rule.Name} (${rule.Type})`,
                                    date: history[i].date,
                                    symbol: symId,
                                    rules: [rule.documentId || rule.id],
                                    account: accountId, // Add account association
                                    expired: false
                                }
                            };
                            console.log(`Match found for symbol ${symbol.Name} at index ${i} (Date: ${history[i].date})`);

                            await api.post('/signals', payload);
                            matchCount++;
                            break; // Stop after finding the most recent signal matches this rule
                        }
                    }
                } catch (err) {
                    console.error(`Error scanning symbol ${symbol.Name}:`, err);
                }
            });

            await Promise.all(scanPromises);

            dispatch(fetchSignals());
            return matchCount;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const deleteSignal = createAsyncThunk(
    'signals/deleteSignal',
    async (id, { rejectWithValue }) => {
        try {
            await api.delete(`/signals/${id}`);
            return id;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

const signalSlice = createSlice({
    name: 'signals',
    initialState: {
        items: [],
        loading: false,
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchSignals.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchSignals.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload;
            })
            .addCase(fetchSignals.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(deleteSignal.fulfilled, (state, action) => {
                state.items = state.items.filter(item => (item.id || item.documentId) !== action.payload);
            });
    }
});

export default signalSlice.reducer;
