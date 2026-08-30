import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Bot,
    Sparkles,
    Send,
    RefreshCw,
    SlidersHorizontal,
    Copy,
    Check,
    Trash2,
    Zap,
    TrendingUp,
    TrendingDown,
    Scale,
    ShieldAlert,
    ChevronDown,
    ChevronUp,
    Key,
    Eye,
    EyeOff,
    CheckCircle2,
    Loader2
} from 'lucide-react';
import { getAIIntradayDecision } from '../services/intradayAI';

const PROVIDER_OPTIONS = [
    {
        label: 'Gemini (Google)',
        value: 'gemini',
        models: ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
    },
    {
        label: 'OpenAI',
        value: 'openai',
        models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo']
    },
    {
        label: 'Z.AI (GLM)',
        value: 'z.ai',
        models: ['glm-4.5', 'glm-4-air', 'glm-4']
    },
    {
        label: 'Gemma4 (Local Ollama)',
        value: 'gemma',
        models: ['gemma4:e2b', 'gemma2:9b', 'gemma:7b']
    }
];

const PERSONA_OPTIONS = [
    {
        id: 'order_flow_pro',
        name: '📊 Chuyên Gia Order Flow & Sổ Lệnh',
        desc: 'Phân tích sâu tương quan Khớp lệnh Mua/Bán chủ động và Dư mua/Dư bán để tìm dấu hiệu cá mập gom/xả.',
        prompt: 'Bạn là chuyên gia phân tích Order Flow và Cung Cầu Intraday hàng đầu cho hợp đồng tương lai VN30F. Đọc kỹ dữ liệu Khớp lệnh chủ động (BSA) và Sổ lệnh Dư mua/Dư bán (Bid/Ask) để phân tích động lực phe Mua vs phe Bán, phát hiện phân kỳ hoặc bẫy giá (Spoofing) và đưa ra quyết định giao dịch có căn cứ sắc bén.'
    },
    {
        id: 'scalper_fast',
        name: '⚡ Scalper Phái Sinh Siêu Tốc (1-5m)',
        desc: 'Tập trung các mốc khớp lệnh mới nhất, phản xạ nhanh với bứt phá khối lượng và đảo chiều.',
        prompt: 'Bạn là Scalper phái sinh VN30F tốc độ cao. Dựa vào biến động 10-15 mốc thời gian gần nhất của BSA và Bid/Ask, đưa ra tín hiệu vào lệnh LONG / SHORT chớp nhoáng với điểm Entry cụ thể, Stoploss chặt 2-3 điểm và chốt lời nhanh.'
    },
    {
        id: 'risk_manager',
        name: '🛡️ Trader Thận Trọng & Quản Trị Rủi Ro',
        desc: 'Chỉ khuyến nghị khi có sự đồng thuận cao từ cả 2 bảng, cảnh báo rủi ro bẫy giá.',
        prompt: 'Bạn là nhà quản lý rủi ro giao dịch phái sinh. Bạn chỉ khuyến nghị vào lệnh khi cả Khớp lệnh chủ động và Sổ lệnh chờ đều đồng thuận rõ ràng theo một chiều. Nếu có tín hiệu mâu thuẫn hoặc rủi ro bẫy lệnh (chặn bán/mua ảo), hãy khuyến nghị ĐỨNG NGOÀI/THEO DÕI.'
    },
    {
        id: 'custom',
        name: '✍️ Tùy chỉnh Prompt Hệ Thống',
        desc: 'Tự viết chỉ dẫn và phong cách phân tích của riêng bạn.',
        prompt: ''
    }
];

