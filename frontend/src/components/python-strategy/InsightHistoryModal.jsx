import React from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, X, RefreshCw, ExternalLink, Check } from 'lucide-react';
import { formatNumber } from '../../utils/formatNumber';
import dayjs from 'dayjs';

const InsightHistoryModal = ({
    isOpen,
    onClose,
    selectedSymbol,
    loadingInsightStats,
    savedInsightsList = [],
    symbolInsightStats,
    onSelectInsightItem
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900/90">
                    <div className="flex items-center gap-2">
                        <Bookmark size={18} className="text-cyan-400" />
                        <h3 className="text-sm font-bold text-gray-100">
                            Lịch sử Insight đã lưu ({selectedSymbol})
                        </h3>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 font-mono">
                            {savedInsightsList.length} bản ghi
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-4 overflow-y-auto space-y-3 divide-y divide-gray-700/60 custom-scrollbar">
                    {loadingInsightStats ? (
                        <div className="py-12 flex flex-col items-center justify-center space-y-3 text-gray-400">
                            <RefreshCw size={28} className="animate-spin text-cyan-400" />
                            <span className="text-xs">Đang tải danh sách Insight đã lưu...</span>
                        </div>
                    ) : savedInsightsList.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 text-xs space-y-3">
                            <p className="font-semibold text-gray-300">Chưa có bản ghi Insight nào được lưu cho mã {selectedSymbol}.</p>
                            <p className="text-gray-500">Bạn có thể sang trang Strategy Insight để phân tích thống kê và bấm Lưu Insight.</p>
                            <div className="pt-2">
                                <Link
                                    to={`/strategy-insight?symbol=${encodeURIComponent(selectedSymbol || '')}`}
                                    onClick={onClose}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition shadow-md shadow-cyan-900/30"
                                >
                                    <span>Tới trang Strategy Insight</span>
                                    <ExternalLink size={13} />
                                </Link>
                            </div>
                        </div>
                    ) : (
                        savedInsightsList.map((item) => {
                            const itemId = item.documentId || item.id;
                            const isCurrentSelected = symbolInsightStats && (String(symbolInsightStats.documentId || symbolInsightStats.id) === String(itemId));

                            return (
                                <div
                                    key={itemId}
                                    className={`pt-3 first:pt-0 flex flex-col gap-2.5 p-3 rounded-xl transition border ${
                                        isCurrentSelected
                                            ? 'bg-cyan-950/30 border-cyan-500/60 ring-1 ring-cyan-500/40'
                                            : 'bg-gray-900/50 hover:bg-gray-900/90 border-gray-700/70 hover:border-gray-600'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-sky-300 truncate">
                                                    {item.title || `${selectedSymbol} - ${item.startDate} ~ ${item.endDate}`}
                                                </span>
                                                {isCurrentSelected && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shrink-0">
                                                        Đang áp dụng
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-gray-400 flex flex-wrap items-center gap-2 mt-1 font-mono">
                                                <span>Lưu lúc: {dayjs(item.savedAt || item.createdAt).format('DD/MM/YYYY HH:mm')}</span>
                                                <span>•</span>
                                                <span className="text-amber-400 font-bold">{item.timeframe || 'D1'}</span>
                                                <span>•</span>
                                                <span>{item.totalCandles || 0} nến</span>
                                                {item.startDate && (
                                                    <>
                                                        <span>•</span>
                                                        <span>({item.startDate} ~ {item.endDate})</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => onSelectInsightItem(item)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm ${
                                                isCurrentSelected
                                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
                                                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/25'
                                            }`}
                                        >
                                            <Check size={13} />
                                            <span>{isCurrentSelected ? 'Đã chọn' : 'Chọn bản ghi'}</span>
                                        </button>
                                    </div>

                                    {/* Summary metrics card trong Modal */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-gray-950/80 p-2.5 rounded-xl border border-gray-800">
                                        <div>
                                            <span className="text-gray-500 block text-[10px]">Spread P50 (Trung vị)</span>
                                            <span className="font-mono text-sky-300 font-bold">
                                                {formatNumber(item.spreadMedianPrice)} ({Number(item.spreadMedianPercent || 0).toFixed(2)}%)
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 block text-[10px]">Spread Rộng (P75)</span>
                                            <span className="font-mono text-cyan-300 font-bold">
                                                {formatNumber(item.spreadP75Price)} ({Number(item.spreadP75Percent || 0).toFixed(2)}%)
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 block text-[10px]">Giờ Tăng mạnh</span>
                                            <span className="text-emerald-400 font-semibold truncate block">
                                                {item.bestBullHour || 'N/A'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 block text-[10px]">Ngày Tăng tốt</span>
                                            <span className="text-emerald-400 font-semibold truncate block">
                                                {item.bestBullDay || 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Modal Footer */}
                <div className="p-3 bg-gray-900 border-t border-gray-700 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-semibold rounded-xl transition cursor-pointer"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InsightHistoryModal;
