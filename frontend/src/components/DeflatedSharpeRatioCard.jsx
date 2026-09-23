import React, { useState, useMemo } from 'react';
import {
    ShieldCheck,
    ShieldAlert,
    AlertTriangle,
    Sliders,
    Info,
    ChevronDown,
    ChevronUp,
    Scale,
    TrendingUp,
    BrainCircuit,
    Activity,
    CheckCircle2,
    XCircle,
    HelpCircle,
    Zap,
    BarChart2,
    Layers
} from 'lucide-react';
import { calculateDSRMetrics } from '../utils/deflatedSharpeRatio';

const PRESET_TRIALS = [
    { label: '1 (Không Tune)', value: 1, desc: 'Chạy 1 thiết lập duy nhất, không tối ưu' },
    { label: '50 (Thử thủ công)', value: 50, desc: 'Thử đổi tham số bằng tay ~50 lần' },
    { label: '500 (Grid nhỏ)', value: 500, desc: 'Quét tổ hợp tham số nhỏ' },
    { label: '1,440 (Grid tối ưu)', value: 1440, desc: 'Không gian Grid Search chuẩn của hệ thống' },
    { label: '6,000 (Vét cạn)', value: 6000, desc: 'Quét vét cạn đa tham số' },
    { label: '20,000 (Deep Search)', value: 20000, desc: 'Quét sâu nhiều tổ hợp & chỉ báo' },
];

