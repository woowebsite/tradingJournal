import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import TradingViewChart from '../components/TradingViewChart';
import WatchlistSelector from '../components/WatchlistSelector';
import { fetchPagedSymbolHistories } from '../features/marketSlice';
import { useAccount } from '../context/AccountContext';
import { getStockHistory } from '../services/tcbs';
import { buildEqualWeightIndex, normalizeChartHistory } from '../utils/watchlistIndex';

const getSymbolId = symbol => symbol?.documentId || symbol?.id;
const BENCHMARK_LABELS = { VN30: 'VN30', VNINDEX: 'VNIndex', 100: '100' };

const ChartBox = ({ title, subtitle, data, loading, emptyMessage, headerAction = null }) => (
    <section className="min-h-[560px] overflow-hidden rounded-xl border border-gray-700 bg-gray-800 shadow-lg">
        <header className="flex items-center justify-between gap-4 border-b border-gray-700 bg-gray-900/50 px-4 py-3">
            <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-white">{title}</h2>
                <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>
            </div>
            {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
        </header>
        <div className="relative h-[500px]">
            {loading ? (
                <div className="absolute inset-0 flex items-center justify-center text-blue-400">Loading data...</div>
            ) : data.length > 0 ? (
                <TradingViewChart data={data} symbol={title} />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-gray-500">{emptyMessage}</div>
            )}
        </div>
    </section>
);

const Portfolio = () => {
    const { selectedWatchlist } = useAccount();
    const [watchlistHistories, setWatchlistHistories] = useState([]);
    const [benchmarkHistory, setBenchmarkHistory] = useState([]);
    const [benchmarkTicker, setBenchmarkTicker] = useState('VN30');
    const [watchlistLoading, setWatchlistLoading] = useState(false);
    const [benchmarkLoading, setBenchmarkLoading] = useState(false);
    const [error, setError] = useState('');

    const loadWatchlistChart = useCallback(async () => {
        const watchlistSymbols = selectedWatchlist?.symbols || [];
        setWatchlistLoading(true);
        setError('');
        try {
            const historyGroups = await Promise.all(
                watchlistSymbols.map(symbol => fetchPagedSymbolHistories(getSymbolId(symbol)))
            );
            setWatchlistHistories(historyGroups);
        } catch (loadError) {
            console.error('Failed to load Watchlist index:', loadError);
            setError(loadError?.message || 'Failed to load Watchlist data.');
        } finally {
            setWatchlistLoading(false);
        }
    }, [selectedWatchlist]);

    const loadBenchmarkChart = useCallback(async () => {
        setBenchmarkLoading(true);
        setError('');
        try {
            const bars = await getStockHistory(benchmarkTicker, 'index', 'D');
            setBenchmarkHistory(normalizeChartHistory(bars));
        } catch (loadError) {
            console.error(`Failed to load ${benchmarkTicker}:`, loadError);
            setError(loadError?.message || `Failed to load ${benchmarkTicker} data.`);
        } finally {
            setBenchmarkLoading(false);
        }
    }, [benchmarkTicker]);

    useEffect(() => {
        loadWatchlistChart();
    }, [loadWatchlistChart]);

    useEffect(() => {
        loadBenchmarkChart();
    }, [loadBenchmarkChart]);

    const handleRefresh = useCallback(() => {
        loadWatchlistChart();
        loadBenchmarkChart();
    }, [loadBenchmarkChart, loadWatchlistChart]);

    const watchlistIndex = useMemo(() => buildEqualWeightIndex(watchlistHistories), [watchlistHistories]);
    const constituentCount = selectedWatchlist?.symbols?.length || 0;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Porfolio</h1>
                    <p className="text-sm text-gray-400">Selected Watchlist index compared with VN30</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={watchlistLoading || benchmarkLoading}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={watchlistLoading || benchmarkLoading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ChartBox
                    title={`${selectedWatchlist?.name || 'Watchlist'} Index`}
                    subtitle={`Equal-weight, normalized to 100 · ${constituentCount} constituents`}
                    data={watchlistIndex}
                    loading={watchlistLoading}
                    emptyMessage="The selected Watchlist needs symbols with overlapping price history."
                    headerAction={<WatchlistSelector />}
                />
                <ChartBox
                    title={'Index'}
                    subtitle={`Index from TCBS · Daily`}
                    data={benchmarkHistory}
                    loading={benchmarkLoading}
                    emptyMessage={`${BENCHMARK_LABELS[benchmarkTicker] || benchmarkTicker} history could not be loaded from TCBS.`}
                    headerAction={(
                        <select
                            aria-label="Selected market index"
                            value={benchmarkTicker}
                            onChange={(event) => setBenchmarkTicker(event.target.value)}
                            className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white transition hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="VN30">VN30</option>
                            <option value="VNINDEX">VNIndex</option>
                            <option value="100">100</option>
                        </select>
                    )}
                />
            </div>
        </div>
    );
};

export default Portfolio;
