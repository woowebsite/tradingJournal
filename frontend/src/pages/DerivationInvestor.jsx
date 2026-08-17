import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import ReactECharts from 'echarts-for-react';
import { RefreshCw, TrendingUp } from 'lucide-react';
import api from '../services/api';
import { syncInvestorData } from '../services/tcbs';
import TradingViewChart from '../components/TradingViewChart';
import { fetchPagedSymbolHistories } from '../features/marketSlice';
import { loadExternalHistory } from '../features/marketSlice';

const TICKER = 'VN30F1M';
const COLORS = { CM: '#38bdf8', SG: '#a78bfa', CN: '#fbbf24' };
const unwrap = item => item?.attributes || item || {};
const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const DerivationInvestor = () => {
    const dispatch = useDispatch();
    const [investors, setInvestors] = useState([]);
    const [histories, setHistories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);

    const loadInvestorData = useCallback(async (forceRefresh = false) => {
        setLoading(true);
        setError('');
        try {
            const response = await api.get('/investors', {
                params: {
                    'filters[symbol][ticker][$eq]': TICKER,
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
            const result = await syncInvestorData(TICKER, '1M');
            setInvestors((result?.investors || []).map(unwrap));
            setLastUpdated(new Date());
        } catch (err) {
            setInvestors([]);
            setError(err.response?.data?.error?.message || err.message || 'Unable to load futures investor data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadInvestorData(); }, [loadInvestorData]);

    const loadChartData = useCallback(async (forceRefresh = false) => {
        setHistoryLoading(true);
        try {
            const response = await api.get('/symbols', {
                params: {
                    'filters[$or][0][ticker][$eq]': TICKER,
                    'filters[$or][1][Name][$eq]': TICKER,
                    'pagination[pageSize]': 1,
                },
            });
            const existingSymbol = response.data?.data?.[0];
            const symbol = existingSymbol || (await api.post('/symbols', {
                data: { Name: TICKER, ticker: TICKER },
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
                    symbol: TICKER,
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

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-widest text-sky-400">Future Insight</p>
                    <h1 className="mt-1 text-3xl font-bold text-gray-100">Derivation Investor</h1>
                    <p className="mt-2 text-sm text-gray-400">Theo dõi dòng mua ròng của 3 nhóm nhà đầu tư phái sinh trong 1 tháng.</p>
                </div>
                <div className="flex gap-2">
                    <input id="ticker" value={TICKER} readOnly className="w-48 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none" aria-label="Ticker" />
                    <button onClick={() => loadInvestorData(true)} disabled={loading} className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />{loading ? 'Đang tải' : 'Cập nhật'}</button>
                </div>
            </div>
            {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <section className="order-1 rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-xl md:p-6">
                    <div className="mb-4 flex items-center justify-between gap-4">
                        <div><h2 className="text-lg font-bold text-gray-100">Biểu đồ nến <a href={`/trade-station?symbol=${TICKER}`} className="text-sky-400 hover:underline">{TICKER}</a></h2><p className="mt-1 text-xs text-gray-400">Dữ liệu lịch sử đã lưu trong database, tương tự Trade Station.</p></div>
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
                    <div className="h-[460px] overflow-hidden rounded-xl">{histories.length ? <TradingViewChart data={histories} symbol={TICKER} /> : <div className="flex h-full items-center justify-center text-sm text-gray-500">Chưa có dữ liệu lịch sử.</div>}</div>
                </section>
                <section className="order-2 rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-xl md:p-6">
                    <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold text-gray-100">Mua ròng theo nhóm nhà đầu tư</h2><p className="mt-1 text-xs text-gray-400">{TICKER} · 1M · {lastUpdated ? `Cập nhật ${lastUpdated.toLocaleTimeString('vi-VN')}` : 'Chưa cập nhật'}</p></div><TrendingUp className="text-sky-400" size={22} /></div>
                    {investors.length ? <div className="h-[460px]"><ReactECharts option={chartOption} style={{ width: '100%', height: '100%' }} notMerge lazyUpdate /></div> : <div className="flex h-[460px] items-center justify-center text-sm text-gray-500">{loading ? 'Đang tải dữ liệu...' : 'Chưa có dữ liệu.'}</div>}
                </section>
            </div>
        </div>
    );
};

export default DerivationInvestor;
