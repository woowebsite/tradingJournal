import React, { useState, useMemo } from 'react';
import {
    BrainCircuit,
    Sparkles,
    Loader2,
    CheckCircle2,
    RotateCcw,
    Copy,
    Check,
    Trash2,
    AlertCircle,
    Info,
    TrendingUp,
    BarChart2,
    Layers,
    Sliders
} from 'lucide-react';
import { analyzePythonStrategyWithAI } from '../../services/pythonStrategy';

const AI_PROVIDERS = [
    { label: 'Z.AI', value: 'z.ai', defaultModel: 'glm-4.5' },
    { label: 'OpenAI', value: 'openai', defaultModel: 'gpt-4o-mini' },
    { label: 'Gemini', value: 'gemini', defaultModel: 'gemini-3.1-flash-lite' },
    { label: 'Gemma4', value: 'gemma', defaultModel: 'gemma4:e2b' },
];

const PROMPT_PRESETS = [
    {
        id: 'comprehensive',
        label: 'Phân tích toàn diện',
        prompt: `Hãy phân tích chi tiết lịch sử lệnh giao dịch và hiệu suất của chiến lược trên.

Yêu cầu phân tích:
1. Đánh giá tổng quan hiệu suất: Tỷ lệ thắng (Win Rate), Profit Factor, Tổng lợi nhuận (Total PnL) và mức độ ổn định của chiến lược.
2. Phân tích các lệnh thắng (Wins) và lệnh thua (Losses):
   - Đặc điểm chung của các lệnh thắng lớn nhất và các lệnh thua nặng nhất.
   - Chuỗi thua lỗ (Loss streak) và nguyên nhân chính (do sideway, whipsaw, hay ngược xu hướng mạnh).
3. Đánh giá tỷ lệ Risk/Reward (R:R) và thời gian giữ lệnh (Holding Period): Chiến lược chốt lời/cắt lỗ đã tối ưu chưa?
4. Nhận diện các điểm yếu & rủi ro lớn nhất trong bộ thông số / quy tắc giao dịch hiện tại.
5. Đề xuất 3-5 giải pháp cụ thể để cải thiện hiệu suất (Ví dụ: điều chỉnh bộ lọc xu hướng, tối ưu Stop Loss / Take Profit, quản lý vốn hoặc tránh các điều kiện thị trường bất lợi).

Phong cách trả lời:
- Trình bày bằng Tiếng Việt có cấu trúc rõ ràng, sử dụng heading, bullet points và bảng nếu cần.
- Nhận định sâu sắc, dựa trên số liệu thực tế từ danh sách lệnh.`,
    },
    {
        id: 'losses_whipsaw',
        label: 'Đánh giá lệnh thua & Whipsaw',
        prompt: `Hãy tập trung phân tích sâu vào tất cả các lệnh thua lỗ (Losses) và các nhịp bị quét nhiễu (Whipsaw) trong danh sách lệnh:
1. Phân loại các nguyên nhân gây ra lệnh thua: vào lệnh trễ, chạm Stop Loss sớm trước khi giá chạy, thị trường đi ngang không có xu hướng, hay đảo chiều đột ngột.
2. Thống kê tỷ lệ các lệnh bị cắt lỗ tại đáy/đỉnh ngắn hạn.
3. Đề xuất quy tắc bộ lọc bổ sung hoặc cơ chế trailing stop / thời gian xác nhận để giảm thiểu tối đa các lệnh thua này mà không làm mất đi các lệnh thắng lớn.`,
    },
    {
        id: 'tp_sl_opt',
        label: 'Tối ưu Stop Loss & Take Profit',
        prompt: `Hãy đánh giá hiệu quả của cơ chế chốt lời (Take Profit) và dừng lỗ (Stop Loss) hiện tại:
1. So sánh tỷ lệ R:R thực tế đạt được so với tỷ lệ R:R mục tiêu cài đặt.
2. Liệu chiến lược có đang chốt lời quá sớm (để lỡ sóng lớn) hay để lệnh chuyển từ lãi sang lỗ?
3. Đề xuất mức Stop Loss (theo ATR, Swing High/Low hoặc phần trăm) và Take Profit tối ưu hơn cho cặp tài sản và khung thời gian này.`,
    },
    {
        id: 'streaks_risk',
        label: 'Phân tích chuỗi lệnh & Quản lý vốn',
        prompt: `Hãy phân tích chuỗi các lệnh giao dịch (Win Streaks & Loss Streaks):
1. Chuỗi thua dài nhất là bao nhiêu lệnh liên tiếp và Drawdown tương ứng là bao nhiêu?
2. Có hiện tượng overtrading hoặc vào lệnh liên tục trong cùng một vùng giá không?
3. Đưa ra hướng dẫn quản lý rủi ro và phân bổ vốn (Position Sizing) phù hợp cho trader khi vận hành chiến lược này thực tế.`,
    },
];

