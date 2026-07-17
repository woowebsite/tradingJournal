import { useEffect, useMemo, useState } from 'react';
import { Eye, Loader2, RefreshCw, Trash2, Newspaper, X } from 'lucide-react';
import { deleteNewsSummary, getNewsSummaries } from '../services/newsSummary';

const stringifyJson = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
};

const normalizeLinkItems = (value) => {
    if (!value) return [];
    const items = Array.isArray(value) ? value : [];
    return items.map((item, index) => ({
        title: item?.title || item?.name || item?.sourceName || item?.articleUrl || item?.sourceUrl || `Link ${index + 1}`,
        url: item?.articleUrl || item?.sourceUrl || '',
    }));
};

const unwrapText = (value) => {
    if (!value) return '-';
    return String(value);
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

const NewsSummaryDetailModal = ({ item, onClose }) => {
    const linkItems = useMemo(() => normalizeLinkItems(item?.links), [item]);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    if (!item) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
                <div className="flex items-start justify-between border-b border-gray-800 bg-gray-800/50 p-5">
                    <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-gray-500">News Summary</div>
                        <h3 className="mt-2 text-2xl font-bold text-white">{item.title || 'Untitled'}</h3>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
                            <span className="rounded-full border border-gray-700 bg-gray-950 px-2.5 py-1">Day: {item.day || '-'}</span>
                            <span className="rounded-full border border-gray-700 bg-gray-950 px-2.5 py-1">Provider: {item.provider || '-'}</span>
                            <span className="rounded-full border border-gray-700 bg-gray-950 px-2.5 py-1">Model: {item.model || '-'}</span>
                            <span className="rounded-full border border-gray-700 bg-gray-950 px-2.5 py-1">Selected: {item.selectedCount ?? '-'}</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-gray-400 transition hover:bg-gray-800 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="overflow-y-auto p-5">
                        <div className="space-y-5">
                            <section className="rounded-xl border border-gray-700 bg-gray-950 p-4">
                                <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Content</div>
                                {item.content ? (
                                    <div className="mt-3 text-sm leading-7 text-gray-200">
                                        {renderMarkdown(item.content)}
                                    </div>
                                ) : (
                                    <div className="mt-3 text-sm text-gray-500">-</div>
                                )}
                            </section>
                        </div>
                    </div>

                    <div className="overflow-y-auto border-t border-gray-800 bg-gray-900/70 p-5 lg:border-l lg:border-t-0">
                        <div className="space-y-5">
                            <section className="rounded-xl border border-gray-700 bg-gray-950 p-4">
                                <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Links</div>
                                {linkItems.length > 0 ? (
                                    <ul className="mt-3 space-y-3 list-inside list-disc text-sm text-gray-200">
                                        {linkItems.map((link, index) => (
                                            <li key={`${link.url || link.title || index}`} className="link-item">
                                                <span className="text-sm font-medium text-white">
                                                    {link.url ? (
                                                        <a
                                                            href={link.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="transition hover:text-blue-300 hover:underline"
                                                        >
                                                            {link.title}
                                                        </a>
                                                    ) : (
                                                        link.title
                                                    )}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="mt-3 text-sm text-gray-500">-</div>
                                )}
                            </section>

                            <section className="rounded-xl border border-gray-700 bg-gray-950 p-4">
                                <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Metadata</div>
                                <div className="mt-3 space-y-2 text-sm text-gray-200">
                                    <div><span className="text-gray-500">Created:</span> {unwrapText(item.createdAt)}</div>
                                    <div><span className="text-gray-500">Updated:</span> {unwrapText(item.updatedAt)}</div>
                                    <div><span className="text-gray-500">Slug:</span> {unwrapText(item.documentId || item.id)}</div>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const NewsSummary = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [deletingId, setDeletingId] = useState('');

    const loadItems = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await getNewsSummaries();
            setItems(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err?.response?.data?.error?.message || err?.message || 'Failed to load news summaries.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadItems();
    }, []);

    const filteredItems = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return items;
        return items.filter((item) => {
            const haystack = [
                item.title,
                item.content,
                item.day,
                item.provider,
                item.model,
                stringifyJson(item.links),
            ].join(' ').toLowerCase();
            return haystack.includes(term);
        });
    }, [items, searchTerm]);

    const handleDelete = async (item) => {
        const id = item?.documentId || item?.id;
        if (!id) return;
        if (!window.confirm(`Delete "${item.title || 'Untitled'}"?`)) return;

        setDeletingId(id);
        setError('');
        try {
            await deleteNewsSummary(id);
            await loadItems();
            if (selectedItem && String(selectedItem.documentId || selectedItem.id) === String(id)) {
                setSelectedItem(null);
            }
        } catch (err) {
            setError(err?.response?.data?.error?.message || err?.message || 'Failed to delete news summary.');
        } finally {
            setDeletingId('');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
                        <Newspaper size={14} />
                        News Summary
                    </div>
                    <h2 className="mt-4 text-3xl font-bold text-white">Manage saved news summaries</h2>
                    <p className="mt-2 max-w-3xl text-sm text-gray-400">
                        Review AI-generated summaries, inspect selected links, and delete records you no longer need.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={loadItems}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-gray-700"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Reload
                </button>
            </div>

            {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                </div>
            )}

            <div className="rounded-2xl border border-gray-700 bg-gray-800/90 shadow-xl">
                <div className="flex items-center justify-between gap-3 border-b border-gray-700 px-5 py-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Listing</h3>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500">Saved summary records</p>
                    </div>
                    <div className="w-full max-w-md">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Search title, content, day, provider..."
                            className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-gray-200 outline-none transition focus:border-blue-500"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-gray-500">
                        <Loader2 size={24} className="mx-auto mb-2 animate-spin opacity-60" />
                        Loading news summaries...
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="p-12 text-center text-sm text-gray-500">
                        No news summaries found.
                    </div>
                ) : (
                    <div className="max-h-[700px] overflow-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="sticky top-0 z-10 bg-gray-900/95 text-xs uppercase tracking-[0.18em] text-gray-400 backdrop-blur">
                                <tr>
                                    <th className="px-5 py-3">Day</th>
                                    <th className="px-5 py-3">Title</th>
                                    <th className="px-5 py-3">Provider</th>
                                    <th className="px-5 py-3">Model</th>
                                    <th className="px-5 py-3">Count</th>
                                    <th className="px-5 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700/70">
                                {filteredItems.map((item) => {
                                    const id = item.documentId || item.id;
                                    const isDeleting = deletingId === id;
                                    return (
                                        <tr
                                            key={id}
                                            className="cursor-pointer hover:bg-gray-700/30"
                                            onClick={() => setSelectedItem(item)}
                                        >
                                            <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-gray-400">{item.day || '-'}</td>
                                            <td className="px-5 py-4">
                                                <div className="max-w-[520px] font-medium text-white">{item.title || '-'}</div>
                                                <div className="mt-1 max-w-[520px] truncate text-xs text-gray-500">{item.selectedDays?.length ? `${item.selectedDays.length} selected day(s)` : 'No selected days'}</div>
                                            </td>
                                            <td className="px-5 py-4 text-gray-200">{item.provider || '-'}</td>
                                            <td className="px-5 py-4 text-gray-200">{item.model || '-'}</td>
                                            <td className="px-5 py-4 text-gray-200">{item.selectedCount ?? '-'}</td>
                                            <td className="px-5 py-4">
                                                <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedItem(item)}
                                                        className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-gray-700"
                                                    >
                                                        <Eye size={14} />
                                                        View
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(item)}
                                                        disabled={isDeleting}
                                                        className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {selectedItem && (
                <NewsSummaryDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
            )}
        </div>
    );
};

export default NewsSummary;
