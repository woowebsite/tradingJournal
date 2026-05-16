import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save, ChevronDown, Loader2, CloudDownload } from 'lucide-react';
import { getMarketFlowLeader } from '../services/tcbs';
import { saveMarketFlow } from '../services/marketFlow';
import { getIndustries, syncIndustriesFromTCBS, syncIndustries } from '../services/industry';

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

    useEffect(() => {
        loadIndustries();
    }, []);

    const parseDate = (td) => {
        if (!td) return new Date().toISOString();
        const d = new Date(td * 1000);
        return isNaN(d.getTime()) || d.getFullYear() < 2020
            ? new Date().toISOString()
            : d.toISOString();
    };

    const handleSave = async () => {
        const allEntries = [...rowsInc, ...rowsDesc];
        if (!allEntries.length) return;
        setSaving(true);
        setSaveSuccess(false);
        setError('');

        try {
            const entries = allEntries.map(row => ({
                ticker: row?.ticker || '',
                score: parseFloat(row?.s) || 0,
                td: row?.td,
                date: parseDate(payload?.body?.time),
                industry: selectedIndustry,
            }));
            await saveMarketFlow(entries);
            setSaveSuccess(true);
        } catch (err) {
            setError(err.message || 'Failed to save market flow.');
        } finally {
            setSaving(false);
        }
    };

    const renderTable = (id, title, rows, columns, colorClass) => {
        if (rows.length === 0) return (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center text-gray-500 text-sm">
                No data for {title}
            </div>
        );
        return (
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col h-[500px]">
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
                        Sync
                    </button>

                    <button
                        type="button"
                        onClick={loadMarketFlow}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition text-gray-300 text-sm"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !rowsInc.length}
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
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-300 text-sm flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Saved successfully!
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
        </div>
    );
};

export default MarketFlow;
