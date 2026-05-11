import { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchOpenTrades, saveTrade } from '../features/tradeSlice';
import { fetchBatchLatestMinutePrices } from '../features/marketSlice';
import { useAccount } from '../context/AccountContext';
import { formatNumber } from '../utils/formatNumber';
import { calculateTradePnL } from '../utils/tradeCalculations';
import TradeDetailModal from '../components/TradeDetailModal';
import TradeModal from '../components/TradeModal';

const TodayTrades = () => {
    const { selectedAccount } = useAccount();
    const dispatch = useDispatch();
    const { openTrades, openTradesLoading } = useSelector(state => state.trades);
    const [selectedTrade, setSelectedTrade] = useState(null);
    const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
    const [tradeToEdit, setTradeToEdit] = useState(null);
    const [marketPricesMap, setMarketPricesMap] = useState({});

    useEffect(() => {
        if (selectedAccount) {
            const accountId = selectedAccount.documentId || selectedAccount.id;
            dispatch(fetchOpenTrades({ accountId }));
        }
    }, [dispatch, selectedAccount]);

    // Fetch 1-minute prices directly from market data, not from symbol-histories.
    useEffect(() => {
        if (!openTrades || openTrades.length === 0) {
            return;
        }

        const symbolsById = openTrades.reduce((acc, trade) => {
            const symbol = trade.symbol;
            const symbolId = symbol?.documentId || symbol?.id;
            if (symbol && symbolId) {
                acc[symbolId] = symbol;
            }
            return acc;
        }, {});

        const symbols = Object.values(symbolsById);

        const refreshMarketPrices = async () => {
            const result = await dispatch(fetchBatchLatestMinutePrices(symbols));
            if (fetchBatchLatestMinutePrices.fulfilled.match(result)) {
                setMarketPricesMap(result.payload || {});
            }
        };

        refreshMarketPrices();
        const intervalId = window.setInterval(refreshMarketPrices, 60 * 1000);

        return () => window.clearInterval(intervalId);
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
            const currentPrice = symbolId ? marketPricesMap[symbolId] : null;
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
    }, [todayTrades, marketPricesMap]);

    const totalPnl = useMemo(() => {
        return trades.reduce((sum, t) => sum + (t.derivedPnl || 0), 0);
    }, [trades]);

    const handleEditTrade = (trade) => {
        setSelectedTrade(null);
        setTradeToEdit(trade);
        setIsTradeModalOpen(true);
    };

    const handleSaveTrade = async (tradeData) => {
        try {
            await dispatch(saveTrade({ tradeData, tradeToEdit })).unwrap();

            if (selectedAccount) {
                dispatch(fetchOpenTrades({ accountId: selectedAccount.documentId || selectedAccount.id }));
            }

            setIsTradeModalOpen(false);
            setTradeToEdit(null);
        } catch (error) {
            console.error('Error saving trade sequence:', error);
            alert(`Failed to save trade: ${error.message || error}`);
        }
    };

    return (
        <>
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

        <TradeDetailModal
            isOpen={!!selectedTrade}
            onClose={() => setSelectedTrade(null)}
            trade={selectedTrade}
            onEdit={handleEditTrade}
        />

        <TradeModal
            isOpen={isTradeModalOpen}
            onClose={() => setIsTradeModalOpen(false)}
            onSubmit={handleSaveTrade}
            initialData={tradeToEdit}
        />
        </>
    );
};

export default TodayTrades;
