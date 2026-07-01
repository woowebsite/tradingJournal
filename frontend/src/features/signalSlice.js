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
    async ({ selectedRuleId, selectedRuleIds, scanSymbols, accountId }, { dispatch, getState, rejectWithValue }) => {
        try {
            const state = getState();
            const ruleIds = selectedRuleIds?.length ? selectedRuleIds : [selectedRuleId];
            const normalizedRuleIds = ruleIds.filter(Boolean).map(id => id.toString());

            if (normalizedRuleIds.length === 0) throw new Error('No rules selected.');

            const rulesToScan = normalizedRuleIds.map(ruleId => {
                const rule = state.rules.items.find(r =>
                    (r.documentId && r.documentId.toString() === ruleId) ||
                    (r.id && r.id.toString() === ruleId)
                );

                if (!rule) throw new Error(`Rule ${ruleId} not found.`);
                if (!rule.Rule) throw new Error(`${rule.Name || 'Selected rule'} has no logic defined.`);

                return rule;
            });

            // Fetch Symbols, unless the page supplied a filtered scan list.
            const symbols = scanSymbols?.length
                ? scanSymbols.map(symbol => ({
                    ...symbol,
                    id: symbol.documentId || symbol.id,
                    documentId: symbol.documentId || symbol.id,
                    Name: symbol.Name || symbol.name
                }))
                : (await api.get('/symbols')).data.data;

            if (!symbols || symbols.length === 0) throw new Error('No symbols selected.');

            let matchCount = 0;

            // Process sequentially or parallel (limit concurrency if needed)
            const scanPromises = symbols.map(async (symbol) => {
                try {
                    const symId = symbol.documentId || symbol.id;
                    // Fetch recent history (DESC)
                    const historyRes = await api.get(`/symbol-histories?filters[symbol][documentId][$eq]=${symId}&pagination[limit]=50&sort=date:desc`);
                    const history = historyRes.data.data;

                    if (!history || history.length === 0) return;

                    for (const rule of rulesToScan) {
                        // Loop through history to find the first match (most recent interaction)
                        for (let i = 0; i < history.length; i++) {
                            const isMatch = evaluateRule(history, rule.Rule, i);

                            if (isMatch) {
                                // Uniqueness Check: Prevent duplicate signal for same Symbol + Date + Rule
                                const checkDate = history[i].date;
                                const ruleId = rule.documentId || rule.id;
                                let checkUrl = `/signals?filters[date][$eq]=${checkDate}`;
                                if (typeof symId === 'string') {
                                    checkUrl += `&filters[symbol][documentId][$eq]=${symId}`;
                                } else {
                                    checkUrl += `&filters[symbol][id][$eq]=${symId}`;
                                }
                                if (typeof ruleId === 'string') {
                                    checkUrl += `&filters[rules][documentId][$eq]=${ruleId}`;
                                } else {
                                    checkUrl += `&filters[rules][id][$eq]=${ruleId}`;
                                }

                                const existing = await api.get(checkUrl);
                                if (existing.data.data && existing.data.data.length > 0) {
                                    console.log(`Signal already exists for ${symbol.Name} on ${checkDate} with ${rule.Name}. Skipping.`);
                                    break;
                                }

                                const payload = {
                                    data: {
                                        name: `${symbol.Name} - ${rule.Name} (${rule.Type})`,
                                        date: history[i].date,
                                        symbol: symId,
                                        rules: [ruleId],
                                        account: accountId, // Add account association
                                        expired: false
                                    }
                                };
                                console.log(`Match found for symbol ${symbol.Name} with ${rule.Name} at index ${i} (Date: ${history[i].date})`);

                                await api.post('/signals', payload);
                                matchCount++;
                                break; // Stop after finding the most recent signal matches this rule
                            }
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
            .addCase(scanSignals.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(scanSignals.fulfilled, (state) => {
                state.loading = false;
            })
            .addCase(scanSignals.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(deleteSignal.fulfilled, (state, action) => {
                state.items = state.items.filter(item => (item.id || item.documentId) !== action.payload);
            });
    }
});

export default signalSlice.reducer;
