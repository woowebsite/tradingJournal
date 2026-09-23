import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    Activity,
    AlertTriangle,
    BarChart2,
    Calendar,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Clock,
    Compass,
    Eye,
    HelpCircle,
    Info,
    Layers,
    RotateCcw,
    Scale,
    ShieldAlert,
    ShieldCheck,
    Sliders,
    Sparkles,
    TrendingDown,
    TrendingUp,
    Zap
} from 'lucide-react';
import { calculateWalkForwardAnalysis } from '../utils/walkForwardAnalysis';
import { formatNumber } from '../utils/formatNumber';
import dayjs from 'dayjs';

const TIMEFRAME_OPTIONS = [
    { value: 'H1', label: '1 Giờ (H1)', desc: 'Mỗi chu kỳ WFA là 1 giờ (Scalping)' },
    { value: 'H4', label: '4 Giờ (H4)', desc: 'Mỗi chu kỳ WFA là 4 giờ' },
    { value: 'D1', label: '1 Ngày (D1)', desc: 'Mỗi chu kỳ WFA là 1 ngày (Day Trading)' },
    { value: 'W1', label: '1 Tuần (W1)', desc: 'Mỗi chu kỳ WFA là 1 tuần (Swing Trading)' },
    { value: 'M1', label: '1 Tháng (M1)', desc: 'Mỗi chu kỳ WFA là 1 tháng (Position Trading)' },
    { value: 'Q1', label: '1 Quý (3 Tháng)', desc: 'Mỗi chu kỳ WFA là 3 tháng' }
];

const WFA_MODES = [
    { value: 'Chỉ kiểm định Out-of-Sample (OOS)', label: 'Chỉ kiểm định Out-of-Sample (OOS)', desc: 'Chỉ đánh giá các lệnh nằm trong phần OOS của mỗi chu kỳ' },
    { value: 'Chỉ kiểm định In-Sample (IS)', label: 'Chỉ kiểm định In-Sample (IS)', desc: 'Chỉ đánh giá các lệnh trong phần IS (Huấn luyện)' },
    { value: 'Toàn bộ chu kỳ (Cả IS & OOS)', label: 'Toàn bộ chu kỳ (Cả IS & OOS)', desc: 'Đánh giá liên tục và so sánh phân vùng IS vs OOS' },
    { value: 'Chu kỳ xen kẽ (Xen kẽ 1 chu kỳ IS, 1 chu kỳ OOS)', label: 'Chu kỳ xen kẽ (Xen kẽ 1 chu kỳ IS, 1 chu kỳ OOS)', desc: 'Chu kỳ lẻ là IS, Chu kỳ chẵn là OOS' }
];

const SCOPE_OPTIONS = [
    { value: 'Tất cả các chu kỳ', label: 'Tất cả các chu kỳ', desc: 'Áp dụng WFA liên tục trên toàn bộ lịch sử' },
    { value: 'Chỉ 1 chu kỳ mục tiêu (Single Cycle)', label: 'Chỉ 1 chu kỳ mục tiêu (Single Cycle)', desc: 'Chỉ kiểm định duy nhất 1 ngày / tuần cụ thể' },
    { value: 'Từ chu kỳ mục tiêu trở đi (From Cycle N)', label: 'Từ chu kỳ mục tiêu trở đi (From Cycle N)', desc: 'Bắt đầu kiểm định từ chu kỳ N đến hiện tại' }
];

const OOS_RATIO_PRESETS = [10, 20, 30, 40, 50];

