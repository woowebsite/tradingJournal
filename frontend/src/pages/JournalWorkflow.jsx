import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowRight, Target } from 'lucide-react';
import { useAccount } from '../context/AccountContext';
import { fetchStrategies } from '../features/strategySlice';
import { fetchSignals } from '../features/signalSlice';
import { fetchWebhookSignals } from '../features/webhookSignalSlice';
import { fetchTrades } from '../features/tradeSlice';
import api from '../services/api';
import { formatNumber } from '../utils/formatNumber';
import { toNumber } from '../utils/roadmapCalculations';

const getEntityId = (item) => item?.documentId || item?.id;
const sameId = (a, b) => a != null && b != null && a.toString() === b.toString();
const getRuleIds = (rules = []) => rules.map(getEntityId).filter(Boolean).map(id => id.toString());
const formatDate = (date) => date ? new Date(date).toLocaleDateString() : '-';
const getSignalPriceKey = (signal) => `${getEntityId(signal?.symbol) || 'symbol'}:${signal?.date || signal?.createdAt || 'date'}`;
const getMarketName = (account) => account?.market?.Name || account?.market?.name || '';
const isCryptoMarket = (account) => /crypto|binance/i.test(getMarketName(account));
const getWebhookSymbolName = (signal) => {
    const linkedName = signal?.linked_symbol?.Name || signal?.linked_symbol?.name;
    if (linkedName) return linkedName;
    const rawSymbol = signal?.symbol || '';
    const parts = rawSymbol.split(':');
    return parts.length > 1 ? parts[1] : rawSymbol;
};

const getSignalDirection = (signal) => {
    if (signal?.isWebhookSignal) {
        const direction = signal?.signal?.toUpperCase();
        if (['LONG', 'BUY'].includes(direction)) return 'Long';
        if (['SHORT', 'SELL'].includes(direction)) return 'Short';
    }

    const tradeDirection = signal?.trade?.type || signal?.trade?.Type || signal?.type;
    if (tradeDirection === 'Long' || tradeDirection === 'Short') return tradeDirection;

    return '-';
};

const canOpenSignal = (signal) => {
    if (signal?.signalStatus === 'Unread') return true;
    return Boolean(signal?.trade);
};

