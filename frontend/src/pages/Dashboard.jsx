import { useState, useEffect } from 'react';
import { useAccount } from '../context/AccountContext';
import api from '../services/api';
import { formatNumber } from '../utils/formatNumber';

const Dashboard = () => {
    const { selectedAccount } = useAccount();
    const [stats, setStats] = useState({
        totalPnl: 0,
        winRate: 0,
        profitFactor: 0,
        totalTrades: 0
    });
    const [recentTrades, setRecentTrades] = useState([]);
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState(null);

    // Fetch Settings
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get('/settings');
                const data = res.data.data;
                if (Array.isArray(data) && data.length > 0) {
                    setSettings(data[0]);
                }
            } catch (error) {
                console.error("Failed to fetch settings:", error);
            }
        };
        fetchSettings();
    }, []);

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
                    const pnl = parseFloat(trade.pnl) || 0;
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
                    } else if (trade.trade_status === 'Closed' || trade.trade_status === 'Win' || trade.trade_status === 'Loss') {
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
            {/* Settings Summary Card */}
            <div className="mb-8 bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm relative overflow-hidden">
                <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-6">

                    <div className="flex-1 min-w-[200px]">
                        <p className="text-gray-400 text-sm uppercase tracking-wider mb-1">Risk Setting</p>
                        <h3 className="text-3xl font-bold text-white truncate" title={settings?.Name}>
                            {settings ? settings.Name : 'No Active Setting'}
                        </h3>
                    </div>

                    {settings && (
                        <div className="flex gap-8 text-sm md:text-base">
                            <div className="text-center md:text-left">
                                <p className="text-gray-400 mb-1">Risk / Trade</p>
                                <p className="font-bold text-blue-400 text-lg">{settings.riskPerTrade}%</p>
                            </div>
                            <div className="text-center md:text-left">
                                <p className="text-gray-400 mb-1">Capital Risk</p>
                                <p className="font-bold text-yellow-400 text-lg">{settings.capitalRisk}%</p>
                            </div>
                            <div className="text-center md:text-left">
                                <p className="text-gray-400 mb-1">Max Drawdown</p>
                                <p className="font-bold text-red-400 text-lg">{settings.maxDrawDown}%</p>
                            </div>
                        </div>
                    )}
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
