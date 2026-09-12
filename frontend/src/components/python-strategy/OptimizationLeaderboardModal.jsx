import React, { useState, useMemo } from 'react';
import useEscapeKey from '../../hooks/useEscapeKey';
import {
    Trophy,
    X,
    Search,
    ChevronUp,
    ChevronDown,
    AlertTriangle,
    Check,
    Sparkles
} from 'lucide-react';

const OptimizationLeaderboardModal = ({
    isOpen,
    onClose,
    optimizationConfigs = [],
    activeAppliedConfigRank,
    onApplyConfig,
    selectedSymbol,
    selectedStrategyFile,
    timeframe,
    currentStrategy
}) => {
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('rank');
    const [sortDir, setSortDir] = useState('asc');

    const filteredConfigs = useMemo(() => {
        if (!optimizationConfigs || optimizationConfigs.length === 0) return [];
        let list = [...optimizationConfigs];

        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(item => {
                const paText = String(item.paSummary || '').toLowerCase();
                const tpText = String(item.tpType || '').toLowerCase();
                const slText = String(item.slType || '').toLowerCase();
                const entryText = String(item.entryType || '').toLowerCase();
                const anchorText = String(item.vwapAnchor || '').toLowerCase();
                const rankText = `#${item.rank}`;
                return paText.includes(q) || tpText.includes(q) || slText.includes(q) || entryText.includes(q) || anchorText.includes(q) || rankText.includes(q);
            });
        }

        list.sort((a, b) => {
            let valA, valB;
            if (sortBy === 'profitFactor') {
                valA = Number(a.profitFactor || 0);
                valB = Number(b.profitFactor || 0);
            } else if (sortBy === 'winRate') {
                valA = Number(a.winRate || 0);
                valB = Number(b.winRate || 0);
            } else if (sortBy === 'totalTrades') {
                valA = Number(a.totalTrades || 0);
                valB = Number(b.totalTrades || 0);
            } else if (sortBy === 'totalPnlPercent') {
                valA = Number(a.totalPnlPercent || 0);
                valB = Number(b.totalPnlPercent || 0);
            } else {
                valA = Number(a.rank || 0);
                valB = Number(b.rank || 0);
            }

            if (sortDir === 'asc') {
                return valA > valB ? 1 : (valA < valB ? -1 : 0);
            } else {
                return valA < valB ? 1 : (valA > valB ? -1 : 0);
            }
        });

        return list;
    }, [optimizationConfigs, search, sortBy, sortDir]);

    useEscapeKey(onClose, isOpen);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose?.();
            }}
        >
            <div className="bg-gray-900 border border-gray-700/80 rounded-2xl w-full max-w-6xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/10">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-800 bg-gray-950/80">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 shrink-0">
                            <Trophy size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base sm:text-lg font-bold text-gray-100 flex items-center gap-2">
                                    <span>Bảng Xếp Hạng Cấu Hình Tối Ưu</span>
                                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-semibold">
                                        {filteredConfigs.length} cấu hình
                                    </span>
                                </h3>
                            </div>
                            <p className="text-xs text-gray-400 flex flex-wrap items-center gap-2 mt-0.5 font-mono">
                                <span className="text-emerald-400 font-bold">{selectedSymbol}</span>
                                <span>•</span>
                                <span className="text-amber-400 font-bold">{timeframe}</span>
                                <span>•</span>
                                <span className="text-gray-300">{selectedStrategyFile}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Filter & Search Bar */}
                <div className="p-3 sm:p-4 border-b border-gray-800/80 bg-gray-950/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1 max-w-md">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo PA (Engulfing, BD3BU2), TP (P50), SL (P75)..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700/80 hover:border-gray-600 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition font-medium"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 p-0.5 rounded cursor-pointer"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {/* Sort Filter Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                        <span className="text-xs text-gray-400 shrink-0 mr-1 hidden sm:inline">Sắp xếp:</span>
                        {[
                            { key: 'rank', label: 'Hạng (Rank)' },
                            { key: 'profitFactor', label: 'Profit Factor' },
                            { key: 'winRate', label: 'Win Rate' },
                            { key: 'totalTrades', label: 'Tổng lệnh' },
                            { key: 'totalPnlPercent', label: 'Tổng % PnL' }
                        ].map(sortItem => {
                            const isActive = sortBy === sortItem.key;
                            return (
                                <button
                                    key={sortItem.key}
                                    type="button"
                                    onClick={() => {
                                        if (isActive) {
                                            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
                                        } else {
                                            setSortBy(sortItem.key);
                                            setSortDir(sortItem.key === 'rank' ? 'asc' : 'desc');
                                        }
                                    }}
                                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                                        isActive
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                                            : 'bg-gray-800/80 text-gray-400 hover:text-gray-200 border border-gray-700/60 hover:border-gray-600'
                                    }`}
                                >
                                    <span>{sortItem.label}</span>
                                    {isActive && (
                                        sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Modal Body: Table */}
                <div className="p-3 sm:p-4 overflow-y-auto flex-1 custom-scrollbar">
                    {filteredConfigs.length === 0 ? (
                        <div className="py-16 text-center text-gray-400 space-y-2">
                            <AlertTriangle size={32} className="mx-auto text-amber-400/80" />
                            <p className="text-sm font-semibold text-gray-300">Không tìm thấy cấu hình nào khớp với bộ lọc.</p>
                            <p className="text-xs text-gray-500">Vui lòng thử thay đổi từ khóa tìm kiếm hoặc bấm chạy lại Optimize.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-gray-800">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-gray-950/80 text-gray-400 border-b border-gray-800 font-semibold uppercase tracking-wider text-[10px]">
                                        <th className="py-3 px-3.5 text-center w-14"># Hạng</th>
                                        <th className="py-3 px-3.5 min-w-[240px]">Thông số Cấu hình</th>
                                        <th className="py-3 px-3 text-center">Profit Factor</th>
                                        <th className="py-3 px-3 text-center min-w-[120px]">Tỷ Lệ Thắng (Win Rate)</th>
                                        <th className="py-3 px-3 text-center">Tổng Số Lệnh</th>
                                        <th className="py-3 px-3 text-right">Tổng PnL (%)</th>
                                        <th className="py-3 px-3 text-right">Gross Profit / Loss</th>
                                        <th className="py-3 px-3.5 text-center w-28">Hành động</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800/60 bg-gray-900/40">
                                    {filteredConfigs.map((item, index) => {
                                        const isApplied = activeAppliedConfigRank === item.rank;
                                        const pfNum = Number(item.profitFactor || 0);
                                        const wrNum = Number(item.winRate || 0);
                                        const pnlNum = Number(item.totalPnlPercent || 0);

                                        return (
                                            <tr
                                                key={item.rank || index}
                                                className={`transition hover:bg-gray-800/50 ${
                                                    isApplied ? 'bg-amber-500/10 hover:bg-amber-500/15' : ''
                                                }`}
                                            >
                                                {/* # Rank */}
                                                <td className="py-3 px-3.5 text-center font-mono">
                                                    {item.rank === 1 ? (
                                                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold shadow-sm shadow-amber-500/20">
                                                            🥇 #1
                                                        </span>
                                                    ) : item.rank === 2 ? (
                                                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-slate-400/20 text-slate-200 border border-slate-400/50 font-bold">
                                                            🥈 #2
                                                        </span>
                                                    ) : item.rank === 3 ? (
                                                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-amber-700/20 text-amber-400 border border-amber-700/50 font-bold">
                                                            🥉 #3
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 font-semibold">
                                                            #{item.rank}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Parameters */}
                                                <td className="py-3 px-3.5">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        {typeof currentStrategy?.renderLeaderboardBadges === 'function' ? (
                                                            currentStrategy.renderLeaderboardBadges(item)
                                                        ) : (
                                                            <span className="text-gray-400 font-mono text-[11px]">
                                                                Config #{item.rank}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Profit Factor */}
                                                <td className="py-3 px-3 text-center">
                                                    <span
                                                        className={`inline-block px-2.5 py-1 rounded-lg font-mono font-bold text-xs border ${
                                                            pfNum >= 2.0
                                                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                                                                : pfNum >= 1.3
                                                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                                                : pfNum >= 1.0
                                                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                                                : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                                        }`}
                                                    >
                                                        {pfNum.toFixed(2)}
                                                    </span>
                                                </td>

                                                {/* Win Rate */}
                                                <td className="py-3 px-3">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="font-mono font-bold text-gray-200">
                                                            {wrNum.toFixed(1)}%
                                                        </span>
                                                        <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden flex">
                                                            <div
                                                                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                                                                style={{ width: `${Math.min(wrNum, 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[10px] text-gray-400 font-mono">
                                                            {item.winTrades}W / {item.lossTrades}L
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Total Trades */}
                                                <td className="py-3 px-3 text-center font-mono font-semibold text-gray-200">
                                                    {item.totalTrades}
                                                </td>

                                                {/* Total PnL (%) */}
                                                <td className="py-3 px-3 text-right font-mono font-bold">
                                                    <span className={pnlNum >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                                        {pnlNum > 0 ? '+' : ''}{pnlNum.toFixed(2)}%
                                                    </span>
                                                </td>

                                                {/* Gross Profit / Loss */}
                                                <td className="py-3 px-3 text-right font-mono text-[11px] text-gray-400">
                                                    <div className="text-emerald-400">+{Number(item.grossProfit || 0).toFixed(2)}%</div>
                                                    <div className="text-rose-400">-{Number(item.grossLoss || 0).toFixed(2)}%</div>
                                                </td>

                                                {/* Action Button */}
                                                <td className="py-3 px-3.5 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => onApplyConfig(item)}
                                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 w-full cursor-pointer shadow-sm ${
                                                            isApplied
                                                                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50'
                                                                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-amber-500/25 active:scale-95'
                                                        }`}
                                                    >
                                                        {isApplied ? (
                                                            <>
                                                                <Check size={13} className="text-emerald-400" />
                                                                <span>Đang dùng</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Sparkles size={13} />
                                                                <span>Áp dụng</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="p-3.5 sm:p-4 bg-gray-950/80 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                        <span>Bấm <b>"Áp dụng"</b> để nạp bộ tham số vào form chiến lược &amp; chạy quét kiểm tra trên biểu đồ.</span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OptimizationLeaderboardModal;
