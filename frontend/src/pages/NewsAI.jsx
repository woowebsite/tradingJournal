import { useEffect, useMemo, useState } from 'react';
import {
    BrainCircuit,
    CheckCircle2,
    Loader2,
    RefreshCw,
    Save,
    Sparkles,
    X,
} from 'lucide-react';
import { analyzeNewsWithAI, getNewsAIHistory, saveNewsAIResult } from '../services/newsAI';

const defaultPrompt = `Hãy phân tích kỹ các bài báo đã chọn và đưa ra nhận định chi tiết, không trả lời quá ngắn.

Yêu cầu đầu ra:
1. Tóm tắt ngắn gọn từng bài báo theo ý chính.
2. Chỉ ra các sự kiện, số liệu, phát biểu hoặc dữ kiện quan trọng có thể ảnh hưởng đến thị trường.
3. Phân tích tác động tiềm năng lên các nhóm tài sản như cổ phiếu, chỉ số, ngoại hối, hàng hóa hoặc crypto nếu có liên quan.
4. Nêu mức độ ảnh hưởng: ngắn hạn, trung hạn hay dài hạn.
5. Chỉ ra các kịch bản có thể xảy ra: tích cực, tiêu cực và trung tính.
6. Đưa ra quan điểm hành động cho trader/investor, ví dụ: nên theo dõi gì, rủi ro nào cần tránh, và tín hiệu nào cần xác nhận thêm.
7. Nếu dữ liệu chưa đủ rõ, hãy nói rõ giả định đang dùng thay vì kết luận quá chắc chắn.

Phong cách trả lời:
- Viết bằng tiếng Việt rõ ràng, có cấu trúc.
- Dùng heading, bullet points và bảng nếu phù hợp.
- Ưu tiên phân tích sâu hơn là tóm tắt ngắn.
- Không lặp lại tiêu đề bài viết một cách máy móc.
- Nếu có nhiều bài, hãy tổng hợp điểm chung và điểm khác nhau giữa chúng.

Kết luận cuối cùng nên có:
- Mức độ đáng chú ý của tin tức.
- Tác động chính lên thị trường.
- 1 đến 3 ý quan sát hoặc thiết lập giao dịch đáng theo dõi.`;

const getItemId = (item) => item?.documentId || item?.id || '';
const getItemStatus = (item) => item?.status || 'Unread';

const getStatusBadgeClass = (status) => {
    if (status === 'Read') {
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    }

    return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
};

const getLatestDayKey = (items) => {
    const dayKeys = Array.from(new Set(items.map((item) => item?.dayKey).filter(Boolean)));
    return dayKeys.sort((a, b) => b.localeCompare(a))[0] || new Date().toISOString().slice(0, 10);
};

const buildSelectedLinksPayload = (items) => (
    items.map((item) => ({
        title: item?.title || '',
        sourceName: item?.sourceName || '',
        sourceUrl: item?.sourceUrl || '',
        articleUrl: item?.articleUrl || '',
        excerpt: item?.excerpt || '',
        dayKey: item?.dayKey || '',
        fetchedAt: item?.fetchedAt || '',
        documentId: item?.documentId || '',
        id: item?.id || '',
    }))
);

const AI_PROVIDERS = [
    { label: 'Z.AI', value: 'z.ai', defaultModel: 'glm-4.5' },
    { label: 'OpenAI', value: 'openai', defaultModel: 'gpt-4o-mini' },
    { label: 'Gemini', value: 'gemini', defaultModel: 'gemini-3.1-flash-lite' },
    { label: 'Gemma4', value: 'gemma', defaultModel: 'gemma4:e2b' },
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
                <code key={index} className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-xs text-emerald-200">
                    {part.slice(1, -1)}
                </code>
            );
        }
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={index} className="text-gray-100">{part.slice(1, -1)}</em>;
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
                <pre key={`code-${index}`} className="my-4 overflow-auto rounded-lg border border-gray-700 bg-gray-900 p-3 text-xs leading-6 text-gray-300">
                    <code>{codeLines.join('\n')}</code>
                </pre>
            );
            continue;
        }

        const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
        if (heading) {
            const level = heading[1].length;
            const className = level <= 2
                ? 'mt-5 mb-2 text-lg font-semibold text-white'
                : 'mt-4 mb-2 text-base font-semibold text-white';
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
                <ul key={`ul-${index}`} className="my-3 list-disc space-y-1 pl-5 text-gray-200">
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
                <ol key={`ol-${index}`} className="my-3 list-decimal space-y-1 pl-5 text-gray-200">
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
            <p key={`p-${index}`} className="my-3 text-sm leading-7 text-gray-200">
                {renderInlineMarkdown(paragraph.join(' '))}
            </p>
        );
    }

    return nodes;
};

