import { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchTrades, saveTrade } from '../features/tradeSlice';
import { Plus, Filter, Edit2, XCircle } from 'lucide-react';
import TradeModal from '../components/TradeModal';
import TradeDetailModal from '../components/TradeDetailModal';
import api from '../services/api';
import { useAccount } from '../context/AccountContext';
import { formatNumber } from '../utils/formatNumber';
import { calculateTradePnL } from '../utils/tradeCalculations';
import { fetchBatchLatestPrices } from '../features/marketSlice';

const Trades = () => {
    const { selectedAccount } = useAccount();
    const dispatch = useDispatch();
    const { items: rawTrades, loading } = useSelector(state => state.trades);
    const { latestPricesMap } = useSelector(state => state.market);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTrade, setSelectedTrade] = useState(null);
    const [tradeToEdit, setTradeToEdit] = useState(null);

    useEffect(() => {
        if (selectedAccount) {
            const accountId = selectedAccount.documentId || selectedAccount.id;
            dispatch(fetchTrades({ accountId }));
        }
    }, [dispatch, selectedAccount]);

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
            const currentPrice = symbolId ? latestPricesMap[symbolId] : null;
            const pnl = calculateTradePnL(item, currentPrice);

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



    const handleSaveTrade = async (tradeData) => {
        try {
            await dispatch(saveTrade({ tradeData, tradeToEdit })).unwrap();

            // Refresh list
            if (selectedAccount) {
                dispatch(fetchTrades({ accountId: selectedAccount.documentId || selectedAccount.id }));
            }

            setIsModalOpen(false);
            setTradeToEdit(null);
        } catch (error) {
            console.error('Error saving trade sequence:', error);
            alert(`Failed to save trade: ${error.message || error}`);
        }
    };

    const handleEditTrade = (trade) => {
        setTradeToEdit(trade);
        setIsModalOpen(true);
    };

    const handleOpenCreateModal = () => {
        setTradeToEdit(null);
        setIsModalOpen(true);
    };

    return (
        <div>
            <TradeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSaveTrade}
                initialData={tradeToEdit}
            />

            <TradeDetailModal
                isOpen={!!selectedTrade}
                onClose={() => setSelectedTrade(null)}
                trade={selectedTrade}
            />

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Trade Log</h2>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition">
                        <Filter size={18} />
                        Filter
                    </button>
                    <button
                        onClick={handleOpenCreateModal}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition font-medium text-white shadow-lg shadow-blue-500/20"
                    >
                        <Plus size={18} />
                        New Trade
                    </button>
                </div>
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
                                <td onClick={() => setSelectedTrade(trade)} className={`p-4 text-right font-medium font-mono ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {trade.pnl != null ? formatNumber(trade.pnl, selectedAccount?.moneyFormat || '#,###.##') : '-'}
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

export default Trades;
