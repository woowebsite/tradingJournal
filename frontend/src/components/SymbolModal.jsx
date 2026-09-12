import React, { useState, useEffect, useMemo } from 'react';
import { Save, X, Tag, Edit2, Plus, BrainCircuit, AlertCircle } from 'lucide-react';

const DEFAULT_FORM = {
    Name: '',
    Description: '',
    exchange: '',
    sector: '',
    market: '',
    strategy_template: ''
};

const SymbolModal = ({
    isOpen,
    onClose,
    onSubmit,
    symbol = null,
    templates = [],
    markets = [],
    defaultMarketId = '',
    existingSymbols = [],
    isSubmitting = false
}) => {
    const isEditMode = Boolean(symbol);
    const [formData, setFormData] = useState(DEFAULT_FORM);
    const [error, setError] = useState('');

    const currentSymName = String(
        symbol?.Name || symbol?.name || formData.Name || ''
    ).replace(/:(HOSE|HNX|UPCOM)$/i, '').trim().toUpperCase();

    // Only display templates belonging to the current symbol
    const filteredTemplates = useMemo(() => {
        if (!templates || templates.length === 0) return [];
        if (!currentSymName) return isEditMode ? [] : templates;

        const assignedId = String(
            symbol?.strategy_template?.documentId ||
            symbol?.strategy_template?.id ||
            symbol?.strategy_template ||
            formData.strategy_template ||
            ''
        );

        return templates.filter(tpl => {
            const tplSym = String(tpl.symbolName || tpl.symbol?.Name || tpl.symbol?.name || '').trim().toUpperCase();
            const tplId = String(tpl.documentId || tpl.id);
            return tplSym === currentSymName || (assignedId && assignedId === tplId);
        });
    }, [templates, currentSymName, symbol, formData.strategy_template, isEditMode]);

    useEffect(() => {
        if (isOpen) {
            if (symbol) {
                const assigned = symbol.strategy_template;
                const assignedId = assigned?.documentId || assigned?.id || (typeof assigned === 'string' || typeof assigned === 'number' ? assigned : '');
                const symMarketId = symbol.market?.documentId || symbol.market?.id || (typeof symbol.market === 'string' || typeof symbol.market === 'number' ? symbol.market : '');
                setFormData({
                    Name: symbol.Name || '',
                    Description: symbol.Description || '',
                    exchange: symbol.exchange || '',
                    sector: symbol.sector || '',
                    market: symMarketId ? String(symMarketId) : (defaultMarketId ? String(defaultMarketId) : ''),
                    strategy_template: assignedId ? String(assignedId) : ''
                });
            } else {
                setFormData({
                    ...DEFAULT_FORM,
                    market: defaultMarketId ? String(defaultMarketId) : ''
                });
            }
            setError('');
        }
    }, [isOpen, symbol, defaultMarketId]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (error) setError('');
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();

        const cleanName = (name) => name.replace(/:(HOSE|HNX|UPCOM)$/i, '').trim().toUpperCase();
        const baseInput = cleanName(formData.Name || '');

        if (!baseInput) {
            setError('Vui lòng nhập tên Symbol.');
            return;
        }

        const editingId = symbol?.documentId || symbol?.id;
        const isDuplicate = existingSymbols.some(s => {
            const symId = s.documentId || s.id;
            if (editingId && symId === editingId) return false;
            return cleanName(s.Name || '') === baseInput;
        });

        if (isDuplicate) {
            setError(`Symbol "${baseInput}" (hoặc tiền tố tương tự) đã tồn tại trong thị trường này.`);
            return;
        }

        const payload = {
            Name: formData.Name.trim(),
            Description: formData.Description ? formData.Description.trim() : '',
            exchange: formData.exchange ? formData.exchange.trim().toUpperCase() : '',
            sector: formData.sector ? formData.sector.trim() : '',
            market: formData.market ? formData.market : null,
            strategy_template: formData.strategy_template ? formData.strategy_template : null
        };

        onSubmit?.(payload, editingId);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 shadow-2xl flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-gray-700 bg-gray-900/60 px-6 py-4">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            {isEditMode ? <Edit2 size={20} /> : <Plus size={20} />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">
                                {isEditMode ? `Edit Symbol: ${symbol.Name}` : 'Create New Symbol'}
                            </h3>
                            <p className="text-xs text-gray-400">
                                {isEditMode ? 'Cập nhật thông tin và template chiến lược cho symbol' : 'Thêm symbol mới vào danh mục theo dõi'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-700/50 transition cursor-pointer"
                        title="Đóng"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Body / Form */}
                <form onSubmit={handleFormSubmit} className="p-6 space-y-4 overflow-y-auto">
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-900/40 border border-red-500/50 rounded-lg text-red-200 text-sm">
                            <AlertCircle size={18} className="text-red-400 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Name */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Symbol Name <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                name="Name"
                                value={formData.Name}
                                onChange={handleChange}
                                required
                                placeholder="e.g. VCB, BTCUSD, SSI:HOSE"
                                className="w-full bg-gray-900/60 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                            />
                        </div>

                        {/* Market */}
                        {markets && markets.length > 0 && (
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Market (Thị trường)
                                </label>
                                <select
                                    name="market"
                                    value={formData.market}
                                    onChange={handleChange}
                                    className="w-full bg-gray-900/60 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition cursor-pointer"
                                >
                                    <option value="">-- Mặc định theo tài khoản --</option>
                                    {markets.map(m => {
                                        const mId = m.documentId || m.id;
                                        const mName = m.Name || m.name || 'Unknown Market';
                                        return (
                                            <option key={mId} value={mId}>
                                                {mName}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        )}

                        {/* Exchange */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Exchange
                            </label>
                            <input
                                type="text"
                                name="exchange"
                                value={formData.exchange}
                                onChange={handleChange}
                                placeholder="e.g. HOSE, HNX, BINANCE"
                                className="w-full bg-gray-900/60 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                            />
                        </div>

                        {/* Sector */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Sector (Industry)
                            </label>
                            <input
                                type="text"
                                name="sector"
                                value={formData.sector}
                                onChange={handleChange}
                                placeholder="e.g. Banks, Real Estate"
                                className="w-full bg-gray-900/60 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                            />
                        </div>

                        {/* Strategy Template Dropdown */}
                        <div className="md:col-span-2">
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm font-medium text-gray-300 flex items-center gap-1.5">
                                    <BrainCircuit size={16} className="text-purple-400" />
                                    Python Strategy Template {currentSymName ? `(${currentSymName})` : ''}
                                </label>
                                {filteredTemplates.length > 0 && (
                                    <span className="text-[11px] text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded-full border border-purple-500/30">
                                        {filteredTemplates.length} templates của {currentSymName}
                                    </span>
                                )}
                            </div>
                            <select
                                name="strategy_template"
                                value={formData.strategy_template}
                                onChange={handleChange}
                                className="w-full bg-gray-900/60 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition cursor-pointer"
                            >
                                <option value="">
                                    {filteredTemplates.length > 0
                                        ? `-- Không gán Strategy Template (${filteredTemplates.length}) --`
                                        : `-- Chưa có Strategy Template cho ${currentSymName || 'Symbol'} --`}
                                </option>
                                {filteredTemplates.map(tpl => {
                                    const tplId = tpl.documentId || tpl.id;
                                    const m = tpl.config?.metrics || tpl.config?.backtestSummary;
                                    const metricsStr = m
                                        ? ` | WR: ${m.winRate}% • PF: ${m.profitFactor} • PnL: ${Number(m.totalPnlPercent) > 0 ? '+' : ''}${m.totalPnlPercent}%`
                                        : '';
                                    return (
                                        <option key={tplId} value={tplId}>
                                            {tpl.name} [{tpl.timeframe || 'D1'}{metricsStr}]
                                        </option>
                                    );
                                })}
                            </select>
                            <p className="text-xs text-gray-400 mt-1.5">
                                {filteredTemplates.length > 0
                                    ? 'Template này sẽ tự động được chọn khi bạn mở symbol trên Trade Station.'
                                    : `Chưa có template nào được lưu riêng cho ${currentSymName || 'symbol này'}. Bạn có thể tạo template tại trang Python Strategy.`}
                            </p>
                        </div>

                        {/* Description */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Description
                            </label>
                            <textarea
                                name="Description"
                                value={formData.Description}
                                onChange={handleChange}
                                rows="3"
                                placeholder="Mô tả bổ sung về symbol này..."
                                className="w-full bg-gray-900/60 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition resize-none"
                            />
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-medium transition cursor-pointer disabled:opacity-50"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg font-medium shadow-lg shadow-purple-500/25 transition cursor-pointer disabled:opacity-50"
                        >
                            <Save size={18} />
                            {isSubmitting ? 'Đang lưu...' : (isEditMode ? 'Cập nhật Symbol' : 'Lưu Symbol')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SymbolModal;
