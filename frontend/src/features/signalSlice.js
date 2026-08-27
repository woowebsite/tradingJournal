import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';
import { evaluateRule } from '../utils/ruleEngine';
import { createBlocksFromText } from '../utils/textUtils';
import { calculateTradePnL } from '../utils/tradeCalculations';
import { loadExternalHistory } from './marketSlice';

const HISTORY_PAGE_SIZE = 100;
const MAX_HISTORY_CANDLES = 365;

const getHistoryDate = (candle) => candle?.date || candle?.attributes?.date;

export const fetchHistoryForSignalScan = async (symbolId, tf = 'D1') => {
    const history = [];
    const maxPages = Math.ceil(MAX_HISTORY_CANDLES / HISTORY_PAGE_SIZE);

    let tfFilter = '';
    if (tf === 'D1') {
        tfFilter = '&filters[$or][0][tf][$eq]=D1&filters[$or][1][tf][$null]=true';
    } else if (tf) {
        tfFilter = `&filters[tf][$eq]=${encodeURIComponent(tf)}`;
    }

    const isDocId = typeof symbolId === 'string' && symbolId.length > 5;
    const symFilter = `filters[symbol][${isDocId ? 'documentId' : 'id'}][$eq]=${encodeURIComponent(symbolId)}`;

    for (let page = 1; page <= maxPages; page++) {
        const historyRes = await api.get(
            `/symbol-histories?${symFilter}${tfFilter}` +
            `&pagination[page]=${page}&pagination[pageSize]=${HISTORY_PAGE_SIZE}&sort=date:desc`
        );
        const pageItems = historyRes.data?.data || [];
        history.push(...pageItems);

        const pagination = historyRes.data?.meta?.pagination;
        const isLastPage = pagination?.pageCount
            ? page >= pagination.pageCount
            : pageItems.length < HISTORY_PAGE_SIZE;

        if (isLastPage || history.length >= MAX_HISTORY_CANDLES) break;
    }

    return history
        .slice(0, MAX_HISTORY_CANDLES)
        .sort((a, b) => new Date(getHistoryDate(b)).getTime() - new Date(getHistoryDate(a)).getTime());
};

