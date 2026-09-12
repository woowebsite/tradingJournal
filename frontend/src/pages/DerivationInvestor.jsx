import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import ReactECharts from 'echarts-for-react';
import { RefreshCw, TrendingUp } from 'lucide-react';
import api from '../services/api';
import { syncInvestorData } from '../services/tcbs';
import TradingViewChart from '../components/TradingViewChart';
import { fetchPagedSymbolHistories } from '../features/marketSlice';
import { loadExternalHistory } from '../features/marketSlice';
import { analyzeThreeCandlePatterns, normalizeDailyCandles } from '../utils/threeCandlePatterns';
import PatternDetailModal from '../components/PatternDetailModal';

const CHART_TICKER = 'VN30F1M';
const DERIVATION_TICKER = '41I1G8000';
const COLORS = { CM: '#38bdf8', SG: '#ff3a96', CN: '#fbbf24' };
const CANDLE_STYLES = {
    up: { label: 'Tăng', className: 'border-emerald-300/40 bg-emerald-500 shadow-emerald-500/20' },
    down: { label: 'Giảm', className: 'border-red-300/40 bg-red-500 shadow-red-500/20' },
    doji: { label: 'Doji', className: 'border-amber-200/50 bg-amber-400 shadow-amber-400/20' },
};
const VOLUME_STYLES = {
    up: { label: 'Tăng', symbol: '↑', className: 'text-emerald-300' },
    down: { label: 'Giảm', symbol: '↓', className: 'text-red-300' },
    flat: { label: 'Đi ngang', symbol: '→', className: 'text-gray-300' },
};
const unwrap = item => item?.attributes || item || {};
const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const DerivationInvestor = () => {
    const dispatch = useDispatch();
    const [tickerInput, setTickerInput] = useState(DERIVATION_TICKER);
    const [investorTicker, setInvestorTicker] = useState(DERIVATION_TICKER);
    const [investors, setInvestors] = useState([]);
    const [histories, setHistories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);
    const [selectedPattern, setSelectedPattern] = useState(null);

    const loadInvestorData = useCallback(async (forceRefresh = false) => {
        setLoading(true);
        setError('');
        try {
            const response = await api.get('/investors', {
                params: {
                    'filters[symbol][ticker][$eq]': investorTicker,
                    sort: 'date:asc',
                    'pagination[pageSize]': 1000,
                },
            });
            const databaseRows = (response.data?.data || []).map(unwrap);
            if (!forceRefresh && databaseRows.some(row => row.date === today())) {
                setInvestors(databaseRows);
                setLastUpdated(new Date());
                return;
            }
            const result = await syncInvestorData(investorTicker, '1M');
            setInvestors((result?.investors || []).map(unwrap));
            setLastUpdated(new Date());
        } catch (err) {
            setInvestors([]);
            setError(err.response?.data?.error?.message || err.message || 'Unable to load futures investor data.');
        } finally {
            setLoading(false);
        }
    }, [investorTicker]);

    useEffect(() => { loadInvestorData(); }, [loadInvestorData]);

    const loadChartData = useCallback(async (forceRefresh = false) => {
        setHistoryLoading(true);
        try {
            const response = await api.get('/symbols', {
                params: {
                    'filters[$or][0][ticker][$eq]': CHART_TICKER,
                    'filters[$or][1][Name][$eq]': CHART_TICKER,
                    'pagination[pageSize]': 1,
                },
            });
            const existingSymbol = response.data?.data?.[0];
            const symbol = existingSymbol || (await api.post('/symbols', {
                data: { Name: CHART_TICKER, ticker: CHART_TICKER },
            })).data?.data;
            const symbolId = symbol?.documentId || symbol?.id;
            if (!symbolId) {
                setHistories([]);
                return;
            }

            const existingHistories = await fetchPagedSymbolHistories(symbolId);
            const hasToday = existingHistories.some(item => String(item.date || '').startsWith(today()));
            if (forceRefresh || !hasToday) {
                await dispatch(loadExternalHistory({
                    symbol: CHART_TICKER,
                    symbolId,
                    marketType: 'Derivative',
                    resolution: 'D',
                })).unwrap();
            }
            setHistories(await fetchPagedSymbolHistories(symbolId));
        } catch (chartError) {
            console.error('Unable to refresh derivation chart:', chartError);
            if (!forceRefresh) setHistories([]);
        } finally {
            setHistoryLoading(false);
        }
    }, [dispatch]);

    useEffect(() => { loadChartData(); }, [loadChartData]);

    const chartData = useMemo(() => {
        const dates = [...new Set(investors.map(row => row.date).filter(Boolean))].sort();
        return { dates, series: Object.fromEntries(['CM', 'SG', 'CN'].map(type => [type, dates.map(date => {
            const row = investors.find(item => item.date === date && item.investorType === type);
            return row ? Number(row.netBuy ?? 0) : null;
        })])) };
    }, [investors]);

    const chartOption = useMemo(() => ({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', backgroundColor: '#111827', borderColor: '#374151', textStyle: { color: '#f3f4f6' } },
        legend: { bottom: 0, textStyle: { color: '#9ca3af' } },
        grid: { left: 56, right: 24, top: 24, bottom: 56 },
        xAxis: { type: 'category', boundaryGap: false, data: chartData.dates.map(date => date.slice(8, 10) + '/' + date.slice(5, 7)), axisLine: { lineStyle: { color: '#374151' } }, axisLabel: { color: '#9ca3af' } },
        yAxis: { type: 'value', name: 'Net Buy', nameTextStyle: { color: '#9ca3af' }, splitLine: { lineStyle: { color: '#1f2937' } }, axisLabel: { color: '#9ca3af' } },
        series: ['CM', 'SG', 'CN'].map(type => ({ name: type, type: 'line', smooth: true, symbol: 'circle', symbolSize: 5, lineStyle: { width: 2, color: COLORS[type] }, itemStyle: { color: COLORS[type] }, data: chartData.series[type] })),
    }), [chartData]);

    const dailyCandles = useMemo(() => normalizeDailyCandles(histories), [histories]);
    const candlePatterns = useMemo(() => analyzeThreeCandlePatterns(histories), [histories]);
    const totalPatternWindows = Math.max(0, dailyCandles.length - 2);
    const mostRepeatedPattern = candlePatterns[0] || null;

    const handleTickerSubmit = event => {
        event.preventDefault();
        const normalizedTicker = tickerInput.trim().toUpperCase();
        if (!/^[A-Z0-9]{1,20}$/.test(normalizedTicker)) {
            setError('Ticker chỉ được gồm chữ cái và chữ số.');
            return;
        }

        setTickerInput(normalizedTicker);
        if (normalizedTicker === investorTicker) {
            loadInvestorData(true);
            return;
        }

        setInvestors([]);
        setLastUpdated(null);
        setInvestorTicker(normalizedTicker);
    };

    return (
        <div className="space-y-6">
            <div>
                <div>
                    <p className="text-sm font-semibold uppercase tracking-widest text-sky-400">Future Insight</p>
                    <h1 className="mt-1 text-3xl font-bold text-gray-100">Derivation Investor</h1>
                    <p className="mt-2 text-sm text-gray-400">Theo dõi dòng mua ròng của 3 nhóm nhà đầu tư phái sinh trong 1 tháng.</p>
                </div>
            </div>
            {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <section className="order-1 rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-xl md:p-6">
                    <div className="mb-4 flex items-center justify-between gap-4">
                        <div><h2 className="text-lg font-bold text-gray-100">Biểu đồ nến <a href={`/trade-station?symbol=${CHART_TICKER}`} className="text-sky-400 hover:underline">{CHART_TICKER}</a></h2><p className="mt-1 text-xs text-gray-400">Dữ liệu lịch sử đã lưu trong database, tương tự Trade Station.</p></div>
                        <button
                            type="button"
                            onClick={() => loadChartData(true)}
                            disabled={historyLoading}
                            className="flex shrink-0 items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <RefreshCw size={16} className={historyLoading ? 'animate-spin' : ''} />
                            {historyLoading ? 'Đang tải' : 'Refresh'}
                        </button>
                    </div>
                    <div className="h-[460px] overflow-hidden rounded-xl">{histories.length ? <TradingViewChart data={histories} symbol={CHART_TICKER} /> : <div className="flex h-full items-center justify-center text-sm text-gray-500">Chưa có dữ liệu lịch sử.</div>}</div>
                </section>
                <section className="order-2 rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-xl md:p-6">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-gray-100">Mua ròng theo nhóm nhà đầu tư</h2>
                                <TrendingUp className="text-sky-400" size={22} />
                            </div>
                            <p className="mt-1 text-xs text-gray-400">{investorTicker} · 1M · {lastUpdated ? `Cập nhật ${lastUpdated.toLocaleTimeString('vi-VN')}` : 'Chưa cập nhật'}</p>
                        </div>
                        <form onSubmit={handleTickerSubmit} className="flex shrink-0 gap-2">
                            <input
                                id="ticker"
                                value={tickerInput}
                                onChange={event => setTickerInput(event.target.value.toUpperCase())}
                                className="w-32 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm uppercase text-gray-100 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                aria-label="Ticker"
                                autoComplete="off"
                            />
                            <button type="submit" disabled={loading} className="flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />{loading ? 'Đang tải' : 'Cập nhật'}</button>
                        </form>
                    </div>
                    {investors.length ? <div className="h-[460px]"><ReactECharts option={chartOption} style={{ width: '100%', height: '100%' }} notMerge lazyUpdate /></div> : <div className="flex h-[460px] items-center justify-center text-sm text-gray-500">{loading ? 'Đang tải dữ liệu...' : 'Chưa có dữ liệu.'}</div>}
                </section>
            </div>
            <section className="rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-xl md:p-6">
                <div className="flex flex-col gap-4 border-b border-gray-700/70 pb-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">Price &amp; Volume</p>
                        <h2 className="mt-1 text-xl font-bold text-gray-100">Thống kê pattern 3 nến</h2>
                        <p className="mt-2 max-w-3xl text-sm text-gray-400">
                            Mỗi pattern gồm hướng của 3 nến D1 và biến động volume giữa nến 1→2, 2→3.
                            Các cửa sổ 3 nến liên tiếp được tính chồng lấn.
                        </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="min-w-24 rounded-xl border border-gray-700 bg-gray-900/50 px-3 py-2">
                            <div className="text-lg font-bold text-gray-100">{totalPatternWindows}</div>
                            <div className="text-[11px] text-gray-500">Cửa sổ</div>
                        </div>
                        <div className="min-w-24 rounded-xl border border-gray-700 bg-gray-900/50 px-3 py-2">
                            <div className="text-lg font-bold text-sky-300">{candlePatterns.length}</div>
                            <div className="text-[11px] text-gray-500">Pattern</div>
                        </div>
                        <div className="min-w-24 rounded-xl border border-gray-700 bg-gray-900/50 px-3 py-2">
                            <div className="text-lg font-bold text-amber-300">{mostRepeatedPattern?.count || 0}</div>
                            <div className="text-[11px] text-gray-500">Lặp nhiều nhất</div>
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-400">
                    <span><strong className="text-gray-300">Nến:</strong> Tăng, Giảm, Doji (thân ≤ 0,1%)</span>
                    <span><strong className="text-gray-300">Volume:</strong> Tăng, Giảm, Đi ngang (±5%)</span>
                </div>

                {candlePatterns.length > 0 ? (
                    <div className="mt-4 max-h-[480px] overflow-auto rounded-xl border border-gray-700">
                        <table className="w-full min-w-[760px] text-left text-sm">
                            <thead className="sticky top-0 z-10 bg-gray-900 text-xs uppercase tracking-wide text-gray-500">
                                <tr>
                                    <th className="px-4 py-3">Pattern nến</th>
                                    <th className="px-4 py-3">Pattern volume</th>
                                    <th className="px-4 py-3 text-right">Số lần</th>
                                    <th className="px-4 py-3 text-right">Tỷ lệ</th>
                                    <th className="px-4 py-3 text-right">Gần nhất</th>
                                    <th className="px-4 py-3 text-right">Detail</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700/70">
                                {candlePatterns.map(pattern => {
                                    const matchesToday = (pattern.occurrences || []).some(occurrence => occurrence.endDate === today());
                                    return (
                                    <tr
                                        key={pattern.key}
                                        className={`transition ${matchesToday ? 'bg-amber-500/15 ring-1 ring-inset ring-amber-400/50 hover:bg-amber-500/20' : 'hover:bg-gray-700/30'}`}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                                {pattern.candles.map((direction, index) => {
                                                    const style = CANDLE_STYLES[direction];
                                                    return (
                                                        <span
                                                            key={`${pattern.key}-candle-${index}`}
                                                            role="img"
                                                            aria-label={`Nến ${index + 1}: ${style.label}`}
                                                            title={`Nến ${index + 1}: ${style.label}`}
                                                            className={`block h-7 w-7 rounded-sm border shadow-md ${style.className}`}
                                                        />
                                                    );
                                                })}
                                                {matchesToday && (
                                                    <span className="ml-2 rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                                                        Hôm nay
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                {pattern.volumes.map((direction, index) => {
                                                    const style = VOLUME_STYLES[direction];
                                                    return (
                                                        <span key={`${pattern.key}-volume-${index}`} className={`whitespace-nowrap text-xs font-semibold ${style.className}`}>
                                                            V{index + 2}/V{index + 1} {style.symbol} {style.label}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-gray-100">{pattern.count}</td>
                                        <td className="px-4 py-3 text-right font-mono text-sky-300">{pattern.percentage.toFixed(1)}%</td>
                                        <td className="px-4 py-3 text-right font-mono text-gray-400">{pattern.lastSeen}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedPattern(pattern)}
                                                className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-300 transition hover:border-sky-400 hover:bg-sky-500/20"
                                            >
                                                Xem detail
                                            </button>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="mt-4 flex min-h-36 items-center justify-center rounded-xl border border-dashed border-gray-700 text-sm text-gray-500">
                        Cần ít nhất 3 nến D1 hợp lệ để thống kê pattern.
                    </div>
                )}
            </section>
            {selectedPattern && (
                <PatternDetailModal
                    key={selectedPattern.key}
                    isOpen
                    onClose={() => setSelectedPattern(null)}
                    pattern={selectedPattern}
                    histories={histories}
                    symbol={CHART_TICKER}
                />
            )}
        </div>
    );
};

export default DerivationInvestor;