const WalkForwardAnalysisCard = ({
    trades = [],
    timeframe = 'D1',
    onFocusDate,
    onViewTrade,
    onWfaZoneChange,
}) => {
    // Map initial timeframe to sensible default WFA cycle
    const initialWfaTf = useMemo(() => {
        if (timeframe === 'M1' || timeframe === 'M5' || timeframe === 'M15' || timeframe === '30') return 'D1';
        if (timeframe === '1h' || timeframe === 'H1' || timeframe === '4h' || timeframe === 'H4') return 'W1';
        return 'W1';
    }, [timeframe]);

    const [isCollapsed, setIsCollapsed] = useState(true);
    const [wfaTf, setWfaTf] = useState(initialWfaTf);
    const [wfaMode, setWfaMode] = useState('Chỉ kiểm định Out-of-Sample (OOS)');
    const [wfaOosPercent, setWfaOosPercent] = useState(30);
    const [wfaCycleOffset, setWfaCycleOffset] = useState(0);
    const [wfaScope, setWfaScope] = useState('Tất cả các chu kỳ');
    const [wfaTargetCycle, setWfaTargetCycle] = useState(1);
    const [showCycleDetails, setShowCycleDetails] = useState(false);
    const [showTheoryGuide, setShowTheoryGuide] = useState(false);
    const [selectedCycleIndex, setSelectedCycleIndex] = useState(null);

    // Compute Walk-Forward Analysis Metrics
    const analysis = useMemo(() => {
        return calculateWalkForwardAnalysis(trades, {
            wfaTf,
            wfaMode,
            wfaOosPercent,
            wfaCycleOffset,
            wfaScope,
            wfaTargetCycle
        });
    }, [trades, wfaTf, wfaMode, wfaOosPercent, wfaCycleOffset, wfaScope, wfaTargetCycle]);

    const isFirstRunRef = useRef(true);
    const prevCycleOffsetRef = useRef(wfaCycleOffset);
    const prevTargetCycleRef = useRef(wfaTargetCycle);
    const prevSelectedCycleRef = useRef(selectedCycleIndex);

    // Synchronize active cycle validation zone to chart & trigger auto-scroll on explicit user interaction
    useEffect(() => {
        if (!analysis || !analysis.cycleBreakdown || analysis.cycleBreakdown.length === 0) {
            onWfaZoneChange?.(null);
            return;
        }

        const breakdown = analysis.cycleBreakdown;
        let active = null;

        if (selectedCycleIndex !== null) {
            active = breakdown.find(c => c.cycleIndex === selectedCycleIndex);
        }

        if (!active) {
            const targetIdx = Number(wfaTargetCycle || 1) + Number(wfaCycleOffset || 0);
            active = breakdown.find(c => c.cycleIndex === targetIdx) ||
                     breakdown.find(c => c.effCycleIndex === targetIdx) ||
                     breakdown[Math.min(Math.max(0, targetIdx - 1), breakdown.length - 1)];
        }

        if (active) {
            const zoneData = {
                cycleIndex: active.cycleIndex,
                effCycleIndex: active.effCycleIndex,
                dateKey: active.dateKey,
                startTime: active.startTime,
                splitTime: active.splitTime,
                endTime: active.endTime,
                formattedStart: active.formattedStart,
                formattedEnd: active.formattedEnd,
                formattedLabel: active.formattedLabel,
                wfePercent: active.cycleWfe,
                status: active.status,
                wfaTf,
                wfaMode,
                wfaOosPercent,
            };
            onWfaZoneChange?.(zoneData);

            // Only move the chart if the user explicitly interacted (shifted cycle offset, clicked a cycle, or changed target cycle)
            const userChangedCycle = (!isFirstRunRef.current) && (
                prevCycleOffsetRef.current !== wfaCycleOffset ||
                prevTargetCycleRef.current !== wfaTargetCycle ||
                prevSelectedCycleRef.current !== selectedCycleIndex
            );

            if (userChangedCycle && onFocusDate && (active.formattedStart || active.startTime)) {
                onFocusDate(active.formattedStart || active.startTime);
            }

            isFirstRunRef.current = false;
            prevCycleOffsetRef.current = wfaCycleOffset;
            prevTargetCycleRef.current = wfaTargetCycle;
            prevSelectedCycleRef.current = selectedCycleIndex;
        }
    }, [analysis, selectedCycleIndex, wfaCycleOffset, wfaTargetCycle, wfaTf, wfaMode, wfaOosPercent, onFocusDate, onWfaZoneChange]);

    if (!analysis) return null;

    if (analysis.insufficientData) {
        return (
            <div className="bg-gray-800 rounded-2xl border border-gray-700/80 p-6 shadow-xl space-y-3">
                <div className="flex items-center gap-2 text-purple-400">
                    <Compass size={20} />
                    <h3 className="text-base font-bold text-gray-100">Walk-Forward Analysis (WFA) - Kiểm Định Out-Of-Sample</h3>
                </div>
                <div className="bg-gray-900/60 border border-purple-500/20 rounded-xl p-4 text-xs text-purple-300/90 flex items-center gap-3">
                    <Info size={18} className="shrink-0 text-purple-400" />
                    <p>{analysis.message}</p>
                </div>
            </div>
        );
    }

    const {
        totalTrades,
        totalCyclesCount,
        isOverallStats,
        oosOverallStats,
        fullStats,
        wfePercent,
        robustnessGrade,
        robustnessLabel,
        robustnessColor,
        robustnessDesc,
        cycleBreakdown
    } = analysis;

    const isRobust = robustnessGrade === 'EXCELLENT' || robustnessGrade === 'ROBUST';
    const isModerate = robustnessGrade === 'MODERATE';

    return (
        <div className="bg-gray-800 rounded-2xl border border-gray-700/80 overflow-hidden shadow-xl space-y-0">
            {/* Header */}
            <div className="p-5 border-b border-gray-700/80 bg-gradient-to-r from-gray-800 via-gray-800/90 to-blue-950/25 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl ${
                        isRobust
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-emerald-500/10'
                            : isModerate
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                        <Compass size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                                Walk-Forward Analysis (WFA) - Kiểm Định Out-Of-Sample (OOS)
                            </h3>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                Robert Pardo Standard
                            </span>
                            {/* Summary Badge when collapsed */}
                            {isCollapsed && (
                                <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full ${
                                    isRobust
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                        : isModerate
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                }`}>
                                    WFE: {wfePercent.toFixed(1)}% • {robustnessGrade}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                            Phân đoạn chu kỳ theo Timeframe, chia In-Sample (IS) vs Out-Of-Sample (OOS) & tính chỉ số hiệu suất thực chiến WFE
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {!isCollapsed && (
                        <>
                            {/* Reset Offset Button */}
                            {wfaCycleOffset !== 0 && (
                                <button
                                    type="button"
                                    onClick={() => setWfaCycleOffset(0)}
                                    className="px-2.5 py-1.5 rounded-xl bg-gray-900 border border-gray-700 text-xs text-gray-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                                    title="Đặt lại độ dời về 0 (chu kỳ mặc định)"
                                >
                                    <RotateCcw size={12} />
                                    <span>Reset Offset</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => setShowTheoryGuide(!showTheoryGuide)}
                                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                                    showTheoryGuide
                                        ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                                        : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-gray-200'
                                }`}
                            >
                                <HelpCircle size={14} />
                                <span>Nguyên lý WFA</span>
                            </button>
                        </>
                    )}

                    {/* Elegant Icon-only Collapse Toggle Button */}
                    <button
                        type="button"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="h-8 w-8 rounded-lg bg-gray-900/80 border border-gray-700/80 text-gray-400 hover:text-white hover:border-blue-500/50 hover:bg-blue-950/20 transition-all duration-200 flex items-center justify-center cursor-pointer shadow-sm group"
                        title={isCollapsed ? "Mở rộng" : "Thu gọn"}
                        aria-label={isCollapsed ? "Mở rộng" : "Thu gọn"}
                    >
                        <ChevronDown
                            size={16}
                            className={`transition-transform duration-300 ease-out ${
                                isCollapsed ? 'rotate-0 text-gray-400 group-hover:text-blue-300' : 'rotate-180 text-blue-400'
                            }`}
                        />
                    </button>
                </div>
            </div>

            {!isCollapsed && (
                <>

            {/* Interactive Control Toolbar */}
            <div className="p-4 bg-gray-900/60 border-b border-gray-700/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Dropdown chọn Timeframe Cycle */}
                <div>
                    <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Calendar size={13} className="text-blue-400" />
                        <span>Chu kỳ WFA (Timeframe)</span>
                    </label>
                    <select
                        value={wfaTf}
                        onChange={(e) => setWfaTf(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    >
                        {TIMEFRAME_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 2. Dịch chuyển chu kỳ WFA (Cycle Shift / Offset) */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1">
                            <Clock size={13} className="text-purple-400" />
                            <span>Dịch chuyển Chu kỳ (Offset)</span>
                        </label>
                        <span className={`text-[11px] font-mono font-bold px-1.5 py-0.2 rounded ${
                            wfaCycleOffset > 0
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : wfaCycleOffset < 0
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-gray-800 text-gray-400'
                        }`}>
                            {wfaCycleOffset > 0 ? `+${wfaCycleOffset}` : wfaCycleOffset} {wfaTf}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 bg-gray-800 rounded-xl border border-gray-700 p-1">
                        <button
                            type="button"
                            onClick={() => setWfaCycleOffset(prev => prev - 1)}
                            className="p-1.5 rounded-lg bg-gray-700/60 hover:bg-gray-700 text-gray-200 transition cursor-pointer"
                            title={`Lùi lại 1 ${wfaTf}`}
                        >
                            <ChevronLeft size={15} />
                        </button>
                        <div className="flex-1 text-center font-mono text-xs font-bold text-gray-200">
                            {wfaCycleOffset === 0 ? 'Chu kỳ Chuẩn (0)' : `${wfaCycleOffset > 0 ? '+' : ''}${wfaCycleOffset} ${wfaTf}`}
                        </div>
                        <button
                            type="button"
                            onClick={() => setWfaCycleOffset(prev => prev + 1)}
                            className="p-1.5 rounded-lg bg-gray-700/60 hover:bg-gray-700 text-gray-200 transition cursor-pointer"
                            title={`Sang ${wfaTf} tiếp theo (+1)`}
                        >
                            <ChevronRight size={15} />
                        </button>
                    </div>
                </div>

                {/* 3. Chế độ kiểm định (WFA Mode) */}
                <div>
                    <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Layers size={13} className="text-emerald-400" />
                        <span>Chế độ kiểm định (Mode)</span>
                    </label>
                    <select
                        value={wfaMode}
                        onChange={(e) => setWfaMode(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    >
                        {WFA_MODES.map((m) => (
                            <option key={m.value} value={m.value}>
                                {m.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 4. Tỷ lệ Out-of-Sample (% OOS) */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1">
                            <Sliders size={13} className="text-amber-400" />
                            <span>Tỷ lệ Out-of-Sample (% OOS)</span>
                        </label>
                        <span className="text-[11px] font-mono font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                            {wfaOosPercent}% OOS / {100 - wfaOosPercent}% IS
                        </span>
                    </div>
                    <div className="flex items-center gap-1 bg-gray-800 rounded-xl border border-gray-700 p-1">
                        {OOS_RATIO_PRESETS.map((pct) => (
                            <button
                                key={pct}
                                type="button"
                                onClick={() => setWfaOosPercent(pct)}
                                className={`flex-1 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    wfaOosPercent === pct
                                        ? 'bg-amber-600 text-white shadow-sm'
                                        : 'text-gray-400 hover:text-gray-200'
                                }`}
                            >
                                {pct}%
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sub-toolbar: Scope Selection */}
            <div className="px-5 py-2.5 bg-gray-900/40 border-b border-gray-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-gray-400 font-medium">Phạm vi kiểm định (Scope):</span>
                    {SCOPE_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setWfaScope(opt.value)}
                            className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                                wfaScope === opt.value
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {wfaScope !== 'Tất cả các chu kỳ' && (
                    <div className="flex items-center gap-2">
                        <span className="text-gray-400">Chu kỳ mục tiêu:</span>
                        <input
                            type="number"
                            min="1"
                            max={Math.max(1, totalCyclesCount)}
                            value={wfaTargetCycle}
                            onChange={(e) => setWfaTargetCycle(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-center font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-gray-500 text-[11px]">/ tổng {totalCyclesCount} chu kỳ</span>
                    </div>
                )}
            </div>

            {/* Theory Guide Box (Collapsible) */}
            {showTheoryGuide && (
                <div className="p-5 bg-gradient-to-r from-blue-950/40 via-gray-900/80 to-purple-950/30 border-b border-gray-700/80 text-xs text-gray-300 space-y-3">
                    <div className="flex items-center gap-2 text-blue-400 font-bold">
                        <Sparkles size={16} />
                        <span>Bản chất Toán học & Tiêu chuẩn Walk-Forward Analysis (Robert Pardo):</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-gray-900/70 p-3 rounded-xl border border-gray-700">
                            <span className="text-blue-400 font-bold block mb-1">1. Nguyên lý In-Sample vs OOS:</span>
                            <p className="text-gray-400 text-[11px] leading-relaxed">
                                Dữ liệu mỗi chu kỳ (ví dụ 1 ngày hoặc 1 tuần) được chia làm 2 phần: 70% đầu là <strong>In-Sample (IS)</strong> mô phỏng giai đoạn hình thành tín hiệu, và 30% cuối là <strong>Out-Of-Sample (OOS)</strong> kiểm định thực chiến trên dữ liệu tương lai chưa từng thấy.
                            </p>
                        </div>
                        <div className="bg-gray-900/70 p-3 rounded-xl border border-gray-700">
                            <span className="text-purple-400 font-bold block mb-1">2. Walk-Forward Efficiency (WFE):</span>
                            <p className="text-gray-400 text-[11px] leading-relaxed">
                                <code className="text-emerald-400 font-mono">WFE = (Lợi nhuận OOS / Lợi nhuận IS) × 100%</code>.
                                Nếu WFE &ge; 50%, chiến lược vượt qua bài kiểm tra độ bền vững và không bị bẫy tối ưu hóa quá mức (Overfitting).
                            </p>
                        </div>
                        <div className="bg-gray-900/70 p-3 rounded-xl border border-gray-700">
                            <span className="text-emerald-400 font-bold block mb-1">3. Di chuyển Chu kỳ (Cycle Shift):</span>
                            <p className="text-gray-400 text-[11px] leading-relaxed">
                                Cho phép bạn tịnh tiến khung kiểm định sang ngày/tuần tiếp theo để xem phản ứng của chiến lược ở các giai đoạn thị trường khác nhau (Trend mạnh, Sideway, Flash Crash).
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Stats Grid */}
            <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* 1. Walk-Forward Efficiency (WFE) Gauge */}
                <div className="bg-gray-900/80 rounded-2xl p-5 border border-gray-700/80 flex flex-col justify-between relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Scale size={14} className="text-blue-400" />
                            <span>Walk-Forward Efficiency (WFE)</span>
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            isRobust
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : isModerate
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                            {robustnessGrade}
                        </span>
                    </div>

                    <div className="my-4 text-center">
                        <div className={`text-4xl font-extrabold font-mono tracking-tight ${
                            isRobust ? 'text-emerald-400' : isModerate ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                            {wfePercent.toFixed(1)}%
                        </div>
                        <p className="text-xs font-semibold text-gray-300 mt-1">
                            {robustnessLabel}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                            {robustnessDesc}
                        </p>
                    </div>

                    {/* Progress bar visual */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>0% (Overfit)</span>
                            <span className="text-amber-400 font-semibold">50% (Pass)</span>
                            <span>100% (Robust)</span>
                        </div>
                        <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden flex border border-gray-700">
                            <div
                                className={`h-full transition-all duration-500 ${
                                    isRobust ? 'bg-emerald-500' : isModerate ? 'bg-amber-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.max(5, Math.min(100, wfePercent))}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Out-Of-Sample (OOS) Performance */}
                <div className="bg-gray-900/80 rounded-2xl p-5 border border-purple-500/30 flex flex-col justify-between relative shadow-lg shadow-purple-950/20">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
                        <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldCheck size={15} className="text-purple-400" />
                            <span>Hiệu suất Out-Of-Sample (OOS)</span>
                        </span>
                        <span className="text-[11px] font-mono font-bold text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded-md border border-purple-500/30">
                            {oosOverallStats.count} Lệnh OOS
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 my-3">
                        <div className="bg-gray-800/80 p-2.5 rounded-xl border border-gray-700/60">
                            <span className="text-[10px] text-gray-400 block">Tổng PnL OOS:</span>
                            <span className={`text-sm font-bold font-mono ${oosOverallStats.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {oosOverallStats.totalPnl >= 0 ? '+' : ''}{oosOverallStats.totalPnl.toFixed(2)}%
                            </span>
                        </div>
                        <div className="bg-gray-800/80 p-2.5 rounded-xl border border-gray-700/60">
                            <span className="text-[10px] text-gray-400 block">Win Rate OOS:</span>
                            <span className={`text-sm font-bold font-mono ${oosOverallStats.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {oosOverallStats.winRate.toFixed(1)}%
                            </span>
                        </div>
                        <div className="bg-gray-800/80 p-2.5 rounded-xl border border-gray-700/60">
                            <span className="text-[10px] text-gray-400 block">Profit Factor OOS:</span>
                            <span className={`text-sm font-bold font-mono ${oosOverallStats.profitFactor >= 1.5 ? 'text-emerald-400' : oosOverallStats.profitFactor >= 1.0 ? 'text-blue-400' : 'text-rose-400'}`}>
                                {oosOverallStats.profitFactor.toFixed(2)}
                            </span>
                        </div>
                        <div className="bg-gray-800/80 p-2.5 rounded-xl border border-gray-700/60">
                            <span className="text-[10px] text-gray-400 block">Sharpe Ratio OOS:</span>
                            <span className={`text-sm font-bold font-mono ${oosOverallStats.sharpeRatio >= 1.0 ? 'text-emerald-400' : oosOverallStats.sharpeRatio > 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                                {oosOverallStats.sharpeRatio.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    <div className="text-[11px] text-gray-400 flex items-center justify-between border-t border-gray-800 pt-2">
                        <span>Max Drawdown OOS: <strong className="text-rose-400 font-mono">-{oosOverallStats.maxDrawdown.toFixed(1)}%</strong></span>
                        <span>Avg Trade: <strong className="text-gray-200 font-mono">{oosOverallStats.avgPnl >= 0 ? '+' : ''}{oosOverallStats.avgPnl.toFixed(2)}%</strong></span>
                    </div>
                </div>

                {/* 3. In-Sample (IS) vs Out-Of-Sample Comparison */}
                <div className="bg-gray-900/80 rounded-2xl p-5 border border-gray-700/80 flex flex-col justify-between">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
                        <span className="text-xs font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                            <BarChart2 size={15} className="text-blue-400" />
                            <span>So Sánh In-Sample vs OOS</span>
                        </span>
                        <span className="text-[11px] font-mono font-bold text-gray-400">
                            {isOverallStats.count} IS / {oosOverallStats.count} OOS
                        </span>
                    </div>

                    <div className="space-y-2.5 my-3 text-xs">
                        {/* Win Rate Row */}
                        <div>
                            <div className="flex justify-between text-[11px] mb-1">
                                <span className="text-gray-400">Win Rate:</span>
                                <span>
                                    <strong className="text-blue-400">IS: {isOverallStats.winRate.toFixed(1)}%</strong> vs <strong className="text-purple-400">OOS: {oosOverallStats.winRate.toFixed(1)}%</strong>
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden flex">
                                <div className="h-full bg-blue-500" style={{ width: `${isOverallStats.winRate}%` }} />
                            </div>
                        </div>

                        {/* Total PnL Row */}
                        <div>
                            <div className="flex justify-between text-[11px] mb-1">
                                <span className="text-gray-400">Tổng PnL (%):</span>
                                <span>
                                    <strong className="text-blue-400">IS: {isOverallStats.totalPnl.toFixed(1)}%</strong> vs <strong className="text-purple-400">OOS: {oosOverallStats.totalPnl.toFixed(1)}%</strong>
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden flex">
                                <div className="h-full bg-purple-500" style={{ width: `${Math.max(5, Math.min(100, (oosOverallStats.totalPnl / Math.max(1, isOverallStats.totalPnl + oosOverallStats.totalPnl)) * 100))}%` }} />
                            </div>
                        </div>

                        {/* Profit Factor */}
                        <div className="flex justify-between items-center text-[11px] bg-gray-800/60 px-2.5 py-1.5 rounded-lg border border-gray-700/50">
                            <span className="text-gray-400">Profit Factor:</span>
                            <div className="space-x-3 font-mono">
                                <span>IS: <strong className="text-blue-400">{isOverallStats.profitFactor.toFixed(2)}</strong></span>
                                <span>OOS: <strong className="text-purple-400">{oosOverallStats.profitFactor.toFixed(2)}</strong></span>
                            </div>
                        </div>
                    </div>

                    <div className="text-[11px] text-gray-400 flex items-center justify-between border-t border-gray-800 pt-2">
                        <span>Độ sụt giảm hiệu suất:</span>
                        <strong className={`font-mono ${wfePercent >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {wfePercent >= 100 ? 'Không sụt giảm (Tốt)' : `-${(100 - wfePercent).toFixed(1)}%`}
                        </strong>
                    </div>
                </div>
            </div>

            {/* Cycle Breakdown Accordion / Table */}
            <div className="border-t border-gray-700/80">
                <button
                    type="button"
                    onClick={() => setShowCycleDetails(!showCycleDetails)}
                    className="w-full p-4 bg-gray-900/40 hover:bg-gray-900/80 transition flex items-center justify-between text-xs font-bold text-gray-200 cursor-pointer"
                >
                    <div className="flex items-center gap-2">
                        <Calendar size={15} className="text-blue-400" />
                        <span>Danh Sách Chi Tiết Từng Chu Kỳ WFA ({cycleBreakdown.length} Chu Kỳ)</span>
                        <span className="text-[10px] font-mono text-gray-400 font-normal">
                            (Nhấp để mở rộng bảng phân đoạn In-Sample vs Out-Of-Sample)
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-blue-400">
                        <span>{showCycleDetails ? 'Thu gọn' : 'Xem chi tiết'}</span>
                        {showCycleDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                </button>

                {showCycleDetails && (
                    <div className="p-4 bg-gray-900/60 overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-gray-800/80 text-gray-400 uppercase text-[10px] font-bold tracking-wider">
                                <tr>
                                    <th className="py-2.5 px-3">Chu kỳ #</th>
                                    <th className="py-2.5 px-3">Thời gian Bắt đầu</th>
                                    <th className="py-2.5 px-3">Lệnh IS (PnL)</th>
                                    <th className="py-2.5 px-3">Lệnh OOS (PnL)</th>
                                    <th className="py-2.5 px-3">WinRate OOS</th>
                                    <th className="py-2.5 px-3">WFE Chu kỳ</th>
                                    <th className="py-2.5 px-3">Trạng thái OOS</th>
                                    <th className="py-2.5 px-3 text-right">Xem lệnh</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700/50 text-gray-300">
                                {cycleBreakdown.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="py-6 text-center text-gray-500 italic">
                                            Không có chu kỳ nào trong phạm vi đã chọn.
                                        </td>
                                    </tr>
                                ) : (
                                    cycleBreakdown.map((cycle, idx) => {
                                        const isPass = cycle.status === 'PASS';
                                        const isFail = cycle.status === 'FAIL';

                                        return (
                                            <tr
                                                key={idx}
                                                onClick={() => {
                                                    setSelectedCycleIndex(cycle.cycleIndex);
                                                    if (onFocusDate) onFocusDate(cycle.formattedStart || cycle.startTime);
                                                }}
                                                className={`transition hover:bg-gray-800/80 cursor-pointer ${
                                                    selectedCycleIndex === cycle.cycleIndex ? 'bg-blue-900/30 ring-1 ring-blue-500/50' : ''
                                                }`}
                                                title="Nhấn để di chuyển biểu đồ đến chu kỳ này"
                                            >
                                                <td className="py-2.5 px-3 font-mono font-bold text-gray-300">
                                                    #{cycle.cycleIndex}
                                                    {cycle.effCycleIndex !== cycle.cycleIndex && (
                                                        <span className="text-[10px] text-gray-500 ml-1">
                                                            (Eff: #{cycle.effCycleIndex})
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3 font-mono text-gray-400">
                                                    {cycle.formattedLabel}
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <span className="font-mono text-blue-400 font-semibold">
                                                        {cycle.isStats.count} lệnh
                                                    </span>
                                                    <span className={`text-[11px] font-mono ml-1.5 ${cycle.isStats.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        ({cycle.isStats.totalPnl >= 0 ? '+' : ''}{cycle.isStats.totalPnl.toFixed(1)}%)
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <span className="font-mono text-purple-400 font-semibold">
                                                        {cycle.oosStats.count} lệnh
                                                    </span>
                                                    <span className={`text-[11px] font-mono ml-1.5 font-bold ${cycle.oosStats.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        ({cycle.oosStats.totalPnl >= 0 ? '+' : ''}{cycle.oosStats.totalPnl.toFixed(1)}%)
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 font-mono">
                                                    {cycle.oosStats.count > 0 ? (
                                                        <span className={cycle.oosStats.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}>
                                                            {cycle.oosStats.winRate.toFixed(0)}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-500">-</span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3 font-mono font-bold">
                                                    {cycle.oosStats.count > 0 ? (
                                                        <span className={cycle.cycleWfe >= 50 ? 'text-emerald-400' : 'text-rose-400'}>
                                                            {cycle.cycleWfe.toFixed(0)}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-500">-</span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                        isPass
                                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                            : isFail
                                                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                                            : 'bg-gray-700/40 text-gray-400 border border-gray-700'
                                                    }`}>
                                                        {isPass ? <CheckCircle2 size={11} /> : isFail ? <AlertTriangle size={11} /> : null}
                                                        <span>{isPass ? 'OOS Có Lời' : isFail ? 'OOS Lỗ' : 'Không có lệnh'}</span>
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-right">
                                                    {cycle.tradesOOS.length > 0 && (onViewTrade || onFocusDate) ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedCycleIndex(cycle.cycleIndex);
                                                                if (onViewTrade && cycle.tradesOOS[0]) {
                                                                    onViewTrade(cycle.tradesOOS[0]);
                                                                }
                                                                if (onFocusDate) {
                                                                    onFocusDate(cycle.tradesOOS[0]?.entry_date || cycle.splitTime || cycle.formattedStart);
                                                                }
                                                            }}
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-purple-300 text-[11px] font-semibold border border-purple-500/30 cursor-pointer transition"
                                                            title="Xem lệnh OOS trên biểu đồ"
                                                        >
                                                            <Eye size={11} />
                                                            <span>Xem ({cycle.tradesOOS.length})</span>
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-600 text-[11px]">-</span>
                                                    )}
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
            </>
            )}
        </div>
    );
};

export default WalkForwardAnalysisCard;
