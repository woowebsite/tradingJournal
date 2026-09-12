import React from 'react';
import { Layers, ListFilter, Bookmark, Trash2, Clock, List } from 'lucide-react';

const WatchlistSymbolBar = ({
    selectedWatchlistId,
    onWatchlistChange,
    accountWatchlists,
    selectedSymbol,
    onSymbolChange,
    watchlistSymbols,
    selectedTemplateId,
    onTemplateSelect,
    onTemplateDelete,
    onOpenTemplatesList,
    symbolTemplates,
    timeframe,
    onTimeframeChange
}) => {
    return (
        <div className="bg-gray-800/80 backdrop-blur-md rounded-2xl border border-gray-700/70 p-4 shadow-xl space-y-3">
            <div className="flex items-center gap-2 border-b border-gray-700/60 pb-2.5">
                <Layers size={16} className="text-blue-400" />
                <h2 className="text-sm font-bold text-gray-200 tracking-wide uppercase">
                    Watchlist & Symbol Selection
                </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
                {/* Dropdown: WatchLists của Account */}
                <div className="lg:col-span-3 space-y-1.5">
                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                        <Layers size={14} className="text-blue-400" />
                        Account Watchlist
                    </label>
                    <select
                        value={selectedWatchlistId}
                        onChange={(e) => onWatchlistChange(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition cursor-pointer"
                    >
                        <option value="">-- Tất cả Symbol --</option>
                        {accountWatchlists.map(wl => (
                            <option key={wl.documentId || wl.id} value={wl.documentId || wl.id}>
                                {wl.name || wl.Name} ({wl.symbols?.length || 0})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Dropdown: Symbol trong Watchlist */}
                <div className="lg:col-span-3 space-y-1.5">
                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                        <ListFilter size={14} className="text-emerald-400" />
                        Symbol trong Watchlist
                    </label>
                    <select
                        value={selectedSymbol}
                        onChange={(e) => onSymbolChange(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition cursor-pointer font-semibold uppercase"
                    >
                        <option value="">-- Chọn Symbol --</option>
                        {watchlistSymbols.map((sym, idx) => (
                            <option key={`${sym}-${idx}`} value={sym}>
                                {sym}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Dropdown: Strategy Template */}
                <div className="lg:col-span-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                            <Bookmark size={14} className="text-cyan-400" />
                            Strategy Template {selectedSymbol ? `(${selectedSymbol})` : ''}
                        </label>
                        <div className="flex items-center gap-2">
                            {selectedSymbol && (
                                <button
                                    type="button"
                                    onClick={onOpenTemplatesList}
                                    title={`Xem danh sách các Strategy Templates của ${selectedSymbol}`}
                                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition cursor-pointer font-medium hover:underline"
                                >
                                    <List size={12} />
                                    <span>Tất cả</span>
                                </button>
                            )}
                            {selectedTemplateId && (
                                <button
                                    type="button"
                                    onClick={(e) => onTemplateDelete(selectedTemplateId, e)}
                                    title="Xóa template đã chọn"
                                    className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 transition cursor-pointer"
                                >
                                    <Trash2 size={12} />
                                    <span>Xóa</span>
                                </button>
                            )}
                        </div>
                    </div>
                    <select
                        value={selectedTemplateId}
                        onChange={(e) => onTemplateSelect(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition cursor-pointer font-medium"
                    >
                        <option value="">
                            {symbolTemplates.length > 0
                                ? `-- Chọn Template của ${selectedSymbol} (${symbolTemplates.length}) --`
                                : `-- Chưa có Template (${selectedSymbol}) --`}
                        </option>
                        {symbolTemplates.map(tpl => {
                            const tplId = String(tpl.id || tpl.documentId);
                            const stratShortName = String(tpl.strategyFile || '').replace('strategy_', '').replace('.py', '');
                            const m = tpl.config?.metrics || tpl.config?.backtestSummary;
                            const metricsStr = m
                                ? ` | WR: ${m.winRate}% • PF: ${m.profitFactor} • PnL: ${Number(m.totalPnlPercent) > 0 ? '+' : ''}${m.totalPnlPercent}%`
                                : '';
                            return (
                                <option key={tplId} value={tplId}>
                                    {tpl.name} ({stratShortName} - {tpl.timeframe || 'D1'}{metricsStr})
                                </option>
                            );
                        })}
                    </select>
                </div>

                {/* Dropdown: Timeframe */}
                <div className="lg:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                        <Clock size={14} className="text-amber-400" />
                        Timeframe
                    </label>
                    <select
                        value={timeframe}
                        onChange={(e) => onTimeframeChange(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition cursor-pointer font-semibold"
                    >
                        <option value="M1">M1 (1 Phút)</option>
                        <option value="M5">M5 (5 Phút)</option>
                        <option value="M30">M30 (30 Phút)</option>
                        <option value="H4">H4 (4 Giờ)</option>
                        <option value="D1">D1 (1 Ngày)</option>
                        <option value="W1">W1 (1 Tuần)</option>
                    </select>
                </div>
            </div>
        </div>
    );
};

export default WatchlistSymbolBar;
