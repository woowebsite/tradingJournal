import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Clock,
    TrendingUp,
    TrendingDown,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Eye,
    ExternalLink,
    ChevronDown
} from 'lucide-react';
import { formatNumber } from '../../utils/formatNumber';
import dayjs from 'dayjs';

const TradesHistoryTable = ({
    trades = [],
    activeTab,
    onTabChange,
    focusDate,
    onViewTrade,
    ticker
}) => {
    const [isCollapsed, setIsCollapsed] = useState(true);

    const filteredTrades = useMemo(() => {
        if (!trades || trades.length === 0) return [];
        if (activeTab === 'all') return [...trades].reverse();
        if (activeTab === 'Open') return trades.filter(t => t.status === 'Open').reverse();
        if (activeTab === 'Closed') return trades.filter(t => t.status === 'Closed').reverse();
        if (activeTab === 'Long' || activeTab === 'Short') return trades.filter(t => t.type === activeTab).reverse();
        return [...trades].reverse();
    }, [trades, activeTab]);

    return (
        <div className="bg-gray-800 rounded-2xl border border-gray-700/80 overflow-hidden shadow-xl">
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 ${!isCollapsed ? 'border-b border-gray-700/80' : ''}`}>
                <div 
                    className="flex items-center gap-2 cursor-pointer select-none"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    <Clock size={18} className="text-purple-400" />
                    <h3 className="text-base font-bold text-gray-100">
                        Lịch sử Lệnh Giao Dịch (1 Lệnh 1 Lúc) ({filteredTrades.length})
                    </h3>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center bg-gray-900 p-1 rounded-xl border border-gray-700 text-xs">
                        <button
                            onClick={() => onTabChange('all')}
                            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                                activeTab === 'all' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                            }`}
                        >
                            Tất cả ({trades.length})
                        </button>
                        <button
                            onClick={() => onTabChange('Open')}
                            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                                activeTab === 'Open' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                            }`}
                        >
                            Đang mở ({trades.filter(t => t.status === 'Open').length})
                        </button>
                        <button
                            onClick={() => onTabChange('Closed')}
                            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                                activeTab === 'Closed' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                            }`}
                        >
                            Đã đóng ({trades.filter(t => t.status === 'Closed').length})
                        </button>
                        <button
                            onClick={() => onTabChange('Long')}
                            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                                activeTab === 'Long' ? 'bg-emerald-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                            }`}
                        >
                            Long ({trades.filter(t => t.type === 'Long').length})
                        </button>
                        <button
                            onClick={() => onTabChange('Short')}
                            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                                activeTab === 'Short' ? 'bg-red-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                            }`}
                        >
                            Short ({trades.filter(t => t.type === 'Short').length})
                        </button>
                    </div>

                    {/* Elegant Icon-only Collapse Toggle Button */}
                    <button
                        type="button"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="h-8 w-8 rounded-lg bg-gray-900/80 border border-gray-700/80 text-gray-400 hover:text-white hover:border-purple-500/50 hover:bg-purple-950/20 transition-all duration-200 flex items-center justify-center cursor-pointer shadow-sm group"
                        title={isCollapsed ? "Mở rộng" : "Thu gọn"}
                        aria-label={isCollapsed ? "Mở rộng" : "Thu gọn"}
                    >
                        <ChevronDown
                            size={16}
                            className={`transition-transform duration-300 ease-out ${
                                isCollapsed ? 'rotate-0 text-gray-400 group-hover:text-purple-300' : 'rotate-180 text-purple-400'
                            }`}
                        />
                    </button>
                </div>
            </div>

            {!isCollapsed && (

            <div className="overflow-x-auto max-h-96 custom-scrollbar">
                <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-gray-900/70 text-gray-400 text-xs uppercase tracking-wider sticky top-0 backdrop-blur z-10">
                        <tr>
                            <th className="py-3 px-3">#</th>
                            <th className="py-3 px-3">Vị thế</th>
                            <th className="py-3 px-3">Ngày Vào (Entry)</th>
                            <th className="py-3 px-3">Giá Vào</th>
                            <th className="py-3 px-3">Cắt lỗ (SL)</th>
                            <th className="py-3 px-3">Chốt lời (TP)</th>
                            <th className="py-3 px-3">Ngày Đóng (Exit)</th>
                            <th className="py-3 px-3">Giá Đóng</th>
                            <th className="py-3 px-3">Kết Quả</th>
                            <th className="py-3 px-3">PnL (%)</th>
                            <th className="py-3 px-3">Thời Gian</th>
                            <th className="py-3 px-3 text-right">Hành động</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50 text-gray-300">
                        {filteredTrades.length === 0 ? (
                            <tr>
                                <td colSpan="12" className="py-8 text-center text-gray-500 italic">
                                    Không có lệnh giao dịch nào phù hợp.
                                </td>
                            </tr>
                        ) : (
                            filteredTrades.map((trade, idx) => {
                                const tradeDate = trade.entry_time || (trade.entry_date ? String(trade.entry_date).split('T')[0] : '');
                                const isFocused = focusDate === tradeDate;

                                return (
                                    <tr key={idx} className={`transition ${isFocused ? 'bg-purple-900/20' : 'hover:bg-gray-700/30'}`}>
                                        <td className="py-3 px-3 font-mono text-xs text-gray-500">
                                            #{trade.trade_no}
                                        </td>
                                        <td className="py-3 px-3">
                                            <button
                                                type="button"
                                                onClick={() => onViewTrade(trade)}
                                                title={`Xem nến Entry ${trade.entry_time || (trade.entry_date ? dayjs(trade.entry_date).format('YYYY-MM-DD') : '')} trên biểu đồ`}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer shadow-sm hover:scale-105 active:scale-95 ${
                                                    trade.type === 'Long'
                                                        ? isFocused
                                                            ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 shadow-emerald-600/30'
                                                            : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30'
                                                        : isFocused
                                                            ? 'bg-red-600 text-white ring-2 ring-red-400 shadow-red-600/30'
                                                            : 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30'
                                                }`}
                                            >
                                                {trade.type === 'Long' ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                                                <span>{trade.type.toUpperCase()}</span>
                                                <Eye size={11} className="opacity-70 ml-0.5" />
                                            </button>
                                        </td>
                                        <td className="py-3 px-3 font-mono text-xs text-gray-300">
                                            {dayjs(trade.entry_date).format('YYYY-MM-DD')}
                                        </td>
                                        <td className="py-3 px-3 font-semibold text-white">
                                            {formatNumber(trade.entry_price)}
                                        </td>
                                        <td className="py-3 px-3 text-red-400 font-medium text-xs">
                                            {formatNumber(trade.stop_loss)}
                                        </td>
                                        <td className="py-3 px-3 text-emerald-400 font-medium text-xs">
                                            {trade.take_profit ? formatNumber(trade.take_profit) : <span className="text-gray-400 italic text-[11px]">Theo ST</span>}
                                        </td>
                                        <td className="py-3 px-3 font-mono text-xs text-gray-400">
                                            {trade.exit_date ? dayjs(trade.exit_date).format('YYYY-MM-DD') : '-'}
                                        </td>
                                        <td className="py-3 px-3 font-semibold text-gray-200">
                                            {trade.exit_price ? formatNumber(trade.exit_price) : '-'}
                                        </td>
                                        <td className="py-3 px-3 text-xs">
                                            {trade.status === 'Open' ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                                                    <Clock size={12} /> Đang mở
                                                </span>
                                            ) : trade.exit_reason === 'StopLoss' ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 font-bold">
                                                    <XCircle size={12} /> Stop Loss
                                                </span>
                                            ) : (trade.exit_reason && trade.exit_reason.includes('TakeProfit')) || trade.pnl_percent > 0 ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                                                    <CheckCircle2 size={12} /> {trade.exit_reason || 'Take Profit'}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold">
                                                    <AlertTriangle size={12} /> {trade.exit_reason || 'Đóng vị thế'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 font-bold">
                                            <span className={trade.pnl_percent > 0 ? 'text-emerald-400' : trade.pnl_percent < 0 ? 'text-rose-400' : 'text-gray-400'}>
                                                {trade.pnl_percent > 0 ? `+${trade.pnl_percent}%` : `${trade.pnl_percent}%`}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-xs text-gray-400">
                                            {trade.holding_bars || 0} nến
                                        </td>
                                        <td className="py-3 px-3 text-right">
                                            <Link
                                                to={`/trade-station?symbol=${encodeURIComponent(ticker || '')}&price=${trade.entry_price}&slPrice=${trade.stop_loss}&tpPrice=${trade.take_profit || ''}`}
                                                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold transition"
                                            >
                                                <span>Đặt lệnh</span>
                                                <ExternalLink size={12} />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            )}
        </div>
    );
};

export default TradesHistoryTable;
