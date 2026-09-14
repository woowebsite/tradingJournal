import React, { useState, useMemo } from 'react';
import useEscapeKey from '../../hooks/useEscapeKey';
import {
    BookmarkCheck,
    X,
    Search,
    Trash2,
    Check,
    Clock,
    Award,
    Target,
    Activity,
    TrendingUp,
    TrendingDown,
    Layers,
    Filter,
    ArrowUpDown,
    ExternalLink,
    Tag,
    Star,
    Loader2
} from 'lucide-react';

const getStrategyDisplayName = (stratFile = '') => {
    const s = String(stratFile || '').toLowerCase();
    if (s.includes('breakout')) return 'Breakout ST & VWAP';
    if (s.includes('ma288')) return 'Supertrend & MA288';
    if (s.includes('vwap_ma9') || (s.includes('vwap') && s.includes('ma9'))) return 'VWAP & MA9';
    if (s.includes('priceaction') || s.includes('price_action')) return 'Supertrend Price Action';
    if (s.includes('ichimoku')) return 'Ichimoku Cloud';
    return stratFile.replace('strategy_', '').replace('.py', '') || 'Python Strategy';
};

const formatParamBadges = (config = {}) => {
    const badges = [];
    if (config.entrySetup) {
        const setupMap = {
            'setup1': 'Setup 1 (Vượt đỉnh)',
            'setup2': 'Setup 2 (Phá đáy)',
            'both': 'Cả 2 Setup'
        };
        badges.push({ label: 'Entry', val: setupMap[config.entrySetup] || config.entrySetup, color: 'border-blue-500/30 text-blue-300 bg-blue-500/10' });
    }
    if (config.slType) {
        const slMap = {
            'current_bar': 'SL: Đáy/Đỉnh nến hiện tại',
            'prev_bar': 'SL: Đáy/Đỉnh nến hôm trước',
            'P25': 'SL: Spread P25',
            'P50': 'SL: Spread P50',
            'P75': 'SL: Spread P75',
            'P90': 'SL: Spread P90',
            'P99': 'SL: Spread P99',
            'CUSTOM': `SL: Spread ${config.slSpreadVal || ''}p`
        };
        badges.push({ label: 'Stop Loss', val: slMap[config.slType] || config.slType, color: 'border-rose-500/30 text-rose-300 bg-rose-500/10' });
    }
    if (config.tpType) {
        const tpMap = {
            'RR': `TP: RR ${config.riskRewardRatio || 1.5}`,
            'close_current': 'TP: Close ngày hiện tại',
            'close_next': 'TP: Close ngày hôm sau'
        };
        badges.push({ label: 'Take Profit', val: tpMap[config.tpType] || config.tpType, color: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10' });
    }
    if (config.vwapAnchor) {
        badges.push({ label: 'VWAP', val: `Anchor: ${config.vwapAnchor}`, color: 'border-sky-500/30 text-sky-300 bg-sky-500/10' });
    }
    if (config.stPeriod || config.stMultiplier) {
        badges.push({ label: 'ST', val: `ST (${config.stPeriod || 10}, ${config.stMultiplier || 3.0})`, color: 'border-amber-500/30 text-amber-300 bg-amber-500/10' });
    }
    if (config.maPeriod) {
        badges.push({ label: 'MA', val: `MA: ${config.maPeriod}`, color: 'border-purple-500/30 text-purple-300 bg-purple-500/10' });
    }
    if (config.indicatorFilter) {
        const filterMap = {
            'none': 'Không lọc trend',
            'supertrend': 'Trend ST',
            'vwap': 'Trend VWAP',
            'both': 'Trend ST + VWAP'
        };
        badges.push({ label: 'Lọc Trend', val: filterMap[config.indicatorFilter] || config.indicatorFilter, color: 'border-teal-500/30 text-teal-300 bg-teal-500/10' });
    }
    return badges;
};

const StrategyTemplatesListModal = ({
    isOpen,
    onClose,
    templates = [],
    selectedTemplateId,
    defaultTemplateId,
    selectedSymbol = '',
    onApplyTemplate,
    onSetDefaultTemplate,
    onDeleteTemplate
}) => {
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('updatedAt'); // 'updatedAt', 'winRate', 'profitFactor', 'pnl', 'trades', 'name'
    const [sortDir, setSortDir] = useState('desc'); // 'asc', 'desc'
    const [localDefaultId, setLocalDefaultId] = useState(defaultTemplateId || null);
    const [settingDefaultId, setSettingDefaultId] = useState(null);

    // Đồng bộ localDefaultId khi defaultTemplateId từ prop thay đổi
    React.useEffect(() => {
        if (defaultTemplateId) {
            setLocalDefaultId(defaultTemplateId);
        }
    }, [defaultTemplateId]);

    const handleSetDefault = async (tpl) => {
        if (!tpl) return;
        const tplDocId = String(tpl.documentId || tpl.id || '');
        setLocalDefaultId(tplDocId); // Optimistic UI update tức thì
        setSettingDefaultId(tplDocId);
        try {
            await onSetDefaultTemplate?.(tpl);
        } finally {
            setSettingDefaultId(null);
        }
    };

    const cleanSelectedSymbol = String(
        typeof selectedSymbol === 'object' && selectedSymbol !== null
            ? (selectedSymbol.Name || selectedSymbol.name || '')
            : (selectedSymbol || '')
    ).trim().toUpperCase();

    // Strictly filter templates belonging to selectedSymbol
    const symbolTemplates = useMemo(() => {
        if (!templates || templates.length === 0 || !cleanSelectedSymbol) return [];
        return templates.filter(tpl => {
            const sym = String(tpl.symbolName || tpl.symbol?.Name || tpl.symbol?.name || '').trim().toUpperCase();
            return sym === cleanSelectedSymbol;
        });
    }, [templates, cleanSelectedSymbol]);

    // Filter & Sort logic
    const filteredTemplates = useMemo(() => {
        let list = [...symbolTemplates];

        // Search query
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(tpl => {
                const name = String(tpl.name || '').toLowerCase();
                const desc = String(tpl.description || '').toLowerCase();
                const strat = String(tpl.strategyFile || '').toLowerCase();
                const tf = String(tpl.timeframe || '').toLowerCase();
                return name.includes(q) || desc.includes(q) || strat.includes(q) || tf.includes(q);
            });
        }

        // Sort
        list.sort((a, b) => {
            const ma = a.config?.metrics || a.config?.backtestSummary || {};
            const mb = b.config?.metrics || b.config?.backtestSummary || {};

            let valA, valB;
            if (sortBy === 'winRate') {
                valA = Number(ma.winRate || 0);
                valB = Number(mb.winRate || 0);
            } else if (sortBy === 'profitFactor') {
                valA = ma.profitFactor === '∞' ? 9999 : Number(ma.profitFactor || 0);
                valB = mb.profitFactor === '∞' ? 9999 : Number(mb.profitFactor || 0);
            } else if (sortBy === 'pnl') {
                valA = Number(ma.totalPnlPercent || 0);
                valB = Number(mb.totalPnlPercent || 0);
            } else if (sortBy === 'trades') {
                valA = Number(ma.totalTrades || 0);
                valB = Number(mb.totalTrades || 0);
            } else if (sortBy === 'name') {
                valA = String(a.name || '').toLowerCase();
                valB = String(b.name || '').toLowerCase();
                return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else {
                // updatedAt
                valA = new Date(a.updatedAt || a.createdAt || 0).getTime();
                valB = new Date(b.updatedAt || b.createdAt || 0).getTime();
            }

            return sortDir === 'asc' ? valA - valB : valB - valA;
        });

        return list;
    }, [symbolTemplates, search, sortBy, sortDir]);

    useEscapeKey(onClose, isOpen);

    if (!isOpen) return null;

    const isDefaultTemplate = (tpl) => {
        const tplDocId = String(tpl.documentId || tpl.id || '');
        if (localDefaultId && String(localDefaultId) === tplDocId) return true;
        if (defaultTemplateId && String(defaultTemplateId) === tplDocId) return true;
        return Boolean(tpl.isDefault);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose?.();
            }}
        >
            <div className="bg-gray-800 border border-gray-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* 1. Header */}
                <div className="p-4 sm:p-5 border-b border-gray-700/80 flex items-center justify-between bg-gray-900/60 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                            <BookmarkCheck size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base sm:text-lg font-bold text-gray-100">
                                    Strategy Templates {cleanSelectedSymbol ? `(${cleanSelectedSymbol})` : ''}
                                </h3>
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30 font-mono">
                                    {symbolTemplates.length} Templates
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                                Danh sách cấu hình chiến lược và kết quả Backtest đã lưu của <b className="text-emerald-400 font-mono">{cleanSelectedSymbol}</b>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-200 p-1.5 rounded-xl hover:bg-gray-700/50 transition cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 2. Filter & Controls Bar */}
                <div className="p-3 sm:p-4 bg-gray-900/40 border-b border-gray-700/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    {/* Symbol Badge */}
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400 font-medium">Symbol:</span>
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono font-bold">
                            {cleanSelectedSymbol || 'Chưa chọn'}
                        </span>
                    </div>

                    {/* Search & Sort Controls */}
                    <div className="flex flex-1 sm:flex-initial items-center gap-2 min-w-[240px]">
                        <div className="relative flex-1 sm:w-64">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder={`Tìm template của ${cleanSelectedSymbol}...`}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-medium"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        {/* Sort Dropdown */}
                        <div className="flex items-center gap-1">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="bg-gray-900 border border-gray-700 rounded-xl px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer font-medium"
                            >
                                <option value="updatedAt">Mới nhất</option>
                                <option value="winRate">Winrate</option>
                                <option value="profitFactor">Profit Factor</option>
                                <option value="pnl">Tổng PnL</option>
                                <option value="trades">Tổng Trade</option>
                                <option value="name">Tên A-Z</option>
                            </select>
                            <button
                                type="button"
                                onClick={() => setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')}
                                title={sortDir === 'asc' ? 'Tăng dần' : 'Giảm dần'}
                                className="p-1.5 bg-gray-900 border border-gray-700 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition cursor-pointer"
                            >
                                <ArrowUpDown size={14} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* 3. Templates List */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 divide-y divide-transparent">
                    {filteredTemplates.length > 0 ? (
                        filteredTemplates.map(tpl => {
                            const tplId = String(tpl.id || tpl.documentId);
                            const isSelected = String(selectedTemplateId) === tplId;
                            const isDefault = isDefaultTemplate(tpl);
                            const symName = String(tpl.symbolName || tpl.symbol?.Name || tpl.symbol?.name || '').trim().toUpperCase();
                            const stratName = getStrategyDisplayName(tpl.strategyFile);
                            const m = tpl.config?.metrics || tpl.config?.backtestSummary;
                            const paramBadges = formatParamBadges(tpl.config);

                            return (
                                <div
                                    key={tplId}
                                    className={`rounded-2xl border transition-all p-4 space-y-3 shadow-md ${
                                        isSelected
                                            ? 'bg-cyan-950/30 border-cyan-500/60 ring-1 ring-cyan-500/40'
                                            : isDefault
                                                ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-500/60'
                                                : 'bg-gray-900/70 border-gray-700/60 hover:border-gray-600 hover:bg-gray-900/90'
                                    }`}
                                >
                                    {/* Top Line: Template Name, Badges & Actions */}
                                    <div className="flex flex-wrap items-start justify-between gap-2.5">
                                        <div className="space-y-1 flex-1 min-w-[220px]">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h4 className="text-sm sm:text-base font-bold text-gray-100">
                                                    {tpl.name}
                                                </h4>
                                                {isDefault && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1">
                                                        <Star size={10} className="fill-amber-400 text-amber-400" /> Mặc định
                                                    </span>
                                                )}
                                                {isSelected && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold flex items-center gap-1">
                                                        <Check size={10} /> Đang chọn
                                                    </span>
                                                )}
                                                {symName && (
                                                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                                                        {symName}
                                                    </span>
                                                )}
                                                <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1">
                                                    <Clock size={11} /> {tpl.timeframe || 'D1'}
                                                </span>
                                                <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 font-medium">
                                                    {stratName}
                                                </span>
                                            </div>

                                            {tpl.description && (
                                                <p className="text-xs text-gray-400 line-clamp-2">
                                                    {tpl.description}
                                                </p>
                                            )}
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            {onSetDefaultTemplate && !isDefault && (
                                                <button
                                                    type="button"
                                                    disabled={Boolean(settingDefaultId)}
                                                    onClick={() => handleSetDefault(tpl)}
                                                    className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-gray-800 hover:bg-amber-600/20 text-gray-300 hover:text-amber-300 border border-gray-700 hover:border-amber-500/40 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                                    title="Đặt làm template mặc định cho symbol này"
                                                >
                                                    {settingDefaultId === tplId ? (
                                                        <Loader2 size={12} className="animate-spin text-amber-400" />
                                                    ) : (
                                                        <Star size={12} className="text-amber-400" />
                                                    )}
                                                    <span>{settingDefaultId === tplId ? 'Đang lưu...' : 'Đặt mặc định'}</span>
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onApplyTemplate(tpl);
                                                    onClose();
                                                }}
                                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-500/20'
                                                        : 'bg-gray-700 hover:bg-cyan-600 text-gray-200 hover:text-white'
                                                }`}
                                            >
                                                <Check size={13} />
                                                <span>{isSelected ? 'Đang kích hoạt' : 'Áp dụng'}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => onDeleteTemplate(tplId, e)}
                                                title="Xóa template này"
                                                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl border border-transparent hover:border-red-500/30 transition cursor-pointer"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Middle: Backtest Metrics Grid (if present) */}
                                    {m ? (
                                        <div className="bg-gray-800/80 border border-gray-700/60 rounded-xl p-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                            {/* Profit Factor */}
                                            <div className="p-1.5 rounded-lg bg-gray-900/60 border border-gray-700/40">
                                                <div className="text-[10px] text-gray-400 font-medium flex items-center justify-center gap-1">
                                                    <Award size={11} className="text-amber-400" />
                                                    Profit Factor
                                                </div>
                                                <div className={`text-sm font-bold mt-0.5 ${
                                                    m.profitFactor === '∞' || parseFloat(m.profitFactor) >= 1.5
                                                        ? 'text-emerald-400'
                                                        : parseFloat(m.profitFactor) >= 1.0
                                                            ? 'text-sky-400'
                                                            : 'text-rose-400'
                                                }`}>
                                                    {m.profitFactor ?? 'N/A'}
                                                </div>
                                            </div>

                                            {/* Winrate */}
                                            <div className="p-1.5 rounded-lg bg-gray-900/60 border border-gray-700/40">
                                                <div className="text-[10px] text-gray-400 font-medium flex items-center justify-center gap-1">
                                                    <Target size={11} className="text-emerald-400" />
                                                    Winrate
                                                </div>
                                                <div className={`text-sm font-bold mt-0.5 ${
                                                    Number(m.winRate) >= 50 ? 'text-emerald-400' : 'text-amber-400'
                                                }`}>
                                                    {m.winRate !== undefined ? `${m.winRate}%` : 'N/A'}
                                                </div>
                                                <div className="text-[9px] text-gray-500">
                                                    {m.winTrades ?? 0} TP / {m.lossTrades ?? 0} SL
                                                </div>
                                            </div>

                                            {/* Total Trades */}
                                            <div className="p-1.5 rounded-lg bg-gray-900/60 border border-gray-700/40">
                                                <div className="text-[10px] text-gray-400 font-medium flex items-center justify-center gap-1">
                                                    <Activity size={11} className="text-cyan-400" />
                                                    Tổng số Trade
                                                </div>
                                                <div className="text-sm font-bold text-gray-100 mt-0.5">
                                                    {m.totalTrades ?? 0}
                                                </div>
                                                <div className="text-[9px] text-gray-500">
                                                    {m.closedTrades ?? m.totalTrades ?? 0} đã đóng
                                                </div>
                                            </div>

                                            {/* Total PnL */}
                                            <div className="p-1.5 rounded-lg bg-gray-900/60 border border-gray-700/40">
                                                <div className="text-[10px] text-gray-400 font-medium flex items-center justify-center gap-1">
                                                    {Number(m.totalPnlPercent) >= 0 ? (
                                                        <TrendingUp size={11} className="text-emerald-400" />
                                                    ) : (
                                                        <TrendingDown size={11} className="text-rose-400" />
                                                    )}
                                                    Tổng PnL
                                                </div>
                                                <div className={`text-sm font-bold mt-0.5 ${
                                                    Number(m.totalPnlPercent) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                                }`}>
                                                    {Number(m.totalPnlPercent) > 0 ? `+${m.totalPnlPercent}%` : `${m.totalPnlPercent}%`}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-2 text-center text-xs text-gray-500 italic">
                                            Chưa có thông số Backtest đã lưu kèm (Sử dụng cấu hình tham số mặc định).
                                        </div>
                                    )}

                                    {/* Bottom: Parameter Badges */}
                                    {paramBadges.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                            <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1 mr-1">
                                                <Tag size={10} /> Tham số:
                                            </span>
                                            {paramBadges.map((b, i) => (
                                                <span
                                                    key={i}
                                                    className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${b.color}`}
                                                >
                                                    {b.val}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="py-12 text-center space-y-3">
                            <div className="p-4 rounded-full bg-gray-800 border border-gray-700 w-14 h-14 mx-auto flex items-center justify-center text-gray-500">
                                <BookmarkCheck size={26} />
                            </div>
                            <div className="text-sm font-semibold text-gray-300">
                                {search ? 'Không tìm thấy Template nào phù hợp với từ khóa' : 'Chưa có Strategy Template nào được lưu'}
                            </div>
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-xl text-xs font-semibold transition cursor-pointer"
                                >
                                    Xóa bộ lọc tìm kiếm
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* 4. Footer */}
                <div className="p-3.5 sm:p-4 bg-gray-900/60 border-t border-gray-700/80 flex items-center justify-between text-xs text-gray-400 shrink-0">
                    <div className="flex items-center gap-2">
                        <span>Hiển thị <b>{filteredTemplates.length}</b> / {templates.length} templates</span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-xl font-semibold transition cursor-pointer"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StrategyTemplatesListModal;