const NewsAI = () => {
    const [items, setItems] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [provider, setProvider] = useState('gemini');
    const [model, setModel] = useState('gemini-3.1-flash-lite');
    const [prompt, setPrompt] = useState(defaultPrompt);
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [analysisResult, setAnalysisResult] = useState(null);
    const [dayFilter, setDayFilter] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');

    const selectedItems = useMemo(
        () => items.filter((item) => selectedIds.includes(getItemId(item))),
        [items, selectedIds],
    );

    const dayOptions = useMemo(() => (
        Array.from(new Set(items.map((item) => item.dayKey).filter(Boolean))).sort((a, b) => b.localeCompare(a))
    ), [items]);

    const sourceOptions = useMemo(() => (
        Array.from(new Set(items.map((item) => item.sourceName || item.sourceUrl).filter(Boolean))).sort()
    ), [items]);

    const filteredItems = useMemo(() => {
        const statusRank = (item) => (getItemStatus(item) === 'Read' ? 1 : 0);
        const timeRank = (item) => new Date(item?.fetchedAt || item?.createdAt || 0).getTime();

        return items
            .filter((item) => {
                const source = item.sourceName || item.sourceUrl || '';
                return (!dayFilter || item.dayKey === dayFilter) && (!sourceFilter || source === sourceFilter);
            })
            .sort((left, right) => {
                const statusDiff = statusRank(left) - statusRank(right);
                if (statusDiff !== 0) return statusDiff;

                return timeRank(right) - timeRank(left);
            });
    }, [dayFilter, items, sourceFilter]);

    const checkAllVisibleItems = () => {
        const visibleIds = filteredItems.map((item) => getItemId(item)).filter(Boolean);
        setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    };

    const uncheckAllVisibleItems = () => {
        const visibleIds = new Set(filteredItems.map((item) => getItemId(item)).filter(Boolean));
        setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    };

    const analysisDisplay = useMemo(() => {
        if (!analysisResult) return null;

        const text = extractAnalysisText(analysisResult);
        const ollamaUsage = analysisResult.analysis?.prompt_eval_count != null || analysisResult.analysis?.eval_count != null
            ? {
                model: analysisResult.analysis?.model,
                done: analysisResult.analysis?.done,
                done_reason: analysisResult.analysis?.done_reason,
                prompt_eval_count: analysisResult.analysis?.prompt_eval_count,
                prompt_eval_duration: analysisResult.analysis?.prompt_eval_duration,
                eval_count: analysisResult.analysis?.eval_count,
                eval_duration: analysisResult.analysis?.eval_duration,
                total_duration: analysisResult.analysis?.total_duration,
                load_duration: analysisResult.analysis?.load_duration,
            }
            : null;
        return {
            text,
            provider: analysisResult.provider || '-',
            model: analysisResult.model || analysisResult.analysis?.modelVersion || '-',
            selectedCount: analysisResult.selectedCount ?? '-',
            usage: analysisResult.analysis?.usageMetadata || analysisResult.analysis?.usage || ollamaUsage,
            finishReason: analysisResult.analysis?.candidates?.[0]?.finishReason || analysisResult.analysis?.choices?.[0]?.finish_reason || analysisResult.analysis?.done_reason || '',
        };
    }, [analysisResult]);

    const loadItems = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await getNewsAIHistory();
            setItems(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err?.response?.data?.error?.message || err?.message || 'Failed to load news analysis database.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!saveSuccess) return undefined;

        const timer = setTimeout(() => {
            setSaveSuccess(false);
            setSaveMessage('');
        }, 3000);

        return () => clearTimeout(timer);
    }, [saveSuccess]);

    useEffect(() => {
        loadItems();
    }, []);

    const toggleItem = (id) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id],
        );
    };

    const handleAnalyze = async () => {
        if (!selectedIds.length) {
            setError('Please select at least one news item to analyze.');
            return;
        }

        setAnalyzing(true);
        setError('');
        setNotice('');
        setAnalysisResult(null);

        try {
            const result = await analyzeNewsWithAI({
                newsIds: selectedIds,
                provider,
                model,
                prompt,
            });
            setAnalysisResult(result);
            setNotice('AI analysis completed.');
            await loadItems();
        } catch (err) {
            setError(
                err?.response?.data?.error?.message ||
                err?.response?.data?.message ||
                err?.message ||
                'Failed to analyze news with AI.',
            );
        } finally {
            setAnalyzing(false);
        }
    };

    const handleSave = async () => {
        if (!selectedItems.length) {
            setError('Please select at least one news item to save.');
            return;
        }

        const analysisText = analysisDisplay?.text || '';
        if (!analysisText) {
            setError('Please run Analysis before saving to NewsAI.');
            return;
        }

        setSaving(true);
        setError('');
        setNotice('');

        try {
            const day = getLatestDayKey(selectedItems);
            const links = buildSelectedLinksPayload(selectedItems);
            const title = `News AI ${day}`;

            await saveNewsAIResult({
                title,
                content: analysisText,
                links,
                day,
                provider: analysisDisplay?.provider || provider,
                model: analysisDisplay?.model || model,
                prompt,
                selectedCount: selectedItems.length,
                selectedDays: Array.from(new Set(selectedItems.map((item) => item?.dayKey).filter(Boolean))),
            });

            setSaveMessage('Saved to NewsAI.');
            setSaveSuccess(true);
        } catch (err) {
            setError(
                err?.response?.data?.error?.message ||
                err?.response?.data?.message ||
                err?.message ||
                'Failed to save NewsAI result.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                        <BrainCircuit size={14} />
                        News AI
                    </div>
                    <h2 className="mt-4 text-3xl font-bold text-white">AI news analysis workspace</h2>
                    <p className="mt-2 max-w-3xl text-sm text-gray-400">
                        Select saved news from the news analysis database, send it to your chosen AI provider, then review the AI output before using it in your trading plan.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
                <div className="space-y-5 rounded-xl border border-gray-700 bg-gray-800 p-5 shadow-sm">
                    <div>
                        <h3 className="text-lg font-semibold text-white">AI Settings</h3>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500">Provider configuration</p>
                    </div>

                    <label className="block">
                        <span className="mb-2 block text-sm font-medium text-gray-300">AI Provider</span>
                        <select
                            value={provider}
                            onChange={(event) => {
                                const nextProvider = event.target.value;
                                const nextConfig = AI_PROVIDERS.find((item) => item.value === nextProvider);
                                setProvider(nextProvider);
                                setModel(nextConfig?.defaultModel || '');
                            }}
                            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        >
                            {AI_PROVIDERS.map((item) => (
                                <option key={item.value} value={item.value}>{item.label}</option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-2 block text-sm font-medium text-gray-300">Model</span>
                        <input
                            value={model}
                            onChange={(event) => setModel(event.target.value)}
                            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                            placeholder={AI_PROVIDERS.find((item) => item.value === provider)?.defaultModel || ''}
                        />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Selected</div>
                            <div className="mt-2 text-2xl font-bold text-white">{selectedIds.length}</div>
                        </div>
                        <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Database</div>
                            <div className="mt-2 text-2xl font-bold text-white">{items.length}</div>
                        </div>
                    </div>

                    {notice && (
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                            {notice}
                        </div>
                    )}

                    {error && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                            {error}
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-gray-700 bg-gray-800 shadow-sm">
                    <div className="flex flex-col gap-4 border-b border-gray-700 px-5 py-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold text-white">News Analysis Database</h3>
                                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500">Select rows to send to the chosen AI provider</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={checkAllVisibleItems}
                                    disabled={filteredItems.length === 0}
                                    className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Check All
                                </button>
                                <button
                                    type="button"
                                    onClick={uncheckAllVisibleItems}
                                    disabled={filteredItems.length === 0}
                                    className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Uncheck All
                                </button>
                                <button
                                    type="button"
                                    onClick={loadItems}
                                    className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-700"
                                >
                                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                                    Reload
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Day</span>
                                <select
                                    value={dayFilter}
                                    onChange={(event) => setDayFilter(event.target.value)}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                >
                                    <option value="">All days</option>
                                    {dayOptions.map((day) => (
                                        <option key={day} value={day}>{day}</option>
                                    ))}
                                </select>
                            </label>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Source</span>
                                <select
                                    value={sourceFilter}
                                    onChange={(event) => setSourceFilter(event.target.value)}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                >
                                    <option value="">All sources</option>
                                    {sourceOptions.map((source) => (
                                        <option key={source} value={source}>{source}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-gray-500">
                            <Loader2 size={24} className="mx-auto mb-2 animate-spin opacity-60" />
                            Loading news rows...
                        </div>
                    ) : items.length === 0 ? (
                        <div className="p-12 text-center text-sm text-gray-500">
                            No rows found. Use News Analysis first to crawl and save headlines.
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="p-12 text-center text-sm text-gray-500">
                            No rows match the selected filters.
                        </div>
                    ) : (
                        <div className="max-h-[620px] overflow-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="sticky top-0 z-10 bg-gray-900 text-xs uppercase tracking-[0.18em] text-gray-400">
                                    <tr>
                                        <th className="w-12 px-5 py-3"></th>
                                        <th className="px-5 py-3">Day Key</th>
                                        <th className="px-5 py-3">Status</th>
                                        <th className="px-5 py-3">Source</th>
                                        <th className="px-5 py-3">Title</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700/70">
                                    {filteredItems.map((item) => {
                                        const id = getItemId(item);
                                        const selected = selectedIds.includes(id);
                                        return (
                                            <tr key={id || `${item.title}-${item.fetchedAt}`} className="hover:bg-gray-700/30">
                                                <td className="px-5 py-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={selected}
                                                        onChange={() => toggleItem(id)}
                                                        disabled={!id}
                                                        className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-emerald-500 focus:ring-emerald-500"
                                                    />
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-gray-400">
                                                    {item.dayKey || '-'}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getStatusBadgeClass(getItemStatus(item))}`}>
                                                        {getItemStatus(item)}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="font-medium text-white">{item.sourceName || '-'}</div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    {item.title ? (
                                                        <a
                                                            href={item.articleUrl || item.sourceUrl || '#'}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="max-w-[560px] text-gray-200 transition hover:text-emerald-300 hover:underline"
                                                        >
                                                            {item.title}
                                                        </a>
                                                    ) : (
                                                        <div className="max-w-[560px] text-gray-200">-</div>
                                                    )}
                                                    {item.excerpt ? (
                                                        <div className="mt-1 max-w-[560px] text-xs text-gray-500">{item.excerpt}</div>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <div className="rounded-xl border border-gray-700 bg-gray-800 shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-gray-700 px-5 py-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white">News Analysis</h3>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500">
                            Latest AI response
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {analysisResult && (
                            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                                <CheckCircle2 size={14} />
                                Ready
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving || analyzing || selectedIds.length === 0 || !analysisDisplay?.text}
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Save
                            </button>
                            <button
                                type="button"
                                onClick={handleAnalyze}
                                disabled={analyzing || selectedIds.length === 0}
                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            Analysis
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <div className="border-b border-gray-700 p-5 lg:border-b-0 lg:border-r">
                        <div className="text-sm font-semibold text-white">Selected news</div>
                        <div className="mt-3 space-y-3">
                            {selectedItems.length === 0 ? (
                                <p className="text-sm text-gray-500">No selected rows yet.</p>
                            ) : (
                                selectedItems.slice(0, 6).map((item) => (
                                    <div key={getItemId(item)} className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
                                        {item.title ? (
                                            <a
                                                href={item.articleUrl || item.sourceUrl || '#'}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="line-clamp-2 text-sm text-gray-200 transition hover:text-emerald-300 hover:underline"
                                            >
                                                {item.title}
                                            </a>
                                        ) : (
                                            <div className="text-sm text-gray-200">-</div>
                                        )}
                                        <div className="mt-2 text-xs text-gray-500">{item.sourceName || item.sourceUrl}</div>
                                    </div>
                                ))
                            )}
                            {selectedItems.length > 6 && (
                                <div className="text-xs text-gray-500">+{selectedItems.length - 6} more</div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 p-5">
                        <label className="block">
                            <span className="mb-2 block text-sm font-medium text-gray-300">Analysis Prompt</span>
                            <textarea
                                value={prompt}
                                onChange={(event) => setPrompt(event.target.value)}
                                className="min-h-[150px] w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                            />
                        </label>

                        {analysisDisplay ? (
                            <div className="rounded-lg border border-gray-700 bg-gray-950">
                                <div className="flex flex-wrap items-center gap-2 border-b border-gray-700 px-4 py-3 text-xs text-gray-400">
                                    <span className="rounded-full border border-gray-700 bg-gray-900 px-2.5 py-1">
                                        Provider: <span className="text-gray-200">{analysisDisplay.provider}</span>
                                    </span>
                                    <span className="rounded-full border border-gray-700 bg-gray-900 px-2.5 py-1">
                                        Model: <span className="text-gray-200">{analysisDisplay.model}</span>
                                    </span>
                                    <span className="rounded-full border border-gray-700 bg-gray-900 px-2.5 py-1">
                                        News: <span className="text-gray-200">{analysisDisplay.selectedCount}</span>
                                    </span>
                                    {analysisDisplay.finishReason ? (
                                        <span className="rounded-full border border-gray-700 bg-gray-900 px-2.5 py-1">
                                            Finish: <span className="text-gray-200">{analysisDisplay.finishReason}</span>
                                        </span>
                                    ) : null}
                                </div>

                                <div className="max-h-[420px] overflow-auto p-4">
                                    {analysisDisplay.text ? (
                                        <div className="text-sm leading-7 text-gray-200">
                                            {renderMarkdown(analysisDisplay.text)}
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
                                            AI provider returned no readable text content.
                                        </div>
                                    )}

                                    {analysisDisplay.usage ? (
                                        <details className="mt-4 rounded-lg border border-gray-700 bg-gray-900/70">
                                            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                                                Usage details
                                            </summary>
                                            <pre className="overflow-auto px-3 pb-3 text-xs leading-5 text-gray-400">
                                                {stringifyObjectAsText(analysisDisplay.usage)}
                                            </pre>
                                        </details>
                                    ) : null}
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900/40 p-10 text-center text-sm text-gray-500">
                                Analysis results will appear here after the backend AI endpoint returns.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {saveSuccess && (
                <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-10 fade-in duration-300">
                    <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/50 bg-gray-900 px-5 py-4 shadow-2xl shadow-emerald-500/10 backdrop-blur-xl">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                            <CheckCircle2 size={20} className="text-emerald-500" />
                        </div>
                        <div className="min-w-[200px]">
                            <p className="text-sm font-bold text-gray-100">Save Complete!</p>
                            <div className="mt-1 text-xs text-gray-400">
                                <p className="text-emerald-400">{saveMessage || 'News AI result has been saved.'}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setSaveSuccess(false);
                                setSaveMessage('');
                            }}
                            className="rounded-lg p-1 text-gray-500 transition-colors hover:bg-gray-800"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewsAI;