const QUICK_PROMPTS = [
    {
        icon: '🎯',
        label: 'Quyết định Long / Short ngay',
        prompt: 'Dựa trên dữ liệu 2 bảng BSA và Bid/Ask hiện tại, hãy đưa ra quyết định rõ ràng: Nên vào lệnh LONG, SHORT, hay ĐỨNG NGOÀI? Cho biết điểm vào lệnh (Entry), Cắt lỗ (Stoploss), và Chốt lời (Take Profit) mục tiêu.'
    },
    {
        icon: '📊',
        label: 'Đánh giá phân kỳ Cung - Cầu',
        prompt: 'Hãy so sánh giữa Khối lượng Mua/Bán chủ động (BSA) và Tỷ lệ Dư mua/Dư bán (Bid/Ask). Hiện tại 2 bảng này đang ĐỒNG THUẬN hay PHÂN KỲ? Có dấu hiệu bẫy giá (chặn lệnh ảo / gom hàng ngầm) không?'
    },
    {
        icon: '🔍',
        label: 'Cá mập gom hay xả hàng?',
        prompt: 'Phân tích dòng tiền của tay to (Smart Money) trong các mốc thời gian gần nhất: Phe nào đang kiểm soát thị trường? Khối lượng lớn xuất hiện ở chiều Mua hay Bán?'
    },
    {
        icon: '⚖️',
        label: 'Tỷ lệ rủi ro & Xác suất',
        prompt: 'Đánh giá tỷ lệ Risk/Reward và xác suất thắng cho vị thế hiện tại nếu mở lệnh theo chiều thuận dòng tiền.'
    }
];

// Helper to render markdown formatting without external packages
const renderInline = (text) => {
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

const renderMarkdownContent = (markdown) => {
    if (!markdown) return null;
    const lines = String(markdown).split(/\r?\n/);
    const nodes = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) {
            i++;
            continue;
        }

        if (trimmed.startsWith('```')) {
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            i++;
            nodes.push(
                <pre key={`code-${i}`} className="my-3 overflow-auto rounded-xl border border-gray-700/80 bg-gray-950 p-3.5 font-mono text-xs leading-5 text-gray-300">
                    <code>{codeLines.join('\n')}</code>
                </pre>
            );
            continue;
        }

        const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
        if (heading) {
            const level = heading[1].length;
            const headingText = heading[2];
            const isVerdict = /khuyến nghị|quyết định|tín hiệu/i.test(headingText);
            const isLong = /long|mua/i.test(headingText);
            const isShort = /short|bán/i.test(headingText);

            let headingColor = 'text-white';
            if (isVerdict) {
                headingColor = isLong ? 'text-emerald-400' : isShort ? 'text-rose-400' : 'text-amber-300';
            }

            const className = level <= 2
                ? `mt-4 mb-2 text-base font-bold flex items-center gap-2 ${headingColor}`
                : `mt-3 mb-1.5 text-sm font-semibold text-gray-200`;

            nodes.push(
                <div key={`h-${i}`} className={className}>
                    {renderInline(headingText)}
                </div>
            );
            i++;
            continue;
        }

        if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
            const items = [];
            const isOrdered = /^\d+\.\s+/.test(trimmed);
            while (i < lines.length && (/^[-*]\s+/.test(lines[i].trim()) || /^\d+\.\s+/.test(lines[i].trim()))) {
                const cleanItem = lines[i].trim().replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '');
                items.push(cleanItem);
                i++;
            }

            if (isOrdered) {
                nodes.push(
                    <ol key={`ol-${i}`} className="my-2 list-decimal space-y-1 pl-5 text-sm text-gray-300 leading-relaxed">
                        {items.map((item, idx) => (
                            <li key={idx}>{renderInline(item)}</li>
                        ))}
                    </ol>
                );
            } else {
                nodes.push(
                    <ul key={`ul-${i}`} className="my-2 list-disc space-y-1 pl-5 text-sm text-gray-300 leading-relaxed">
                        {items.map((item, idx) => (
                            <li key={idx}>{renderInline(item)}</li>
                        ))}
                    </ul>
                );
            }
            continue;
        }

        if (trimmed.startsWith('>')) {
            nodes.push(
                <blockquote key={`quote-${i}`} className="my-2.5 border-l-4 border-emerald-500/60 bg-emerald-500/10 px-3.5 py-2 rounded-r-lg text-sm italic text-emerald-200">
                    {renderInline(trimmed.replace(/^>\s*/, ''))}
                </blockquote>
            );
            i++;
            continue;
        }

        nodes.push(
            <p key={`p-${i}`} className="my-1.5 text-sm leading-relaxed text-gray-300">
                {renderInline(trimmed)}
            </p>
        );
        i++;
    }

    return nodes;
};