const stringifyObjectAsText = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
};

const extractAnalysisText = (result) => {
    const analysis = result?.analysis;
    if (!analysis) return '';

    const geminiText = analysis.candidates
        ?.flatMap((candidate) => candidate.content?.parts || [])
        ?.map((part) => part.text)
        ?.filter(Boolean)
        ?.join('\n\n');
    if (geminiText) return geminiText;

    const openAIText = analysis.choices
        ?.map((choice) => choice.message?.content || choice.text)
        ?.filter(Boolean)
        ?.join('\n\n');
    if (openAIText) return openAIText;

    if (analysis.response) return analysis.response;
    if (analysis.output_text) return analysis.output_text;
    if (analysis.text) return analysis.text;

    return '';
};

const renderInlineMarkdown = (text) => {
    const parts = String(text).split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);

    return parts.map((part, index) => {
        if (!part) return null;
        if (part.startsWith('`') && part.endsWith('`')) {
            return (
                <code key={index} className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-xs text-emerald-300">
                    {part.slice(1, -1)}
                </code>
            );
        }
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={index} className="text-gray-200">{part.slice(1, -1)}</em>;
        }
        return <span key={index}>{part}</span>;
    });
};

const renderMarkdown = (markdown) => {
    const lines = String(markdown || '').split(/\r?\n/);
    const nodes = [];
    let index = 0;

    while (index < lines.length) {
        const line = lines[index];
        const trimmed = line.trim();

        if (!trimmed) {
            index += 1;
            continue;
        }

        if (trimmed.startsWith('```')) {
            const codeLines = [];
            index += 1;
            while (index < lines.length && !lines[index].trim().startsWith('```')) {
                codeLines.push(lines[index]);
                index += 1;
            }
            index += 1;
            nodes.push(
                <pre key={`code-${index}`} className="my-3 overflow-auto rounded-lg border border-gray-700 bg-gray-900 p-3 text-xs leading-6 text-emerald-300">
                    <code>{codeLines.join('\n')}</code>
                </pre>
            );
            continue;
        }

        const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
        if (heading) {
            const level = heading[1].length;
            const className = level <= 2
                ? 'mt-4 mb-2 text-base font-bold text-white flex items-center gap-2 border-b border-gray-700/60 pb-1.5'
                : 'mt-3 mb-1.5 text-sm font-semibold text-emerald-300';
            nodes.push(
                <div key={`heading-${index}`} className={className}>
                    {renderInlineMarkdown(heading[2])}
                </div>
            );
            index += 1;
            continue;
        }

        if (/^[-*]\s+/.test(trimmed)) {
            const items = [];
            while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
                items.push(lines[index].trim().replace(/^[-*]\s+/, ''));
                index += 1;
            }
            nodes.push(
                <ul key={`ul-${index}`} className="my-2.5 list-disc space-y-1.5 pl-5 text-gray-200 text-sm">
                    {items.map((item, itemIndex) => (
                        <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
                    ))}
                </ul>
            );
            continue;
        }

        if (/^\d+\.\s+/.test(trimmed)) {
            const items = [];
            while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
                items.push(lines[index].trim().replace(/^\d+\.\s+/, ''));
                index += 1;
            }
            nodes.push(
                <ol key={`ol-${index}`} className="my-2.5 list-decimal space-y-1.5 pl-5 text-gray-200 text-sm">
                    {items.map((item, itemIndex) => (
                        <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
                    ))}
                </ol>
            );
            continue;
        }

        const paragraph = [trimmed];
        index += 1;
        while (
            index < lines.length &&
            lines[index].trim() &&
            !/^(#{1,4})\s+/.test(lines[index].trim()) &&
            !/^[-*]\s+/.test(lines[index].trim()) &&
            !/^\d+\.\s+/.test(lines[index].trim()) &&
            !lines[index].trim().startsWith('```')
        ) {
            paragraph.push(lines[index].trim());
            index += 1;
        }
        nodes.push(
            <p key={`p-${index}`} className="my-2 text-sm leading-relaxed text-gray-200">
                {renderInlineMarkdown(paragraph.join(' '))}
            </p>
        );
    }

    return nodes;
};

