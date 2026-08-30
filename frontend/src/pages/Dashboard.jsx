import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Edit } from 'lucide-react';
import { useAccount } from '../context/AccountContext';
import api from '../services/api';
import { formatNumber } from '../utils/formatNumber';
import { getStrategyId, resolveSetting } from '../utils/roadmapCalculations';
import { fetchStrategies, updateStrategy } from '../features/strategySlice';
import { fetchRules, updateRule } from '../features/ruleSlice';
import { fetchWebhooks } from '../features/webhookSlice';
import { fetchSignals } from '../features/signalSlice';
import { fetchWatchlists } from '../features/watchlistSlice';
import { StrategyModal } from './ManageStrategies';
import SettingsModal from '../components/SettingsModal';

const Dashboard = () => {
    const dispatch = useDispatch();
    const { selectedAccount, setSelectedAccount, defaultWatchlist } = useAccount();
    const { items: strategies } = useSelector(state => state.strategies);
    const { items: rules } = useSelector(state => state.rules);
    const { items: webhooks } = useSelector(state => state.webhooks);
    const { items: signals, loading: signalsLoading } = useSelector(state => state.signals);
    const { items: watchlists } = useSelector(state => state.watchlists);
    const [watchlistFilter, setWatchlistFilter] = useState('');
    const [stats, setStats] = useState({
        totalPnl: 0,
        winRate: 0,
        profitFactor: 0,
        totalTrades: 0
    });
    const [recentTrades, setRecentTrades] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingStrategy, setEditingStrategy] = useState(false);
    const [editingSetting, setEditingSetting] = useState(false);
    const activeSetting = resolveSetting(selectedAccount);
    const selectedAccountStrategyId = getStrategyId(selectedAccount?.strategy);
    const activeStrategy = strategies.find(strategy => {
        const strategyId = getStrategyId(strategy);
        return selectedAccountStrategyId && (strategyId === selectedAccountStrategyId || strategy.documentId === selectedAccountStrategyId || strategy.id === selectedAccountStrategyId);
    }) || (typeof selectedAccount?.strategy === 'object' ? selectedAccount.strategy : null);
    const activeStrategyName = activeStrategy
        ? (typeof activeStrategy === 'object'
            ? (activeStrategy.name || activeStrategy.Name || activeStrategy.title || activeStrategy.Title)
            : activeStrategy)
        : '';
    const activeStrategyDescription = activeStrategy && typeof activeStrategy === 'object'
        ? (activeStrategy.description || activeStrategy.Description || '')
        : '';

    const accountWatchlists = useMemo(() => {
        if (!watchlists) return [];
        if (!selectedAccount) return watchlists;
        return watchlists.filter(wl => {
            const wlAccountId = wl.account?.documentId || wl.account?.id || wl.account;
            const currentAccountId = selectedAccount.documentId || selectedAccount.id;
            return wlAccountId?.toString() === currentAccountId?.toString();
        });
    }, [watchlists, selectedAccount]);

    const rulePurposeConfig = {
        entryRules: { label: 'Entry', className: 'bg-blue-500/20 text-blue-400' },
        stoplossRules: { label: 'Stoploss', className: 'bg-red-500/20 text-red-400' },
        takeProfitRules: { label: 'Take Profit', className: 'bg-green-500/20 text-green-400' },
        exitRules: { label: 'Exit', className: 'bg-yellow-500/20 text-yellow-400' }
    };

    const getRulePurpose = (rule) => {
        const ruleId = (rule.documentId || rule.id)?.toString();
        if (!ruleId || !activeStrategy) return null;

        for (const [fieldName, config] of Object.entries(rulePurposeConfig)) {
            const hasRule = activeStrategy[fieldName]?.some(strategyRule =>
                (strategyRule.documentId || strategyRule.id)?.toString() === ruleId
            );
            if (hasRule) return config;
        }
        return null;
    };

    const formatSignalTime = (dateString) => {
        if (!dateString) return '-';
        const d = new Date(dateString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const activeAccountSignals = useMemo(() => {
        if (!selectedAccount || !signals || !activeStrategy) return [];

        const currentAccountId = selectedAccount.documentId || selectedAccount.id;

        let list = signals.filter(signal => {
            const signalAccountId = signal.account?.documentId || signal.account?.id;
            return signalAccountId && currentAccountId &&
                signalAccountId.toString() === currentAccountId.toString();
        });

        const strategyRuleIdentifiers = new Set();
        [
            ...(activeStrategy.rules || []),
            ...(activeStrategy.entryRules || []),
            ...(activeStrategy.takeProfitRules || []),
            ...(activeStrategy.stoplossRules || []),
            ...(activeStrategy.exitRules || [])
        ].forEach(r => {
            if (r.id) strategyRuleIdentifiers.add(r.id.toString());
            if (r.documentId) strategyRuleIdentifiers.add(r.documentId.toString());
        });

        list = list.filter(signal => {
            if (!signal.rules || signal.rules.length === 0) return false;
            return signal.rules.some(r => {
                const idMatch = r.id && strategyRuleIdentifiers.has(r.id.toString());
                const docIdMatch = r.documentId && strategyRuleIdentifiers.has(r.documentId.toString());
                return idMatch || docIdMatch;
            });
        });

        if (watchlistFilter) {
            const selectedWatchlistObj = watchlists.find(wl => (wl.documentId || wl.id) === watchlistFilter);
            const watchlistSymbols = selectedWatchlistObj?.symbols || [];
            const allowedSymbolIds = new Set(
                watchlistSymbols.map(s => (s.documentId || s.id)?.toString()).filter(Boolean)
            );
            list = list.filter(signal => {
                const sigSymId = (signal.symbol?.documentId || signal.symbol?.id)?.toString();
                return sigSymId && allowedSymbolIds.has(sigSymId);
            });
        }

        const today = new Date();
        const todayLocalStr = today.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
        const todayUtcStr = today.toISOString().split('T')[0]; // YYYY-MM-DD in UTC

        list = list.filter(signal => {
            if (!signal.date) return false;
            const d = new Date(signal.date);
            
            const signalLocalStr = d.toLocaleDateString('en-CA');
            const signalUtcStr = d.toISOString().split('T')[0];
            
            const dateMatches = (signalLocalStr === todayLocalStr) || 
                                (signalUtcStr === todayUtcStr) ||
                                (signalUtcStr === todayLocalStr) ||
                                (signalLocalStr === todayUtcStr);

            const diffMs = Math.abs(d.getTime() - today.getTime());
            // Filter: dates match OR the signal was generated within the last 24 hours
            const within24h = diffMs <= 24 * 3600 * 1000;

            return dateMatches || within24h;
        });

        return list;
    }, [selectedAccount, signals, activeStrategy, watchlistFilter, watchlists]);

    useEffect(() => {
        dispatch(fetchStrategies());
        dispatch(fetchRules());
        dispatch(fetchWebhooks());
        dispatch(fetchSignals({ todayOnly: true }));
        dispatch(fetchWatchlists());
    }, [dispatch]);

    useEffect(() => {
        if (defaultWatchlist) {
            setWatchlistFilter(defaultWatchlist.documentId || defaultWatchlist.id || '');
        }
    }, [defaultWatchlist]);

    const handleUpdateStrategy = async (strategyData) => {
        if (!activeStrategy || typeof activeStrategy !== 'object') return;
        const id = activeStrategy.documentId || activeStrategy.id;
        if (!id) return;

        try {
            const { rulePercents = {}, ...sanitizedStrategyData } = strategyData;
            await dispatch(updateStrategy({ id, data: sanitizedStrategyData })).unwrap();

            await Promise.all(Object.entries(rulePercents)
                .filter(([, percent]) => percent !== '' && percent !== undefined && percent !== null)
                .map(([ruleId, percent]) => dispatch(updateRule({
                    id: ruleId,
                    data: { percent: Number(percent) }
                })).unwrap()));

            if (Object.keys(rulePercents).length > 0) {
                dispatch(fetchRules());
            }

            await dispatch(fetchStrategies()).unwrap();
            setEditingStrategy(false);
        } catch (error) {
            console.error('Failed to update strategy:', error);
            alert(`Failed to update strategy: ${error?.error?.message || error?.message || error}`);
        }
    };

    const handleUpdateSetting = async (settingData) => {
        if (!activeSetting) return;
        const id = activeSetting.documentId || activeSetting.id;
        if (!id) return;

        try {
            const response = await api.put(`/settings/${id}`, { data: settingData });
            const updatedSetting = response.data.data;

            setSelectedAccount(prev => prev ? ({
                ...prev,
                setting: updatedSetting
            }) : prev);
            setEditingSetting(false);
        } catch (error) {
            console.error('Failed to update setting:', error.response?.data || error);
            const message = error.response?.data?.error?.message
                || error.response?.data?.message
                || error.message
                || 'Failed to update setting';
            alert(message);
        }
    };

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!selectedAccount) return;

            try {
                setLoading(true);
                const accountId = selectedAccount.id || selectedAccount.documentId;
                // Fetch all trades for calculation (might need pagination handling for large sets later)
                const res = await api.get(`/trades?filters[account][id][$eq]=${accountId}&populate=*&sort[0]=entry_date:desc`);
                const trades = res.data.data || [];

                // Calculate Stats
                let totalPnl = 0;
                let wins = 0;
                let totalClosed = 0;
                let grossProfit = 0;
                let grossLoss = 0;
                let totalOpenCost = 0;
                let totalRealizedPnl = 0; // For accurately calculating equity/cash if totalPnl mixes both (though usually pnl is 0 for Open)

                trades.forEach(trade => {
                    const details = trade.trade_details || [];
                    const sortedDetails = [...details].sort((a, b) => new Date(a.date) - new Date(b.date));

                    let pnl = 0;
                    if (sortedDetails && sortedDetails.length > 0) {
                        pnl = sortedDetails.reduce((acc, d) => {
                            const val = (parseFloat(d.price) || 0) * (parseFloat(d.volume) || 0);
                            return d.type === 'Sell' ? acc + val : acc - val;
                        }, 0);
                    }
                    totalPnl += pnl;

                    if (trade.trade_status === 'Open') {
                        // Calculate cost of open trade
                        const entry1 = parseFloat(trade.entry_price) || 0;
                        const vol1 = parseFloat(trade.volume1) || 0;
                        const entry2 = parseFloat(trade.entry2_price) || 0;
                        const vol2 = parseFloat(trade.volume2) || 0;
                        const entry3 = parseFloat(trade.entry3_price) || 0;
                        const vol3 = parseFloat(trade.volume3) || 0;

                        totalOpenCost += (entry1 * vol1) + (entry2 * vol2) + (entry3 * vol3);
                    } else if (trade.trade_status === 'Closed') {
                        totalClosed++;
                        totalRealizedPnl += pnl; // Only include realized PnL in Cash calc
                        if (pnl > 0) {
                            wins++;
                            grossProfit += pnl;
                        } else {
                            grossLoss += Math.abs(pnl);
                        }
                    }
                });

                const winRate = totalClosed > 0 ? (wins / totalClosed) * 100 : 0;
                const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : grossProfit > 0 ? 99.99 : 0; // Handle partial infinity

                const initialBalance = parseFloat(selectedAccount.initial_balance) || 0;
                const cash = (initialBalance + totalRealizedPnl) - totalOpenCost;

                setStats({
                    totalPnl: totalPnl.toFixed(2),
                    winRate: winRate.toFixed(1),
                    profitFactor: profitFactor.toFixed(2),
                    totalTrades: trades.length,
                    totalClosed: totalClosed,
                    totalOpen: trades.length - totalClosed,
                    cash: cash.toFixed(2),
                    balance: initialBalance
                });

                // Recent trades (already sorted by desc from API)
                setRecentTrades(trades.slice(0, 5).map(t => ({
                    id: t.id || t.documentId,
                    ...t
                })));

            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [selectedAccount]);

    return (
        <div>
            <StrategyModal
                isOpen={editingStrategy}
                onClose={() => setEditingStrategy(false)}
                onSubmit={handleUpdateStrategy}
                initialData={activeStrategy && typeof activeStrategy === 'object' ? activeStrategy : null}
                availableRules={rules}
                availableWebhooks={webhooks}
            />
            <SettingsModal
                isOpen={editingSetting}
                onClose={() => setEditingSetting(false)}
                onSubmit={handleUpdateSetting}
                setting={activeSetting}
            />

            {/* Settings Summary Cards */}
            <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => activeSetting && setEditingSetting(true)}
                    onKeyDown={(event) => {
                        if ((event.key === 'Enter' || event.key === ' ') && activeSetting) {
                            event.preventDefault();
                            setEditingSetting(true);
                        }
                    }}
                    className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm relative overflow-hidden transition hover:border-blue-500/40 hover:bg-gray-800/80 cursor-pointer"
                    title={activeSetting ? 'Edit setting' : 'No active setting'}
                >
                    <div className="flex flex-wrap md:flex-nowrap items-start justify-between gap-6">
                        <div className="flex-1 min-w-[200px]">
                            <p className="text-gray-400 text-sm uppercase tracking-wider mb-1">Risk Setting</p>
                            <h3 className="text-3xl font-bold text-white truncate" title={activeSetting?.Name || activeSetting?.name}>
                                {activeSetting ? (activeSetting.Name || activeSetting.name) : 'No Active Setting'}
                            </h3>
                        </div>

                        {activeSetting && (
                            <div className="flex gap-8 text-sm md:text-base">
                                <div className="text-center md:text-left">
                                    <p className="text-gray-400 mb-1">Risk / Trade</p>
                                    <p className="font-bold text-blue-400 text-lg">{activeSetting.riskPerTrade}%</p>
                                </div>
                                <div className="text-center md:text-left">
                                    <p className="text-gray-400 mb-1">Capital Risk</p>
                                    <p className="font-bold text-yellow-400 text-lg">{activeSetting.capitalRisk}%</p>
                                </div>
                                <div className="text-center md:text-left">
                                    <p className="text-gray-400 mb-1">Max Drawdown</p>
                                    <p className="font-bold text-red-400 text-lg">{activeSetting.maxDrawDown}%</p>
                                </div>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                setEditingSetting(true);
                            }}
                            disabled={!activeSetting}
                            className="inline-flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Edit size={15} />
                            Edit
                        </button>
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm relative overflow-hidden">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-gray-400 text-sm uppercase tracking-wider mb-1">Strategy</p>
                            <h3 className="text-2xl font-bold text-emerald-400 truncate" title={activeStrategyName || 'No Strategy Selected'}>
                                {activeStrategyName || 'No Strategy'}
                            </h3>
                            {activeStrategyDescription ? (
                                <p className="mt-2 max-h-10 overflow-hidden text-sm text-gray-400" title={activeStrategyDescription}>
                                    {activeStrategyDescription}
                                </p>
                            ) : (
                                <p className="mt-2 text-sm text-gray-500">
                                    {activeStrategyName ? 'No description' : 'No strategy selected for this account.'}
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setEditingStrategy(true)}
                            disabled={!activeStrategy || typeof activeStrategy !== 'object'}
                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Edit size={15} />
                            Edit
                        </button>
                    </div>
                </div>
            </div>

            {/* New Stats Grid: Balance, Risk, Drawdown, Open Trades */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {/* Account Balance */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm">
                    <p className="text-gray-400 text-sm mb-1">Account Balance</p>
                    <p className="text-2xl font-bold text-blue-400">
                        {selectedAccount?.initial_balance !== undefined && (
                            <span>
                                ${selectedAccount.initial_balance.toLocaleString()}
                            </span>
                        )}
                    </p>
                </div>

                {/* Capital Risk (Total PnL / Balance) */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm">
                    <p className="text-gray-400 text-sm mb-1">Cash</p>
                    <p className={`text-2xl font-bold ${parseFloat(stats.cash) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {loading ? '...' : `$${parseFloat(stats.cash || 0).toLocaleString()}`}
                    </p>
                </div>

                {/* Drawdown (Hardcoded) */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm">
                    <p className="text-gray-400 text-sm mb-1">Drawdown</p>
                    <p className="text-2xl font-bold text-red-400">15%</p>
                </div>

                {/* Open Trades */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm">
                    <p className="text-gray-400 text-sm mb-1">Open Trades</p>
                    <p className="text-2xl font-bold text-gray-300">{loading ? '...' : stats.totalOpen}</p>
                </div>
            </div>

            {/* Original Stats Grid: PnL, WinRate, PF, Trades */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm relative">
                    <p className="text-gray-400 text-sm mb-1">Total P&L</p>

                    <p className={`text-2xl font-bold ${stats.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {loading ? '...' : `${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl}`}
                    </p>

                    <p className={`text-xl ${stats.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {loading ? '...' : `${(stats.totalPnl / selectedAccount?.initial_balance * 100).toFixed(2)}%`}
                    </p>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm">
                    <p className="text-gray-400 text-sm mb-1">Win Rate</p>
                    <p className="text-2xl font-bold text-blue-400">{loading ? '...' : `${stats.winRate}%`}</p>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm">
                    <p className="text-gray-400 text-sm mb-1">Profit Factor</p>
                    <p className="text-2xl font-bold text-purple-400">{loading ? '...' : stats.profitFactor}</p>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm">
                    <p className="text-gray-400 text-sm mb-1">Total Trades</p>
                    <p className="text-2xl font-bold text-gray-300">{loading ? '...' : stats.totalTrades}</p>
                </div>
            </div>

            {/* Signal Suggestions (Today) */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-sm relative overflow-hidden">
                {signalsLoading && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gray-950 overflow-hidden">
                        <div className="h-full bg-blue-500 animate-pulse w-full"></div>
                    </div>
                )}
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-white">Signal Suggestions (Today)</h3>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg">
                        <span className="text-xs text-gray-400 font-medium">Watchlist:</span>
                        <select
                            value={watchlistFilter}
                            onChange={(e) => setWatchlistFilter(e.target.value)}
                            className="bg-transparent text-xs text-gray-200 outline-none focus:ring-0 cursor-pointer min-w-[150px]"
                        >
                            <option value="" className="bg-gray-900 text-gray-200">All Symbols (No Watchlist)</option>
                            {accountWatchlists.map(wl => {
                                const wlId = wl.documentId || wl.id;
                                return (
                                    <option key={wlId} value={wlId} className="bg-gray-900 text-gray-200">
                                        {wl.name || 'Untitled Watchlist'}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-900/50 text-gray-400 text-sm uppercase">
                            <tr>
                                <th className="p-4">Time</th>
                                <th className="p-4">Symbol</th>
                                <th className="p-4">Action</th>
                                <th className="p-4">Triggered Rule</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                            {signalsLoading ? (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-gray-500">Loading signal suggestions...</td>
                                </tr>
                            ) : activeAccountSignals.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-gray-500 italic text-sm">
                                        No signal suggestions generated today for this strategy.
                                    </td>
                                </tr>
                            ) : (
                                activeAccountSignals.map(signal => {
                                    const signalId = signal.documentId || signal.id;
                                    const symbolName = signal.symbol?.Name || signal.symbol?.name || signal.name || '';
                                    return (
                                        <tr key={signalId} className="hover:bg-gray-700/30 transition">
                                            <td className="p-4 text-gray-300 font-mono">
                                                {formatSignalTime(signal.date)}
                                            </td>
                                            <td className="p-4 font-mono font-medium text-blue-400 hover:text-blue-300 transition">
                                                {symbolName ? (
                                                    <Link to={`/trade-station?symbol=${encodeURIComponent(symbolName)}`}>
                                                        {symbolName}
                                                    </Link>
                                                ) : (
                                                    'N/A'
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {signal.rules?.map(rule => {
                                                        const purpose = getRulePurpose(rule);
                                                        return (
                                                            <span
                                                                key={rule.id || rule.documentId}
                                                                className={`px-2.5 py-1 rounded-full text-xs font-bold ${purpose?.className || 'bg-gray-500/20 text-gray-400'}`}
                                                            >
                                                                {purpose?.label || 'Rule'}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td className="p-4 text-gray-300 text-sm">
                                                {signal.rules?.map(r => r.Name).join(', ') || '-'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            </div>

            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 min-h-[300px]">
                    <h3 className="text-xl font-semibold mb-4">Equity Curve</h3>
                    <div className="flex items-center justify-center h-full text-gray-500">
                        {/* Placeholder for now, requires charting lib */}
                        Chart Coming Soon
                    </div>
                </div>
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 min-h-[300px]">
                    <h3 className="text-xl font-semibold mb-4">Recent Trades</h3>
                    <div className="space-y-4">
                        {loading ? (
                            <p className="text-gray-500">Loading...</p>
                        ) : recentTrades.length === 0 ? (
                            <p className="text-gray-500 text-sm">No trades yet for this account.</p>
                        ) : (
                            recentTrades.map(trade => (
                                <div key={trade.id} className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition">
                                    <div>
                                        <span className={`font-bold mr-2 ${trade.type === 'Long' ? 'text-green-400' : 'text-red-400'}`}>
                                            {trade.type.toUpperCase()}
                                        </span>
                                        <span className="font-mono text-gray-200">
                                            {trade.symbol?.Name || trade.symbol?.name || 'N/A'}
                                        </span>
                                    </div>
                                    <span className={`font-mono font-medium ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {trade.pnl ? formatNumber(trade.pnl) : '-'}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
