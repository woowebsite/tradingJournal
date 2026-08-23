import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { syncInvestorData } from '../services/tcbs';
import api from '../services/api';
import TradingViewChart from '../components/TradingViewChart';
import { fetchPagedSymbolHistories } from '../features/marketSlice';

const COLORS = { CM: '#38bdf8', SG: '#ff3a96', CN: '#fbbf24' };
const INVESTOR_FIELDS = {
    CM: { buy: 'skb', sell: 'sks' },
    SG: { buy: 'wob', sell: 'wos' },
    CN: { buy: 'shb', sell: 'shs' },
};

const unwrapInvestor = (item) => item?.attributes || item || {};

const formatDate = (value) => {
    if (!value) return '';
    const [year, month, day] = String(value).split('-');
    return year && month && day ? `${day}/${month}` : String(value);
};

const getToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const InvestorInsight = () => {
    const [ticker, setTicker] = useState('VIX');
    const [stockSymbols, setStockSymbols] = useState([]);
    const [investors, setInvestors] = useState([]);
    const [histories, setHistories] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);

    useEffect(() => {
        let cancelled = false;
        api.get('/symbols?populate=*&sort=Name:asc&pagination[pageSize]=1000')
            .then(response => {
                if (cancelled) return;
                const symbols = (response.data?.data || [])
                    .map(unwrapInvestor)
                    .map(symbol => {
                        const name = String(symbol.ticker || symbol.Name || '').trim().toUpperCase();
                        return { ...symbol, ticker: name.split(':')[0] };
                    })
                    .filter(symbol => /^[A-Z]+$/.test(symbol.ticker))
                    .filter((symbol, index, list) => list.findIndex(item => item.ticker === symbol.ticker) === index);
                setStockSymbols(symbols);
                setTicker(current => symbols.some(symbol => symbol.ticker === current) ? current : (symbols[0]?.ticker || current));
            })
            .catch(err => {
                if (!cancelled) setError(err.message || 'Không thể tải danh sách mã cổ phiếu.');
            });
        return () => { cancelled = true; };
    }, []);

    const loadData = useCallback(async (selectedTicker = ticker, forceRefresh = false) => {
        const normalizedTicker = selectedTicker.trim().toUpperCase();
        if (!normalizedTicker) return;
        setLoading(true);
        setError('');
        try {
            const databaseResponse = await api.get('/investors', {
                params: {
                    'filters[symbol][ticker][$eq]': normalizedTicker,
                    sort: 'date:asc',
                    'pagination[pageSize]': 1000,
                },
            });
            const databaseRows = (databaseResponse.data?.data || []).map(unwrapInvestor);
            if (!forceRefresh && databaseRows.some(row => row.date === getToday())) {
                setInvestors(databaseRows);
                setLastUpdated(new Date());
                return;
            }

            const result = await syncInvestorData(normalizedTicker, '1M');
            setInvestors((result?.investors || []).map(unwrapInvestor));
            setLastUpdated(new Date());
        } catch (err) {
            setInvestors([]);
            setError(err.response?.data?.error?.message || err.message || 'Không thể tải dữ liệu nhà đầu tư.');
        } finally {
            setLoading(false);
        }
    }, [ticker]);

    useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const selectedSymbol = stockSymbols.find(symbol => symbol.ticker === ticker);
        const symbolId = selectedSymbol?.documentId || selectedSymbol?.id;
        if (!symbolId) {
            setHistories([]);
            return undefined;
        }

        let cancelled = false;
        setHistoryLoading(true);
        fetchPagedSymbolHistories(symbolId)
            .then(data => { if (!cancelled) setHistories(data || []); })
            .catch(() => { if (!cancelled) setHistories([]); })
            .finally(() => { if (!cancelled) setHistoryLoading(false); });
        return () => { cancelled = true; };
    }, [stockSymbols, ticker]);

    const chartData = useMemo(() => {
        const dates = [...new Set(investors.map(item => item.date).filter(Boolean))].sort();
        return { dates, byType: Object.fromEntries(['CM', 'SG', 'CN'].map(type => [
            type,
            dates.map(date => {
                const row = investors.find(item => item.date === date && item.investorType === type);
                return row ? Number(row.netBuy ?? 0) : null;
            }),
        ])) };
    }, [investors]);

    const chartOption = useMemo(() => ({
        backgroundColor: 'transparent',
        animationDuration: 500,
        tooltip: {
            trigger: 'axis',
            backgroundColor: '#111827',
            borderColor: '#374151',
            textStyle: { color: '#f3f4f6' },
        },
        legend: { bottom: 0, textStyle: { color: '#9ca3af' } },
        grid: { left: 56, right: 24, top: 24, bottom: 56 },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: chartData.dates.map(formatDate),
            axisLine: { lineStyle: { color: '#374151' } },
            axisLabel: { color: '#9ca3af' },
        },
        yAxis: {
            type: 'value',
            name: 'Net Buy',
            nameTextStyle: { color: '#9ca3af' },
            splitLine: { lineStyle: { color: '#1f2937' } },
            axisLabel: { color: '#9ca3af' },
        },
        series: ['CM', 'SG', 'CN'].map(type => ({
            name: type,
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 5,
            lineStyle: { width: 2, color: COLORS[type] },
            itemStyle: { color: COLORS[type] },
            data: chartData.byType[type],
        })),
    }), [chartData]);

    const latestByType = ['CM', 'SG', 'CN'].map(type => {
        const rows = investors.filter(item => item.investorType === type).sort((a, b) => String(a.date).localeCompare(String(b.date)));
        return { type, row: rows.at(-1) };
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">Stock Insight</p>
                    <h1 className="mt-1 text-3xl font-bold text-gray-100">Investor Insight</h1>
                    <p className="mt-2 text-sm text-gray-400">Theo dõi dòng mua ròng của 3 nhóm nhà đầu tư phái sinh trong 1 tháng.</p>
                </div>
                <div className="flex gap-2">
                    <select id="ticker" value={ticker} onChange={event => { const value = event.target.value; setTicker(value); loadData(value); }} className="w-48 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-sky-500" aria-label="Ticker">
                        {!stockSymbols.length && <option value={ticker}>{ticker}</option>}
                        {stockSymbols.map(symbol => <option key={symbol.ticker} value={symbol.ticker}>{symbol.ticker}{symbol.Name && symbol.Name !== symbol.ticker ? ` · ${symbol.Name}` : ''}</option>)}
                    </select>
                    <button onClick={() => loadData(ticker, true)} disabled={loading} className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        {loading ? 'Đang tải' : 'Cập nhật'}
                    </button>
                </div>
            </div>

            {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="order-2 rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-xl md:p-6 lg:order-2">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-gray-100">Mua ròng theo nhóm nhà đầu tư</h2>
                        <p className="mt-1 text-xs text-gray-400">{ticker.toUpperCase()} · Khung thời gian 1M · {lastUpdated ? `Cập nhật ${lastUpdated.toLocaleTimeString('vi-VN')}` : 'Chưa cập nhật'}</p>
                    </div>
                    <TrendingUp className="text-sky-400" size={22} />
                </div>
                {investors.length ? <div className="h-[460px]"><ReactECharts option={chartOption} style={{ width: '100%', height: '100%' }} notMerge lazyUpdate /></div> : <div className="flex h-[460px] items-center justify-center text-sm text-gray-500">{loading ? 'Đang tải dữ liệu...' : 'Chưa có dữ liệu.'}</div>}
            </section>

            <section className="order-1 rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-xl md:p-6 lg:order-1">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-gray-100">Biểu đồ nến <a href={`/trade-station?symbol=${encodeURIComponent(ticker)}`} className="text-sky-400 hover:text-sky-300 hover:underline">{ticker.toUpperCase()}</a></h2>
                        <p className="mt-1 text-xs text-gray-400">Dữ liệu lịch sử đã lưu trong database, tương tự Trade Station.</p>
                    </div>
                    {historyLoading && <span className="text-xs text-sky-400">Đang tải dữ liệu nến...</span>}
                </div>
                <div className="h-[460px] overflow-hidden rounded-xl">
                    {histories.length ? <TradingViewChart data={histories} symbol={ticker} /> : <div className="flex h-full items-center justify-center text-sm text-gray-500">Chưa có dữ liệu lịch sử cho symbol này.</div>}
                </div>
            </section>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {latestByType.map(({ type, row }) => {
                    const netBuy = row ? Number(row.netBuy ?? 0) : null;
                    const netBuyColor = netBuy < 0 ? 'text-red-400' : netBuy > 0 ? 'text-emerald-400' : 'text-gray-100';
                    return (
                        <div key={type} className="rounded-xl border border-gray-700 bg-gray-800/80 p-4">
                            <div className="flex items-center justify-between"><span className="text-sm font-semibold" style={{ color: COLORS[type] }}>Nhóm {type}</span></div>
                            <p className={`mt-3 text-2xl font-bold ${netBuyColor}`}>{netBuy !== null ? netBuy.toLocaleString('vi-VN') : '—'}</p>
                            <p className="mt-1 text-xs text-gray-500">
                                {INVESTOR_FIELDS[type].buy} (mua) - {INVESTOR_FIELDS[type].sell} (bán): {row ? `${Number(row.buyVolume ?? 0).toLocaleString('vi-VN')} - ${Number(row.sellVolume ?? 0).toLocaleString('vi-VN')}` : '—'}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">Mua ròng · {row?.sourceDate || 'chưa có dữ liệu'}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default InvestorInsight;