export const fetchSignals = createAsyncThunk(
    'signals/fetchSignals',
    async (params = {}, { rejectWithValue }) => {
        try {
            const pageSize = params.pageSize || 100;
            const signals = [];

            if (params.todayOnly) {
                // Fetch only today's signals (last 30 hours) in a single request with no page limit
                const today = new Date();
                const sinceDate = new Date(today.getTime() - 30 * 3600 * 1000).toISOString();
                const res = await api.get(
                    `/signals?populate=*&sort=date:desc&filters[date][$gte]=${encodeURIComponent(sinceDate)}&pagination[limit]=-1`
                );
                return res.data?.data || [];
            }

            // Fetch first page to discover pageCount
            const firstRes = await api.get(
                `/signals?populate=*&sort=date:desc&pagination[page]=1&pagination[pageSize]=${pageSize}`
            );
            signals.push(...(firstRes.data?.data || []));
            const pageCount = firstRes.data?.meta?.pagination?.pageCount || 1;

            // Fetch remaining pages in parallel
            if (pageCount > 1) {
                const pagePromises = [];
                for (let p = 2; p <= pageCount; p++) {
                    pagePromises.push(
                        api.get(`/signals?populate=*&sort=date:desc&pagination[page]=${p}&pagination[pageSize]=${pageSize}`)
                    );
                }
                const responses = await Promise.all(pagePromises);
                responses.forEach(res => {
                    signals.push(...(res.data?.data || []));
                });
            }

            return signals;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const scanSignals = createAsyncThunk(
    'signals/scanSignals',
    async ({ selectedRuleId, selectedRuleIds, scanSymbols, accountId, strategyId, syncDemoTrades = true, tf = 'D1' }, { dispatch, getState, rejectWithValue }) => {
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
            const activeStrategy = strategyId
                ? state.strategies.items.find(strategy =>
                    (strategy.documentId && strategy.documentId.toString() === strategyId.toString()) ||
                    (strategy.id && strategy.id.toString() === strategyId.toString())
                )
                : null;
            const tradeDetailRuleGroups = [
                { fieldName: 'entryRules', signal: 'Entry', detailType: 'Buy' },
                { fieldName: 'takeProfitRules', signal: 'TakeProfit', detailType: 'Sell' },
                { fieldName: 'stoplossRules', signal: 'Stoploss', detailType: 'Sell' },
                { fieldName: 'exitRules', signal: 'Exit', detailType: 'Sell' }
            ];
            const ruleGroupById = new Map();

            tradeDetailRuleGroups.forEach(group => {
                (activeStrategy?.[group.fieldName] || []).forEach(rule => {
                    const id = (rule.documentId || rule.id)?.toString();
                    if (id) ruleGroupById.set(id, group);
                });
            });

            const getRuleScanOrder = (rule) => {
                const ruleId = (rule.documentId || rule.id)?.toString();
                const group = ruleGroupById.get(ruleId);
                const groupIndex = tradeDetailRuleGroups.findIndex(item => item.signal === group?.signal);

                return groupIndex === -1 ? tradeDetailRuleGroups.length : groupIndex;
            };

            rulesToScan.sort((a, b) => getRuleScanOrder(a) - getRuleScanOrder(b));

            const buildDemoTradeUrl = ({ symId, date, status }) => {
                let url = `/trades?filters[mode][$eq]=Demo`;
                if (date) {
                    url += `&filters[date][$eq]=${encodeURIComponent(date)}`;
                }
                if (status) {
                    url += `&filters[trade_status][$eq]=${status}`;
                }
                if (typeof symId === 'string') {
                    url += `&filters[symbol][documentId][$eq]=${symId}`;
                } else {
                    url += `&filters[symbol][id][$eq]=${symId}`;
                }
                if (typeof strategyId === 'string') {
                    url += `&filters[strategy][documentId][$eq]=${strategyId}`;
                } else {
                    url += `&filters[strategy][id][$eq]=${strategyId}`;
                }
                return `${url}&sort=date:desc&populate=trade_details`;
            };

            const createTradeDetail = async ({ tradeId, group, rule, historyItem }) => {
                const noteText = `Auto-created from ${group.signal} signal: ${rule.Name || 'Rule'}`;
                const price = Number(historyItem.close ?? historyItem.Close ?? historyItem.price ?? 0);
                const detailPayload = {
                    price: Number.isFinite(price) ? price : 0,
                    type: group.detailType,
                    volume: 100,
                    signal: group.signal,
                    date: historyItem.date,
                    note: createBlocksFromText(noteText),
                    trade: tradeId
                };

                const detailRes = await api.post('/trade-details', { data: detailPayload });
                return detailRes.data.data || detailPayload;
            };

            const findEligibleOpenTrade = (trades, signalDate) => {
                const signalTime = new Date(signalDate).getTime();

                return [...(trades || [])]
                    .filter(trade => {
                        const tradeTime = new Date(trade.date || trade.createdAt).getTime();
                        return Number.isFinite(tradeTime) && Number.isFinite(signalTime) && tradeTime <= signalTime;
                    })
                    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))[0];
            };

            const findOpenTradeBeforeSignal = async ({ symId, signalDate }) => {
                const openTrades = await api.get(buildDemoTradeUrl({ symId, status: 'Open' }));
                return findEligibleOpenTrade(openTrades.data.data, signalDate);
            };

            const syncDemoTradeDetailForSignal = async ({ symbol, symId, rule, historyItem }) => {
                if (!accountId || !strategyId) return;

                const ruleId = (rule.documentId || rule.id)?.toString();
                const group = ruleGroupById.get(ruleId);

                if (!group) {
                    console.log(`Rule ${rule.Name || ruleId} is not assigned to an Entry/TakeProfit/Stoploss/Exit group in the active strategy. Skipping demo trade sync.`);
                    return;
                }

                if (group.signal === 'Entry') {
                    const priorOpenTrade = await findOpenTradeBeforeSignal({ symId, signalDate: historyItem.date });
                    if (priorOpenTrade) {
                        console.log(`Open demo trade already exists for ${symbol.Name} before ${historyItem.date}. Skipping Entry detail.`);
                        return;
                    }

                    const existingTrade = await api.get(buildDemoTradeUrl({ symId, date: historyItem.date }));
                    if (existingTrade.data.data && existingTrade.data.data.length > 0) {
                        console.log(`Demo trade already exists for ${symbol.Name} on ${historyItem.date}. Skipping.`);
                        return;
                    }

                    const noteText = `Auto-created from Entry signal: ${rule.Name || 'Entry rule'}`;
                    const tradePayload = {
                        type: 'Long',
                        trade_status: 'Open',
                        mode: 'Demo',
                        date: historyItem.date,
                        account: accountId,
                        strategy: strategyId,
                        symbol: symId,
                        scored: 0,
                        note: createBlocksFromText(noteText),
                        pnl: 0
                    };

                    const tradeRes = await api.post('/trades', { data: tradePayload });
                    const savedTradeId = tradeRes.data.data.documentId || tradeRes.data.data.id;
                    await createTradeDetail({ tradeId: savedTradeId, group, rule, historyItem });
                    return;
                }

                const trade = await findOpenTradeBeforeSignal({ symId, signalDate: historyItem.date });
                if (!trade) {
                    console.log(`No eligible open demo trade found for ${symbol.Name} before ${historyItem.date}. Skipping ${group.signal} detail.`);
                    return;
                }

                const tradeId = trade.documentId || trade.id;
                const hasExistingDetail = trade.trade_details?.some(detail =>
                    detail.signal === group.signal &&
                    detail.date === historyItem.date
                );

                if (hasExistingDetail) {
                    console.log(`Demo trade detail already exists for ${symbol.Name} ${group.signal} on ${historyItem.date}. Skipping.`);
                    return;
                }

                const createdDetail = await createTradeDetail({ tradeId, group, rule, historyItem });

                if (group.signal === 'TakeProfit' || group.signal === 'Stoploss' || group.signal === 'Exit') {
                    const closeNote = `Auto-closed by ${group.signal} signal: ${rule.Name || 'Rule'}`;
                    const pnl = calculateTradePnL({
                        ...trade,
                        trade_details: [
                            ...(trade.trade_details || []),
                            createdDetail
                        ]
                    });

                    await api.put(`/trades/${tradeId}`, {
                        data: {
                            trade_status: 'Closed',
                            pnl,
                            note: createBlocksFromText(closeNote)
                        }
                    });
                }
            };

            const canCreateSignal = async ({ symbol, symId, rule, historyItem }) => {
                if (!syncDemoTrades) return true;

                const ruleId = (rule.documentId || rule.id)?.toString();
                const group = ruleGroupById.get(ruleId);
                if (!group) return true;

                const openTrade = await findOpenTradeBeforeSignal({ symId, signalDate: historyItem.date });

                if (group.signal === 'Entry') {
                    if (openTrade) {
                        console.log(`Open demo trade already exists for ${symbol.Name} before ${historyItem.date}. Skipping Entry signal.`);
                        return false;
                    }
                    return true;
                }

                if (!openTrade) {
                    console.log(`No eligible open demo trade found for ${symbol.Name} before ${historyItem.date}. Skipping ${group.signal} signal.`);
                    return false;
                }

                return true;
            };

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
                    const ticker = symbol.Name || symbol.name;
                    // Strapi caps each response at 100 records. Fetch enough pages to warm up
                    // recursive indicators such as EMA, MACD, RSI and Supertrend reliably.
                    let history = await fetchHistoryForSignalScan(symId, tf);

                    // If no history in database for this timeframe, auto-fetch from external API
                    if ((!history || history.length === 0) && ticker) {
                        try {
                            await dispatch(loadExternalHistory({
                                symbol: ticker,
                                symbolId: symId,
                                tf
                            })).unwrap();
                            history = await fetchHistoryForSignalScan(symId, tf);
                        } catch (loadErr) {
                            console.warn(`Could not load external history for ${ticker} (${tf}):`, loadErr);
                        }
                    }

                    if (!history || history.length === 0) return;

                    for (let i = history.length - 1; i >= 0; i--) {
                        // Process each candle chronologically so demo trades open and close in chart order.
                        for (const rule of rulesToScan) {
                            const isMatch = evaluateRule(history, rule.Rule, i);

                            if (isMatch) {
                                // Uniqueness Check: Prevent duplicate signal for same Symbol + Date + Rule
                                const checkDate = history[i].date;
                                const ruleId = rule.documentId || rule.id;
                                const isAllowedSignal = await canCreateSignal({ symbol, symId, rule, historyItem: history[i] });
                                if (!isAllowedSignal) continue;

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
                                    if (syncDemoTrades) {
                                        await syncDemoTradeDetailForSignal({ symbol, symId, rule, historyItem: history[i] });
                                    }
                                    continue;
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
                                if (syncDemoTrades) {
                                    await syncDemoTradeDetailForSignal({ symbol, symId, rule, historyItem: history[i] });
                                }
                                matchCount++;
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
                const targetId = String(action.payload);
                state.items = state.items.filter(item => {
                    const docId = item.documentId ? String(item.documentId) : null;
                    const numId = item.id ? String(item.id) : null;
                    return docId !== targetId && numId !== targetId;
                });
            });
    }
});

export default signalSlice.reducer;
