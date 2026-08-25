import { useState, useEffect, useMemo } from 'react';
import { X, DollarSign, Image as ImageIcon, Pencil, ExternalLink, ChartCandlestick } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatNumber } from '../utils/formatNumber';
import { useAccount } from '../context/AccountContext';
import { useDispatch } from 'react-redux';
import { fetchLatestHistory, fetchPagedSymbolHistories } from '../features/marketSlice';
import { extractTextFromBlocks } from '../utils/textUtils';
import { calculateTradePnL } from '../utils/tradeCalculations';
import useEscapeKey from '../hooks/useEscapeKey';
import TradingViewChart from './TradingViewChart';

const TradeDetailModal = ({ isOpen, onClose, trade, onEdit }) => {
    const { selectedAccount } = useAccount();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [currentPrice, setCurrentPrice] = useState('');
    const [chartState, setChartState] = useState({ symbolId: null, data: [], error: '' });

    useEffect(() => {
        const fetchPrice = async () => {
            if (isOpen && trade && trade.symbol) {
                // Reset first
                setCurrentPrice(trade.price || '');

                const symbolId = trade.symbol.documentId || trade.symbol.id;
                if (!symbolId) return;

                try {
                    const resultAction = await dispatch(fetchLatestHistory(symbolId));
                    if (fetchLatestHistory.fulfilled.match(resultAction)) {
                        const latestHistory = resultAction.payload;
                        if (latestHistory && latestHistory.close) {
                            setCurrentPrice(latestHistory.close);
                        }
                    }
                } catch (error) {
                    console.error('Failed to fetch latest price:', error);
                }
            }
        };

        fetchPrice();
    }, [isOpen, trade, dispatch]);

    useEffect(() => {
        let cancelled = false;
        const symbolId = trade?.symbol?.documentId || trade?.symbol?.id;

        if (!isOpen || !symbolId) return () => { cancelled = true; };

        fetchPagedSymbolHistories(symbolId)
            .then(data => {
                if (!cancelled) setChartState({ symbolId, data, error: '' });
            })
            .catch(error => {
                console.error('Failed to fetch chart history:', error);
                if (!cancelled) {
                    setChartState({ symbolId, data: [], error: 'Unable to load chart data.' });
                }
            });

        return () => { cancelled = true; };
    }, [isOpen, trade?.symbol?.documentId, trade?.symbol?.id]);

    const activeSymbolId = trade?.symbol?.documentId || trade?.symbol?.id;
    const chartLoading = Boolean(isOpen && activeSymbolId && chartState.symbolId !== activeSymbolId);
    const chartData = chartState.symbolId === activeSymbolId ? chartState.data : [];
    const chartError = chartState.symbolId === activeSymbolId ? chartState.error : '';

    const chartSignals = useMemo(() => (trade?.trade_details || [])
        .filter(detail => detail.date && detail.signal)
        .map(detail => {
            const normalizedSignal = String(detail.signal).toLowerCase().replace(/[\s_-]/g, '');
            let type = 'unknown';
            if (normalizedSignal.includes('entry') || normalizedSignal.includes('buy')) type = 'entry';
            else if (normalizedSignal.includes('takeprofit') || normalizedSignal === 'tp') type = 'takeprofit';
            else if (normalizedSignal.includes('stoploss') || normalizedSignal === 'sl') type = 'stoploss';
            else if (normalizedSignal.includes('exit') || normalizedSignal.includes('sell')) type = 'exit';

            return {
                date: detail.date,
                rules: [{
                    documentId: `trade-detail-${detail.documentId || detail.id || detail.date}`,
                    Name: detail.signal,
                    Type: type
                }]
            };
        }), [trade?.trade_details]);

    useEscapeKey(onClose, isOpen);

    if (!isOpen || !trade) return null;

    // Helper to format currency
    const formatPrice = (price) => {
        return price ? formatNumber(price, selectedAccount?.moneyFormat || '#,###.##') : '-';
    };

    // Helper to format volume
    const formatVol = (vol) => {
        return vol ? formatNumber(vol, selectedAccount?.volumeFormat || '###') : '-';
    };

    // Helper to format date
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString();
    };

    // Helper for status color
    const getStatusColor = (status) => {
        switch (status) {
            case 'Open': return 'bg-blue-500/20 text-blue-400';
            case 'Closed': return 'bg-gray-600/20 text-gray-400';
            case 'Pending': return 'bg-yellow-500/20 text-yellow-400';
            default: return 'bg-gray-700 text-gray-300';
        }
    };

    // Helper for type color
    const getTypeColor = (type) => {
        return type === 'Long' ? 'text-green-400' : 'text-red-400';
    };

    const relevantDetails = (trade.trade_details || []).filter(d =>
        trade.type === 'Long' ? d.type === 'Buy' : d.type === 'Sell'
    );

    const totalVolume = relevantDetails.reduce((acc, curr) => acc + (parseFloat(curr.volume) || 0), 0);
    const avgPrice = totalVolume > 0
        ? relevantDetails.reduce((acc, curr) => acc + ((parseFloat(curr.price) || 0) * (parseFloat(curr.volume) || 0)), 0) / totalVolume
        : 0;

    const totalCalculatedPnl = calculateTradePnL(trade, currentPrice);

    const handleEditTrade = () => {
        onEdit?.(trade);
        onClose();
    };

    const handleGoToTradeStation = () => {
        const symbolName = trade.symbol?.Name || trade.symbol?.name;
        if (!symbolName) return;

        navigate(`/trade-station?symbol=${encodeURIComponent(symbolName)}`);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-6xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex justify-between items-start bg-gray-800/50">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className={`text-2xl font-bold font-mono ${getTypeColor(trade.type)}`}>
                                {trade.symbol?.Name || trade.symbol?.name || 'UNKNOWN'}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-sm font-bold border border-white/10 ${trade.type === 'Long' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                {trade.type.toUpperCase()}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(trade.trade_status)}`}>
                                {trade.trade_status}
                            </span>

                            <button
                                onClick={handleEditTrade}
                                className="flex items-center gap-2 px-3 py-1 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:border-blue-400 transition"
                            >
                                <Pencil size={14} />
                                Edit Trade
                            </button>
                            <button
                                onClick={handleGoToTradeStation}
                                className="flex items-center gap-2 px-3 py-1 rounded-lg border border-gray-500/30 bg-gray-500/10 text-gray-300 hover:bg-gray-500/20 hover:border-gray-400 transition"
                            >
                                <ExternalLink size={14} />
                                Go
                            </button>
                        </div>
                        <div className="flex items-center gap-4 text-gray-400 text-sm">


                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full transition text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto p-6 space-y-8 flex-1">
                    {/* Symbol chart with trade signals */}
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h4 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                                <ChartCandlestick size={18} /> Symbol Chart
                            </h4>
                            <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                                <span className="text-blue-400">● Entry</span>
                                <span className="text-green-400">● Take Profit</span>
                                <span className="text-red-400">● Stop Loss</span>
                                <span className="text-orange-400">● Exit</span>
                            </div>
                        </div>
                        <div className="relative h-[520px] overflow-hidden rounded-xl border border-gray-700/50 bg-gray-800">
                            {chartLoading ? (
                                <div className="absolute inset-0 flex items-center justify-center text-sm text-blue-400 animate-pulse">
                                    Loading chart...
                                </div>
                            ) : chartError ? (
                                <div className="absolute inset-0 flex items-center justify-center text-sm text-red-400">
                                    {chartError}
                                </div>
                            ) : (
                                <TradingViewChart
                                    data={chartData}
                                    symbol={trade.symbol?.Name || trade.symbol?.name}
                                    signals={chartSignals}
                                    template={trade.strategy?.template || 'Supertrend'}
                                    disableScrollZoom
                                    disableChartMove
                                />
                            )}
                        </div>
                    </div>

                    {/* PnL and Quantity Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
                            <span className="text-gray-400 text-sm block mb-1">Current Price</span>
                            <span className="text-xl font-mono text-white">{formatPrice(currentPrice)}</span>
                        </div>
                        <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
                            <span className="text-gray-400 text-sm block mb-1">Avg Entry</span>
                            <span className="text-xl font-mono text-white">{formatPrice(avgPrice)}</span>
                        </div>
                        <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
                            <span className="text-gray-400 text-sm block mb-1">Total Volume</span>
                            <span className="text-xl font-mono text-white">{formatVol(totalVolume)}</span>
                        </div>
                        <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
                            <span className="text-gray-400 text-sm block mb-1">Est. P&L</span>
                            <span className={`text-2xl font-bold font-mono ${totalCalculatedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {totalCalculatedPnl ? (totalCalculatedPnl > 0 ? '+' : '') + formatPrice(totalCalculatedPnl) : '-'}
                            </span>
                        </div>
                        <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
                            <span className="text-gray-400 text-sm block mb-1">Est. %</span>
                            <span className={`text-2xl font-bold font-mono ${totalCalculatedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {selectedAccount?.initial_balance ? (totalCalculatedPnl / selectedAccount.initial_balance * 100).toFixed(2) + '%' : '-'}
                            </span>
                        </div>
                    </div>

                    {/* Execution History */}
                    <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                            <DollarSign size={18} /> Execution History
                        </h4>
                        <div className="bg-gray-800/30 rounded-xl overflow-hidden border border-gray-700/50">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-800/80 text-gray-400">
                                    <tr>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Signal</th>
                                        <th className="p-3">Type</th>
                                        <th className="p-3 text-right">Price</th>
                                        <th className="p-3 text-right">Volume</th>
                                        <th className="p-3 text-right">Value</th>
                                        <th className="p-3">Note</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700/30">
                                    {(trade.trade_details || [])
                                        .slice()
                                        .sort((a, b) => new Date(a.date) - new Date(b.date))
                                        .map((detail, i) => {
                                            const val = (parseFloat(detail.price) || 0) * (parseFloat(detail.volume) || 0);

                                            return (
                                                <tr key={i} className="hover:bg-white/5 transition group">
                                                    <td className="p-3 text-gray-300 whitespace-nowrap max-w-[170px]">{formatDate(detail.date)}</td>
                                                    <td className="p-3 text-blue-300 font-medium">{detail.signal}</td>
                                                    <td className={`p-3 font-bold ${detail.type === 'Buy' ? 'text-green-400' : 'text-red-400'}`}>
                                                        {detail.type}
                                                    </td>
                                                    <td className="p-3 text-right font-mono text-white">{formatPrice(detail.price)}</td>
                                                    <td className="p-3 text-right font-mono text-blue-300">{formatVol(detail.volume)}</td>
                                                    <td className="p-3 text-right font-mono text-gray-300">{formatPrice(val)}</td>
                                                    <td className="p-3 text-gray-400 w-full min-w-[100px] truncate" title={extractTextFromBlocks(detail.note) || ''}>
                                                        {extractTextFromBlocks(detail.note) || '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    {(trade.trade_details || []).length === 0 && (
                                        <tr>
                                            <td colSpan="7" className="p-4 text-center text-gray-500 italic">No execution details recorded.</td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-gray-800/80 border-t border-gray-700/50 font-bold">
                                    <tr>
                                        <td colSpan="4" className="p-3 text-right text-gray-400 uppercase text-xs tracking-wider">Total Volume</td>
                                        <td className="p-3 text-right font-mono text-blue-300">
                                            {formatVol(totalVolume)}
                                        </td>
                                        <td className="p-3" colSpan="2"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Screenshots */}
                    {(() => {
                        const allScreenshots = (trade.trade_details || [])
                            .filter(d => d.screenshot && d.screenshot.url)
                            .map(d => ({
                                url: d.screenshot.url.startsWith('http') ? d.screenshot.url : `${import.meta.env.VITE_API_URL || 'http://localhost:1337'}${d.screenshot.url}`,
                                signal: d.signal,
                                date: d.date
                            }));

                        if (allScreenshots.length === 0) return null;

                        return (
                            <div className="bg-gray-800/30 p-5 rounded-xl border border-gray-700/50">
                                <h4 className="text-lg font-semibold text-gray-200 mb-3 flex items-center gap-2">
                                    <ImageIcon size={18} /> Screenshots
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {allScreenshots.map((img, idx) => (
                                        <a
                                            key={idx}
                                            href={img.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block group relative aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-700 hover:border-blue-500 transition"
                                        >
                                            <img src={img.url} alt={`Screenshot ${idx + 1}`} className="w-full h-full object-cover group-hover:opacity-80 transition" />
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-xs text-center text-gray-300 backdrop-blur-sm">
                                                {img.signal} ({formatDate(img.date)})
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Note */}
                    {extractTextFromBlocks(trade.note) && (
                        <div className="bg-gray-800/30 p-5 rounded-xl border border-gray-700/50">
                            <h4 className="text-lg font-semibold text-gray-200 mb-3">Note</h4>
                            <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{extractTextFromBlocks(trade.note)}</p>
                        </div>
                    )}



                </div>
            </div>
        </div>
    );
};

export default TradeDetailModal;
