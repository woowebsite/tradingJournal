import { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchTrades } from '../features/tradeSlice';
import { useAccount } from '../context/AccountContext';
import { formatNumber } from '../utils/formatNumber';
import { Calendar, Tag, TrendingUp, TrendingDown, Image as ImageIcon } from 'lucide-react';
import clsx from 'clsx';

const JournalTrade = () => {
    const { selectedAccount } = useAccount();
    const dispatch = useDispatch();
    const { items: rawTrades, loading } = useSelector(state => state.trades);
    const [selectedMonth, setSelectedMonth] = useState(null);

    const API_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:1337';

    useEffect(() => {
        if (selectedAccount) {
            const accountId = selectedAccount.documentId || selectedAccount.id;
            dispatch(fetchTrades({ accountId }));
        }
    }, [dispatch, selectedAccount]);

    const trades = useMemo(() => {
        if (!rawTrades) return [];
        return rawTrades.map(item => {
            const details = item.trade_details || [];
            const sortedDetails = [...details].sort((a, b) => new Date(a.date) - new Date(b.date));
            const firstEntry = sortedDetails.find(d => d.signal === 'Entry') || sortedDetails[0];

            // Calc PnL
            let pnl = 0;
            if (sortedDetails && sortedDetails.length > 0) {
                pnl = sortedDetails.reduce((acc, d) => {
                    const val = (parseFloat(d.price) || 0) * (parseFloat(d.volume) || 0);
                    return d.type === 'Sell' ? acc + val : acc - val;
                }, 0);
            }

            // Get screenshot from the first detail that has one
            const detailWithScreenshot = sortedDetails.find(d => d.screenshot);
            const screenshotUrl = detailWithScreenshot?.screenshot?.url
                || null;

            return {
                id: item.id || item.documentId,
                ...item,
                derivedDate: item.date || (firstEntry ? firstEntry.date : item.createdAt),
                derivedPnl: pnl,
                screenshotUrl,
                firstNote: firstEntry?.note || item.note
            };
        }).sort((a, b) => new Date(b.derivedDate) - new Date(a.derivedDate));
    }, [rawTrades, API_URL]);

    const months = useMemo(() => {
        const uniqueMonths = new Set();
        trades.forEach(trade => {
            const date = new Date(trade.derivedDate);
            const monthStr = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
            uniqueMonths.add(monthStr);
        });
        return Array.from(uniqueMonths).sort((a, b) => {
            const [mA, yA] = a.split('/').map(Number);
            const [mB, yB] = b.split('/').map(Number);
            return yB - yA || mB - mA;
        });
    }, [trades]);

    useEffect(() => {
        if (months.length > 0 && !selectedMonth) {
            setSelectedMonth(months[0]);
        }
    }, [months]);

    const filteredTrades = useMemo(() => {
        if (!selectedMonth) return trades;
        return trades.filter(trade => {
            const date = new Date(trade.derivedDate);
            const monthStr = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
            return monthStr === selectedMonth;
        });
    }, [trades, selectedMonth]);

    const renderNote = (note) => {
        if (!note) return 'No notes';
        if (Array.isArray(note)) {
            // Strapi blocks format
            return note.map(block => block.children?.map(child => child.text).join('')).join(' ');
        }
        return note;
    };

    return (
        <div className="flex h-full gap-6">
            {/* Sidebar - Months */}
            <div className="w-64 flex-shrink-0">
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 sticky top-0">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 px-2">
                        Timeframe
                    </h3>
                    <div className="space-y-1">
                        {months.map(month => (
                            <button
                                key={month}
                                onClick={() => setSelectedMonth(month)}
                                className={clsx(
                                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-left',
                                    selectedMonth === month
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                        : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                                )}
                            >
                                <Calendar size={18} />
                                <span className="font-medium">{month}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content - Trade Cards */}
            <div className="flex-1 overflow-y-auto pr-2">
                <div className="grid grid-cols-1">
                    {loading ? (
                        <div className="col-span-full py-20 text-center text-gray-500">Loading trades...</div>
                    ) : filteredTrades.length === 0 ? (
                        <div className="col-span-full py-20 text-center text-gray-500">No trades found for this period.</div>
                    ) : (
                        filteredTrades.map(trade => (
                            <div
                                key={trade.id}
                                className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden hover:border-blue-500/50 transition-all duration-300 group shadow-lg flex flex-col"
                            >
                                {/* Screenshot Container */}
                                <div className="aspect-video w-full bg-gray-900 relative overflow-hidden">
                                    {trade.screenshotUrl ? (
                                        <img
                                            src={trade.screenshotUrl}
                                            alt={trade.symbol?.Name || 'Trade Screenshot'}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 gap-2">
                                            <ImageIcon size={48} strokeWidth={1} />
                                            <span className="text-xs">No preview available</span>
                                        </div>
                                    )}
                                    <div className={clsx(
                                        "absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                                        trade.type === 'Long' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                                    )}>
                                        {trade.type}
                                    </div>
                                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono text-white border border-white/10">
                                        {new Date(trade.derivedDate).toLocaleDateString()}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-5 flex-1 flex flex-col">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="text-xl font-bold text-white mb-1">
                                                {trade.symbol?.Name || trade.symbol?.name || 'Unknown Symbol'}
                                            </h3>
                                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                                <Tag size={14} />
                                                <span>{trade.strategy?.name || 'Manual'}</span>
                                            </div>
                                        </div>
                                        <div className={clsx(
                                            "text-right",
                                            trade.derivedPnl >= 0 ? "text-green-400" : "text-red-400"
                                        )}>
                                            <div className="text-lg font-mono font-bold">
                                                {trade.derivedPnl >= 0 ? '+' : ''}
                                                {formatNumber(trade.derivedPnl, selectedAccount?.moneyFormat || '#,###.##')}
                                            </div>
                                            <div className="text-[10px] uppercase font-bold tracking-widest opacity-60">
                                                Net P&L
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gray-900/50 rounded-lg p-4 mb-4 flex-1">
                                        <p className="text-sm text-gray-300 line-clamp-3 italic leading-relaxed">
                                            {renderNote(trade.note)}
                                        </p>
                                    </div>

                                    <div className="flex justify-between items-center mt-auto">
                                        <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
                                            <div>
                                                ENTRY: <span className="text-gray-300">{formatNumber(trade.derivedEntryPrice, selectedAccount?.moneyFormat || '#,###.##')}</span>
                                            </div>
                                            <div>
                                                STATUS: <span className={clsx(trade.trade_status === 'Open' ? 'text-blue-400' : 'text-gray-400')}>{trade.trade_status}</span>
                                            </div>
                                        </div>
                                        {trade.derivedPnl >= 0 ? (
                                            <div className="p-2 bg-green-500/10 rounded-full text-green-500">
                                                <TrendingUp size={18} />
                                            </div>
                                        ) : (
                                            <div className="p-2 bg-red-500/10 rounded-full text-red-500">
                                                <TrendingDown size={18} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default JournalTrade;
