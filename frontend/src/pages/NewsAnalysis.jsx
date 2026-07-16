import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw, Save, Trash2, Newspaper } from 'lucide-react';
import { getNewsAnalysisLast30, refreshNewsAnalysis } from '../services/newsAnalysis';
import { getNewsUrls, saveNewsUrls } from '../services/newsUrl';

const parseUrlList = (value) =>
    value
        .split(/[\r\n,]+/g)
        .map((item) => item.trim())
        .filter(Boolean);

const formatDateTime = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const NewsAnalysis = () => {
    const [urlText, setUrlText] = useState('');
    const [ignoreText, setIgnoreText] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingPresets, setLoadingPresets] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [savingSourceUrls, setSavingSourceUrls] = useState(false);
    const [savingIgnoreUrls, setSavingIgnoreUrls] = useState(false);
    const [items, setItems] = useState([]);
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const parsedUrls = useMemo(() => parseUrlList(urlText), [urlText]);
    const parsedIgnoreList = useMemo(() => parseUrlList(ignoreText), [ignoreText]);

    const loadSavedItems = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await getNewsAnalysisLast30();
            setItems(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err?.response?.data?.error?.message || err?.message || 'Failed to load saved news analysis.');
        } finally {
            setLoading(false);
        }
    };

    const loadSavedPresets = async () => {
        setLoadingPresets(true);
        setError('');
        try {
            const data = await getNewsUrls();
            const rows = Array.isArray(data) ? data : [];
            const sourceUrls = rows.filter((item) => item.type === 'source').map((item) => item.url);
            const ignoreUrls = rows.filter((item) => item.type === 'ignore').map((item) => item.url);

            setUrlText(sourceUrls.join('\n'));
            setIgnoreText(ignoreUrls.join('\n'));
        } catch (err) {
            setError(err?.response?.data?.error?.message || err?.message || 'Failed to load saved URL presets.');
        } finally {
            setLoadingPresets(false);
        }
    };

    useEffect(() => {
        loadSavedItems();
        loadSavedPresets();
    }, []);

    const handleRefresh = async () => {
        if (!parsedUrls.length) {
            setError('Please enter at least one news URL, one per line.');
            return;
        }

        setRefreshing(true);
        setError('');
        setSummary(null);

        try {
            const result = await refreshNewsAnalysis(parsedUrls, parsedIgnoreList);
            setSummary(result?.summary || null);
            setNotice('Refresh complete.');
            await loadSavedItems();
        } catch (err) {
            setError(err?.response?.data?.error?.message || err?.message || 'Failed to refresh news analysis.');
        } finally {
            setRefreshing(false);
        }
    };

    const handleSaveUrls = async (type) => {
        const urls = type === 'source' ? parsedUrls : parsedIgnoreList;
        if (!urls.length) {
            setError(type === 'source' ? 'Please enter at least one source URL.' : 'Please enter at least one ignore URL.');
            return;
        }

        setError('');
        setNotice('');

        if (type === 'source') {
            setSavingSourceUrls(true);
        } else {
            setSavingIgnoreUrls(true);
        }

        try {
            const result = await saveNewsUrls(type, urls);
            setNotice(`${result?.data?.created ?? urls.length} ${type} URLs saved.`);
            await loadSavedPresets();
        } catch (err) {
            setError(err?.response?.data?.error?.message || err?.message || 'Failed to save URLs.');
        } finally {
            if (type === 'source') {
                setSavingSourceUrls(false);
            } else {
                setSavingIgnoreUrls(false);
            }
        }
    };

    const groupedByDay = useMemo(() => {
        const groups = new Map();
        for (const item of items) {
            const day = item.dayKey || (item.fetchedAt ? new Date(item.fetchedAt).toISOString().slice(0, 10) : 'unknown');
            if (!groups.has(day)) {
                groups.set(day, []);
            }
            groups.get(day).push(item);
        }
        return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    }, [items]);

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
                        <Newspaper size={14} />
                        News Analysis
                    </div>
                    <h2 className="mt-4 text-3xl font-bold text-white">Analyze news sources and save headlines</h2>
                    <p className="mt-2 max-w-3xl text-sm text-gray-400">
                        Paste one or more source URL patterns below. The crawler will convert each pattern into the
                        matching article URLs for that site, and only links in the ignore list are skipped.
                    </p>
                </div>

                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border border-gray-700 bg-gray-800/90 p-5 shadow-xl">
                    <div className="flex items-center justify-between gap-3 border-b border-gray-700 pb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-white">Source Patterns</h3>
                            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500">
                                Enter URL patterns, one per line or separated by commas
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="rounded-full border border-gray-700 bg-gray-900/50 px-3 py-1 text-xs text-gray-400">
                                {parsedUrls.length} URLs
                            </span>
                            <button
                                onClick={() => handleSaveUrls('source')}
                                disabled={savingSourceUrls || loadingPresets}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Save size={14} className={savingSourceUrls ? 'animate-pulse' : ''} />
                                Save
                            </button>
                        </div>
                    </div>

                    <textarea
                        value={urlText}
                        onChange={(e) => setUrlText(e.target.value)}
                        placeholder={`https://vietstock.vn/{year}/{month}\nhttps://nguoiquansat.vn/*.html`}
                        className="mt-4 min-h-[240px] w-full rounded-xl border border-gray-700 bg-gray-900/70 px-4 py-3 text-sm text-gray-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />

                    <div className="mt-5 rounded-xl border border-dashed border-gray-700 bg-gray-900/40 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h4 className="text-sm font-semibold text-white">Ignore list</h4>
                                <p className="mt-1 text-xs text-gray-500">
                                    Dán domain, path, hoặc cụm từ cần bỏ qua trong lần crawl này.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="rounded-full border border-gray-700 bg-gray-900/50 px-3 py-1 text-xs text-gray-400">
                                    {parsedIgnoreList.length} ignored
                                </span>
                                <button
                                    onClick={() => handleSaveUrls('ignore')}
                                    disabled={savingIgnoreUrls || loadingPresets}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Save size={14} className={savingIgnoreUrls ? 'animate-pulse' : ''} />
                                    Save
                                </button>
                            </div>
                        </div>

                        <textarea
                            value={ignoreText}
                            onChange={(e) => setIgnoreText(e.target.value)}
                            placeholder={`vnexpress.net/video\nthanhnien.vn/giai-tri\n/category/`}
                            className="mt-3 min-h-[120px] w-full rounded-xl border border-gray-700 bg-gray-950/80 px-4 py-3 text-sm text-gray-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                            Fetch titles and save
                        </button>
                        <button
                            onClick={() => {
                                setUrlText('');
                                setIgnoreText('');
                                setError('');
                            }}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-gray-700"
                        >
                            <Trash2 size={16} />
                            Clear
                        </button>
                    </div>

                    <div className="mt-4 rounded-xl border border-gray-700 bg-gray-900/60 p-4 text-sm text-gray-300">
                        <p className="font-medium text-white">How it works</p>
                        <ul className="mt-2 space-y-1 text-gray-400">
                            <li>- URLs in the ignore list are skipped before the crawler fetches them.</li>
                            <li>- Duplicate titles for the same source and day are skipped automatically.</li>
                            <li>- Saved entries can be reviewed in the history table on the right.</li>
                        </ul>
                    </div>

                    {(loadingPresets || notice) && (
                        <div className="mt-4 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
                            {loadingPresets ? 'Loading saved URL presets...' : notice}
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                            {error}
                        </div>
                    )}
                </div>

                <div className="space-y-4 rounded-2xl border border-gray-700 bg-gray-800/90 p-5 shadow-xl">
                    <div className="flex items-center justify-between gap-3 border-b border-gray-700 pb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-white">Refresh summary</h3>
                            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500">Latest run</p>
                        </div>
                        <div className="rounded-full border border-gray-700 bg-gray-900/50 px-3 py-1 text-xs text-gray-400">
                            {loading ? 'Loading...' : `${items.length} saved`}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'URLs', value: summary?.totalUrls ?? parsedUrls.length },
                            { label: 'Saved', value: summary?.created ?? '-' },
                            { label: 'Skipped URLs', value: summary?.skippedUrls ?? '-' },
                            { label: 'Ignored', value: summary?.ignoredByList ?? '-' },
                            { label: 'Removed', value: summary?.removedByIgnore ?? '-' },
                            { label: 'Failed', value: summary?.failed ?? '-' },
                        ].map((card) => (
                            <div key={card.label} className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-gray-500">{card.label}</div>
                                <div className="mt-2 text-2xl font-bold text-white">{card.value}</div>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Latest results</div>
                        <div className="mt-3 space-y-3">
                            {(summary ? Object.entries(summary) : []).length > 0 ? (
                                Object.entries(summary).map(([key, value]) => (
                                    <div key={key} className="flex items-center justify-between gap-3 text-sm">
                                        <span className="text-gray-400">{key}</span>
                                        <span className="font-semibold text-white">{String(value)}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="text-sm text-gray-500">Run Refresh to see the latest statistics.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-700 bg-gray-800/90 shadow-xl">
                <div className="flex items-center justify-between gap-3 border-b border-gray-700 px-5 py-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Saved headlines</h3>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500">
                            Last 30 days, grouped by collected day
                        </p>
                    </div>
                    <button
                        onClick={loadSavedItems}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-700"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Reload
                    </button>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-gray-500">
                        <Loader2 size={24} className="mx-auto mb-2 animate-spin opacity-60" />
                        Loading saved headlines...
                    </div>
                ) : items.length === 0 ? (
                    <div className="p-12 text-center text-sm text-gray-500">
                        No saved news headlines yet. Paste URLs and press Refresh to start collecting.
                    </div>
                ) : (
                    <div className="overflow-hidden">
                        <div className="max-h-[640px] overflow-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="sticky top-0 z-10 bg-gray-900/90 text-xs uppercase tracking-[0.2em] text-gray-400 backdrop-blur">
                                    <tr>
                                        <th className="px-5 py-3">Collected</th>
                                        <th className="px-5 py-3">Source</th>
                                        <th className="px-5 py-3">Title</th>
                                        <th className="px-5 py-3">Link</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700/70">
                                    {groupedByDay.flatMap(([day, dayItems]) => (
                                        dayItems.map((item, index) => (
                                            <tr key={item.id || item.documentId || `${day}-${index}`} className="hover:bg-gray-700/30">
                                                <td className="px-5 py-4 whitespace-nowrap font-mono text-xs text-gray-400">
                                                    {formatDateTime(item.fetchedAt)}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="font-medium text-white">{item.sourceName || item.sourceUrl}</div>
                                                    <div className="mt-1 text-xs text-gray-500">{item.sourceUrl}</div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="max-w-[560px] text-gray-200">{item.title}</div>
                                                    {item.excerpt ? (
                                                        <div className="mt-1 max-w-[560px] text-xs text-gray-500">{item.excerpt}</div>
                                                    ) : null}
                                                </td>
                                                <td className="px-5 py-4">
                                                    {item.articleUrl ? (
                                                        <a
                                                            href={item.articleUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-1 text-blue-400 transition hover:text-blue-300"
                                                        >
                                                            Open
                                                            <ExternalLink size={14} />
                                                        </a>
                                                    ) : (
                                                        <span className="text-gray-500">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NewsAnalysis;
