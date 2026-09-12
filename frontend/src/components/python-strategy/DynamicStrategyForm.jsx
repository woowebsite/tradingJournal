import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Sliders,
    Sparkles,
    BrainCircuit,
    Target,
    Activity,
    Layers,
    TrendingUp,
    TrendingDown,
    ShieldAlert,
    CheckCircle2,
    RotateCcw,
    BookmarkPlus,
    Trophy,
    Play,
    RefreshCw,
    AlertTriangle,
    ExternalLink
} from 'lucide-react';
import { formatNumber } from '../../utils/formatNumber';

const DynamicStrategyForm = ({
    strategyFiles = [],
    selectedStrategyFile,
    onStrategyChange,
    currentStrategy,
    params,
    onParamChange,
    optFlags,
    onOptFlagChange,
    onToggleAllOpt,
    optCount,
    totalOptCount,
    timeframe,
    spreadValues,
    symbolInsightStats,
    loadingInsightStats,
    onOpenInsightModal,
    selectedSymbol,
    scanResult,
    scanning,
    optimizing,
    optimizationConfigsCount = 0,
    onResetDefault,
    onOpenSaveModal,
    onOpenLeaderboard,
    onOptimize,
    onScan
}) => {
    const fields = currentStrategy?.fields || [];
    const col1Fields = useMemo(() => fields.filter(f => f.column === 1), [fields]);
    const col2Fields = useMemo(() => fields.filter(f => f.column === 2), [fields]);

    const isVWAP = selectedStrategyFile?.toLowerCase().includes('vwap');
    const isPriceAction = selectedStrategyFile?.toLowerCase().includes('priceaction') || selectedStrategyFile?.toLowerCase().includes('price_action');

    // Render 1 input number chuẩn
    const renderNumberField = (field) => {
        const value = params[field.name] !== undefined ? params[field.name] : '';
        const optKey = field.optKey || field.name;
        const isOpt = Boolean(optFlags[optKey]);
        const IconComponent = field.icon;
        const isDisabled = typeof field.disabledWhen === 'function' ? field.disabledWhen(params) : false;

        return (
            <div key={field.name} className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-1 text-[11px] truncate" title={field.title || field.label}>
                        {IconComponent && <IconComponent size={12} className={`${field.iconColor || 'text-purple-400'} shrink-0`} />}
                        <span>{field.label}</span>
                    </label>
                    {field.optimizable && (
                        <label
                            title={isOpt ? "Bỏ chọn để giữ cố định giá trị này khi optimize" : "Chọn để tự động tìm kiếm giá trị tối ưu"}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition select-none ${
                                isOpt
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-gray-800/90 text-gray-400 border border-gray-700 hover:text-gray-300'
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={isOpt}
                                onChange={(e) => onOptFlagChange(optKey, e.target.checked)}
                                className="w-3 h-3 rounded text-amber-500 bg-gray-900 border-gray-600 focus:ring-amber-500 cursor-pointer accent-amber-500"
                            />
                            <span>{isOpt ? 'Opt' : 'Lock'}</span>
                        </label>
                    )}
                </div>
                <input
                    type="number"
                    step={field.step || '1'}
                    min={field.min}
                    max={field.max}
                    value={value}
                    onChange={(e) => onParamChange(field.name, e.target.value)}
                    disabled={isDisabled}
                    placeholder={field.placeholder || ''}
                    className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-2 py-2 text-sm text-center text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition font-mono h-[42px] disabled:opacity-40 disabled:cursor-not-allowed"
                />
            </div>
        );
    };

    // Render 1 dropdown select chuẩn
    const renderSelectField = (field) => {
        const value = params[field.name] !== undefined ? params[field.name] : '';
        const optKey = field.optKey || field.name;
        const isOpt = Boolean(optFlags[optKey]);
        const IconComponent = field.icon;

        return (
            <div key={field.name} className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-1 text-[11px] truncate" title={field.title || field.label}>
                        {IconComponent && <IconComponent size={12} className={`${field.iconColor || 'text-indigo-400'} shrink-0`} />}
                        <span>{field.label}</span>
                    </label>
                    {field.optimizable && (
                        <label
                            title={isOpt ? "Bỏ chọn để giữ cố định giá trị này khi optimize" : "Chọn để tự động tìm kiếm giá trị tối ưu"}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition select-none ${
                                isOpt
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-gray-800/90 text-gray-400 border border-gray-700 hover:text-gray-300'
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={isOpt}
                                onChange={(e) => onOptFlagChange(optKey, e.target.checked)}
                                className="w-3 h-3 rounded text-amber-500 bg-gray-900 border-gray-600 focus:ring-amber-500 cursor-pointer accent-amber-500"
                            />
                            <span>{isOpt ? 'Opt' : 'Lock'}</span>
                        </label>
                    )}
                </div>
                <select
                    value={value}
                    onChange={(e) => onParamChange(field.name, e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition cursor-pointer font-medium h-[42px]"
                >
                    {(field.options || []).map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>
        );
    };

    // Render 5 Checkbox mẫu hình Price Action
    const renderPriceActionPatterns = (field) => {
        const isOpt = Boolean(optFlags.paPatterns);
        const patterns = [
            { key: 'paEngulfing', name: '1. Engulfing', sub: 'Bao trùm', desc: 'Nến đóng cửa vượt qua toàn bộ nến trước', subColor: 'text-purple-400' },
            { key: 'paBd3bu2', name: '2. BD3BU2 / BU3BD2', sub: '6 Nến', desc: 'Nến 2 là cực trị, Nến 0 breakout vượt 1 & 2', subColor: 'text-cyan-400' },
            { key: 'paIncludeOpposite', name: '3. IncludeOpposite', sub: 'Ngược màu', desc: 'Nến vượt 2 nến trước & có nến ngược màu', subColor: 'text-emerald-400' },
            { key: 'paPointUp', name: '4. PointUp / PointDown', sub: '3 Nến', desc: 'Fractal đỉnh / đáy với nến giữa cực trị', subColor: 'text-amber-400' },
            { key: 'paSwingUp', name: '5. SwingUp / SwingDown', sub: 'Swing Cực Trị', desc: 'PointUp cao nhất hoặc PointDown thấp nhất so với 2 bên', subColor: 'text-rose-400', fullWidth: true },
        ];

        return (
            <div key={field.name} className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                        <Activity size={13} className="text-purple-400" />
                        Price Action Filter (Tick chọn kích hoạt)
                    </label>
                    <div className="flex items-center gap-1.5">
                        <label
                            title={isOpt ? "Bỏ chọn để giữ nguyên tổ hợp mẫu hình PA hiện tại khi optimize" : "Chọn để tự động tìm kiếm tổ hợp mẫu hình PA tối ưu"}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition select-none ${
                                isOpt
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-gray-800/90 text-gray-400 border border-gray-700 hover:text-gray-300'
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={isOpt}
                                onChange={(e) => onOptFlagChange('paPatterns', e.target.checked)}
                                className="w-3 h-3 rounded text-amber-500 bg-gray-900 border-gray-600 focus:ring-amber-500 cursor-pointer accent-amber-500"
                            />
                            <span>{isOpt ? 'Opt' : 'Lock'}</span>
                        </label>
                        <span className="text-[10px] text-purple-300 font-mono bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full">
                            Kích hoạt khi thỏa mãn (OR)
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {patterns.map(p => {
                        const checked = Boolean(params[p.key]);
                        return (
                            <label
                                key={p.key}
                                className={`${p.fullWidth ? 'sm:col-span-2' : ''} flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition select-none ${
                                    checked
                                        ? 'bg-purple-950/30 border-purple-500/60 shadow-sm shadow-purple-950/50'
                                        : 'bg-gray-900/80 border-gray-700/80 hover:border-gray-600 opacity-75'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => onParamChange(p.key, e.target.checked)}
                                    className="mt-0.5 w-4 h-4 rounded text-purple-600 bg-gray-800 border-gray-600 focus:ring-purple-500 focus:ring-offset-gray-900 cursor-pointer accent-purple-500"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold text-gray-200 flex items-center justify-between">
                                        <span>{p.name}</span>
                                        <span className={`text-[10px] font-mono ${p.subColor}`}>{p.sub}</span>
                                    </div>
                                    <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
                                        {p.desc}
                                    </p>
                                </div>
                            </label>
                        );
                    })}
                </div>
            </div>
        );
    };

    // Render Tùy chọn Chốt lời Supertrend MA (ST Đảo chiều & Theo R:R)
    const renderTpOptionsSt = (field) => {
        const isOpt = Boolean(optFlags.tpMode);
        return (
            <div key={field.name} className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-emerald-400" />
                        Tùy chọn Chốt lời
                    </label>
                    <label
                        title={isOpt ? "Bỏ chọn để giữ cố định chế độ TP này khi optimize" : "Chọn để tự động tìm kiếm chế độ TP tối ưu"}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition select-none ${
                            isOpt
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-gray-800/90 text-gray-400 border border-gray-700 hover:text-gray-300'
                        }`}
                    >
                        <input
                            type="checkbox"
                            checked={isOpt}
                            onChange={(e) => onOptFlagChange('tpMode', e.target.checked)}
                            className="w-3 h-3 rounded text-amber-500 bg-gray-900 border-gray-600 focus:ring-amber-500 cursor-pointer accent-amber-500"
                        />
                        <span>{isOpt ? 'Opt' : 'Lock'}</span>
                    </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <label className={`flex items-center gap-2 bg-gray-900 border rounded-xl px-2.5 py-2 cursor-pointer transition select-none h-[42px] ${
                        params.tpSupertrend ? 'border-emerald-500/50 bg-emerald-950/20 shadow-sm shadow-emerald-950/50' : 'border-gray-700 hover:border-gray-600 opacity-60'
                    }`}>
                        <input
                            type="checkbox"
                            checked={Boolean(params.tpSupertrend)}
                            onChange={(e) => onParamChange('tpSupertrend', e.target.checked)}
                            className="w-4 h-4 rounded text-emerald-600 bg-gray-800 border-gray-600 focus:ring-emerald-500 focus:ring-offset-gray-900 cursor-pointer accent-emerald-500"
                        />
                        <span className={`text-xs font-medium truncate ${params.tpSupertrend ? 'text-emerald-300' : 'text-gray-400'}`}>
                            ST Đảo chiều
                        </span>
                    </label>

                    <label className={`flex items-center gap-2 bg-gray-900 border rounded-xl px-2.5 py-2 cursor-pointer transition select-none h-[42px] ${
                        params.tpRR ? 'border-amber-500/50 bg-amber-950/20 shadow-sm shadow-amber-950/50' : 'border-gray-700 hover:border-gray-600 opacity-60'
                    }`}>
                        <input
                            type="checkbox"
                            checked={Boolean(params.tpRR)}
                            onChange={(e) => onParamChange('tpRR', e.target.checked)}
                            className="w-4 h-4 rounded text-amber-600 bg-gray-800 border-gray-600 focus:ring-amber-500 focus:ring-offset-gray-900 cursor-pointer accent-amber-500"
                        />
                        <span className={`text-xs font-medium truncate ${params.tpRR ? 'text-amber-300' : 'text-gray-400'}`}>
                            Theo R:R
                        </span>
                    </label>
                </div>
            </div>
        );
    };

    // Render TP dropdown với mốc Spread Percentiles
    const renderSelectSpreadTp = (field) => {
        const isOpt = Boolean(optFlags.tpType);
        return (
            <div key={field.name} className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                        <Target size={13} className="text-emerald-400" />
                        {field.label}
                    </label>
                    <label
                        title={isOpt ? "Bỏ chọn để giữ cố định mốc TP này khi optimize" : "Chọn để tự động tìm kiếm mốc TP tối ưu"}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition select-none ${
                            isOpt
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-gray-800/90 text-gray-400 border border-gray-700 hover:text-gray-300'
                        }`}
                    >
                        <input
                            type="checkbox"
                            checked={isOpt}
                            onChange={(e) => onOptFlagChange('tpType', e.target.checked)}
                            className="w-3 h-3 rounded text-amber-500 bg-gray-900 border-gray-600 focus:ring-amber-500 cursor-pointer accent-amber-500"
                        />
                        <span>{isOpt ? 'Opt' : 'Lock'}</span>
                    </label>
                </div>
                <select
                    value={params.tpType || 'P50'}
                    onChange={(e) => onParamChange('tpType', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition cursor-pointer font-medium h-[42px]"
                >
                    <option value="P25">P25 (Spread Hẹp {spreadValues?.p25 ? `• ${formatNumber(spreadValues.p25)}` : ''})</option>
                    <option value="P50">P50 (Trung vị {spreadValues?.p50 ? `• ${formatNumber(spreadValues.p50)}` : ''}) - Mặc định</option>
                    <option value="P75">P75 (Spread Rộng {spreadValues?.p75 ? `• ${formatNumber(spreadValues.p75)}` : ''})</option>
                    <option value="P90">P90 (Spread Đột biến {spreadValues?.p90 ? `• ${formatNumber(spreadValues.p90)}` : ''})</option>
                    <option value="P99">P99 (Spread Cực đại {spreadValues?.p99 ? `• ${formatNumber(spreadValues.p99)}` : ''})</option>
                </select>
            </div>
        );
    };

    // Render SL dropdown với mốc Spread Percentiles
    const renderSelectSpreadSl = (field) => {
        const isOpt = Boolean(optFlags.slType);
        return (
            <div key={field.name} className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                        <ShieldAlert size={13} className="text-rose-400" />
                        {field.label}
                    </label>
                    <label
                        title={isOpt ? "Bỏ chọn để giữ cố định mốc SL này khi optimize" : "Chọn để tự động tìm kiếm mốc SL tối ưu"}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition select-none ${
                            isOpt
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-gray-800/90 text-gray-400 border border-gray-700 hover:text-gray-300'
                        }`}
                    >
                        <input
                            type="checkbox"
                            checked={isOpt}
                            onChange={(e) => onOptFlagChange('slType', e.target.checked)}
                            className="w-3 h-3 rounded text-amber-500 bg-gray-900 border-gray-600 focus:ring-amber-500 cursor-pointer accent-amber-500"
                        />
                        <span>{isOpt ? 'Opt' : 'Lock'}</span>
                    </label>
                </div>
                <select
                    value={params.slType || 'P75'}
                    onChange={(e) => onParamChange('slType', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition cursor-pointer font-medium h-[42px]"
                >
                    <option value="P25">P25 (Spread Hẹp {spreadValues?.p25 ? `• ${formatNumber(spreadValues.p25)}` : ''})</option>
                    <option value="P50">P50 (Trung vị {spreadValues?.p50 ? `• ${formatNumber(spreadValues.p50)}` : ''})</option>
                    <option value="P75">P75 (Spread Rộng {spreadValues?.p75 ? `• ${formatNumber(spreadValues.p75)}` : ''}) - Mặc định</option>
                    <option value="P90">P90 (Spread Đột biến {spreadValues?.p90 ? `• ${formatNumber(spreadValues.p90)}` : ''})</option>
                    <option value="supertrend">Theo dải Supertrend</option>
                </select>
            </div>
        );
    };

    // Render Insight button & Spread Metrics Card
    const renderInsightSpreadRow = (field) => {
        const isOpt = Boolean(optFlags.tpSupertrend);
        return (
            <React.Fragment key={field.name}>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-gray-900/60 p-2.5 rounded-xl border border-gray-700/60 text-xs">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <button
                            type="button"
                            onClick={onOpenInsightModal}
                            disabled={loadingInsightStats || !selectedSymbol}
                            className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-semibold border border-blue-500/30 flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-sm"
                            title="Mở danh sách các bản ghi Insight đã lưu cho mã này"
                        >
                            <RefreshCw size={13} className={loadingInsightStats ? 'animate-spin' : ''} />
                            <span>Nạp Spread Insight</span>
                        </button>
                        {symbolInsightStats ? (
                            <span className="text-[11px] text-cyan-300 font-medium truncate flex items-center gap-1">
                                <CheckCircle2 size={12} className="text-cyan-400 shrink-0" />
                                <span className="truncate">{symbolInsightStats.title || `${selectedSymbol} Insight`}</span>
                            </span>
                        ) : (
                            <div className="flex items-center gap-1.5 text-[11px] text-amber-300/90 font-medium">
                                <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                                <span>Chưa có Insight cho {selectedSymbol || 'symbol'}.</span>
                                <Link
                                    to={`/strategy-insight?symbol=${encodeURIComponent(selectedSymbol || '')}`}
                                    className="text-cyan-400 hover:text-cyan-300 underline font-semibold flex items-center gap-0.5 ml-1 transition"
                                >
                                    <span>Tạo Insight</span>
                                    <ExternalLink size={10} />
                                </Link>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <label
                            title={isOpt ? "Bỏ chọn để giữ cố định tùy chọn này khi optimize" : "Chọn để tự động tìm kiếm tùy chọn tối ưu"}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition select-none ${
                                isOpt
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-gray-800/90 text-gray-400 border border-gray-700 hover:text-gray-300'
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={isOpt}
                                onChange={(e) => onOptFlagChange('tpSupertrend', e.target.checked)}
                                className="w-3 h-3 rounded text-amber-500 bg-gray-900 border-gray-600 focus:ring-amber-500 cursor-pointer accent-amber-500"
                            />
                            <span>{isOpt ? 'Opt' : 'Lock'}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none text-gray-300 hover:text-white">
                            <input
                                type="checkbox"
                                checked={Boolean(params.tpSupertrend)}
                                onChange={(e) => onParamChange('tpSupertrend', e.target.checked)}
                                className="w-4 h-4 rounded text-purple-600 bg-gray-800 border-gray-600 focus:ring-purple-500 focus:ring-offset-gray-900 cursor-pointer accent-purple-500"
                            />
                            <span className="text-xs">Chốt khi ST đảo chiều</span>
                        </label>
                    </div>
                </div>

                {/* Summary metrics card */}
                {symbolInsightStats ? (
                    <div id="summary-metrics-card" className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-gray-950/80 p-2.5 rounded-xl border border-cyan-500/40 shadow-inner">
                        <div>
                            <span className="text-gray-500 block text-[10px]">Spread P50 (Trung vị)</span>
                            <span className="font-mono text-sky-300 font-bold">
                                {formatNumber(symbolInsightStats.spreadMedianPrice)} ({Number(symbolInsightStats.spreadMedianPercent || 0).toFixed(2)}%)
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-500 block text-[10px]">Spread Rộng (P75)</span>
                            <span className="font-mono text-cyan-300 font-bold">
                                {formatNumber(symbolInsightStats.spreadP75Price)} ({Number(symbolInsightStats.spreadP75Percent || 0).toFixed(2)}%)
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-500 block text-[10px]">Giờ Tăng mạnh</span>
                            <span className="text-emerald-400 font-semibold truncate block">
                                {symbolInsightStats.bestBullHour || 'N/A'}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-500 block text-[10px]">Ngày Tăng tốt</span>
                            <span className="text-emerald-400 font-semibold truncate block">
                                {symbolInsightStats.bestBullDay || 'N/A'}
                            </span>
                        </div>
                    </div>
                ) : scanResult?.spreadStats ? (
                    <div id="summary-metrics-card" className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-gray-950/60 p-2.5 rounded-xl border border-gray-800">
                        <div>
                            <span className="text-gray-500 block text-[10px]">Spread P50 (Lịch sử nến)</span>
                            <span className="font-mono text-sky-300 font-bold">
                                {formatNumber(spreadValues?.p50 || 0)} ({Number(scanResult.spreadStats.medianPercent || 0).toFixed(2)}%)
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-500 block text-[10px]">Spread Rộng (P75)</span>
                            <span className="font-mono text-cyan-300 font-bold">
                                {formatNumber(spreadValues?.p75 || 0)} ({Number(scanResult.spreadStats.p75Percent || 0).toFixed(2)}%)
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-500 block text-[10px]">Spread Đột biến (P90)</span>
                            <span className="font-mono text-amber-300 font-semibold truncate block">
                                {formatNumber(spreadValues?.p90 || 0)} ({Number(scanResult.spreadStats.p90Percent || 0).toFixed(2)}%)
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-500 block text-[10px]">Nguồn dữ liệu</span>
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-gray-400 font-medium truncate block">
                                    Tính từ Lịch sử nến
                                </span>
                                <Link
                                    to={`/strategy-insight?symbol=${encodeURIComponent(selectedSymbol || '')}`}
                                    className="text-cyan-400 hover:text-cyan-300 font-semibold text-[10px] shrink-0 underline flex items-center gap-0.5"
                                >
                                    Tạo Insight <ExternalLink size={9} />
                                </Link>
                            </div>
                        </div>
                    </div>
                ) : null}
            </React.Fragment>
        );
    };

    // Bộ định tuyến dispatcher render theo field type
    const renderField = (field) => {
        switch (field.type) {
            case 'number':
                return renderNumberField(field);
            case 'select':
                return renderSelectField(field);
            case 'price_action_patterns':
                return renderPriceActionPatterns(field);
            case 'tp_options_st':
                return renderTpOptionsSt(field);
            case 'select_spread_tp':
                return renderSelectSpreadTp(field);
            case 'select_spread_sl':
                return renderSelectSpreadSl(field);
            case 'insight_spread_row':
                return renderInsightSpreadRow(field);
            default:
                return null;
        }
    };

    return (
        <div className="bg-gray-800/80 backdrop-blur-md rounded-2xl border border-gray-700/70 p-4 shadow-xl space-y-4">
            {/* Top Bar: Title & Optimization Summary */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-700/60 pb-2.5">
                <div className="flex items-center gap-2">
                    <Sliders size={16} className="text-purple-400" />
                    <h2 className="text-sm font-bold text-gray-200 tracking-wide uppercase">
                        Strategy Configuration
                    </h2>
                </div>

                {/* Selective Optimization Controls */}
                <div className="flex items-center gap-2 bg-gray-900/80 px-3 py-1.5 rounded-xl border border-gray-700/60">
                    <span className="text-xs text-gray-300 flex items-center gap-1.5 font-medium">
                        <Sparkles size={13} className="text-amber-400" />
                        Tối ưu hóa:
                        <span className="font-mono font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 rounded text-[11px]">
                            {optCount}/{totalOptCount}
                        </span>
                        <span className="text-[11px] text-gray-400">tham số</span>
                    </span>
                    <div className="flex items-center gap-1 text-[11px] ml-1 border-l border-gray-700 pl-2">
                        <button
                            type="button"
                            onClick={() => onToggleAllOpt(true)}
                            className="px-2 py-0.5 rounded bg-gray-800 hover:bg-amber-500/20 text-gray-300 hover:text-amber-300 border border-gray-700 hover:border-amber-500/40 transition cursor-pointer font-medium text-[10px]"
                        >
                            Chọn tất cả
                        </button>
                        <button
                            type="button"
                            onClick={() => onToggleAllOpt(false)}
                            className="px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 border border-gray-700 transition cursor-pointer font-medium text-[10px]"
                        >
                            Bỏ chọn
                        </button>
                    </div>
                </div>
            </div>

            {/* 2 Cột Cấu Hình */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* CỘT 1: STRATEGY & INDICATORS CONFIGURATION */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                            <BrainCircuit size={14} className="text-purple-400" />
                            Strategy &amp; Indicators Configuration
                        </span>
                    </div>

                    {/* Dropdown: Python Strategy Files */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                            <BrainCircuit size={13} className="text-purple-400" />
                            Python Strategy
                        </label>
                        <select
                            value={selectedStrategyFile}
                            onChange={(e) => onStrategyChange(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition cursor-pointer font-mono h-[42px]"
                        >
                            {strategyFiles.length === 0 ? (
                                <option value={selectedStrategyFile}>{selectedStrategyFile}</option>
                            ) : (
                                strategyFiles.map(file => (
                                    <option key={file.fileName} value={file.fileName}>
                                        {file.name || file.fileName}
                                    </option>
                                ))
                            )}
                        </select>
                    </div>

                    {/* Indicator Parameters: Dựa trên fields của Schema */}
                    {isVWAP ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {col1Fields.map(renderField)}
                        </div>
                    ) : isPriceAction ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2.5">
                                {col1Fields.filter(f => f.type === 'number').map(renderField)}
                            </div>
                            {col1Fields.filter(f => f.type !== 'number').map(renderField)}
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-2.5">
                            {col1Fields.map(renderField)}
                        </div>
                    )}
                </div>

                {/* CỘT 2: ENTRY, TAKE PROFIT & STOP LOSS */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Target size={14} className="text-indigo-400" />
                            Entry, Take Profit &amp; Stop Loss
                        </span>
                    </div>

                    {/* Cột 2 Layout: Entry condition + Long/Short */}
                    {isVWAP ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                        <Activity size={13} className="text-indigo-400" />
                                        Điều kiện Vào lệnh (Entry)
                                    </label>
                                    <div className="w-full bg-gray-900/90 border border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-indigo-300 font-medium flex items-center h-[42px]" title="Giá đóng cửa > MA & Giá > Lower 2 & MA < VWAP">
                                        <span className="truncate">Giá &gt; MA{params.vwapMaPeriod} &amp; Giá &gt; Lower2 &amp; MA &lt; VWAP</span>
                                    </div>
                                </div>

                                {/* Long & Short Checkboxes */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                        <Layers size={13} className="text-purple-400" />
                                        Loại lệnh giao dịch
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className={`flex items-center justify-center gap-2 bg-gray-900 border rounded-xl px-2 py-2 cursor-pointer transition select-none h-[42px] ${
                                            params.allowLong ? 'border-emerald-500/50 bg-emerald-950/20 shadow-sm shadow-emerald-950/50' : 'border-gray-700 hover:border-gray-600 opacity-60'
                                        }`}>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(params.allowLong)}
                                                onChange={(e) => onParamChange('allowLong', e.target.checked)}
                                                className="w-4 h-4 rounded text-emerald-600 bg-gray-800 border-gray-600 focus:ring-emerald-500 focus:ring-offset-gray-900 cursor-pointer accent-emerald-500"
                                            />
                                            <TrendingUp size={14} className={params.allowLong ? 'text-emerald-400 shrink-0' : 'text-gray-400 shrink-0'} />
                                            <span className={`text-xs font-semibold truncate ${params.allowLong ? 'text-emerald-300' : 'text-gray-400'}`}>Long</span>
                                        </label>

                                        <label className={`flex items-center justify-center gap-2 bg-gray-900 border rounded-xl px-2 py-2 cursor-pointer transition select-none h-[42px] ${
                                            params.allowShort ? 'border-rose-500/50 bg-rose-950/20 shadow-sm shadow-rose-950/50' : 'border-gray-700 hover:border-gray-600 opacity-60'
                                        }`}>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(params.allowShort)}
                                                onChange={(e) => onParamChange('allowShort', e.target.checked)}
                                                className="w-4 h-4 rounded text-rose-600 bg-gray-800 border-gray-600 focus:ring-rose-500 focus:ring-offset-gray-900 cursor-pointer accent-rose-500"
                                            />
                                            <TrendingDown size={14} className={params.allowShort ? 'text-rose-400 shrink-0' : 'text-gray-400 shrink-0'} />
                                            <span className={`text-xs font-semibold truncate ${params.allowShort ? 'text-rose-300' : 'text-gray-400'}`}>Short</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {col2Fields.map(renderField)}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                        <ShieldAlert size={13} className="text-rose-400" />
                                        Cắt lỗ (Stop Loss)
                                    </label>
                                    <div className="w-full bg-gray-900/90 border border-rose-500/30 rounded-xl px-3 py-2 text-xs text-rose-300 font-semibold flex items-center justify-between h-[42px]">
                                        <span>Tại Lower 2 (VWAP - 2.0σ)</span>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">LOWER 2</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : isPriceAction ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                        <Activity size={13} className="text-indigo-400" />
                                        Điều kiện Vào lệnh (Entry)
                                    </label>
                                    <div className="w-full bg-gray-900/90 border border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-indigo-300 font-medium flex items-center justify-between h-[42px]" title="Supertrend Xu hướng + Price Action đã tick">
                                        <span className="truncate">ST Trend + Price Action đã tick</span>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">TREND + PA</span>
                                    </div>
                                </div>

                                {/* Long & Short Checkboxes */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                        <Layers size={13} className="text-purple-400" />
                                        Loại lệnh giao dịch
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className={`flex items-center justify-center gap-2 bg-gray-900 border rounded-xl px-2 py-2 cursor-pointer transition select-none h-[42px] ${
                                            params.allowLong ? 'border-emerald-500/50 bg-emerald-950/20 shadow-sm shadow-emerald-950/50' : 'border-gray-700 hover:border-gray-600 opacity-60'
                                        }`}>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(params.allowLong)}
                                                onChange={(e) => onParamChange('allowLong', e.target.checked)}
                                                className="w-4 h-4 rounded text-emerald-600 bg-gray-800 border-gray-600 focus:ring-emerald-500 focus:ring-offset-gray-900 cursor-pointer accent-emerald-500"
                                            />
                                            <TrendingUp size={14} className={params.allowLong ? 'text-emerald-400 shrink-0' : 'text-gray-400 shrink-0'} />
                                            <span className={`text-xs font-semibold truncate ${params.allowLong ? 'text-emerald-300' : 'text-gray-400'}`}>Long</span>
                                        </label>

                                        <label className={`flex items-center justify-center gap-2 bg-gray-900 border rounded-xl px-2 py-2 cursor-pointer transition select-none h-[42px] ${
                                            params.allowShort ? 'border-rose-500/50 bg-rose-950/20 shadow-sm shadow-rose-950/50' : 'border-gray-700 hover:border-gray-600 opacity-60'
                                        }`}>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(params.allowShort)}
                                                onChange={(e) => onParamChange('allowShort', e.target.checked)}
                                                className="w-4 h-4 rounded text-rose-600 bg-gray-800 border-gray-600 focus:ring-rose-500 focus:ring-offset-gray-900 cursor-pointer accent-rose-500"
                                            />
                                            <TrendingDown size={14} className={params.allowShort ? 'text-rose-400 shrink-0' : 'text-gray-400 shrink-0'} />
                                            <span className={`text-xs font-semibold truncate ${params.allowShort ? 'text-rose-300' : 'text-gray-400'}`}>Short</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {col2Fields.filter(f => f.type.startsWith('select_spread')).map(renderField)}
                            </div>

                            {col2Fields.filter(f => f.type === 'insight_spread_row').map(renderField)}
                        </>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {col2Fields.filter(f => f.name === 'entryType').map(renderField)}

                                {/* Long & Short Checkboxes */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                        <Layers size={13} className="text-purple-400" />
                                        Loại lệnh giao dịch
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className={`flex items-center justify-center gap-2 bg-gray-900 border rounded-xl px-2 py-2 cursor-pointer transition select-none h-[42px] ${
                                            params.allowLong ? 'border-emerald-500/50 bg-emerald-950/20 shadow-sm shadow-emerald-950/50' : 'border-gray-700 hover:border-gray-600 opacity-60'
                                        }`}>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(params.allowLong)}
                                                onChange={(e) => onParamChange('allowLong', e.target.checked)}
                                                className="w-4 h-4 rounded text-emerald-600 bg-gray-800 border-gray-600 focus:ring-emerald-500 focus:ring-offset-gray-900 cursor-pointer accent-emerald-500"
                                            />
                                            <TrendingUp size={14} className={params.allowLong ? 'text-emerald-400 shrink-0' : 'text-gray-400 shrink-0'} />
                                            <span className={`text-xs font-semibold truncate ${params.allowLong ? 'text-emerald-300' : 'text-gray-400'}`}>Long</span>
                                        </label>

                                        <label className={`flex items-center justify-center gap-2 bg-gray-900 border rounded-xl px-2 py-2 cursor-pointer transition select-none h-[42px] ${
                                            params.allowShort ? 'border-rose-500/50 bg-rose-950/20 shadow-sm shadow-rose-950/50' : 'border-gray-700 hover:border-gray-600 opacity-60'
                                        }`}>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(params.allowShort)}
                                                onChange={(e) => onParamChange('allowShort', e.target.checked)}
                                                className="w-4 h-4 rounded text-rose-600 bg-gray-800 border-gray-600 focus:ring-rose-500 focus:ring-offset-gray-900 cursor-pointer accent-rose-500"
                                            />
                                            <TrendingDown size={14} className={params.allowShort ? 'text-rose-400 shrink-0' : 'text-gray-400 shrink-0'} />
                                            <span className={`text-xs font-semibold truncate ${params.allowShort ? 'text-rose-300' : 'text-gray-400'}`}>Short</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {col2Fields.filter(f => f.name !== 'entryType').map(renderField)}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Status bar & Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-gray-700/50">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
                    <span className="font-medium text-gray-300 text-[11px]">Cấu hình:</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px] font-semibold font-mono">
                        {timeframe}
                    </span>
                    {typeof currentStrategy?.renderConfigSummaryBadges === 'function' && (
                        currentStrategy.renderConfigSummaryBadges(params, timeframe)
                    )}
                    {params.allowLong && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px] font-medium">
                            <TrendingUp size={11} className="text-emerald-400" />
                            Long
                        </span>
                    )}
                    {params.allowShort && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[11px] font-medium">
                            <TrendingDown size={11} className="text-rose-400" />
                            Short
                        </span>
                    )}
                    {!params.allowLong && !params.allowShort && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[11px] font-medium">
                            <AlertTriangle size={11} className="text-rose-400" />
                            Chưa chọn loại lệnh
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 self-stretch sm:self-auto shrink-0 flex-wrap">
                    {/* Button Default */}
                    <button
                        onClick={onResetDefault}
                        disabled={scanning || optimizing}
                        title="Reset các thông số indicator và cấu hình về mặc định"
                        className="h-[34px] bg-gray-800/90 hover:bg-gray-700 hover:text-white border border-gray-700 hover:border-gray-600 active:scale-[0.98] text-gray-300 font-medium rounded-lg px-2.5 sm:px-3 flex items-center justify-center gap-1.5 shadow-sm transition text-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex-1 sm:flex-none"
                    >
                        <RotateCcw size={13} className="text-gray-400" />
                        <span>Default</span>
                    </button>

                    {/* Button Save Config */}
                    <button
                        onClick={onOpenSaveModal}
                        disabled={scanning || optimizing || !selectedSymbol}
                        title="Lưu cấu hình hiện tại thành Strategy Template vào Strapi"
                        className="h-[34px] bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 hover:text-white border border-cyan-500/40 hover:border-cyan-500 active:scale-[0.98] font-medium rounded-lg px-2.5 sm:px-3 flex items-center justify-center gap-1.5 shadow-sm transition text-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex-1 sm:flex-none"
                    >
                        <BookmarkPlus size={13} className="text-cyan-400" />
                        <span>Save Config</span>
                    </button>

                    {/* Button BXH Tối Ưu */}
                    {optimizationConfigsCount > 0 && (
                        <button
                            onClick={onOpenLeaderboard}
                            title="Xem lại bảng danh sách các cấu hình tối ưu đã tìm được"
                            className="h-[34px] bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 border border-amber-500/40 hover:border-amber-500/60 active:scale-[0.98] font-medium rounded-lg px-2.5 sm:px-3 flex items-center justify-center gap-1.5 shadow-sm transition text-xs cursor-pointer flex-1 sm:flex-none"
                        >
                            <Trophy size={14} className="text-amber-400" />
                            <span>BXH Tối Ưu ({optimizationConfigsCount})</span>
                        </button>
                    )}

                    {/* Button Optimize */}
                    <button
                        onClick={onOptimize}
                        disabled={scanning || optimizing || !selectedSymbol || optCount === 0}
                        title={optCount === 0 ? "Vui lòng chọn ít nhất 1 tham số để tối ưu" : `Tự động tìm kiếm bộ tham số tốt nhất cho ${optCount}/${totalOptCount} tham số đã chọn`}
                        className="h-[34px] bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 active:scale-[0.98] text-white font-semibold rounded-lg px-3 sm:px-3.5 flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition text-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex-1 sm:flex-none"
                    >
                        {optimizing ? (
                            <>
                                <RefreshCw size={13} className="animate-spin" />
                                <span>Optimizing...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles size={13} className="text-yellow-200 fill-yellow-200" />
                                <span>Optimize {optCount < totalOptCount ? `(${optCount})` : ''}</span>
                            </>
                        )}
                    </button>

                    {/* Button Run Scan */}
                    <button
                        onClick={onScan}
                        disabled={scanning || optimizing || !selectedSymbol}
                        className="h-[34px] bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 active:scale-[0.98] text-white font-semibold rounded-lg px-3.5 sm:px-4 flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/25 transition text-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex-1 sm:flex-none"
                    >
                        {scanning ? (
                            <>
                                <RefreshCw size={13} className="animate-spin" />
                                <span>Scanning...</span>
                            </>
                        ) : (
                            <>
                                <Play size={13} className="fill-current" />
                                <span>Run Scan</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DynamicStrategyForm;
