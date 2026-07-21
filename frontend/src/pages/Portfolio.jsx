import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RefreshCw } from 'lucide-react';
import TradingViewChart from '../components/TradingViewChart';
import WatchlistSelector from '../components/WatchlistSelector';
import { fetchPagedSymbolHistories } from '../features/marketSlice';
import { useAccount } from '../context/AccountContext';
import { getStockHistory } from '../services/tcbs';
import { buildMarketCapWeightedIndex, buildMarketCapWeights, normalizeChartHistory } from '../utils/watchlistIndex';
import { fetchSignals } from '../features/signalSlice';
import { fetchStrategies } from '../features/strategySlice';
import { getStrategyId } from '../utils/roadmapCalculations';

const getSymbolId = symbol => symbol?.documentId || symbol?.id;
const BENCHMARK_LABELS = { VN30: 'VN30', VNINDEX: 'VNIndex', 100: '100' };
const formatMetric = (value, fractionDigits = 2) => Number.isFinite(Number(value))
    ? Number(value).toLocaleString('en-US', { maximumFractionDigits: fractionDigits })
    : '-';

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
    const dispatch = useDispatch();
    const { selectedWatchlist } = useAccount();
    const { selectedAccount } = useAccount();
    const { items: signals } = useSelector(state => state.signals);
    const { items: strategies } = useSelector(state => state.strategies);
    const [watchlistHistories, setWatchlistHistories] = useState([]);
    const [benchmarkHistory, setBenchmarkHistory] = useState([]);
    const [benchmarkTicker, setBenchmarkTicker] = useState('VN30');
    const [watchlistLoading, setWatchlistLoading] = useState(false);
    const [benchmarkLoading, setBenchmarkLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        dispatch(fetchSignals());
        dispatch(fetchStrategies());
    }, [dispatch]);

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

    const ratioGroups = useMemo(
        () => (selectedWatchlist?.symbols || []).map(symbol => symbol?.stockRatio || null),
        [selectedWatchlist]
    );
    const watchlistIndex = useMemo(
        () => buildMarketCapWeightedIndex(watchlistHistories, ratioGroups, benchmarkHistory),
        [benchmarkHistory, ratioGroups, watchlistHistories]
    );
    const selectedStrategy = useMemo(() => {
        const strategyId = getStrategyId(selectedAccount?.strategy);
        if (selectedAccount?.strategy?.entryRules) return selectedAccount.strategy;
        return strategies.find(strategy => String(getStrategyId(strategy)) === String(strategyId)) || null;
    }, [selectedAccount, strategies]);
    const entrySymbolIds = useMemo(() => {
        const entryRuleIds = new Set((selectedStrategy?.entryRules || [])
            .map(rule => String(rule?.documentId || rule?.id)));
        const accountId = String(selectedAccount?.documentId || selectedAccount?.id || '');
        const latestBySymbol = new Map();

        (signals || []).forEach(signal => {
            const signalAccountId = signal.account?.documentId || signal.account?.id;
            if (signalAccountId && String(signalAccountId) !== accountId) return;
            const symbolId = signal.symbol?.documentId || signal.symbol?.id;
            if (!symbolId || signal.expired === true) return;
            const current = latestBySymbol.get(String(symbolId));
            if (!current || new Date(signal.date) > new Date(current.date)) {
                latestBySymbol.set(String(symbolId), signal);
            }
        });

        return new Set([...latestBySymbol.entries()]
            .filter(([, signal]) => (signal.rules || []).some(rule => entryRuleIds.has(String(rule?.documentId || rule?.id))))
            .map(([symbolId]) => symbolId));
    }, [selectedAccount, selectedStrategy, signals]);
    const holdingRows = useMemo(() => {
        const symbols = selectedWatchlist?.symbols || [];
        const weights = buildMarketCapWeights(ratioGroups);
        const eligibleWeights = weights.map((item, index) => {
            const symbolId = String(getSymbolId(symbols[index]) || '');
            return entrySymbolIds.has(symbolId) ? item.weight : 0;
        });
        const totalWeight = eligibleWeights.reduce((sum, weight) => sum + weight, 0);

        return symbols.map((symbol, index) => {
            const ratio = symbol?.stockRatio || {};
            const latestClose = Number(watchlistHistories[index]?.[0]?.close);
            const weight = weights[index]?.weight || 1;
            return {
                id: getSymbolId(symbol) || symbol?.Name || index,
                ticker: symbol?.Name || ratio.ticker || '-',
                company: symbol?.shortName || symbol?.Description || '-',
                latestClose,
                capitalize: Number(ratio.capitalize),
                outstandingShare: Number(ratio.outstandingShare),
                tradeVolume: Number(ratio.tradeVolume),
                hasEntrySignal: entrySymbolIds.has(String(getSymbolId(symbol) || '')),
                suggestedWeight: totalWeight > 0 && entrySymbolIds.has(String(getSymbolId(symbol) || ''))
                    ? weight / totalWeight * 100
                    : 0,
                fallbackWeight: weights[index]?.fallbackWeight,
            };
        });
    }, [entrySymbolIds, ratioGroups, selectedWatchlist, watchlistHistories]);
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
                    subtitle={`Market-cap weighted · missing StockRatio uses average weight · ${constituentCount} constituents`}
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

            <section className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800 shadow-lg">
                <header className="border-b border-gray-700 bg-gray-900/50 px-4 py-3">
                    <h2 className="text-lg font-bold text-white">Suggested Holdings</h2>
                    <p className="mt-0.5 text-xs text-gray-400">
                        Chỉ mã có tín hiệu Entry mới được phân bổ; tỷ trọng trong nhóm Entry dựa theo vốn hóa.
                    </p>
                </header>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700 text-sm">
                        <thead className="bg-gray-900/30 text-left text-xs uppercase tracking-wide text-gray-400">
                            <tr>
                                <th className="px-4 py-3">Ticker</th>
                                <th className="px-4 py-3">Company</th>
                                <th className="px-4 py-3 text-right">Latest close</th>
                                <th className="px-4 py-3 text-right">Capitalization</th>
                                <th className="px-4 py-3 text-right">Outstanding shares</th>
                                <th className="px-4 py-3 text-right">Trade volume</th>
                                <th className="px-4 py-3 text-right">Suggested weight</th>
                                <th className="px-4 py-3">Signal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/70">
                            {holdingRows.length > 0 ? holdingRows.map(row => (
                                <tr key={row.id} className="transition hover:bg-gray-700/30">
                                    <td className="whitespace-nowrap px-4 py-3 font-bold text-white">{row.ticker}</td>
                                    <td className="min-w-[220px] px-4 py-3 text-gray-300">{row.company}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-gray-200">{formatMetric(row.latestClose)}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-gray-200">{formatMetric(row.capitalize)}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-gray-200">{formatMetric(row.outstandingShare)}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-gray-200">{formatMetric(row.tradeVolume, 0)}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-bold text-blue-300">{formatMetric(row.suggestedWeight)}%</td>
                                    <td className="whitespace-nowrap px-4 py-3">
                                        <span className={row.hasEntrySignal ? 'text-emerald-300' : 'text-gray-500'}>
                                            {row.hasEntrySignal ? 'Entry' : 'No Entry'}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="8" className="px-4 py-8 text-center text-gray-500">Selected Watchlist chưa có cổ phiếu.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default Portfolio;
