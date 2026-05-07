import { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchOpenTrades } from '../features/tradeSlice';
import { fetchLatestHistory } from '../features/marketSlice';
import { XCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { useAccount } from '../context/AccountContext';
import { formatNumber } from '../utils/formatNumber';
import { calculateTradePnL } from '../utils/tradeCalculations';

const TodayTrades = () => {
    const { selectedAccount } = useAccount();
    const dispatch = useDispatch();
    const { openTrades, openTradesLoading } = useSelector(state => state.trades);
    const { latestPricesMap } = useSelector(state => state.market);
    const [selectedTrade, setSelectedTrade] = useState(null);

    useEffect(() => {
        if (selectedAccount) {
            const accountId = selectedAccount.documentId || selectedAccount.id;
            dispatch(fetchOpenTrades({ accountId }));
        }
    }, [dispatch, selectedAccount]);

    // Fetch latest history for each symbol on page load
    useEffect(() => {
        if (!openTrades || openTrades.length === 0) return;
        openTrades.forEach(trade => {
            const symbolId = trade.symbol?.documentId || trade.symbol?.id;
            if (symbolId) {
                dispatch(fetchLatestHistory(symbolId));
            }
        });
    }, [dispatch, openTrades]);

    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    const todayTrades = useMemo(() => {
        if (!openTrades) return [];
        return openTrades.filter(trade => {
            const tradeDate = new Date(trade.date || trade.createdAt);
            tradeDate.setHours(0, 0, 0, 0);
            return tradeDate.getTime() === today.getTime();
        });
    }, [openTrades, today]);

    const trades = useMemo(() => {
        return todayTrades.map(item => {
            const details = item.trade_details || [];
            const sortedDetails = [...details].sort((a, b) => new Date(a.date) - new Date(b.date));
            const firstEntry = sortedDetails.find(d => d.signal === 'Entry') || sortedDetails[0];
            const lastExit = sortedDetails.reverse().find(d => d.signal === 'Exit' || d.signal === 'TakeProfit' || d.signal === 'Stoploss');
            const symbolId = item.symbol?.documentId || item.symbol?.id;
            const currentPrice = symbolId ? latestPricesMap[symbolId] : null;
            const pnl = calculateTradePnL(item, currentPrice);

            return {
                ...item,
                derivedDate: item.date || (firstEntry ? firstEntry.date : item.createdAt),
                derivedEntryPrice: firstEntry ? firstEntry.price : 0,
                derivedExitPrice: lastExit ? lastExit.price : 0,
                derivedPnl: pnl,
                derivedCurrentPrice: currentPrice,
                sortedDetails,
            };
        }).sort((a, b) => new Date(b.derivedDate) - new Date(a.derivedDate));
    }, [todayTrades, latestPricesMap]);

    const totalPnl = useMemo(() => {
        return trades.reduce((sum, t) => sum + (t.derivedPnl || 0), 0);
    }, [trades]);

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                        Today&apos;s Trades
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Open trades for {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <div className={`text-lg font-mono font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    Total: {formatNumber(totalPnl)} USD
                </div>
            </div>

            {openTradesLoading ? (
                <div className="text-center text-gray-400 py-12">Loading...</div>
            ) : trades.length === 0 ? (
                <div className="text-center text-gray-500 py-12 bg-gray-800/50 rounded-xl border border-gray-700">
                    No open trades today.
                </div>
            ) : (
                <div className="space-y-3">
                    {trades.map(trade => (
                        <div
                            key={trade.id || trade.documentId}
                            className="bg-gray-800 rounded-xl border border-gray-700 p-4 hover:border-gray-600 transition-colors cursor-pointer"
                            onClick={() => setSelectedTrade(trade)}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full mt-1 ${trade.type === 'Long' ? 'bg-green-400' : 'bg-red-400'}`} />
                                    <div>
                                        <div className="font-bold text-gray-100">
                                            {trade.symbol?.Name || trade.symbol?.name || 'Unknown'}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {trade.type} &middot; {new Date(trade.derivedDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="flex-1" />
                                    {trade.derivedCurrentPrice && (
                                        <div className="text-right">
                                            <div className="text-xs text-gray-500 mb-0.5">Current</div>
                                            <div className={`text-lg font-mono font-bold ${trade.derivedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {formatNumber(trade.derivedCurrentPrice)}
                                            </div>
                                        </div>
                                    )}
                                    <div className="text-right w-32">
                                        <div className="text-xs text-gray-500 mb-0.5">PnL</div>
                                        <div className={`font-mono text-sm font-bold ${trade.derivedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {formatNumber(trade.derivedPnl)} USD
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {trade.sortedDetails && trade.sortedDetails.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {trade.sortedDetails.map((detail, idx) => (
                                        <div key={idx} className="flex items-center gap-1.5 text-xs">
                                            <span className={`px-1.5 py-0.5 rounded font-medium ${detail.signal === 'Entry' ? 'bg-blue-500/20 text-blue-400' : detail.signal === 'Stoploss' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                                {detail.signal}
                                            </span>
                                            <span className="text-gray-400">{formatNumber(detail.price)}</span>
                                            <span className="text-gray-600">&times;{detail.volume}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TodayTrades;
