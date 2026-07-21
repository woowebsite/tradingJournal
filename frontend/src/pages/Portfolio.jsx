import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RefreshCw } from 'lucide-react';
import TradingViewChart from '../components/TradingViewChart';
import WatchlistSelector from '../components/WatchlistSelector';
import { fetchPagedSymbolHistories } from '../features/marketSlice';
import { useAccount } from '../context/AccountContext';
import { getStockHistory } from '../services/tcbs';
import { buildMarketCapWeightedIndex, normalizeChartHistory } from '../utils/watchlistIndex';
import allocationRules from '../config/technicalAllocationRules.json';
import { fetchSignals } from '../features/signalSlice';
import { fetchStrategies } from '../features/strategySlice';
import { getStrategyId } from '../utils/roadmapCalculations';
import api from '../services/api';

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
    const [technicalAnalyses, setTechnicalAnalyses] = useState({});

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
        let cancelled = false;
        const loadTechnicalAnalyses = async () => {
            const symbols = selectedWatchlist?.symbols || [];
            if (symbols.length === 0) {
                setTechnicalAnalyses({});
                return;
            }

            const entries = await Promise.all(symbols.map(async symbol => {
                const documentId = symbol?.documentId;
                const numericId = symbol?.id;
                if (!documentId && !numericId) return null;

                try {
                    const filterKey = documentId ? 'documentId' : 'id';
                    const filterValue = documentId || numericId;
                    const response = await api.get('/symbol-technical-analyses', {
                        params: {
                            [`filters[symbol][${filterKey}][$eq]`]: filterValue,
                            'pagination[pageSize]': 1,
                        },
                    });
                    const analysis = response.data?.data?.[0];
                    return analysis ? [String(documentId || numericId), analysis] : null;
                } catch (loadError) {
                    console.warn(`Technical analysis unavailable for ${symbol.Name || numericId}:`, loadError);
                    return null;
                }
            }));

            if (!cancelled) setTechnicalAnalyses(Object.fromEntries(entries.filter(Boolean)));
        };

        loadTechnicalAnalyses();
        return () => { cancelled = true; };
    }, [selectedWatchlist]);

    useEffect(() => {
        loadBenchmarkChart();
    }, [loadBenchmarkChart]);

    const handleRefresh = useCallback(() => {
        loadWatchlistChart();
        loadBenchmarkChart();
    }, [loadBenchmarkChart, loadWatchlistChart]);

    const ratioGroups = useMemo(
        () => (selectedWatchlist?.symbols || []).map(symbol => symbol?.stockRatio?.data || symbol?.stockRatio || null),
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
        const entryRuleNames = new Set((selectedStrategy?.entryRules || [])
            .map(rule => String(rule?.Name || rule?.name || '').trim().toLowerCase())
            .filter(Boolean));
        const accountId = String(selectedAccount?.documentId || selectedAccount?.id || '');
        const entrySymbols = new Set();

        (signals || []).forEach(signal => {
            const signalAccountId = signal.account?.documentId || signal.account?.id;
            if (signalAccountId && String(signalAccountId) !== accountId) return;
            const symbolId = signal.symbol?.documentId || signal.symbol?.id;
            if (!symbolId || signal.expired === true) return;
            const hasEntryRule = (signal.rules || []).some(rule => (
                entryRuleIds.has(String(rule?.documentId || rule?.id))
                || entryRuleNames.has(String(rule?.Name || rule?.name || '').trim().toLowerCase())
            ));
            if (!hasEntryRule) return;
            if (signal.symbol?.documentId) entrySymbols.add(String(signal.symbol.documentId));
            if (signal.symbol?.id) entrySymbols.add(String(signal.symbol.id));
            entrySymbols.add(String(symbolId));
            if (signal.symbol?.Name) entrySymbols.add(String(signal.symbol.Name).trim().toUpperCase());
        });

        return entrySymbols;
    }, [selectedAccount, selectedStrategy, signals]);
    const holdingRows = useMemo(() => {
        const symbols = selectedWatchlist?.symbols || [];
        const rules = Object.values(allocationRules).flatMap(config => config.rules || []);

        return symbols.map((symbol, index) => {
            const ratio = symbol?.stockRatio?.data || symbol?.stockRatio || {};
            const analysis = technicalAnalyses[String(getSymbolId(symbol))] || {};
            const latestClose = Number(watchlistHistories[index]?.[0]?.close);
            const symbolKey = String(getSymbolId(symbol) || '');
            const symbolName = String(symbol?.Name || '').trim().toUpperCase();
            const hasEntrySignal = entrySymbolIds.has(symbolKey) || entrySymbolIds.has(symbolName);
            const ruleResults = {
                priceAboveK26: latestClose > Number(analysis.k26),
                k26AboveK78: Number(analysis.k26) > Number(analysis.k78),
                priceAboveMA200: latestClose > Number(analysis.ma200),
                priceAboveSupertrend: latestClose > Number(analysis.supertrend),
                supertrendUptrend: Number(analysis.supertrendDirection) > 0,
            };
            const allocation = rules.reduce(
                (sum, rule) => sum + (ruleResults[rule.key] ? Number(rule.percent) : 0),
                0
            );
            const templateAllocations = Object.fromEntries(
                Object.entries(allocationRules).map(([template, config]) => [
                    template,
                    Math.min(100, (config.rules || []).reduce(
                        (sum, rule) => sum + (ruleResults[rule.key] ? Number(rule.percent) : 0),
                        0,
                    )),
                ]),
            );

            return {
                id: getSymbolId(symbol) || symbol?.Name || index,
                ticker: symbol?.Name || ratio.ticker || '-',
                company: symbol?.shortName || symbol?.Description || '-',
                latestClose,
                capitalize: Number(ratio.capitalize),
                outstandingShare: Number(ratio.outstandingShare),
                tradeVolume: Number(ratio.tradeVolume),
                hasEntrySignal,
                suggestedWeight: Math.min(100, allocation),
                ruleResults,
                templateAllocations,
            };
        });
    }, [entrySymbolIds, selectedWatchlist, technicalAnalyses, watchlistHistories]);
    const constituentCount = selectedWatchlist?.symbols?.length || 0;
    const technicalRules = useMemo(
        () => Object.entries(allocationRules),
        [],
    );

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
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-bold text-white">Suggested Holdings</h2>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                        Mỗi mã được tính độc lập theo template kỹ thuật; Entry chỉ là thông tin tham khảo. Rule nằm trong technicalAllocationRules.json.
                    </p>
                </header>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700 text-sm">
                        <thead className="bg-gray-900/30 text-left text-xs uppercase tracking-wide text-gray-400">
                            <tr>
                                <th className="px-4 py-3">Ticker</th>
                                <th className="px-4 py-3">Company</th>
                                <th className="px-4 py-3 text-right">Latest close</th>
                                {technicalRules.map(([template, config]) => (
                                    <th key={template} className="px-4 py-3 text-center">{config.label || template}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/70">
                            {holdingRows.length > 0 ? holdingRows.map(row => (
                                <tr key={row.id} className="transition hover:bg-gray-700/30">
                                    <td className="whitespace-nowrap px-4 py-3 font-bold text-white">{row.ticker}</td>
                                    <td className="min-w-[220px] px-4 py-3 text-gray-300">{row.company}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-gray-200">{formatMetric(row.latestClose)}</td>
                                    {technicalRules.map(([template, config]) => (
                                        <td key={template} className="px-4 py-3">
                                            <div className="mb-1 text-center font-mono font-bold text-blue-300">{formatMetric(row.templateAllocations[template])}%</div>
                                            <div className="flex flex-wrap justify-center gap-1">
                                                {(config.rules || []).map(rule => (
                                                    <span key={rule.key} className={`rounded px-1.5 py-0.5 text-[11px] ${row.ruleResults[rule.key] ? 'bg-emerald-500/15 text-emerald-300' : 'bg-gray-700 text-gray-500'}`}>
                                                        {rule.label}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={technicalRules.length + 3} className="px-4 py-8 text-center text-gray-500">Selected Watchlist chưa có cổ phiếu.</td>
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