const TradeHistoryAISection = ({
    scanResult,
    params,
    selectedSymbol,
    timeframe,
    profitFactor,
    selectedStrategyFile,
}) => {
    const [provider, setProvider] = useState('z.ai');
    const [model, setModel] = useState('glm-4.5');
    const [prompt, setPrompt] = useState(PROMPT_PRESETS[0].prompt);
    const [selectedPresetId, setSelectedPresetId] = useState('comprehensive');
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [copied, setCopied] = useState(false);

    const trades = useMemo(() => scanResult?.trades || [], [scanResult]);
    const summary = useMemo(() => scanResult?.summary || {}, [scanResult]);

    const winTradesCount = useMemo(() => {
        return trades.filter((t) => (t.pnl_percent || 0) > 0).length;
    }, [trades]);

    const winRate = useMemo(() => {
        if (summary?.winRate !== undefined && summary?.winRate !== null) {
            return summary.winRate;
        }
        if (trades.length === 0) return 0;
        return ((winTradesCount / trades.length) * 100).toFixed(1);
    }, [summary, trades, winTradesCount]);

    const totalPnl = useMemo(() => {
        if (summary?.totalPnlPercent !== undefined && summary?.totalPnlPercent !== null) {
            return summary.totalPnlPercent;
        }
        if (trades.length === 0) return 0;
        return trades.reduce((acc, t) => acc + (t.pnl_percent || 0), 0).toFixed(2);
    }, [summary, trades]);

    const analysisDisplay = useMemo(() => {
        if (!analysisResult) return null;

        const text = extractAnalysisText(analysisResult);
        const ollamaUsage = analysisResult.analysis?.prompt_eval_count != null || analysisResult.analysis?.eval_count != null
            ? {
                model: analysisResult.analysis?.model,
                done: analysisResult.analysis?.done,
                done_reason: analysisResult.analysis?.done_reason,
                prompt_eval_count: analysisResult.analysis?.prompt_eval_count,
                eval_count: analysisResult.analysis?.eval_count,
            }
            : null;

        return {
            text,
            provider: analysisResult.provider || '-',
            model: analysisResult.model || analysisResult.analysis?.modelVersion || '-',
            tradeCount: analysisResult.tradeCount ?? trades.length,
            usage: analysisResult.analysis?.usageMetadata || analysisResult.analysis?.usage || ollamaUsage,
            finishReason: analysisResult.analysis?.candidates?.[0]?.finishReason || analysisResult.analysis?.choices?.[0]?.finish_reason || analysisResult.analysis?.done_reason || '',
        };
    }, [analysisResult, trades]);

    const handleSelectPreset = (preset) => {
        setSelectedPresetId(preset.id);
        setPrompt(preset.prompt);
    };

    const handleAnalyze = async () => {
        if (!trades.length) {
            setError('Vui lòng chạy Scan chiến lược trước để có danh sách Lịch sử Lệnh Giao Dịch gửi cho AI.');
            return;
        }

        if (!prompt.trim()) {
            setError('Vui lòng nhập nội dung Prompt phân tích.');
            return;
        }

        setAnalyzing(true);
        setError('');
        setNotice('');
        setAnalysisResult(null);

        try {
            const summaryPayload = {
                ticker: selectedSymbol,
                timeframe,
                strategyFile: selectedStrategyFile,
                totalTrades: trades.length,
                closedTrades: summary.closedTrades ?? trades.filter((t) => t.status === 'Closed').length,
                winTrades: summary.winTrades ?? winTradesCount,
                lossTrades: summary.lossTrades ?? (trades.length - winTradesCount),
                winRate,
                profitFactor: profitFactor ?? summary.profitFactor,
                totalPnlPercent: totalPnl,
                avgPnlPercent: summary.avgPnlPercent,
                grossProfit: summary.grossProfit,
                grossLoss: summary.grossLoss,
            };

            const result = await analyzePythonStrategyWithAI({
                trades,
                summary: summaryPayload,
                params,
                prompt,
                provider,
                model,
            });

            setAnalysisResult(result);
            setNotice(`Đã hoàn tất phân tích ${trades.length} lệnh giao dịch bằng AI!`);
        } catch (err) {
            setError(
                err?.response?.data?.error?.message ||
                err?.response?.data?.message ||
                err?.message ||
                'Không thể hoàn tất phân tích lệnh bằng AI. Vui lòng kiểm tra API Key hoặc kết nối mạng.',
            );
        } finally {
            setAnalyzing(false);
        }
    };

    const handleCopy = () => {
        if (!analysisDisplay?.text) return;
        navigator.clipboard.writeText(analysisDisplay.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="rounded-xl border border-gray-700 bg-gray-800/95 shadow-md overflow-hidden">
            {/* Section Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-700/80 px-5 py-4 bg-gray-800/60">
                <div className="flex items-center gap-3">
                    <div className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-sm">
                        <BrainCircuit size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white">AI Strategy & Trade History Analysis</h3>
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">
                                <Sparkles size={11} /> AI Insights
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Phân tích chuyên sâu danh sách Lịch sử Lệnh Giao Dịch, hiệu suất Win/Loss, Whipsaw và đề xuất tối ưu thông số
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleAnalyze}
                        disabled={analyzing || trades.length === 0}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        {analyzing ? 'Đang phân tích...' : 'Phân tích với AI'}
                    </button>
                </div>
            </div>

            {/* Main Content Grid: Left = AI Settings, Right = Prompt & Result */}
            <div className="grid grid-cols-1 gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
                {/* 1. Left Column: AI Settings Box (Giống AI Settings của /news-ai) */}
                <div className="space-y-4 border-b border-gray-700/80 p-5 xl:border-b-0 xl:border-r bg-gray-850/40">
                    <div>
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                                <Sliders size={15} className="text-emerald-400" />
                                AI Settings
                            </h4>
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Provider Config</span>
                        </div>
                    </div>

                    {/* AI Provider Selector */}
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-gray-300">AI Provider</span>
                        <select
                            value={provider}
                            onChange={(event) => {
                                const nextProvider = event.target.value;
                                const nextConfig = AI_PROVIDERS.find((item) => item.value === nextProvider);
                                setProvider(nextProvider);
                                setModel(nextConfig?.defaultModel || '');
                            }}
                            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        >
                            {AI_PROVIDERS.map((item) => (
                                <option key={item.value} value={item.value}>{item.label}</option>
                            ))}
                        </select>
                    </label>

                    {/* Model Input */}
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-gray-300">Model</span>
                        <input
                            value={model}
                            onChange={(event) => setModel(event.target.value)}
                            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                            placeholder={AI_PROVIDERS.find((item) => item.value === provider)?.defaultModel || ''}
                        />
                    </label>

                    {/* Trade & Backtest Summary Badges */}
                    <div>
                        <span className="mb-1.5 block text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Input Dữ liệu Lệnh ({selectedSymbol || 'Symbol'} · {timeframe})
                        </span>
                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="rounded-lg border border-gray-700/80 bg-gray-900/70 p-2.5">
                                <div className="text-[11px] uppercase tracking-wider text-gray-400 flex items-center gap-1">
                                    <Layers size={12} className="text-gray-400" />
                                    Tổng số lệnh
                                </div>
                                <div className="mt-1 text-lg font-bold text-white font-mono">{trades.length}</div>
                            </div>
                            <div className="rounded-lg border border-gray-700/80 bg-gray-900/70 p-2.5">
                                <div className="text-[11px] uppercase tracking-wider text-gray-400 flex items-center gap-1">
                                    <BarChart2 size={12} className="text-emerald-400" />
                                    Win Rate
                                </div>
                                <div className="mt-1 text-lg font-bold text-emerald-400 font-mono">{winRate}%</div>
                            </div>
                            <div className="rounded-lg border border-gray-700/80 bg-gray-900/70 p-2.5">
                                <div className="text-[11px] uppercase tracking-wider text-gray-400 flex items-center gap-1">
                                    <TrendingUp size={12} className="text-blue-400" />
                                    Profit Factor
                                </div>
                                <div className="mt-1 text-lg font-bold text-blue-300 font-mono">{profitFactor ?? '-'}</div>
                            </div>
                            <div className="rounded-lg border border-gray-700/80 bg-gray-900/70 p-2.5">
                                <div className="text-[11px] uppercase tracking-wider text-gray-400">Total PnL</div>
                                <div className={`mt-1 text-lg font-bold font-mono ${Number(totalPnl) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {Number(totalPnl) > 0 ? `+${totalPnl}%` : `${totalPnl}%`}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Preset Prompts Selector */}
                    <div>
                        <span className="mb-2 block text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Gợi ý Preset Prompt
                        </span>
                        <div className="space-y-1.5">
                            {PROMPT_PRESETS.map((preset) => {
                                const isSelected = selectedPresetId === preset.id;
                                return (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => handleSelectPreset(preset)}
                                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition border ${
                                            isSelected
                                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                                : 'bg-gray-900/50 border-gray-700 text-gray-300 hover:bg-gray-700/50 hover:text-white'
                                        }`}
                                    >
                                        {preset.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Notice / Error banners */}
                    {notice && (
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 flex items-center gap-2">
                            <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
                            <span>{notice}</span>
                        </div>
                    )}

                    {error && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 flex items-start gap-2">
                            <AlertCircle size={14} className="shrink-0 text-red-400 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                {/* 2. Right Column: Prompt Input & Analysis Result Display */}
                <div className="space-y-4 p-5 flex flex-col justify-between">
                    {/* Prompt Input Area */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles size={13} className="text-emerald-400" />
                                Prompt Phân Tích Lệnh
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    const defaultPreset = PROMPT_PRESETS[0];
                                    setSelectedPresetId(defaultPreset.id);
                                    setPrompt(defaultPreset.prompt);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-200 transition"
                                title="Khôi phục Prompt mặc định"
                            >
                                <RotateCcw size={12} />
                                Reset Prompt
                            </button>
                        </div>
                        <textarea
                            value={prompt}
                            onChange={(event) => setPrompt(event.target.value)}
                            rows={5}
                            placeholder="Nhập yêu cầu phân tích cho AI..."
                            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3.5 py-2.5 text-xs sm:text-sm text-gray-100 font-sans leading-relaxed outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        />
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-400">
                            <Info size={12} className="text-emerald-400 shrink-0" />
                            <span>Input tự động kèm theo: Thông số chiến lược, Tổng kết Backtest & Toàn bộ Danh sách Lịch sử Lệnh Giao Dịch ({trades.length} lệnh).</span>
                        </div>
                    </div>

                    {/* Result Box */}
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                                <BrainCircuit size={14} className="text-emerald-400" />
                                Kết quả phân tích từ AI
                            </div>
                            {analysisDisplay && (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleCopy}
                                        className="inline-flex items-center gap-1 rounded bg-gray-700/60 hover:bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-300 transition"
                                    >
                                        {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                        {copied ? 'Đã sao chép' : 'Sao chép'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAnalysisResult(null);
                                            setNotice('');
                                        }}
                                        className="inline-flex items-center gap-1 rounded bg-gray-700/60 hover:bg-gray-700 px-2 py-1 text-xs font-medium text-gray-400 hover:text-red-300 transition"
                                        title="Xóa kết quả"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {analysisDisplay ? (
                            <div className="rounded-lg border border-gray-700 bg-gray-950 overflow-hidden shadow-inner">
                                <div className="flex flex-wrap items-center gap-2 border-b border-gray-700/80 bg-gray-900/90 px-3.5 py-2 text-xs text-gray-400">
                                    <span className="rounded border border-gray-700 bg-gray-800/80 px-2 py-0.5 text-[11px]">
                                        Provider: <span className="font-semibold text-emerald-300">{analysisDisplay.provider}</span>
                                    </span>
                                    <span className="rounded border border-gray-700 bg-gray-800/80 px-2 py-0.5 text-[11px]">
                                        Model: <span className="font-semibold text-gray-200">{analysisDisplay.model}</span>
                                    </span>
                                    <span className="rounded border border-gray-700 bg-gray-800/80 px-2 py-0.5 text-[11px]">
                                        Lệnh phân tích: <span className="font-semibold text-white">{analysisDisplay.tradeCount}</span>
                                    </span>
                                    {analysisDisplay.finishReason ? (
                                        <span className="rounded border border-gray-700 bg-gray-800/80 px-2 py-0.5 text-[11px]">
                                            Finish: <span className="text-gray-300">{analysisDisplay.finishReason}</span>
                                        </span>
                                    ) : null}
                                </div>

                                <div className="max-h-[460px] overflow-auto p-4 leading-relaxed">
                                    {analysisDisplay.text ? (
                                        <div className="text-sm text-gray-200">
                                            {renderMarkdown(analysisDisplay.text)}
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-200">
                                            AI provider không trả về nội dung phản hồi hợp lệ.
                                        </div>
                                    )}

                                    {analysisDisplay.usage && (
                                        <details className="mt-4 rounded border border-gray-800 bg-gray-900/50 text-[11px]">
                                            <summary className="cursor-pointer px-3 py-1.5 text-gray-400 font-mono hover:text-gray-200">
                                                Xem chi tiết Usage / Tokens
                                            </summary>
                                            <pre className="overflow-auto px-3 pb-2 text-[11px] leading-4 text-gray-400 font-mono">
                                                {stringifyObjectAsText(analysisDisplay.usage)}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900/30 p-8 text-center text-xs text-gray-400 flex flex-col items-center justify-center min-h-[160px]">
                                <Sparkles size={28} className="text-gray-600 mb-2" />
                                <p className="font-medium text-gray-300">Chưa có kết quả phân tích AI</p>
                                <p className="text-gray-400 mt-1 max-w-md">
                                    Sau khi chạy Scan chiến lược, nhấn nút <strong className="text-emerald-400">"Phân tích với AI"</strong> để AI đọc toàn bộ Lịch sử Lệnh Giao Dịch và đưa ra nhận định chuyên sâu.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TradeHistoryAISection;