const DeflatedSharpeRatioCard = ({ trades = [], timeframe = 'D1', defaultTrials = 1440 }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [numTrials, setNumTrials] = useState(defaultTrials || 1440);
    const [showDetails, setShowDetails] = useState(false);
    const [showFormula, setShowFormula] = useState(false);

    // Tính toán số liệu DSR
    const metrics = useMemo(() => {
        return calculateDSRMetrics(trades, numTrials, { timeframe });
    }, [trades, numTrials, timeframe]);

    if (!metrics) {
        return null;
    }

    if (metrics.insufficientData) {
        return (
            <div className="bg-gray-800 rounded-2xl border border-gray-700/80 p-6 shadow-xl space-y-3">
                <div className="flex items-center gap-2 text-amber-400">
                    <ShieldAlert size={20} />
                    <h3 className="text-base font-bold text-gray-100">Deflated Sharpe Ratio (DSR) - Kiểm Định Overfitting</h3>
                </div>
                <div className="bg-gray-900/60 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-300/90 flex items-center gap-3">
                    <Info size={18} className="shrink-0 text-amber-400" />
                    <p>{metrics.message}</p>
                </div>
            </div>
        );
    }

    const {
        totalTrades,
        sharpeRatio,
        annualizedSharpeRatio,
        skewness,
        kurtosis,
        excessKurtosis,
        expectedMaxSR,
        srStdError,
        psrPercent,
        dsrPercent,
        minTRL,
        riskLevel,
        riskLabel,
        riskColor,
        recommendation,
        isSignificant
    } = metrics;

    return (
        <div className="bg-gray-800 rounded-2xl border border-gray-700/80 overflow-hidden shadow-xl space-y-0">
            {/* Header */}
            <div className="p-5 border-b border-gray-700/80 bg-gradient-to-r from-gray-800 via-gray-800/90 to-purple-950/20 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl ${isSignificant
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-emerald-500/10'
                            : riskLevel === 'MODERATE'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                        <Scale size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                                Deflated Sharpe Ratio (DSR) - Kiểm Định Chống Overfitting
                            </h3>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                Marcos López de Prado (2014)
                            </span>
                            {/* Summary Badge when collapsed */}
                            {isCollapsed && (
                                <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full ${isSignificant
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                        : riskLevel === 'MODERATE'
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                    }`}>
                                    DSR: {dsrPercent.toFixed(1)}% • {riskLabel}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1 max-w-2xl">
                            Hiệu chỉnh Sharpe Ratio thực tế dựa trên <b>{numTrials.toLocaleString()} thử nghiệm (N)</b>, độ lệch <b>Skewness</b>, độ nhọn <b>Kurtosis</b> và <b>{totalTrades} lệnh mẫu (T)</b> để loại trừ ảo giác may mắn do Data Snooping.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end lg:self-center flex-wrap">
                    {!isCollapsed && (
                        <>
                            <button
                                type="button"
                                onClick={() => setShowFormula(!showFormula)}
                                className="px-3 py-1.5 rounded-xl bg-gray-900/80 border border-gray-700 text-xs font-semibold text-gray-300 hover:text-cyan-400 hover:border-cyan-500/40 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                                <HelpCircle size={14} />
                                <span>{showFormula ? 'Ẩn công thức' : 'Công thức DSR'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowDetails(!showDetails)}
                                className="px-3 py-1.5 rounded-xl bg-gray-900/80 border border-gray-700 text-xs font-semibold text-gray-300 hover:text-purple-400 hover:border-purple-500/40 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                                <Info size={14} />
                                <span>{showDetails ? 'Thu gọn chi tiết' : 'Chi tiết thống kê'}</span>
                                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                        </>
                    )}

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
                <>

                    {/* Formula Explanation Collapsible */}
                    {showFormula && (
                        <div className="p-4 bg-gray-900/90 border-b border-gray-700/80 text-xs text-gray-300 space-y-3 animate-in fade-in duration-200">
                            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                                <BrainCircuit size={16} />
                                <span>Bản chất Toán Học của Deflated Sharpe Ratio:</span>
                            </div>
                            <p className="text-gray-400 leading-relaxed">
                                Khi bạn chạy <b>Grid Search</b> qua hàng nghìn bộ tham số, theo lý thuyết thống kê xác suất cực trị (Extreme Value Theory), luôn có những bộ tham số đạt Sharpe Ratio rất cao <b>thuần túy do may mắn ngẫu nhiên</b>. DSR tính xác suất thống kê để khẳng định Sharpe Ratio quan sát được có thực sự vượt qua ngưỡng tối đa sinh ra do ngẫu nhiên từ <i>N</i> thử nghiệm hay không:
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-[11px] bg-gray-950 p-3 rounded-xl border border-gray-800">
                                <div className="space-y-1">
                                    <span className="text-purple-400 font-bold">1. Deflated Sharpe Ratio:</span>
                                    <div className="text-gray-300">DSR = Φ((SR - E[max SR]) / σ_SR)</div>
                                    <div className="text-gray-500 text-[10px]">Φ là hàm phân phối chuẩn tắc CDF.</div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-cyan-400 font-bold">2. Kỳ vọng SR tối đa ngẫu nhiên:</span>
                                    <div className="text-gray-300">E[max SR] ≈ σ_SR · ((1-γ)Φ⁻¹(1-1/N) + γΦ⁻¹(1-1/Ne))</div>
                                    <div className="text-gray-500 text-[10px]">γ ≈ 0.5772 (Euler-Mascheroni), N là số lần thử.</div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-emerald-400 font-bold">3. Sai số chuẩn phi chuẩn tắc:</span>
                                    <div className="text-gray-300">σ_SR = √((1 - γ₃·SR + ((γ₄-1)/4)·SR²) / (T-1))</div>
                                    <div className="text-gray-500 text-[10px]">γ₃: Skewness, γ₄: Kurtosis, T: số lệnh.</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Trial Simulator Controls Bar */}
                    <div className="p-4 bg-gray-900/60 border-b border-gray-700/80 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Sliders size={16} className="text-purple-400" />
                                <span className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                                    Số Lượng Thử Nghiệm Đã Chạy (Trials - N):
                                </span>
                                <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 font-mono font-bold text-xs border border-purple-500/30">
                                    {numTrials.toLocaleString()} Thử nghiệm
                                </span>
                            </div>

                            {/* Numeric Input */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">Tùy chỉnh N:</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={100000}
                                    step={50}
                                    value={numTrials}
                                    onChange={(e) => setNumTrials(Math.max(1, Number(e.target.value) || 1))}
                                    className="w-28 bg-gray-950 border border-gray-700 rounded-lg px-2.5 py-1 text-xs text-right font-mono font-bold text-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                />
                            </div>
                        </div>

                        {/* Quick Preset Buttons */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                            {PRESET_TRIALS.map((preset) => {
                                const active = numTrials === preset.value;
                                return (
                                    <button
                                        key={preset.value}
                                        type="button"
                                        onClick={() => setNumTrials(preset.value)}
                                        title={preset.desc}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${active
                                                ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/20 scale-105'
                                                : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200 hover:border-gray-600'
                                            }`}
                                    >
                                        {preset.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Slider */}
                        <div className="flex items-center gap-3 pt-1">
                            <span className="text-[11px] text-gray-500 font-mono">1</span>
                            <input
                                type="range"
                                min={1}
                                max={10000}
                                step={10}
                                value={Math.min(10000, numTrials)}
                                onChange={(e) => setNumTrials(Number(e.target.value))}
                                className="w-full accent-purple-500 cursor-pointer h-1.5 bg-gray-700 rounded-lg"
                            />
                            <span className="text-[11px] text-gray-500 font-mono">10,000+</span>
                        </div>
                    </div>

                    {/* Core Metrics Grid */}
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* 1. Deflated Sharpe Ratio (DSR) Main Gauge */}
                        <div className={`p-4 rounded-2xl border transition relative overflow-hidden flex flex-col justify-between ${isSignificant
                                ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-950/30'
                                : riskLevel === 'MODERATE'
                                    ? 'bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-950/30'
                                    : 'bg-rose-950/20 border-rose-500/40 shadow-lg shadow-rose-950/30'
                            }`}>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <ShieldCheck size={16} className={isSignificant ? 'text-emerald-400' : 'text-amber-400'} />
                                    DSR (Deflated SR)
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isSignificant
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                        : riskLevel === 'MODERATE'
                                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    }`}>
                                    {riskLabel}
                                </span>
                            </div>

                            <div className="my-3 flex items-baseline gap-2">
                                <span className={`text-3xl font-extrabold font-mono tracking-tight ${isSignificant ? 'text-emerald-400' : riskLevel === 'MODERATE' ? 'text-amber-400' : 'text-rose-400'
                                    }`}>
                                    {dsrPercent.toFixed(1)}%
                                </span>
                                <span className="text-xs text-gray-400 font-medium">
                                    / Mục tiêu ≥ 95.0%
                                </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="space-y-1.5">
                                <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden border border-gray-700/60 relative">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${isSignificant ? 'bg-emerald-500' : riskLevel === 'MODERATE' ? 'bg-amber-500' : 'bg-rose-500'
                                            }`}
                                        style={{ width: `${Math.min(100, Math.max(5, dsrPercent))}%` }}
                                    />
                                    <div
                                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow"
                                        style={{ left: '95%' }}
                                        title="Ngưỡng 95% tin cậy thống kê"
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                                    <span>0%</span>
                                    <span className="text-emerald-400 font-bold">95% (p=0.05)</span>
                                    <span>100%</span>
                                </div>
                            </div>
                        </div>

                        {/* 2. Probabilistic Sharpe Ratio (PSR) */}
                        <div className="p-4 rounded-2xl border border-gray-700/80 bg-gray-900/40 flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <BarChart2 size={16} className="text-cyan-400" />
                                    PSR (Chuẩn Tắc)
                                </span>
                                <span className="text-[10px] text-gray-500 font-mono">vs Benchmark SR=0</span>
                            </div>

                            <div className="my-3 flex items-baseline gap-2">
                                <span className="text-3xl font-extrabold font-mono text-cyan-400">
                                    {psrPercent.toFixed(1)}%
                                </span>
                            </div>

                            <p className="text-[11px] text-gray-400">
                                Xác suất SR &gt; 0 khi <b>chưa xét</b> tới bias thử nghiệm nhiều lần (N=1).
                            </p>
                        </div>

                        {/* 3. Sample Sharpe Ratio (SR Gốc & Annualized) */}
                        <div className="p-4 rounded-2xl border border-gray-700/80 bg-gray-900/40 flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <TrendingUp size={16} className="text-purple-400" />
                                    Sharpe Ratio (Gốc)
                                </span>
                                <span className="text-[10px] text-purple-400 font-mono font-bold">Per-Trade</span>
                            </div>

                            <div className="my-3 flex items-baseline gap-2">
                                <span className="text-3xl font-extrabold font-mono text-gray-100">
                                    {sharpeRatio.toFixed(2)}
                                </span>
                                <span className="text-xs text-purple-300 font-mono font-semibold">
                                    (Năm: ~{annualizedSharpeRatio.toFixed(2)})
                                </span>
                            </div>

                            <p className="text-[11px] text-gray-400">
                                Sai số chuẩn: <span className="font-mono text-gray-300">±{srStdError.toFixed(3)}</span> trên {totalTrades} lệnh.
                            </p>
                        </div>

                        {/* 4. Expected Maximum Sharpe Ratio E[max SR] */}
                        <div className="p-4 rounded-2xl border border-gray-700/80 bg-gray-900/40 flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Zap size={16} className="text-amber-400" />
                                    Kỳ Vọng Max SR Ngẫu Nhiên
                                </span>
                                <span className="text-[10px] text-amber-400 font-mono font-bold">E[max SR]</span>
                            </div>

                            <div className="my-3 flex items-baseline gap-2">
                                <span className="text-3xl font-extrabold font-mono text-amber-400">
                                    {expectedMaxSR.toFixed(2)}
                                </span>
                            </div>

                            <p className="text-[11px] text-gray-400">
                                Ngưỡng SR tối đa sinh ra do ngẫu nhiên khi thử <b>{numTrials.toLocaleString()}</b> lần.
                            </p>
                        </div>
                    </div>

                    {/* Overfitting Diagnostic Recommendation Banner */}
                    <div className="px-5 pb-5">
                        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${isSignificant
                                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                                : riskLevel === 'MODERATE'
                                    ? 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                                    : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                            }`}>
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 shrink-0">
                                    {isSignificant ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                                </div>
                                <div className="space-y-0.5">
                                    <span className="text-xs font-bold uppercase tracking-wider">
                                        Đánh Giá Overfitting & Khuyến Nghị Thực Nghiệm:
                                    </span>
                                    <p className="text-xs text-gray-200 leading-relaxed">
                                        {recommendation}
                                    </p>
                                </div>
                            </div>

                            {minTRL !== Infinity && (
                                <div className="shrink-0 bg-gray-900/80 px-3 py-2 rounded-lg border border-gray-700/60 text-right">
                                    <div className="text-[10px] text-gray-400 font-medium">Số Lệnh Tối Thiểu (MinTRL)</div>
                                    <div className="text-xs font-mono font-bold text-gray-100">
                                        {totalTrades} / <span className="text-cyan-400">{minTRL} Lệnh</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Statistical Details Breakdown Table (Collapsible) */}
                    {showDetails && (
                        <div className="p-5 border-t border-gray-700/80 bg-gray-900/50 space-y-4 animate-in fade-in duration-200">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-200 uppercase tracking-wider">
                                <Layers size={15} className="text-purple-400" />
                                <span>Bảng Thống Kê Chi Tiết Phân Phối Lợi Nhuận & Higher Moments:</span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                <div className="bg-gray-800/80 p-3 rounded-xl border border-gray-700/50">
                                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Độ Lệch (Skewness)</span>
                                    <div className="text-base font-bold font-mono text-gray-100 mt-1">
                                        {skewness.toFixed(3)}
                                    </div>
                                    <span className="text-[10px] text-gray-500">
                                        {skewness > 0 ? 'Lệch phải (Lãi lớn)' : 'Lệch trái (Đuôi lỗ)'}
                                    </span>
                                </div>

                                <div className="bg-gray-800/80 p-3 rounded-xl border border-gray-700/50">
                                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Độ Nhọn (Kurtosis)</span>
                                    <div className="text-base font-bold font-mono text-gray-100 mt-1">
                                        {kurtosis.toFixed(3)}
                                    </div>
                                    <span className="text-[10px] text-gray-500">
                                        {excessKurtosis > 0 ? 'Đuôi béo (Fat-tail)' : 'Đuôi mỏng'}
                                    </span>
                                </div>

                                <div className="bg-gray-800/80 p-3 rounded-xl border border-gray-700/50">
                                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Số Lệnh Đã Đóng (T)</span>
                                    <div className="text-base font-bold font-mono text-gray-100 mt-1">
                                        {totalTrades}
                                    </div>
                                    <span className="text-[10px] text-gray-500">Quan sát mẫu</span>
                                </div>

                                <div className="bg-gray-800/80 p-3 rounded-xl border border-gray-700/50">
                                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Số Thử Nghiệm (N)</span>
                                    <div className="text-base font-bold font-mono text-purple-400 mt-1">
                                        {numTrials.toLocaleString()}
                                    </div>
                                    <span className="text-[10px] text-gray-500">Trials Backtest</span>
                                </div>

                                <div className="bg-gray-800/80 p-3 rounded-xl border border-gray-700/50">
                                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Sai Số Chuẩn (σ_SR)</span>
                                    <div className="text-base font-bold font-mono text-cyan-400 mt-1">
                                        {srStdError.toFixed(4)}
                                    </div>
                                    <span className="text-[10px] text-gray-500">Lo-Mertens error</span>
                                </div>

                                <div className="bg-gray-800/80 p-3 rounded-xl border border-gray-700/50">
                                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Tỷ Lệ Giảm Kỳ Vọng</span>
                                    <div className="text-base font-bold font-mono text-amber-400 mt-1">
                                        {expectedMaxSR > 0 ? `${Math.min(100, Math.round((expectedMaxSR / Math.max(0.001, sharpeRatio)) * 100))}%` : '0%'}
                                    </div>
                                    <span className="text-[10px] text-gray-500">Haircut do N thử</span>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default DeflatedSharpeRatioCard;