const JournalWorkflow = () => {
    const dispatch = useDispatch();
    const { selectedAccount } = useAccount();
    const { items: strategies } = useSelector(state => state.strategies);
    const { items: signals } = useSelector(state => state.signals);
    const { items: webhookSignals } = useSelector(state => state.webhookSignals);
    const { items: trades } = useSelector(state => state.trades);
    const [roadmaps, setRoadmaps] = useState([]);
    const [signalPrices, setSignalPrices] = useState({});

    const accountId = getEntityId(selectedAccount);
    const useWebhookSignals = isCryptoMarket(selectedAccount);

    useEffect(() => {
        dispatch(fetchStrategies());
        if (useWebhookSignals) {
            dispatch(fetchWebhookSignals());
        } else {
            dispatch(fetchSignals());
        }
    }, [dispatch, useWebhookSignals]);

    useEffect(() => {
        if (!accountId) {
            setRoadmaps([]);
            return;
        }

        let cancelled = false;

        const loadRoadmaps = async () => {
            try {
                const response = await api.get(`/roadmaps?filters[account][documentId][$eq]=${accountId}&sort=updatedAt:desc&pagination[pageSize]=100&populate=*`);
                if (!cancelled) setRoadmaps(response.data.data || []);
            } catch (error) {
                console.error('Failed to load roadmaps for workflow:', error);
                if (!cancelled) setRoadmaps([]);
            }
        };

        loadRoadmaps();

        return () => {
            cancelled = true;
        };
    }, [accountId]);

    const activeStrategyId = useMemo(() => {
        const strategy = selectedAccount?.strategy;
        if (!strategy) return null;
        return typeof strategy === 'object' ? getEntityId(strategy) : strategy;
    }, [selectedAccount]);

    const activeStrategy = useMemo(() => {
        if (!activeStrategyId) return null;
        return strategies.find(strategy => sameId(strategy.documentId, activeStrategyId) || sameId(strategy.id, activeStrategyId)) || null;
    }, [activeStrategyId, strategies]);

    useEffect(() => {
        if (!accountId) return;
        dispatch(fetchTrades({
            accountId,
            strategyId: activeStrategyId || undefined,
            pageSize: 1000
        }));
    }, [accountId, activeStrategyId, dispatch]);

    const processedRoadmap = useMemo(() => {
        return roadmaps.find(roadmap => (roadmap.status || 'unprocess') === 'process') || null;
    }, [roadmaps]);

    const strategyRuleIds = useMemo(() => {
        if (!activeStrategy) return new Set();
        return new Set([
            ...getRuleIds(activeStrategy.rules),
            ...getRuleIds(activeStrategy.entryRules),
            ...getRuleIds(activeStrategy.takeProfitRules),
            ...getRuleIds(activeStrategy.stoplossRules),
            ...getRuleIds(activeStrategy.exitRules)
        ]);
    }, [activeStrategy]);

    const strategySignals = useMemo(() => {
        if (useWebhookSignals) {
            const activeWebhookId = getEntityId(activeStrategy?.webhook)?.toString();

            return webhookSignals
                .filter(signal => signal.signalStatus !== 'Reject')
                .filter(signal => {
                    if (!activeWebhookId) return true;
                    return sameId(getEntityId(signal.webhook), activeWebhookId);
                })
                .map(signal => {
                    const linkedSymbol = signal.linked_symbol || null;
                    const symbolName = getWebhookSymbolName(signal);
                    const symbol = linkedSymbol || {
                        id: symbolName,
                        documentId: symbolName,
                        Name: symbolName,
                        name: symbolName
                    };

                    return {
                        ...signal,
                        isWebhookSignal: true,
                        symbol,
                        date: signal.createdDate || signal.createdAt,
                        name: signal.signal || signal.desc || 'Webhook signal',
                        expired: signal.signalStatus === 'Reject',
                        price: Number(signal.price)
                    };
                });
        }

        if (strategyRuleIds.size === 0) return [];

        return signals.filter(signal => {
            const signalAccountId = getEntityId(signal.account);
            if (accountId && signalAccountId && !sameId(signalAccountId, accountId)) return false;

            return signal.rules?.some(rule => strategyRuleIds.has(getEntityId(rule)?.toString()));
        });
    }, [accountId, activeStrategy?.webhook, signals, strategyRuleIds, useWebhookSignals, webhookSignals]);

    const strategyTrades = useMemo(() => {
        if (!activeStrategy) return [];
        const strategyId = getEntityId(activeStrategy);

        return trades.filter(trade => {
            const tradeStrategyId = getEntityId(trade.strategy);
            const tradeAccountId = getEntityId(trade.account);
            return (!strategyId || sameId(tradeStrategyId, strategyId)) && (!accountId || !tradeAccountId || sameId(tradeAccountId, accountId));
        });
    }, [accountId, activeStrategy, trades]);

    const openTrades = strategyTrades.filter(trade => trade.trade_status === 'Open');
    const roadmapPlannedTrades = toNumber(processedRoadmap?.plannedTrades ?? processedRoadmap?.snapshot?.plannedTrades, 0);
    const remainingRoadmapTrades = roadmapPlannedTrades > 0
        ? Math.max(roadmapPlannedTrades - strategyTrades.length, 0)
        : null;
    const roadmapRiskPercent = toNumber(processedRoadmap?.riskPercent ?? processedRoadmap?.snapshot?.riskPercent, 0);
    const roadmapRewardMultiple = toNumber(processedRoadmap?.rewardMultiple ?? processedRoadmap?.snapshot?.rewardMultiple, 0);

    const entryRuleIds = useMemo(() => new Set(getRuleIds(activeStrategy?.entryRules)), [activeStrategy]);
    const openTradeSymbolIds = useMemo(() => new Set(
        openTrades.map(trade => getEntityId(trade.symbol)?.toString()).filter(Boolean)
    ), [openTrades]);
    const suggestedSignals = useMemo(() => {
        if (!processedRoadmap || !activeStrategy) return [];
        if (remainingRoadmapTrades !== null && remainingRoadmapTrades <= 0) return [];

        const suggestions = strategySignals
            .filter(signal => !signal.expired)
            .filter(signal => {
                const signalSymbolId = getEntityId(signal.symbol)?.toString();
                return signalSymbolId && !openTradeSymbolIds.has(signalSymbolId);
            })
            .filter(signal => {
                if (signal.isWebhookSignal) return true;
                if (entryRuleIds.size === 0) return true;
                return signal.rules?.some(rule => entryRuleIds.has(getEntityId(rule)?.toString()));
            })
            .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

        return suggestions.slice(0, remainingRoadmapTrades || 10);
    }, [activeStrategy, entryRuleIds, openTradeSymbolIds, processedRoadmap, remainingRoadmapTrades, strategySignals]);

    const suggestedSignalKey = useMemo(() => {
        return suggestedSignals
            .map(signal => getSignalPriceKey(signal))
            .join('|');
    }, [suggestedSignals]);

    useEffect(() => {
        if (suggestedSignals.length === 0) {
            setSignalPrices(prev => (Object.keys(prev).length === 0 ? prev : {}));
            return;
        }

        let cancelled = false;

        const loadSignalPrices = async () => {
            const nextPrices = {};

            await Promise.all(suggestedSignals.map(async (signal) => {
                if (signal.isWebhookSignal) {
                    const signalPrice = Number(signal.price);
                    if (Number.isFinite(signalPrice)) {
                        nextPrices[getSignalPriceKey(signal)] = signalPrice;
                    }
                    return;
                }

                const symbolId = getEntityId(signal.symbol);
                const signalDate = signal.date;
                if (!symbolId || !signalDate) return;

                let url = `/symbol-histories?filters[date][$eq]=${encodeURIComponent(signalDate)}&pagination[pageSize]=1`;
                if (typeof symbolId === 'string') {
                    url += `&filters[symbol][documentId][$eq]=${symbolId}`;
                } else {
                    url += `&filters[symbol][id][$eq]=${symbolId}`;
                }

                try {
                    const response = await api.get(url);
                    const historyItem = response.data.data?.[0];
                    if (historyItem) {
                        nextPrices[getSignalPriceKey(signal)] = Number(historyItem.close ?? historyItem.Close ?? historyItem.price);
                    }
                } catch (error) {
                    console.error('Failed to load signal price:', error);
                }
            }));

            if (!cancelled) setSignalPrices(nextPrices);
        };

        loadSignalPrices();

        return () => {
            cancelled = true;
        };
    }, [suggestedSignalKey]);

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Journal Workflow</h1>
                    <p className="mt-1 text-gray-400">
                        Connect the current plan, account strategy, rules, signals, and executions in one operating view.
                    </p>
                </div>
                <div className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-wider text-gray-500">Active Account</p>
                    <p className="font-semibold text-white">{selectedAccount?.name || 'No account selected'}</p>
                </div>
            </div>

            <section className="rounded-lg border border-gray-700 bg-gray-800 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <Target size={18} className="text-emerald-300" />
                            <h2 className="text-lg font-bold text-white">Roadmap Signal Suggestions</h2>
                        </div>
                        <p className="mt-1 text-sm text-gray-400">
                            Suggested from {useWebhookSignals ? 'WebhookSignal' : 'scanned Entry signals'}. SL/TP use roadmap risk {roadmapRiskPercent.toFixed(2)}% and RR {roadmapRewardMultiple.toFixed(2)}.
                        </p>
                    </div>
                    <Link to="/trade-station" className="inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200">
                        Execute <ArrowRight size={14} />
                    </Link>
                </div>

                {!processedRoadmap ? (
                    <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100">
                        No roadmap is currently processed. Process a roadmap first so the system can suggest signals against planned trades, risk, and reward.
                    </div>
                ) : suggestedSignals.length === 0 ? (
                    <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4 text-sm text-gray-400">
                        No suitable {useWebhookSignals ? 'webhook signals' : 'scanned signals'} right now. The roadmap may be full, signals may be expired, or open trades already exist for matching symbols.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="text-xs uppercase text-gray-500">
                                <tr>
                                    <th className="px-3 py-2">Signal</th>
                                    <th className="px-3 py-2">Long / Short</th>
                                    <th className="px-3 py-2">Date</th>
                                    <th className="px-3 py-2 text-right">Entry</th>
                                    <th className="px-3 py-2 text-right">SL</th>
                                    <th className="px-3 py-2 text-right">TP</th>
                                    <th className="px-3 py-2 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {suggestedSignals.map(signal => {
                                    const symbolName = signal.symbol?.Name || signal.symbol?.name || '-';
                                    const entryPrice = signalPrices[getSignalPriceKey(signal)];
                                    const signalDirection = getSignalDirection(signal);
                                    const canOpen = canOpenSignal(signal);
                                    const hasEntryPrice = Number.isFinite(entryPrice);
                                    const stoplossPrice = hasEntryPrice
                                        ? entryPrice * (1 - (roadmapRiskPercent / 100))
                                        : null;
                                    const takeProfitPrice = hasEntryPrice
                                        ? entryPrice * (1 + ((roadmapRiskPercent * roadmapRewardMultiple) / 100))
                                        : null;
                                    const tradeStationParams = new URLSearchParams({ symbol: symbolName });
                                    if (hasEntryPrice) tradeStationParams.set('price', entryPrice.toString());
                                    if (Number.isFinite(stoplossPrice)) tradeStationParams.set('slPrice', stoplossPrice.toString());
                                    if (Number.isFinite(takeProfitPrice)) tradeStationParams.set('tpPrice', takeProfitPrice.toString());

                                    return (
                                        <tr key={signal.documentId || signal.id}>
                                            <td className="px-3 py-3">
                                                <div className="font-mono font-semibold text-white">{symbolName}</div>
                                                <div className="text-xs text-gray-500">{signal.name || (signal.isWebhookSignal ? 'Webhook signal' : 'Strategy signal')}</div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                                    signalDirection === 'Long'
                                                        ? 'bg-green-500/15 text-green-300'
                                                        : signalDirection === 'Short'
                                                            ? 'bg-red-500/15 text-red-300'
                                                            : 'bg-gray-700 text-gray-300'
                                                }`}>
                                                    {signalDirection}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-gray-300">{formatDate(signal.date)}</td>
                                            <td className="px-3 py-3 text-right font-mono text-gray-200">
                                                {hasEntryPrice ? formatNumber(entryPrice, selectedAccount?.moneyFormat || '#,###.##') : '-'}
                                            </td>
                                            <td className="px-3 py-3 text-right font-mono text-red-300">
                                                {Number.isFinite(stoplossPrice) ? formatNumber(stoplossPrice, selectedAccount?.moneyFormat || '#,###.##') : '-'}
                                            </td>
                                            <td className="px-3 py-3 text-right font-mono text-emerald-300">
                                                {Number.isFinite(takeProfitPrice) ? formatNumber(takeProfitPrice, selectedAccount?.moneyFormat || '#,###.##') : '-'}
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                {canOpen ? (
                                                    <Link
                                                        to={`/trade-station?${tradeStationParams.toString()}`}
                                                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                                                    >
                                                        Open <ArrowRight size={13} />
                                                    </Link>
                                                ) : (
                                                    <span className="text-xs text-gray-500">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
};

export default JournalWorkflow;
