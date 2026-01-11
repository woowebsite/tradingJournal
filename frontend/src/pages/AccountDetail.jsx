import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowLeft, Wallet } from 'lucide-react';
import api from '../services/api';
import { fetchTrades, fetchOpenTrades } from '../features/tradeSlice';
import { fetchWatchlists } from '../features/watchlistSlice';
import { fetchStrategies } from '../features/strategySlice';
import { useAccount } from '../context/AccountContext';
import { formatNumber } from '../utils/formatNumber';
import { calculateSymbolOpenVolume, calculateSymbolOpenPnL } from '../utils/tradeCalculations';
import TradeDetailModal from '../components/TradeDetailModal';

const AccountDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { setSelectedAccount } = useAccount();

    const [account, setAccount] = useState(null);
    const [accountLoading, setAccountLoading] = useState(true);

    const [selectedSymbol, setSelectedSymbol] = useState(null);
    const [selectedTrade, setSelectedTrade] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const handleTradeClick = (trade) => {
        setSelectedTrade(trade);
        setIsDetailModalOpen(true);
    };

    // Redux State
    const { items: trades, openTrades, loading: tradesLoading } = useSelector(state => state.trades);
    const { items: watchlists } = useSelector(state => state.watchlists);
    const { items: strategies } = useSelector(state => state.strategies);

    useEffect(() => {
        const loadData = async () => {
            try {
                // 1. Fetch Account
                const accRes = await api.get(`/accounts/${id}?populate=*`);
                const fetchedAccount = accRes.data.data;
                setAccount(fetchedAccount);
                setSelectedAccount(fetchedAccount);
            } catch (error) {
                console.error('Failed to fetch account:', error);
            } finally {
                setAccountLoading(false);
            }

            // 2. Dispatch Redux Actions
            // Fetch watchlists (if global list not robust, we might need specific fetch, 
            // but `fetchWatchlists` loads all. We'll filter client side as requested by Redux usage).
            dispatch(fetchWatchlists());
            dispatch(fetchStrategies());
            dispatch(fetchOpenTrades({ accountId: id }));
        };

        if (id) {
            loadData();
        }
    }, [id, dispatch]);

    // Separate effect for fetching trades to handle symbol changes
    useEffect(() => {
        if (id) {
            const params = { accountId: id, pageSize: 20 };
            if (selectedSymbol) {
                params.symbolId = selectedSymbol.documentId || selectedSymbol.id;
            }
            dispatch(fetchTrades(params));
        }
    }, [id, selectedSymbol, dispatch]);

    const defaultWatchlist = useMemo(() => {
        if (!watchlists || !id) return null;
        return watchlists.find(wl => {
            const accId = wl.account?.documentId || wl.account?.id;
            // Loose comparison for ID (string vs number)
            return (accId == id || accId === id) && wl.isDefault;
        });
    }, [watchlists, id]);

    const handleSymbolSelect = (sym) => {
        if (selectedSymbol && (selectedSymbol.id === sym.id)) {
            // Deselect if clicking the same symbol
            setSelectedSymbol(null);
        } else {
            setSelectedSymbol(sym);
        }
    };

    const handleStrategyChange = async (e) => {
        const strategyId = e.target.value;
        try {
            await api.put(`/accounts/${id}`, {
                data: {
                    strategy: strategyId || null // Clear if empty
                }
            });
            // Update local state to reflect change immediately
            setAccount(prev => ({
                ...prev,
                strategy: strategies.find(s => (s.documentId == strategyId || s.id == strategyId))
            }));
            alert('Strategy updated successfully');
        } catch (error) {
            console.error('Failed to update strategy:', error);
            alert('Failed to update strategy');
        }
    };

    if (accountLoading) return <div className="p-8 text-center text-gray-500">Loading details...</div>;
    if (!account) return <div className="p-8 text-center text-gray-500">Account not found.</div>;

    // Use `defaultWatchlist` instead of `watchlist` local state
    const watchlist = defaultWatchlist;

    return (
        <div className="mx-auto p-4 md:p-6">
            <button
                onClick={() => navigate('/accounts')}
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition"
            >
                <ArrowLeft size={20} />
                Back to Accounts
            </button>

            <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 shadow-lg mb-8">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                        <Wallet size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">{account.name}</h1>
                        <p className="text-gray-400 text-lg">
                            {account.market?.Name || account.market?.name || 'Unknown Market'} • {account.currency}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-700 pt-8">
                    <div>
                        <h3 className="text-gray-500 uppercase tracking-wider text-sm font-semibold mb-2">Initial Balance</h3>
                        <p className="text-3xl font-bold text-green-400">
                            ${account.initial_balance?.toLocaleString()}
                        </p>
                    </div>
                    <div>
                        <h3 className="text-gray-500 uppercase tracking-wider text-sm font-semibold mb-2">Active Strategy</h3>
                        <select
                            value={account.strategy?.documentId || account.strategy?.id || ''}
                            onChange={handleStrategyChange}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-gray-600 transition"
                        >
                            <option value="">Select Strategy</option>
                            {strategies.map(s => (
                                <option key={s.documentId || s.id} value={s.documentId || s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Column 1: Default Watchlist */}
                <div className="lg:col-span-2 bg-gray-800 rounded-xl border border-gray-700 p-6 shadow-sm h-fit">
                    <h3 className="text-xl font-bold text-white mb-4">Default Watchlist</h3>
                    {watchlist && watchlist.symbols && watchlist.symbols.length > 0 ? (
                        <div className="overflow-hidden rounded-lg border border-gray-700">
                            <table className="w-full text-left">
                                <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase">
                                    <tr>
                                        <th className="p-3">Symbol</th>
                                        <th className="p-3 text-right">Volume</th>
                                        <th className="p-3 text-right">PNL</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {watchlist.symbols.map(sym => (
                                        <tr
                                            key={sym.id}
                                            onClick={() => handleSymbolSelect(sym)}
                                            className={`hover:bg-gray-700/30 cursor-pointer transition-colors ${selectedSymbol?.id === sym.id ? 'bg-blue-900/40 border-l-4 border-blue-500' : ''}`}
                                        >
                                            <td className="p-3 font-bold text-blue-400">{sym.Name}</td>
                                            <td className="p-3 text-right text-gray-400 text-sm truncate max-w-[100px] font-mono">
                                                {(() => {
                                                    const vol = calculateSymbolOpenVolume(openTrades, sym);
                                                    return vol > 0 ? formatNumber(vol, account?.volumeFormat || '###') : '-';
                                                })()}
                                            </td>
                                            <td className="p-3 text-right text-sm truncate max-w-[100px] font-mono">
                                                {(() => {
                                                    const totalPnl = calculateSymbolOpenPnL(openTrades, sym);
                                                    const colorClass = totalPnl > 0 ? 'text-green-400' : totalPnl < 0 ? 'text-red-400' : 'text-gray-400';

                                                    return (
                                                        <span className={colorClass}>
                                                            {totalPnl !== 0 ? formatNumber(totalPnl, account?.moneyFormat || '$0,0.00') : '-'}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-500 italic">No default watchlist found.</p>
                    )}
                </div>

                {/* Column 2: Trades */}
                <div className="lg:col-span-1 bg-gray-800 rounded-xl border border-gray-700 p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-white">Recent Trades</h3>
                        <span className="text-sm text-gray-400">{trades.length} trades</span>
                    </div>
                    {trades.length > 0 ? (
                        <div className="overflow-x-auto rounded-lg border border-gray-700">
                            <table className="w-full text-left">
                                <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase">
                                    <tr>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Symbol</th>
                                        <th className="p-3">Type</th>
                                        <th className="p-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {trades.map(trade => (
                                        <tr
                                            key={trade.id}
                                            onClick={() => handleTradeClick(trade)}
                                            className="hover:bg-gray-700/30 cursor-pointer transition border-b border-gray-700/30 last:border-b-0"
                                        >
                                            <td className="p-3 text-gray-300 text-sm">
                                                {new Date(trade.date).toLocaleDateString()}
                                            </td>
                                            <td className="p-3 font-bold text-white">
                                                {trade.symbol?.Name || '-'}
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${trade.type === 'Long' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {trade.type}
                                                </span>
                                            </td>
                                            <td className="p-3 font-mono">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${trade.trade_status === 'Open' ? 'bg-blue-500/20 text-blue-400' :
                                                    trade.trade_status === 'Pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                                        'bg-gray-500/20 text-gray-400'
                                                    }`}>
                                                    {trade.trade_status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-500 italic">No trades recorded yet.</p>
                    )}
                </div>
            </div>

            {isDetailModalOpen && selectedTrade && (
                <TradeDetailModal
                    isOpen={isDetailModalOpen}
                    onClose={() => setIsDetailModalOpen(false)}
                    trade={selectedTrade}
                />
            )}
        </div>
    );
};

export default AccountDetail;
