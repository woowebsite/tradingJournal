import React, { useMemo } from 'react';
import {
    BookmarkPlus,
    X,
    RefreshCw,
    Save,
    BarChart3,
    TrendingUp,
    TrendingDown,
    Target,
    Activity,
    Award,
    Sparkles
} from 'lucide-react';

const SaveTemplateModal = ({
    isOpen,
    onClose,
    onSave,
    saving,
    templateNameInput,
    setTemplateNameInput,
    templateDescInput,
    setTemplateDescInput,
    overwriteTemplateId,
    onModalSelectTemplate,
    symbolTemplates = [],
    selectedSymbol,
    selectedStrategyFile,
    timeframe,
    currentStrategy,
    params,
    scanResult,
    profitFactor
}) => {
    const summaryText = typeof currentStrategy?.generateDescription === 'function'
        ? currentStrategy.generateDescription(params)
        : '';

    // 1. Current backtest metrics from active scan session
    const currentMetrics = useMemo(() => {
        if (!scanResult?.summary) return null;
        const s = scanResult.summary;
        return {
            profitFactor: profitFactor !== undefined && profitFactor !== null ? profitFactor : (s.profitFactor ?? 'N/A'),
            winRate: s.winRate ?? 0,
            totalTrades: s.totalTrades ?? 0,
            closedTrades: s.closedTrades ?? 0,
            winTrades: s.winTrades ?? 0,
            lossTrades: s.lossTrades ?? 0,
            totalPnlPercent: s.totalPnlPercent ?? 0,
            avgPnlPercent: s.avgPnlPercent ?? 0,
            source: 'current'
        };
    }, [scanResult, profitFactor]);

    // 2. Saved metrics of the template being overwritten (if any)
    const targetTemplate = useMemo(() => {
        if (!overwriteTemplateId || overwriteTemplateId === '__NEW__') return null;
        return symbolTemplates.find(t => String(t.id || t.documentId) === String(overwriteTemplateId)) || null;
    }, [overwriteTemplateId, symbolTemplates]);

    const targetSavedMetrics = useMemo(() => {
        const m = targetTemplate?.config?.metrics || targetTemplate?.config?.backtestSummary;
        if (!m) return null;
        return {
            ...m,
            source: 'saved'
        };
    }, [targetTemplate]);

    // Active metrics to display (priority: current scan > saved template metrics)
    const activeMetrics = currentMetrics || targetSavedMetrics;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-700 pb-3">
                    <div className="flex items-center gap-2">
                        <BookmarkPlus size={20} className="text-cyan-400" />
                        <h3 className="text-base font-bold text-gray-100">Lưu Strategy Template</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-200 p-1 rounded-lg transition cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={onSave} className="space-y-4">
                    {/* Dropdown: Chọn Template để ghi đè hoặc tạo mới */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                            <span>Chọn Template ghi đè hoặc tạo mới:</span>
                            {overwriteTemplateId && overwriteTemplateId !== '__NEW__' ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                                    Chế độ: Ghi đè
                                </span>
                            ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                                    Chế độ: Tạo mới
                                </span>
                            )}
                        </label>
                        <select
                            value={overwriteTemplateId || '__NEW__'}
                            onChange={(e) => onModalSelectTemplate(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-3 py-2.5 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition cursor-pointer font-medium"
                        >
                            <option value="__NEW__">✨ [+ Tạo Template Mới Cho {selectedSymbol}]</option>
                            {symbolTemplates.map(tpl => {
                                const tplId = String(tpl.id || tpl.documentId);
                                const m = tpl.config?.metrics || tpl.config?.backtestSummary;
                                const metricsStr = m
                                    ? ` | WR: ${m.winRate}% • PF: ${m.profitFactor} • PnL: ${Number(m.totalPnlPercent) > 0 ? '+' : ''}${m.totalPnlPercent}%`
                                    : '';
                                return (
                                    <option key={tplId} value={tplId}>
                                        🔄 Ghi đè: {tpl.name} ({tpl.timeframe || 'D1'}{metricsStr})
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {/* Tên Template Input */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                            <span>Tên Template *</span>
                            <span className="text-[11px] text-gray-500 font-normal">Có thể chỉnh sửa</span>
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Nhập tên template..."
                            value={templateNameInput}
                            onChange={(e) => setTemplateNameInput(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                            autoFocus
                        />
                    </div>

                    {/* Mô tả tùy chọn */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-300">Mô tả (tùy chọn)</label>
                        <textarea
                            rows={2}
                            placeholder="Ghi chú về thiết lập tham số hoặc thị trường áp dụng..."
                            value={templateDescInput}
                            onChange={(e) => setTemplateDescInput(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                    </div>

                    {/* Kết quả Backtest kèm theo */}
                    <div className="bg-gray-900/90 border border-gray-700/80 rounded-xl p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                                <BarChart3 size={15} className="text-cyan-400" />
                                Kết quả Backtest lưu kèm:
                            </span>
                            {currentMetrics ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                                    <Sparkles size={10} /> Backtest hiện tại
                                </span>
                            ) : targetSavedMetrics ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-medium">
                                    Đã lưu trước đó
                                </span>
                            ) : (
                                <span className="text-[10px] text-gray-500 italic">
                                    Chưa chạy scan
                                </span>
                            )}
                        </div>

                        {activeMetrics ? (
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {/* 1. Profit Factor */}
                                    <div className="bg-gray-800/90 border border-gray-700/70 rounded-lg p-2.5 text-center flex flex-col justify-between">
                                        <div className="text-[10px] text-gray-400 font-medium flex items-center justify-center gap-1">
                                            <Award size={11} className="text-amber-400" />
                                            Profit Factor
                                        </div>
                                        <div className={`text-base font-bold my-0.5 ${
                                            activeMetrics.profitFactor === '∞' || parseFloat(activeMetrics.profitFactor) >= 1.5
                                                ? 'text-emerald-400'
                                                : parseFloat(activeMetrics.profitFactor) >= 1.0
                                                    ? 'text-sky-400'
                                                    : 'text-rose-400'
                                        }`}>
                                            {activeMetrics.profitFactor}
                                        </div>
                                        <div className="text-[9px] text-gray-400">Lãi / Lỗ</div>
                                    </div>

                                    {/* 2. Tổng số trade */}
                                    <div className="bg-gray-800/90 border border-gray-700/70 rounded-lg p-2.5 text-center flex flex-col justify-between">
                                        <div className="text-[10px] text-gray-400 font-medium flex items-center justify-center gap-1">
                                            <Activity size={11} className="text-cyan-400" />
                                            Tổng số Trade
                                        </div>
                                        <div className="text-base font-bold text-gray-100 my-0.5">
                                            {activeMetrics.totalTrades}
                                        </div>
                                        <div className="text-[9px] text-gray-400">
                                            {activeMetrics.closedTrades} đóng
                                        </div>
                                    </div>

                                    {/* 3. Win Rate */}
                                    <div className="bg-gray-800/90 border border-gray-700/70 rounded-lg p-2.5 text-center flex flex-col justify-between">
                                        <div className="text-[10px] text-gray-400 font-medium flex items-center justify-center gap-1">
                                            <Target size={11} className="text-emerald-400" />
                                            Winrate
                                        </div>
                                        <div className={`text-base font-bold my-0.5 ${
                                            Number(activeMetrics.winRate) >= 50 ? 'text-emerald-400' : 'text-amber-400'
                                        }`}>
                                            {activeMetrics.winRate}%
                                        </div>
                                        <div className="text-[9px] text-gray-400">
                                            {activeMetrics.winTrades} TP / {activeMetrics.lossTrades} SL
                                        </div>
                                    </div>

                                    {/* 4. Total PnL */}
                                    <div className="bg-gray-800/90 border border-gray-700/70 rounded-lg p-2.5 text-center flex flex-col justify-between">
                                        <div className="text-[10px] text-gray-400 font-medium flex items-center justify-center gap-1">
                                            {Number(activeMetrics.totalPnlPercent) >= 0 ? (
                                                <TrendingUp size={11} className="text-emerald-400" />
                                            ) : (
                                                <TrendingDown size={11} className="text-rose-400" />
                                            )}
                                            Tổng PnL
                                        </div>
                                        <div className={`text-base font-bold my-0.5 ${
                                            Number(activeMetrics.totalPnlPercent) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                        }`}>
                                            {Number(activeMetrics.totalPnlPercent) > 0
                                                ? `+${activeMetrics.totalPnlPercent}%`
                                                : `${activeMetrics.totalPnlPercent}%`}
                                        </div>
                                        <div className="text-[9px] text-gray-400">Lợi nhuận</div>
                                    </div>
                                </div>

                                {currentMetrics && targetSavedMetrics && (
                                    <div className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1 flex items-center justify-between">
                                        <span>Chỉ số cũ của template:</span>
                                        <span className="font-mono text-[10px]">
                                            WR: {targetSavedMetrics.winRate}% • PF: {targetSavedMetrics.profitFactor} • PnL: {Number(targetSavedMetrics.totalPnlPercent) > 0 ? '+' : ''}{targetSavedMetrics.totalPnlPercent}%
                                        </span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-xs text-gray-400 italic bg-gray-800/50 rounded-lg p-2.5 border border-gray-700/40 text-center">
                                Chưa có kết quả backtest từ phiên scan này. Template sẽ lưu các giá trị tham số hiện tại.
                            </div>
                        )}
                    </div>

                    {/* Meta info info card */}
                    <div className="bg-gray-900/80 rounded-xl p-3 border border-gray-700/50 space-y-1 text-xs text-gray-400">
                        <div className="flex justify-between">
                            <span>Symbol:</span>
                            <span className="text-emerald-400 font-bold font-mono">{selectedSymbol}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Chiến lược:</span>
                            <span className="text-gray-200 font-semibold">{selectedStrategyFile}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Timeframe:</span>
                            <span className="text-amber-400 font-semibold">{timeframe}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Cấu hình:</span>
                            <span className="text-gray-300 font-mono text-[11px] truncate max-w-[260px]">
                                {summaryText}
                            </span>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-2.5 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-sm font-semibold transition cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !templateNameInput.trim()}
                            className={`px-5 py-2 text-white rounded-xl text-sm font-bold shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer ${
                                overwriteTemplateId && overwriteTemplateId !== '__NEW__'
                                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/25'
                                    : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-500/25'
                            }`}
                        >
                            {saving ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin" />
                                    <span>Đang lưu...</span>
                                </>
                            ) : overwriteTemplateId && overwriteTemplateId !== '__NEW__' ? (
                                <>
                                    <RefreshCw size={14} />
                                    <span>Ghi đè Template</span>
                                </>
                            ) : (
                                <>
                                    <Save size={14} />
                                    <span>Lưu Template Mới</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SaveTemplateModal;
