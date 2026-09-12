import React from 'react';
import { BookmarkPlus, X, RefreshCw, Save } from 'lucide-react';

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
    symbolTemplates,
    selectedSymbol,
    selectedStrategyFile,
    timeframe,
    currentStrategy,
    params
}) => {
    if (!isOpen) return null;

    const summaryText = typeof currentStrategy?.generateDescription === 'function'
        ? currentStrategy.generateDescription(params)
        : '';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
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
                                return (
                                    <option key={tplId} value={tplId}>
                                        🔄 Ghi đè: {tpl.name} ({tpl.timeframe || 'D1'})
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
                            <span className="text-gray-300 font-mono text-[11px] truncate max-w-[210px]">
                                {summaryText}
                            </span>
                        </div>
                    </div>

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
