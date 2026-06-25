import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import { getTcbsRecommendationOptions, getTcbsRecommendations } from '../services/tcbsRecommendation';

const getTypeLabel = (type) => {
    const labels = {
        1: 'Mua',
        2: 'Bán',
        3: 'Chờ mua',
        4: 'Nắm giữ',
    };

    return labels[type] || `Type ${type ?? '-'}`;
};

const getTypeTone = (type) => {
    if (Number(type) === 1 || Number(type) === 3) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    if (Number(type) === 2) return 'bg-red-500/15 text-red-300 border-red-500/30';
    if (Number(type) === 4) return 'bg-yellow-500/15 text-yellow-200 border-yellow-500/30';
    return 'bg-gray-600/30 text-gray-300 border-gray-500/30';
};

const TCBSRecommendations = () => {
    const [recommendations, setRecommendations] = useState([]);
    const [tickerOptions, setTickerOptions] = useState([]);
    const [selectedTicker, setSelectedTicker] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingOptions, setLoadingOptions] = useState(false);
    const [error, setError] = useState(null);

    const typeOptions = [
        { value: '1', label: getTypeLabel(1) },
        { value: '2', label: getTypeLabel(2) },
        { value: '3', label: getTypeLabel(3) },
        { value: '4', label: getTypeLabel(4) },
    ];

    const sortedRecommendations = useMemo(() => {
        return [...recommendations].sort((a, b) => {
            const dateDiff = new Date(b.d || 0) - new Date(a.d || 0);
            if (dateDiff !== 0) return dateDiff;
            return String(a.ticker || '').localeCompare(String(b.ticker || ''));
        });
    }, [recommendations]);

    const loadRecommendationOptions = async () => {
        setLoadingOptions(true);

        try {
            const data = await getTcbsRecommendationOptions();
            const tickers = Array.from(new Set(
                data
                    .map(item => String(item.ticker || '').trim().toUpperCase())
                    .filter(Boolean)
            )).sort((a, b) => a.localeCompare(b));
            setTickerOptions(tickers);
        } catch (err) {
            console.error('Failed to load TCBS recommendation filters:', err);
            setError(err.response?.data?.error?.message || err.message || 'Failed to load TCBS recommendation filters.');
        } finally {
            setLoadingOptions(false);
        }
    };

    const loadRecommendations = async ({ ticker = selectedTicker, type = selectedType } = {}) => {
        setLoading(true);
        setError(null);

        try {
            const data = await getTcbsRecommendations({ ticker, type });
            setRecommendations(data);
        } catch (err) {
            console.error('Failed to load TCBS recommendations:', err);
            setError(err.response?.data?.error?.message || err.message || 'Failed to load TCBS recommendations.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRecommendationOptions();
    }, []);

    useEffect(() => {
        loadRecommendations({ ticker: selectedTicker, type: selectedType });
    }, [selectedTicker, selectedType]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div className="text-sm font-medium text-amber-300">Signals / Recommendation</div>
                    <h2 className="text-3xl font-bold text-white">TCBS Recommendations</h2>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-400" htmlFor="tcbs-recommen-ticker">Ticker</label>
                        <select
                            id="tcbs-recommen-ticker"
                            value={selectedTicker}
                            onChange={(event) => setSelectedTicker(event.target.value)}
                            disabled={loadingOptions}
                            className="min-w-[110px] cursor-pointer bg-transparent text-sm font-semibold text-white outline-none disabled:cursor-not-allowed disabled:text-gray-500"
                        >
                            <option value="" className="bg-gray-900">All</option>
                            {tickerOptions.map(ticker => (
                                <option key={ticker} value={ticker} className="bg-gray-900">
                                    {ticker}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-400" htmlFor="tcbs-recommen-type">Type</label>
                        <select
                            id="tcbs-recommen-type"
                            value={selectedType}
                            onChange={(event) => setSelectedType(event.target.value)}
                            className="min-w-[120px] cursor-pointer bg-transparent text-sm font-semibold text-white outline-none"
                        >
                            <option value="" className="bg-gray-900">All</option>
                            {typeOptions.map(option => (
                                <option key={option.value} value={option.value} className="bg-gray-900">
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={() => loadRecommendations()}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white shadow-lg shadow-amber-600/20 transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-600/50"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-3 rounded-lg border border-red-700 bg-red-950/40 px-4 py-3 text-red-200">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <div className="rounded-lg border border-gray-700 bg-gray-800">
                <div className="flex items-center gap-2 border-b border-gray-700 px-5 py-4">
                    <Sparkles size={18} className="text-amber-300" />
                    <h3 className="font-semibold text-white">Recommendation History</h3>
                    <span className="text-sm text-gray-500">({sortedRecommendations.length})</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-900/60 text-xs uppercase text-gray-400">
                            <tr>
                                <th className="px-5 py-3 font-medium">Date</th>
                                <th className="px-5 py-3 font-medium">Ticker</th>
                                <th className="px-5 py-3 font-medium">Type</th>
                                <th className="px-5 py-3 font-medium">Reason</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="px-5 py-10 text-center text-gray-400">
                                        Loading recommendations...
                                    </td>
                                </tr>
                            ) : sortedRecommendations.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-5 py-10 text-center text-gray-400">
                                        No recommendations found.
                                    </td>
                                </tr>
                            ) : sortedRecommendations.map(item => (
                                <tr key={item.documentId || item.id || `${item.d}-${item.ticker}-${item.type}`} className="align-top transition hover:bg-gray-700/30">
                                    <td className="whitespace-nowrap px-5 py-4 font-mono text-gray-300">{item.d || '-'}</td>
                                    <td className="px-5 py-4 font-bold text-white">{item.ticker || '-'}</td>
                                    <td className="px-5 py-4">
                                        <div className="inline-flex flex-col items-start gap-1">
                                            <span className={`inline-flex whitespace-nowrap rounded border px-2 py-1 text-xs font-semibold ${getTypeTone(item.type)}`}>
                                                {getTypeLabel(item.type)}
                                            </span>
                                            {item.value !== null && item.value !== undefined && item.value !== '' && (
                                                <span className="whitespace-nowrap font-mono text-xs text-gray-400">
                                                    {item.value}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="min-w-[520px] px-5 py-4 text-gray-300">
                                        <p className="line-clamp-4 leading-6">{item.reason || '-'}</p>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TCBSRecommendations;
