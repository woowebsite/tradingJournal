import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchTrades, saveTrade, deleteTrade, deleteDemoTradesByStrategy } from '../features/tradeSlice';
import { Filter, Edit2, RefreshCw } from 'lucide-react';
import TradeModal from '../components/TradeModal';
import TradeDetailModal from '../components/TradeDetailModal';
import { useAccount } from '../context/AccountContext';
import { formatNumber } from '../utils/formatNumber';
import { calculateTradePnL } from '../utils/tradeCalculations';
import { fetchBatchLatestPrices } from '../features/marketSlice';
import { fetchStrategies } from '../features/strategySlice';
import { fetchRules } from '../features/ruleSlice';
import { scanSignals } from '../features/signalSlice';
import StrategySummary from '../containers/StrategySummary';

const Backtest = () => {
    const { selectedAccount } = useAccount();
    const dispatch = useDispatch();
    const { items: rawTrades, loading } = useSelector(state => state.trades);
    const { latestPricesMap } = useSelector(state => state.market);
    const { items: strategies } = useSelector(state => state.strategies);
    const { items: rules } = useSelector(state => state.rules);
    const { loading: scanningSignals } = useSelector(state => state.signals);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTrade, setSelectedTrade] = useState(null);
    const [tradeToEdit, setTradeToEdit] = useState(null);
    const [strategyFilter, setStrategyFilter] = useState('');
    const [resettingDemoTrades, setResettingDemoTrades] = useState(false);

    const refreshBacktestTrades = useCallback(() => {
        dispatch(fetchTrades({ mode: 'Demo', strategyId: strategyFilter }));
    }, [dispatch, strategyFilter]);

    useEffect(() => {
        refreshBacktestTrades();
    }, [refreshBacktestTrades]);

    useEffect(() => {
        dispatch(fetchStrategies());
        dispatch(fetchRules());
    }, [dispatch]);

    useEffect(() => {
        if (rawTrades && rawTrades.length > 0) {
            const symbolIds = Array.from(new Set(
                rawTrades
                    .map(t => t.symbol?.documentId || t.symbol?.id)
                    .filter(id => !!id)
            ));
            if (symbolIds.length > 0) {
                dispatch(fetchBatchLatestPrices(symbolIds));
            }
        }
    }, [dispatch, rawTrades]);

    const trades = useMemo(() => {
        if (!rawTrades) return [];
        return rawTrades.map(item => {
            const details = item.trade_details || [];
            // Sort details by date
            const sortedDetails = [...details].sort((a, b) => new Date(a.date) - new Date(b.date));
            const firstEntry = sortedDetails.find(d => d.signal === 'Entry') || sortedDetails[0];
            const lastExit = sortedDetails.reverse().find(d => d.signal === 'Exit' || d.signal === 'TakeProfit' || d.signal === 'Stoploss');

            // Calc PnL
            const symbolId = item.symbol?.documentId || item.symbol?.id;
            const rawCurrentPrice = symbolId ? latestPricesMap[symbolId] : null;
            const currentPrice = rawCurrentPrice !== null && rawCurrentPrice !== undefined && rawCurrentPrice !== ''
                ? Number(rawCurrentPrice)
                : null;

            const savedPnl = item.pnl !== null && item.pnl !== undefined && item.pnl !== ''
                ? Number(item.pnl)
                : null;
            const pnl = item.trade_status === 'Closed' && Number.isFinite(savedPnl)
                ? savedPnl
                : Number.isFinite(currentPrice) ? calculateTradePnL(item, currentPrice) : null;

            return {
                id: item.id || item.documentId,
                ...item,
                derivedDate: item.date || (firstEntry ? firstEntry.date : item.createdAt), // Use correct date field
                derivedEntryPrice: firstEntry ? firstEntry.price : 0,
                derivedExitPrice: lastExit ? lastExit.price : 0,
                derivedPnl: pnl
            };
        }).sort((a, b) => new Date(b.derivedDate) - new Date(a.derivedDate));
    }, [rawTrades, latestPricesMap]);

    const availableStrategies = useMemo(() => strategies || [], [strategies]);

    const activeStrategy = useMemo(() => {
        if (!strategyFilter) return null;
        return availableStrategies.find(strategy =>
            (strategy.documentId || strategy.id)?.toString() === strategyFilter
        ) || null;
    }, [availableStrategies, strategyFilter]);

    const availableRules = useMemo(() => {
        if (!activeStrategy?.rules?.length) return [];

        const strategyRuleIds = activeStrategy.rules.map(rule =>
            (rule.documentId || rule.id)?.toString()
        ).filter(Boolean);

        return rules.filter(rule =>
            strategyRuleIds.includes((rule.documentId || rule.id)?.toString())
        );
    }, [activeStrategy, rules]);

    const handleScanSignals = async () => {
        if (!activeStrategy) {
            alert('Please select a strategy before scanning.');
            return;
        }

        if (availableRules.length === 0) {
            alert('Selected strategy has no rules available to scan.');
            return;
        }

        if (!selectedAccount) {
            alert('Please select an active account before scanning.');
            return;
        }

        const accountId = selectedAccount.documentId || selectedAccount.id;
        const selectedRuleIds = availableRules.map(rule => rule.documentId || rule.id).filter(Boolean);
        const strategyId = activeStrategy.documentId || activeStrategy.id;

        try {
            setResettingDemoTrades(true);
            await dispatch(deleteDemoTradesByStrategy(strategyId)).unwrap();
            setResettingDemoTrades(false);

            const count = await dispatch(scanSignals({
                selectedRuleIds,
                accountId,
                strategyId,
                syncDemoTrades: true
            })).unwrap();

            refreshBacktestTrades();
            alert(`Scan complete. Found ${count} new signals.`);
        } catch (err) {
            refreshBacktestTrades();
            alert(`Scan failed: ${err?.message || JSON.stringify(err) || err}`);
        } finally {
            setResettingDemoTrades(false);
        }
    };



    const handleSaveTrade = async (tradeData) => {
        try {
            await dispatch(saveTrade({ tradeData, tradeToEdit })).unwrap();

            // Refresh list
            refreshBacktestTrades();

            setIsModalOpen(false);
            setTradeToEdit(null);
        } catch (error) {
            console.error('Error saving trade sequence:', error);
            alert(`Failed to save trade: ${error.message || error}`);
        }
    };

    const handleEditTrade = (trade) => {
        setSelectedTrade(null);
        setTradeToEdit(trade);
        setIsModalOpen(true);
    };

    const handleDeleteTrade = async () => {
        if (!tradeToEdit) return;
        const tradeId = tradeToEdit.documentId || tradeToEdit.id;
        if (!window.confirm('Delete this trade and all of its trade details?')) return;

        try {
            await dispatch(deleteTrade({
                tradeId,
                tradeDetails: tradeToEdit.trade_details || []
            })).unwrap();

            refreshBacktestTrades();

            setIsModalOpen(false);
            setTradeToEdit(null);
        } catch (error) {
            console.error('Failed to delete trade:', error);
            alert(`Failed to delete trade: ${error.message || error}`);
        }
    };

    return (
        <div>
            <TradeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSaveTrade}
                onDelete={handleDeleteTrade}
                initialData={tradeToEdit}
            />

            <TradeDetailModal
                isOpen={!!selectedTrade}
                onClose={() => setSelectedTrade(null)}
                trade={selectedTrade}
                onEdit={handleEditTrade}
            />

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Backtest</h2>
                <div className="flex gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                        <Filter size={18} />
                        <span className="text-sm text-gray-400">Strategy</span>
                        <select
                            value={strategyFilter}
                            onChange={(e) => setStrategyFilter(e.target.value)}
                            className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 outline-none focus:border-blue-500 min-w-[180px]"
                        >
                            <option value="">All Strategies</option>
                            {availableStrategies.map(strategy => {
                                const strategyId = strategy.documentId || strategy.id;
                                return (
                                    <option key={strategyId} value={strategyId}>
                                        {strategy.name || 'Untitled strategy'}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                    <button
                        onClick={handleScanSignals}
                        disabled={scanningSignals || resettingDemoTrades}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 disabled:cursor-not-allowed rounded-lg transition font-medium text-white shadow-lg shadow-emerald-500/20"
                    >
                        <RefreshCw size={18} className={scanningSignals || resettingDemoTrades ? 'animate-spin' : ''} />
                        {resettingDemoTrades ? 'Resetting Demo Trades...' : 'Scan Signals'}
                    </button>
                </div>
            </div>

            <div className="mb-6 bg-gray-800 rounded-xl border border-gray-700 p-4 shadow-lg">
                <StrategySummary activeStrategy={activeStrategy} />
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-700/50 text-gray-400">
                        <tr>
                            <th className="p-4">Date</th>
                            <th className="p-4">Symbol</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">P&L</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {loading ? (
                            <tr><td colSpan="8" className="p-8 text-center text-gray-500">Loading trades...</td></tr>
                        ) : trades.length === 0 ? (
                            <tr><td colSpan="8" className="p-8 text-center text-gray-500">No trades found. Add your first trade!</td></tr>
                        ) : trades.map((trade) => (
                            <tr
                                key={trade.id}
                                className="hover:bg-gray-700/30 transition cursor-pointer group"
                            >
                                <td onClick={() => setSelectedTrade(trade)} className="p-4 group-hover:text-blue-400 transition-colors">{new Date(trade.derivedDate).toLocaleDateString()}</td>
                                <td onClick={() => setSelectedTrade(trade)} className="p-4 font-mono">{trade.symbol?.Name || trade.symbol?.name || 'N/A'}</td>
                                <td onClick={() => setSelectedTrade(trade)} className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${trade.type === 'Long' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {trade.type}
                                    </span>
                                </td>
                                <td onClick={() => setSelectedTrade(trade)} className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${trade.trade_status === 'Open' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-600/20 text-gray-400'}`}>
                                        {trade.trade_status}
                                    </span>
                                </td>
                                <td onClick={() => setSelectedTrade(trade)} className={`p-4 text-right font-medium font-mono ${trade.derivedPnl == null ? 'text-gray-400' : trade.derivedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {trade.derivedPnl != null ? formatNumber(trade.derivedPnl, selectedAccount?.moneyFormat || '#,###.##') : '-'}
                                </td>
                                <td className="p-4 text-right flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleEditTrade(trade); }}
                                        className="p-2 text-gray-200 hover:text-blue-400 transition cursor-pointer"
                                        title="Edit Trade"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Backtest;