const extractTextFromAIResponse = (res) => {
    const analysis = res?.analysis;
    if (!analysis) return '';

    if (typeof analysis === 'string') return analysis;

    // Gemini
    const geminiText = analysis.candidates
        ?.flatMap(c => c.content?.parts || [])
        ?.map(p => p.text)
        ?.filter(Boolean)
        ?.join('\n\n');
    if (geminiText) return geminiText;

    // OpenAI / Z.AI
    const openAIText = analysis.choices
        ?.map(c => c.message?.content || c.text)
        ?.filter(Boolean)
        ?.join('\n\n');
    if (openAIText) return openAIText;

    // Ollama / Gemma
    if (analysis.response) return analysis.response;
    if (analysis.text) return analysis.text;

    return JSON.stringify(analysis, null, 2);
};

const IntradayAIDecisionBox = ({
    bsaData = [],
    bidAskData = [],
    ticker = '41I1G9000',
    className = ''
}) => {
    // Settings state with localStorage persistence
    const [settings, setSettings] = useState(() => {
        try {
            const saved = localStorage.getItem('intraday_ai_settings');
            if (saved) return JSON.parse(saved);
        } catch {
            // fallback
        }
        return {
            provider: 'gemini',
            model: 'gemini-3.1-flash-lite',
            apiKey: '',
            personaId: 'order_flow_pro',
            customSystemPrompt: '',
            dataScope: 30, // 30 rows
        };
    });

    const [showSettings, setShowSettings] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [inputPrompt, setInputPrompt] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);
    const [chatHistory, setChatHistory] = useState([]);
    const [latestSummary, setLatestSummary] = useState(null);

    const resultEndRef = useRef(null);

    // Save settings to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('intraday_ai_settings', JSON.stringify(settings));
        } catch (e) {
            console.error('Failed to save AI settings:', e);
        }
    }, [settings]);

    const activePersona = useMemo(() => {
        return PERSONA_OPTIONS.find(p => p.id === settings.personaId) || PERSONA_OPTIONS[0];
    }, [settings.personaId]);

    const currentSystemPrompt = useMemo(() => {
        if (settings.personaId === 'custom') {
            return settings.customSystemPrompt || activePersona.prompt;
        }
        return activePersona.prompt;
    }, [settings.personaId, settings.customSystemPrompt, activePersona]);

    // Compute live quick stats from the current data
    const liveStats = useMemo(() => {
        const limit = settings.dataScope || 30;
        const bsaSubset = bsaData.slice(0, limit);
        const bidAskSubset = bidAskData.slice(0, limit);

        let totalBms = 0;
        let totalSms = 0;
        bsaSubset.forEach(r => {
            totalBms += Number(r.bms) || 0;
            totalSms += Number(r.sms) || 0;
        });
        const netVol = totalBms - totalSms;
        const bsr = totalSms > 0 ? (totalBms / totalSms).toFixed(2) : '1.00';

        const latestBA = bidAskSubset[0] || {};
        const latestBs = Number(latestBA.bs ?? latestBA.bv) || 0;
        const latestOa = Number(latestBA.oa ?? latestBA.av) || 0;
        const obp = typeof latestBA.obp === 'number' ? (latestBA.obp * 100).toFixed(1) : '50.0';

        return {
            bsaCount: bsaData.length,
            bidAskCount: bidAskData.length,
            netVol,
            bsr,
            latestBs,
            latestOa,
            obp
        };
    }, [bsaData, bidAskData, settings.dataScope]);

    const handleSendPrompt = async (promptToSend) => {
        const text = (promptToSend || inputPrompt || '').trim();
        if (!text && bsaData.length === 0 && bidAskData.length === 0) return;

        setAnalyzing(true);
        setError(null);

        const userMessage = {
            role: 'user',
            content: text || 'Phân tích dữ liệu 2 bảng BSA & Bid/Ask để đưa ra quyết định giao dịch.',
            timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };

        setChatHistory(prev => [...prev, userMessage]);
        if (!promptToSend) setInputPrompt('');

        try {
            const res = await getAIIntradayDecision({
                provider: settings.provider,
                model: settings.model,
                apiKey: settings.apiKey,
                prompt: userMessage.content,
                systemPrompt: currentSystemPrompt,
                bsaData,
                bidAskData,
                ticker,
                dataScope: settings.dataScope,
            });

            const rawText = extractTextFromAIResponse(res);
            if (res?.summary) {
                setLatestSummary(res.summary);
            }

            const aiMessage = {
                role: 'assistant',
                content: rawText || 'Không nhận được câu trả lời từ AI.',
                provider: res?.provider || settings.provider,
                model: res?.model || settings.model,
                timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            };

            setChatHistory(prev => [...prev, aiMessage]);

            setTimeout(() => {
                resultEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } catch (err) {
            console.error('AI decision request failed:', err);
            const errMsg = err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Lỗi khi gọi AI phân tích.';
            setError(errMsg);
        } finally {
            setAnalyzing(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendPrompt();
        }
    };

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleClearHistory = () => {
        setChatHistory([]);
        setError(null);
    };

    const currentProviderObj = PROVIDER_OPTIONS.find(p => p.value === settings.provider) || PROVIDER_OPTIONS[0];

    return (
        <div className={`rounded-2xl border border-gray-800 bg-gray-900/90 backdrop-blur-md shadow-2xl overflow-hidden flex flex-col ${className}`}>
            {/* Top Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800/80 px-5 py-3.5 bg-gradient-to-r from-gray-900 via-gray-800/60 to-gray-900">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-500/20">
                        <Bot size={20} className="animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-white tracking-wide">
                                AI Trợ Lý Quyết Định Phái Sinh
                            </h2>
                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-400">
                                {ticker}
                            </span>
                        </div>
                        <p className="text-xs text-gray-400">
                            Đọc dữ liệu thực tế từ 2 bảng Khớp Lệnh (BSA) & Sổ Lệnh (Bid/Ask)
                        </p>
                    </div>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2">
                    {/* Live Data Badge */}
                    <div className="hidden sm:flex items-center gap-2 rounded-lg border border-gray-700/60 bg-gray-800/80 px-3 py-1.5 text-xs text-gray-300">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>BSA: <strong className="text-white font-mono">{liveStats.bsaCount}</strong></span>
                        <span className="text-gray-500">|</span>
                        <span>Bid/Ask: <strong className="text-white font-mono">{liveStats.bidAskCount}</strong></span>
                    </div>

                    {/* Quick Trigger Analyze Button */}
                    <button
                        type="button"
                        onClick={() => handleSendPrompt()}
                        disabled={analyzing}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-emerald-600/25 transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        <span>{analyzing ? 'Đang phân tích...' : 'Phân tích ngay'}</span>
                    </button>

                    {/* AI Settings Toggle */}
                    <button
                        type="button"
                        onClick={() => setShowSettings(!showSettings)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${showSettings
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                            : 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                            }`}
                    >
                        <SlidersHorizontal size={14} />
                        <span>Cài đặt AI</span>
                        {showSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>
            </div>

            {/* Main Content Grid: Left (Chat & Result) - Right (AI Settings) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 flex-1 min-h-[500px]">
                {/* Left Column: Chat & Analysis Output (Cols 1-8 or 12 if settings closed) */}
                <div className={`${showSettings ? 'lg:col-span-8' : 'lg:col-span-12'} flex flex-col p-4 md:p-5 border-b lg:border-b-0 ${showSettings ? 'lg:border-r border-gray-800' : ''}`}>

                    {/* Live Data Summary Pills Bar */}
                    <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-2.5">
                            <span className="text-[11px] text-gray-400 block font-medium">Khối Lượng Ròng (Net)</span>
                            <span className={`font-mono text-sm font-bold ${liveStats.netVol >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {liveStats.netVol > 0 ? '+' : ''}{liveStats.netVol.toLocaleString()} CP
                            </span>
                        </div>
                        <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-2.5">
                            <span className="text-[11px] text-gray-400 block font-medium">Tỷ Lệ BSR (M/B)</span>
                            <span className={`font-mono text-sm font-bold ${Number(liveStats.bsr) >= 1 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {liveStats.bsr}x
                            </span>
                        </div>
                        <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-2.5">
                            <span className="text-[11px] text-gray-400 block font-medium">Dư Mua Hiện Tại (bs)</span>
                            <span className="font-mono text-sm font-bold text-emerald-400">
                                {liveStats.latestBs.toLocaleString()} <span className="text-xs text-gray-400 font-normal">({liveStats.obp}%)</span>
                            </span>
                        </div>
                        <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-2.5">
                            <span className="text-[11px] text-gray-400 block font-medium">Dư Bán Hiện Tại (oa)</span>
                            <span className="font-mono text-sm font-bold text-rose-400">
                                {liveStats.latestOa.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* Quick Suggestion Chips */}
                    <div className="mb-3.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-gray-400 flex items-center gap-1 mr-1">
                            <Zap size={12} className="text-amber-400" />
                            Gợi ý nhanh:
                        </span>
                        {QUICK_PROMPTS.map((q, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => handleSendPrompt(q.prompt)}
                                disabled={analyzing}
                                className="inline-flex items-center gap-1.5 rounded-full border border-gray-700/80 bg-gray-800/80 hover:bg-gray-700 px-3 py-1 text-xs text-gray-200 transition hover:border-emerald-500/50 hover:text-emerald-300 disabled:opacity-50 cursor-pointer"
                            >
                                <span>{q.icon}</span>
                                <span>{q.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Chat Input Box */}
                    <div className="relative mb-4 rounded-xl border border-gray-700/80 bg-gray-950/80 focus-within:border-emerald-500/80 focus-within:ring-2 focus-within:ring-emerald-500/20 transition shadow-inner">
                        <textarea
                            value={inputPrompt}
                            onChange={(e) => setInputPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Hỏi AI về xu hướng, tín hiệu vào lệnh Long/Short, phân tích dữ liệu 2 bảng... (Enter để gửi, Shift+Enter xuống dòng)"
                            rows={3}
                            disabled={analyzing}
                            className="w-full resize-none bg-transparent p-3.5 text-sm text-white placeholder-gray-500 outline-none"
                        />
                        <div className="flex items-center justify-between border-t border-gray-800/60 px-3 py-2 text-xs text-gray-400">
                            <span className="hidden sm:inline">
                                Nhấn <kbd className="rounded bg-gray-800 px-1 py-0.5 font-mono text-[10px] text-gray-300">Enter</kbd> để gửi
                            </span>
                            <div className="flex items-center gap-2 ml-auto">
                                {chatHistory.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleClearHistory}
                                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                    >
                                        <Trash2 size={13} />
                                        <span>Xóa lịch sử</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => handleSendPrompt()}
                                    disabled={analyzing || (!inputPrompt.trim() && bsaData.length === 0)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 font-medium text-white shadow-md shadow-emerald-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                    <span>Gửi</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Error Banner if any */}
                    {error && (
                        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
                            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-rose-400" />
                            <div className="flex-1">
                                <strong className="font-semibold block mb-0.5">Lỗi kết nối AI:</strong>
                                <span>{error}</span>
                            </div>
                        </div>
                    )}

                    {/* Chat / Result Display Feed */}
                    <div className="flex-1 overflow-y-auto space-y-4 rounded-xl border border-gray-800 bg-gray-950/40 p-4 max-h-[500px]">
                        {chatHistory.length === 0 && !analyzing ? (
                            <div className="flex flex-col items-center justify-center h-48 text-center text-gray-500">
                                <Bot size={36} className="mb-2 text-gray-600 opacity-60" />
                                <p className="text-sm font-medium text-gray-400">Chưa có phiên phân tích nào</p>
                                <p className="text-xs mt-1 max-w-md text-gray-500">
                                    Bấm <strong>&quot;Phân tích ngay&quot;</strong> hoặc chọn một câu hỏi gợi ý ở trên để AI đọc bảng dữ liệu BSA &amp; Bid/Ask và đưa ra nhận định giao dịch.
                                </p>
                            </div>
                        ) : (
                            <>
                                {chatHistory.map((msg, index) => (
                                    <div
                                        key={index}
                                        className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'
                                            }`}
                                    >
                                        {msg.role === 'user' ? (
                                            <div className="max-w-[85%] rounded-2xl rounded-tr-none bg-emerald-600/90 text-white px-4 py-2.5 shadow-md">
                                                <div className="text-xs text-emerald-100/80 mb-1 flex items-center justify-end gap-2">
                                                    <span>Trader</span>
                                                    <span>· {msg.timestamp}</span>
                                                </div>
                                                <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                                            </div>
                                        ) : (
                                            <div className="w-full rounded-2xl rounded-tl-none border border-gray-700/70 bg-gray-900/90 text-gray-200 p-4 shadow-xl">
                                                <div className="flex items-center justify-between border-b border-gray-800 pb-2.5 mb-3 text-xs text-gray-400">
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 font-bold">
                                                            AI
                                                        </span>
                                                        <span className="font-semibold text-white">Nhận định &amp; Quyết định Giao dịch</span>
                                                        <span className="rounded bg-gray-800 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                                                            {msg.provider} · {msg.model}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] text-gray-500">{msg.timestamp}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopy(msg.content)}
                                                            className="rounded p-1 text-gray-400 hover:text-white hover:bg-gray-800 transition cursor-pointer"
                                                            title="Sao chép nội dung"
                                                        >
                                                            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Formatted Markdown Body */}
                                                <div className="analysis-result-content leading-relaxed">
                                                    {renderMarkdownContent(msg.content)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {analyzing && (
                                    <div className="flex items-start gap-3 rounded-2xl rounded-tl-none border border-gray-800 bg-gray-900/60 p-4 animate-pulse">
                                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                                            <Loader2 size={16} className="animate-spin" />
                                        </div>
                                        <div className="flex-1 space-y-2 py-1">
                                            <div className="text-xs text-emerald-400 font-semibold">AI đang xử lý dữ liệu BSA &amp; Sổ lệnh...</div>
                                            <div className="h-2 w-3/4 rounded bg-gray-800"></div>
                                            <div className="h-2 w-1/2 rounded bg-gray-800"></div>
                                        </div>
                                    </div>
                                )}

                                <div ref={resultEndRef} />
                            </>
                        )}
                    </div>
                </div>

                {/* Right Column: AI Settings Panel */}
                {showSettings && (
                    <div className="lg:col-span-4 p-4 md:p-5 bg-gray-950/60 flex flex-col justify-between space-y-5 animate-in fade-in duration-150">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <SlidersHorizontal size={15} className="text-emerald-400" />
                                    Cấu Hình AI Trợ Lý
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setShowSettings(false)}
                                    className="text-xs text-gray-400 hover:text-white"
                                >
                                    Đóng
                                </button>
                            </div>

                            {/* Provider Selection */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                                    Nhà cung cấp AI (Provider)
                                </label>
                                <select
                                    value={settings.provider}
                                    onChange={(e) => {
                                        const newProv = e.target.value;
                                        const targetProv = PROVIDER_OPTIONS.find(p => p.value === newProv) || PROVIDER_OPTIONS[0];
                                        setSettings(prev => ({
                                            ...prev,
                                            provider: newProv,
                                            model: targetProv.models[0] || ''
                                        }));
                                    }}
                                    className="w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-xs font-medium text-white outline-none focus:border-emerald-500 transition"
                                >
                                    {PROVIDER_OPTIONS.map(p => (
                                        <option key={p.value} value={p.value}>{p.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Model Selection */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                                    Mô hình AI (Model)
                                </label>
                                <div className="space-y-1.5">
                                    <select
                                        value={settings.model}
                                        onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
                                        className="w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-xs font-mono text-white outline-none focus:border-emerald-500 transition"
                                    >
                                        {currentProviderObj.models.map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        value={settings.model}
                                        onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
                                        placeholder="Hoặc nhập tên model tùy ý"
                                        className="w-full rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-1.5 font-mono text-[11px] text-gray-300 placeholder-gray-600 outline-none focus:border-gray-600"
                                    />
                                </div>
                            </div>

                            {/* Custom API Key Input */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                        <Key size={13} className="text-amber-400" />
                                        API Key Riêng (Tùy chọn)
                                    </label>
                                    <span className="text-[10px] text-gray-500">Mặc định dùng .env server</span>
                                </div>
                                <div className="relative">
                                    <input
                                        type={showApiKey ? 'text' : 'password'}
                                        value={settings.apiKey || ''}
                                        onChange={(e) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                                        placeholder="Để trống nếu dùng API Key của hệ thống"
                                        className="w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 pr-9 font-mono text-xs text-white placeholder-gray-600 outline-none focus:border-emerald-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-white"
                                    >
                                        {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>

                            {/* System Persona / Trading Strategy */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                                    Chiến Lược &amp; Persona AI
                                </label>
                                <div className="space-y-2">
                                    {PERSONA_OPTIONS.map(p => (
                                        <label
                                            key={p.id}
                                            className={`block rounded-xl border p-2.5 cursor-pointer transition ${settings.personaId === p.id
                                                ? 'border-emerald-500/80 bg-emerald-500/10'
                                                : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="persona"
                                                    value={p.id}
                                                    checked={settings.personaId === p.id}
                                                    onChange={() => setSettings(prev => ({ ...prev, personaId: p.id }))}
                                                    className="text-emerald-500 focus:ring-emerald-500 h-3.5 w-3.5"
                                                />
                                                <span className="text-xs font-semibold text-white">{p.name}</span>
                                            </div>
                                            <p className="text-[11px] text-gray-400 mt-1 pl-5.5">{p.desc}</p>
                                        </label>
                                    ))}
                                </div>

                                {settings.personaId === 'custom' && (
                                    <textarea
                                        value={settings.customSystemPrompt || ''}
                                        onChange={(e) => setSettings(prev => ({ ...prev, customSystemPrompt: e.target.value }))}
                                        placeholder="Nhập hướng dẫn phân tích tùy biến cho AI..."
                                        rows={3}
                                        className="mt-2 w-full rounded-xl border border-gray-700 bg-gray-900 p-2.5 text-xs text-white placeholder-gray-600 outline-none focus:border-emerald-500"
                                    />
                                )}
                            </div>

                            {/* Data Scope */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                                    Phạm Vi Dữ Liệu Gửi Kèm (Data Scope)
                                </label>
                                <select
                                    value={settings.dataScope}
                                    onChange={(e) => setSettings(prev => ({ ...prev, dataScope: Number(e.target.value) }))}
                                    className="w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 transition"
                                >
                                    <option value={15}>15 mốc thời gian gần nhất (~15-30 phút)</option>
                                    <option value={30}>30 mốc thời gian gần nhất (~30-60 phút)</option>
                                    <option value={60}>60 mốc thời gian gần nhất</option>
                                    <option value={0}>Toàn bộ dữ liệu phiên hôm nay</option>
                                </select>
                            </div>
                        </div>

                        {/* Reset button */}
                        <div className="pt-3 border-t border-gray-800/80">
                            <button
                                type="button"
                                onClick={() => {
                                    setSettings({
                                        provider: 'gemini',
                                        model: 'gemini-3.1-flash-lite',
                                        apiKey: '',
                                        personaId: 'order_flow_pro',
                                        customSystemPrompt: '',
                                        dataScope: 30,
                                    });
                                }}
                                className="w-full rounded-lg border border-gray-700 bg-gray-900 py-1.5 text-xs text-gray-400 hover:bg-gray-800 hover:text-white transition cursor-pointer"
                            >
                                Khôi phục cài đặt gốc
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(IntradayAIDecisionBox);
