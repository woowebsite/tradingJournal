import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save, ChevronDown, Loader2, CloudDownload, X, CheckCircle2 } from 'lucide-react';
import { getMarketFlowLeader } from '../services/tcbs';
import { saveMarketFlow, getSavedMarketFlow, getSavedMarketFlowLast30 } from '../services/marketFlow';
import { getIndustries, syncIndustriesFromTCBS, syncIndustries } from '../services/industry';
import { saveMarketAnalytic, getMarketAnalytics, getMarketAnalyticsLast30 } from '../services/marketAnalytic';

const formatValue = (value) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') return value.toLocaleString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

const MarketFlow = () => {
    const [payload, setPayload] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [industries, setIndustries] = useState([]);
    const [selectedIndustry, setSelectedIndustry] = useState('2300');
    const [industryOpen, setIndustryOpen] = useState(false);
    const [loadingIndustries, setLoadingIndustries] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
    const [analytics, setAnalytics] = useState([]);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);

    // Auto-hide toast after 3 seconds
    useEffect(() => {
        if (saveSuccess) {
            const timer = setTimeout(() => setSaveSuccess(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [saveSuccess]);

    const rowsInc = useMemo(() => payload?.body?.listInc || [], [payload]);
    const rowsDesc = useMemo(() => payload?.body?.listDesc || [], [payload]);

    const getColumns = (data) => {
        const keys = new Set();
        data.slice(0, 10).forEach(row => {
            if (row && typeof row === 'object' && !Array.isArray(row)) {
                Object.keys(row).forEach(key => keys.add(key));
            }
        });
        return Array.from(keys);
    };

    const columnsInc = useMemo(() => getColumns(rowsInc), [rowsInc]);
    const columnsDesc = useMemo(() => getColumns(rowsDesc), [rowsDesc]);

    const handleSyncTCBS = async () => {
        setSyncing(true);
        setError('');
        try {
            const result = await syncIndustriesFromTCBS();
            if (result && result.listIndustry) {
                await syncIndustries(result.listIndustry);
                console.log('Sync successful');
            } else {
                setError('No industry data found to sync.');
            }
            await loadIndustries();
        } catch (err) {
            console.error('Sync failed:', err);
            setError(err.response?.data?.error?.message || err.message || 'Sync failed');
        } finally {
            setSyncing(false);
        }
    };

    const loadIndustries = async () => {
        setLoadingIndustries(true);
        try {
            let data = await getIndustries();
            if (data.length === 0) {
                const syncData = await syncIndustriesFromTCBS();
                if (syncData && syncData.listIndustry) {
                    await syncIndustries(syncData.listIndustry);
                    data = await getIndustries();
                }
            }
            const sorted = [...data].sort((a, b) => a.code.localeCompare(b.code));
            setIndustries(sorted);
        } catch (err) {
            console.error('Failed to load industries:', err);
        } finally {
            setLoadingIndustries(false);
        }
    };

    const loadMarketFlow = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await getMarketFlowLeader({
                exchange: 'ALL',
                industry: selectedIndustry,
                type: '1d',
            });
            setPayload(data);
        } catch (err) {
            setError(err.message || 'Failed to load market flow.');
        } finally {
            setLoading(false);
        }
    };

    const loadLeaderboard = async () => {
        setLoadingLeaderboard(true);
        try {
            const now = new Date();
            const resp = await getSavedMarketFlowLast30();
            const data = Array.isArray(resp) ? resp : (resp?.data || []);

            const scores = data.reduce((acc, item) => {
                // tolerate different field names
                const ticker = item.ticker || item.symbol || item.tickerSymbol || item.code || '';
                if (!ticker) return acc;

                const scoreValue = (item.score !== undefined && item.score !== null)
                    ? Number(item.score)
                    : (item.s !== undefined ? Number(item.s) : 0);

                if (!acc[ticker]) {
                    acc[ticker] = { ticker, score: 0, count: 0, lastIndustry: item.industry };
                }
                if(ticker === "VGI") console.log("Processing VGI item:", scoreValue);

                acc[ticker].score += isNaN(scoreValue) ? 0 : scoreValue;
                acc[ticker].count += 1;
                return acc;
            }, {});

            const sorted = Object.values(scores).sort((a, b) => b.score - a.score);
            setLeaderboard(sorted);
        } catch (err) {
            console.error('Failed to load leaderboard:', err);
        } finally {
            setLoadingLeaderboard(false);
        }
    };

    const loadAnalytics = async () => {
        setLoadingAnalytics(true);
        try {
            // Use backend endpoint that returns all analytics for last 30 days
            const items = await getMarketAnalyticsLast30();
            const data = Array.isArray(items) ? items : (items?.data || []);
            const uniqueIndustries = new Map();

            // Keep only the most recent entry for each industry
            data.forEach(item => {
                if (!uniqueIndustries.has(item.industry)) {
                    uniqueIndustries.set(item.industry, item);
                }
            });

            // Sort by BSI and PSI descending
            const analyticsData = Array.from(uniqueIndustries.values()).sort((a, b) => {
                if (b.bsi !== a.bsi) return b.bsi - a.bsi;
                return b.psi - a.psi;
            });

            setAnalytics(analyticsData);
        } catch (err) {
            console.error('Failed to load analytics:', err);
        } finally {
            setLoadingAnalytics(false);
        }
    };

    useEffect(() => {
        loadIndustries();
        loadLeaderboard();
        loadAnalytics();
    }, []);

    // Auto-load market flow when industry changes
    useEffect(() => {
        if (selectedIndustry) {
            loadMarketFlow();
        }
    }, [selectedIndustry]);

    const parseDate = (td) => {
        if (typeof td === 'string' && td.includes('/')) {
            // Parse "DD/MM HH:mm" (e.g., "18/05 14:59")
            try {
                const [datePart, timePart] = td.split(' ');
                const [day, month] = datePart.split('/');
                const [hour, minute] = timePart ? timePart.split(':') : ['14', '59']; // Default to 14:59 if no time

                const currentYear = new Date().getFullYear();
                // Construct string in Vietnam time (UTC+7)
                const isoString = `${currentYear}-${month}-${day}T${hour}:${minute}:00+07:00`;
                const d = new Date(isoString);

                if (!isNaN(d.getTime())) {
                    return d.toISOString();
                }
            } catch (e) {
                console.error("Failed to parse time:", td, e);
            }
        }

        let d = td && !isNaN(td) ? new Date(td * 1000) : new Date();
        if (isNaN(d.getTime()) || d.getFullYear() < 2020) {
            d = new Date();
        }

        // Extract UTC date part (trading date) and set to 14:59 VN time (07:59 UTC)
        const dateStr = d.toISOString().split('T')[0];
        return `${dateStr}T07:59:00.000Z`;
    };

    const [saveStats, setSaveStats] = useState(null);
    const [savingAll, setSavingAll] = useState(false);
    const [saveAllProgress, setSaveAllProgress] = useState({ current: 0, total: 0 });

    const calculateAnalytics = (listInc, listDesc) => {
        const total = listInc.length + listDesc.length;
        const bsi = total > 0 ? listInc.length / total : 0;
        const sumInc = listInc.reduce((acc, row) => acc + (parseFloat(row.s) || 0), 0);
        const sumDesc = listDesc.reduce((acc, row) => acc + (parseFloat(row.s) || 0), 0);
        const psi = sumInc + sumDesc;
        return { bsi, psi };
    };

    const handleSave = async () => {
        const allEntries = [...rowsInc, ...rowsDesc];
        if (!allEntries.length) return;
        setSaving(true);
        setSaveSuccess(false);
        setSaveStats(null);
        setError('');

        try {
            const entries = allEntries.map(row => ({
                ticker: row?.ticker || '',
                score: parseFloat(row?.s) || 0,
                td: row?.td,
                date: parseDate(payload?.body?.time),
                industry: selectedIndustry,
            }));
            const response = await saveMarketFlow(entries);

            // Save Analytics
            const { bsi, psi } = calculateAnalytics(rowsInc, rowsDesc);
            await saveMarketAnalytic({
                date: parseDate(payload?.body?.time),
                bsi,
                psi,
                industry: selectedIndustry
            });

            setSaveStats(response.data);
            setSaveSuccess(true);
            loadLeaderboard();
            loadAnalytics();
        } catch (err) {
            setError(err.message || 'Failed to save market flow.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveAll = async () => {
        if (!industries.length) return;
        setSavingAll(true);
        setSaveSuccess(false);
        setError('');
        setSaveStats(null);
        setSaveAllProgress({ current: 0, total: industries.length });

        try {
            let totalCreated = 0;
            let totalSkipped = 0;

            for (let i = 0; i < industries.length; i++) {
                const ind = industries[i];
                setSaveAllProgress({ current: i + 1, total: industries.length });

                // Fetch data for this specific industry
                const data = await getMarketFlowLeader({
                    exchange: 'ALL',
                    industry: ind.code,
                    type: '1d',
                });

                if (data?.body) {
                    const listInc = data.body.listInc || [];
                    const listDesc = data.body.listDesc || [];
                    const allEntries = [...listInc, ...listDesc];

                    if (allEntries.length > 0) {
                        const entries = allEntries.map(row => ({
                            ticker: row?.ticker || '',
                            score: parseFloat(row?.s) || 0,
                            td: row?.td,
                            date: parseDate(data.body.time),
                            industry: ind.code,
                        }));
                        const response = await saveMarketFlow(entries);

                        // Save Analytics for this industry
                        const { bsi, psi } = calculateAnalytics(listInc, listDesc);
                        await saveMarketAnalytic({
                            date: parseDate(data.body.time),
                            bsi,
                            psi,
                            industry: ind.code
                        });

                        if (response.data) {
                            totalCreated += response.data.created || 0;
                            totalSkipped += response.data.skipped || 0;
                        }
                    }
                }
            }

            setSaveStats({
                created: totalCreated,
                skipped: totalSkipped,
                message: `Successfully processed all ${industries.length} industries.`
            });
            setSaveSuccess(true);
            loadLeaderboard();
            loadAnalytics();
        } catch (err) {
            console.error('Save All failed:', err);
            setError(`Failed at industry ${saveAllProgress.current}: ${err.message}`);
        } finally {
            setSavingAll(false);
        }
    };

    const renderTable = (id, title, rows, columns, colorClass) => {
        if (rows.length === 0) return (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center text-gray-500 text-sm">
                No data for {title}
            </div>
        );
        return (
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col h-[300px]">
                <div className="px-4 py-3 border-b border-gray-700 bg-gray-900/40 flex items-center justify-between">
                    <h3 className={`font-bold ${colorClass}`}>{title}</h3>
                    <span className="text-xs text-gray-500 font-mono">{rows.length} items</span>
                </div>
                <div className="overflow-auto flex-1">
                    <table id={id} className="w-full text-left text-sm border-collapse">
                        <thead className="bg-gray-900/80 text-gray-400 sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                                {columns.map(column => (
                                    <th key={column} className="p-3 whitespace-nowrap font-semibold border-b border-gray-700">
                                        {column}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                            {rows.map((row, index) => (
                                <tr key={row?.ticker || row?.symbol || row?.id || index} className="hover:bg-gray-700/30 transition-colors">
                                    {columns.map(column => (
                                        <td key={column} className="p-3 whitespace-nowrap text-gray-300 font-mono text-xs">
                                            {formatValue(row?.[column])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            <div className="flex items-center justify-between flex-wrap gap-4 bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                <div>
                    <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                        Market Flow
                    </h1>
                    <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
                        <span className="text-blue-400">
                            {selectedIndustry
                                ? (industries.find(i => i.code === selectedIndustry)?.name || `Industry ${selectedIndustry}`)
                                : 'Select Industry'}
                        </span>
                        <span className="text-gray-600">|</span>
                        <span>Exchange ALL</span>
                        <span className="text-gray-600">|</span>
                        <span>Type 1d</span>
                        {payload?.body?.time && (
                            <>
                                <span className="text-gray-600">|</span>
                                <span className="text-orange-400">{payload.body.time}</span>
                            </>
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Industry Selector */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIndustryOpen(o => !o)}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg hover:border-blue-500 transition text-gray-200 text-sm min-w-[240px] justify-between group"
                        >
                            <span className="truncate max-w-[200px]">
                                {selectedIndustry
                                    ? (industries.find(i => i.code === selectedIndustry)?.name || selectedIndustry)
                                    : 'Select Industry'}
                            </span>
                            <ChevronDown size={14} className={`transition-transform duration-200 ${industryOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {industryOpen && (
                            <div className="absolute top-full mt-2 right-0 z-50 bg-gray-900 border border-gray-600 rounded-xl shadow-2xl overflow-hidden w-[300px] max-h-[400px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
                                <div className="p-2 border-b border-gray-800 bg-gray-800/30 sticky top-0 backdrop-blur-md">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold px-2">Select Sector</p>
                                </div>
                                {industries.map(ind => (
                                    <button
                                        key={ind.id || ind.code}
                                        type="button"
                                        onClick={() => {
                                            setSelectedIndustry(ind.code);
                                            setIndustryOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-600/10 transition-colors border-l-2 ${ind.code === selectedIndustry
                                            ? 'bg-blue-600/20 text-blue-300 border-blue-500'
                                            : 'text-gray-400 border-transparent hover:text-gray-200'
                                            }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">{ind.name}</span>
                                            <span className="text-[10px] font-mono opacity-50">{ind.code}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleSyncTCBS}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition text-gray-300 text-sm"
                    >
                        <CloudDownload size={14} className={syncing ? 'animate-spin' : ''} />
                        Sync Industries
                    </button>


                    <button
                        type="button"
                        onClick={handleSaveAll}
                        disabled={savingAll || syncing || loading}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 border border-emerald-500 rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition text-white text-sm font-semibold shadow-lg shadow-emerald-900/20"
                    >
                        {savingAll ? (
                            <>
                                <Loader2 size={14} className="animate-spin text-blue-400" />
                                <span className="text-blue-400">{saveAllProgress.current}/{saveAllProgress.total}</span>
                            </>
                        ) : (
                            <>
                                <CloudDownload size={14} />
                                Save All
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || savingAll || (!rowsInc.length && !rowsDesc.length)}
                        className="flex items-center gap-2 px-5 py-2 bg-blue-600 border border-blue-500 rounded-lg hover:bg-blue-500 disabled:opacity-50 transition text-white text-sm font-semibold shadow-lg shadow-blue-900/20"
                    >
                        <Save size={14} />
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    {error}
                </div>
            )}

            {saveSuccess && (
                <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-10 fade-in duration-300">
                    <div className="flex items-center gap-3 px-5 py-4 bg-gray-900 border border-green-500/50 rounded-2xl shadow-2xl shadow-green-500/10 backdrop-blur-xl">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                            <CheckCircle2 size={20} className="text-green-500" />
                        </div>
                        <div className="min-w-[200px]">
                            <p className="text-sm font-bold text-gray-100">Sync Complete!</p>
                            <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                                {saveStats?.created > 0 && <p className="text-green-400">Created: {saveStats.created}</p>}
                                {saveStats?.skipped > 0 && <p className="text-orange-400">Skipped (duplicates): {saveStats.skipped}</p>}
                                {saveStats?.errors > 0 && <p className="text-red-400">Errors: {saveStats.errors}</p>}
                                {!saveStats && <p>Data has been synced to backend.</p>}
                            </div>
                        </div>
                        <button
                            onClick={() => setSaveSuccess(false)}
                            className="p-1 hover:bg-gray-800 rounded-lg transition-colors text-gray-500"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            {loading && !payload ? (
                <div className="p-20 text-center text-gray-400 bg-gray-800/30 rounded-2xl border border-gray-700/50 backdrop-blur-sm">
                    <Loader2 size={40} className="animate-spin mx-auto mb-4 text-blue-500 opacity-50" />
                    <p className="text-lg font-medium">Fetching Market Insights...</p>
                    <p className="text-sm opacity-50 mt-1">This may take a few seconds</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {renderTable('market-flow-inc-tbl', 'Increasing Flow (listInc)', rowsInc, columnsInc, 'text-green-400')}
                    {renderTable('market-flow-desc-tbl', 'Decreasing Flow (listDesc)', rowsDesc, columnsDesc, 'text-red-400')}

                    {!rowsInc.length && !rowsDesc.length && payload && (
                        <div className="lg:col-span-2">
                            <pre className="p-4 overflow-auto text-[10px] text-gray-400 max-h-[70vh] bg-gray-900/50 rounded-xl border border-gray-700 font-mono">
                                {JSON.stringify(payload, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}

            {/* Dashboard Bottom Section: Leaderboard & Analytics */}
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Monthly Leaderboard Column */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                                Monthly Leaderboard
                            </h2>
                            <p className="text-xs text-gray-400 mt-1 h-[40px]">Ranking tickers by cumulative score for the current month</p>
                        </div>
                        <button
                            onClick={loadLeaderboard}
                            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"
                            title="Refresh Leaderboard"
                        >
                            <RefreshCw size={16} className={loadingLeaderboard ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-xl h-[500px] flex flex-col">
                        {loadingLeaderboard && leaderboard.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 flex-1 flex flex-col justify-center">
                                <Loader2 size={24} className="animate-spin mx-auto mb-2 opacity-50" />
                                Calculating leaderboard...
                            </div>
                        ) : leaderboard.length > 0 ? (
                            <div className="overflow-auto flex-1">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead className="bg-gray-900/80 text-gray-400 sticky top-0 z-10 backdrop-blur-md">
                                        <tr>
                                            <th className="p-4 w-16 text-center font-bold">Rank</th>
                                            <th className="p-4 font-bold">Ticker</th>
                                            <th className="p-4 text-right font-bold">Monthly Score</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700/50">
                                        {leaderboard.map((item, index) => (
                                            <tr key={item.ticker} className="hover:bg-gray-700/30 transition-colors group">
                                                <td className="p-4 text-center">
                                                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                                                        index === 1 ? 'bg-gray-400/20 text-gray-400' :
                                                            index === 2 ? 'bg-orange-500/20 text-orange-500' :
                                                                'bg-gray-700/50 text-gray-500'
                                                        }`}>
                                                        {index + 1}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-bold text-gray-100 group-hover:text-blue-400 transition-colors">
                                                    {item.ticker}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className={`font-mono font-bold ${item.score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {item.score > 0 ? '+' : ''}{item.score.toLocaleString()}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-12 text-center text-gray-500 flex-1 flex flex-col justify-center">
                                No data for the current month.
                            </div>
                        )}
                    </div>
                </div>

                {/* Market Analytics Column */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                                Market Analytics (BSI & PSI)
                            </h2>
                            <div className="text-[10px] text-gray-400 mt-1 space-y-0.5 font-mono uppercase tracking-wider h-[40px]">
                                <p>BSI = số mã đóng góp dương / tổng số mã ảnh hưởng</p>
                                <p>PSI = ∑positive_impact − ∑negative_impact</p>
                            </div>
                        </div>
                        <button
                            onClick={loadAnalytics}
                            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"
                            title="Refresh Analytics"
                        >
                            <RefreshCw size={16} className={loadingAnalytics ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-xl h-[500px] flex flex-col">
                        {loadingAnalytics && analytics.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 flex-1 flex flex-col justify-center">
                                <Loader2 size={24} className="animate-spin mx-auto mb-2 opacity-50" />
                                Loading analytics...
                            </div>
                        ) : analytics.length > 0 ? (
                            <div className="overflow-auto flex-1">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead className="bg-gray-900/80 text-gray-400 sticky top-0 z-10 backdrop-blur-md">
                                        <tr>
                                            <th className="p-4 font-bold text-xs uppercase">Industry</th>
                                            <th className="p-4 text-center font-bold text-xs uppercase">BSI</th>
                                            <th className="p-4 text-center font-bold text-xs uppercase">PSI</th>
                                            <th className="p-4 font-bold text-xs uppercase">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700/50">
                                        {analytics.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-700/30 transition-colors group">
                                                <td className="p-4 text-gray-300 font-medium text-xs">
                                                    {industries.find(i => i.code === item.industry)?.name || item.industry}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className={`font-bold font-mono text-xs ${item.bsi >= 0.5 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {(item.bsi * 100).toFixed(1)}%
                                                        </span>
                                                        <div className="w-12 h-1 bg-gray-700 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full transition-all ${item.bsi >= 0.5 ? 'bg-green-500' : 'bg-red-500'}`}
                                                                style={{ width: `${item.bsi * 100}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center font-mono font-bold text-xs">
                                                    <span className={item.psi >= 0 ? 'text-green-400' : 'text-red-400'}>
                                                        {item.psi > 0 ? '+' : ''}{item.psi.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${item.bsi >= 0.7 ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                                        item.bsi >= 0.5 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                            item.bsi >= 0.3 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                                                                'bg-red-500/20 text-red-400 border border-red-500/30'
                                                        }`}>
                                                        {item.bsi >= 0.7 ? 'Strong' :
                                                            item.bsi >= 0.5 ? 'Healthy' :
                                                                item.bsi >= 0.3 ? 'Weak' : 'Bearish'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-12 text-center text-gray-500 flex-1 flex flex-col justify-center">
                                No analytics data available yet.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MarketFlow;
