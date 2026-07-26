import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
    Activity,
    BarChart3,
    CircleDollarSign,
    Factory,
    Flame,
    Globe2,
    Landmark,
    Newspaper,
    RefreshCw,
    Ship,
    TrendingUp,
} from 'lucide-react';
import { getGlobalMacroSnapshot, getLatestBrentHistory, getLatestWtiHistory, getLatestDxyHistory, getLatestGoldHistory, getLatestNasdaqHistory, getLatestSp500History } from '../services/globalMacro';

const periods = ['Jul 25', 'Aug 25', 'Sep 25', 'Oct 25', 'Nov 25', 'Dec 25', 'Jan 26', 'Feb 26', 'Mar 26', 'Apr 26', 'May 26', 'Jun 26'];

const sourceLinks = [
    { key: 'fed', label: 'Federal Reserve ↗', url: 'https://www.federalreserve.gov/monetarypolicy/openmarket.htm' },
    { key: 'usCpi', label: 'BLS CPI ↗', url: 'https://www.bls.gov/cpi/' },
    { key: 'us10y', label: 'U.S. Treasury US10Y ↗', url: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates' },
    { key: 'us2y', label: 'U.S. Treasury US2Y ↗', url: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates' },
    { key: 'dxy', label: 'Investing.com DXY ↗', url: 'https://www.investing.com/currencies/us-dollar-index-historical-data' },
    { key: 'brent', label: 'Investing.com Brent ↗', url: 'https://www.investing.com/commodities/brent-oil-historical-data' },
    { key: 'wti', label: 'Investing.com WTI ↗', url: 'https://www.investing.com/commodities/crude-oil-historical-data' },
    { key: 'nasdaq', label: 'Investing.com Nasdaq ↗', url: 'https://www.investing.com/indices/nasdaq-composite-historical-data' },
    { key: 'sp500', label: 'Investing.com S&P 500 ↗', url: 'https://www.investing.com/indices/us-spx-500-historical-data' },
    { key: 'gold', label: 'Investing.com Gold ↗', url: 'https://www.investing.com/commodities/gold-historical-data' },
    { key: 'china', label: 'China NBS ↗', url: 'https://www.stats.gov.cn/english/' },
    { key: 'news', label: 'Reuters World ↗', url: 'https://www.reuters.com/world/' },
];

const globalIndicators = [
    { key: 'fed', label: 'Fed Funds Rate', value: '3,63%', unit: 'EFFR · 20/07/2026', tone: 'text-sky-400', color: '#38bdf8', icon: Landmark, values: [100, 100, 100, 99.5, 99.5, 99, 99, 99, 99, 98.5, 98.5, 98.5] },
    { key: 'usCpi', label: 'Lạm phát Mỹ', value: '3,5%', unit: 'CPI-U · YoY · 06/2026', tone: 'text-amber-400', color: '#fbbf24', icon: Activity, values: [100, 101, 101, 102, 103, 103, 104, 104, 105, 106, 106, 107] },
    { key: 'us10y', label: 'Lợi suất US10Y', value: '4,60%', unit: 'Treasury nominal · 20/07/2026', tone: 'text-violet-400', color: '#a78bfa', icon: TrendingUp, values: [100, 101, 102, 101, 103, 104, 103, 104, 105, 106, 105, 107] },
    { key: 'us2y', label: 'Lợi suất US2Y', value: '4,21%', unit: 'Treasury nominal · 20/07/2026', tone: 'text-fuchsia-400', color: '#e879f9', icon: TrendingUp, values: [100, 99, 100, 99, 101, 101, 100, 101, 102, 102, 101, 102] },
    { key: 'dxy', label: 'DXY', value: '101,14', unit: 'đóng cửa · 22/07/2026', tone: 'text-rose-400', color: '#fb7185', icon: CircleDollarSign, values: [100, 99, 98, 99, 100, 99, 98, 97, 98, 99, 100, 101] },
    { key: 'brent', label: 'Brent', value: 'N/A', unit: 'Chưa có lịch sử giá', tone: 'text-orange-400', color: '#fb923c', icon: Flame, values: [100, 102, 101, 103, 105, 104, 103, 106, 108, 107, 109, 110] },
    { key: 'wti', label: 'WTI', value: 'N/A', unit: 'Chưa có lịch sử giá', tone: 'text-red-400', color: '#f87171', icon: Flame, values: [100, 101, 100, 102, 104, 103, 102, 105, 107, 106, 108, 109] },
    { key: 'nasdaq', label: 'Giá Nasdaq', value: 'N/A', unit: 'Chưa có lịch sử giá', tone: 'text-slate-300', color: '#cbd5e1', icon: Factory, values: [100, 99, 98, 99, 100, 101, 100, 99, 101, 102, 103, 103] },
    { key: 'sp500', label: 'Giá S&P 500', value: 'N/A', unit: 'Chưa có lịch sử giá', tone: 'text-cyan-400', color: '#22d3ee', icon: BarChart3, values: [100, 100, 101, 101, 102, 103, 102, 103, 104, 105, 105, 106] },
    { key: 'gold', label: 'Giá Gold', value: 'N/A', unit: 'Chưa có lịch sử giá', tone: 'text-yellow-400', color: '#facc15', icon: CircleDollarSign, values: [100, 101, 102, 101, 103, 104, 105, 104, 106, 107, 108, 109] },
];

const nonChartTopics = [
    { key: 'china', label: 'Kinh tế Trung Quốc', description: 'Theo dõi GDP, bất động sản, xuất nhập khẩu, chính sách PBOC và dữ liệu sản xuất – tiêu dùng.', icon: Ship },
    { key: 'news', label: 'Tin tức thế giới', description: 'Theo dõi các sự kiện địa chính trị, chính sách tiền tệ, thương mại và rủi ro thị trường toàn cầu.', icon: Newspaper },
];

const fetchLatestDxyHistory = async () => {
    const source = sourceLinks.find((item) => item.key === 'dxy');
    if (!source?.url) {
        throw new Error('Không tìm thấy sourceLinks[dxy].');
    }

    const latestHistory = await getLatestDxyHistory();
    return {
        ...latestHistory,
        value: latestHistory?.value || 'N/A',
        unit: latestHistory?.unit || 'Chưa có dữ liệu',
        sourceUrl: source.url,
        sourceName: latestHistory?.sourceName || 'Symbol history',
    };
};

const fetchLatestBrentHistory = async () => {
    const source = sourceLinks.find((item) => item.key === 'brent');
    if (!source?.url) {
        throw new Error('Không tìm thấy sourceLinks[brent].');
    }

    const latestHistory = await getLatestBrentHistory();
    return {
        ...latestHistory,
        sourceUrl: source.url,
        sourceName: latestHistory?.sourceName || 'Symbol history',
    };
};

const fetchLatestWtiHistory = async () => {
    const source = sourceLinks.find((item) => item.key === 'wti');
    if (!source?.url) {
        throw new Error('Không tìm thấy sourceLinks[wti].');
    }

    const latestHistory = await getLatestWtiHistory();
    return {
        ...latestHistory,
        sourceUrl: source.url,
        sourceName: latestHistory?.sourceName || 'Symbol history',
    };
};

const fetchLatestGoldHistory = async () => {
    const source = sourceLinks.find((item) => item.key === 'gold');
    if (!source?.url) {
        throw new Error('Không tìm thấy sourceLinks[gold].');
    }

    const latestHistory = await getLatestGoldHistory();
    return {
        ...latestHistory,
        sourceUrl: source.url,
        sourceName: latestHistory?.sourceName || 'Symbol history',
    };
};

const fetchLatestNasdaqHistory = async () => {
    const source = sourceLinks.find((item) => item.key === 'nasdaq');
    if (!source?.url) {
        throw new Error('Không tìm thấy sourceLinks[nasdaq].');
    }

    const latestHistory = await getLatestNasdaqHistory();
    return {
        ...latestHistory,
        sourceUrl: source.url,
        sourceName: latestHistory?.sourceName || 'Symbol history',
    };
};

const fetchLatestSp500History = async () => {
    const source = sourceLinks.find((item) => item.key === 'sp500');
    if (!source?.url) {
        throw new Error('Không tìm thấy sourceLinks[sp500].');
    }

    const latestHistory = await getLatestSp500History();
    return {
        ...latestHistory,
        sourceUrl: source.url,
        sourceName: latestHistory?.sourceName || 'Symbol history',
    };
};

const symbolHistoryKeys = new Set(['brent', 'wti', 'nasdaq', 'sp500', 'gold']);

const buildChartOption = (indicators) => {
    const chartIndicators = indicators.filter((indicator) => symbolHistoryKeys.has(indicator.key));
    const historyDates = [...new Set(chartIndicators.flatMap((indicator) => (
        (indicator.history || []).map((row) => String(row.date || '').slice(0, 10)).filter(Boolean)
    )))].sort().slice(-30);
    const hasSymbolHistory = historyDates.length > 0;
    const categories = hasSymbolHistory
        ? historyDates.map((date) => date.split('-').reverse().slice(0, 2).join('/'))
        : periods;

    const series = chartIndicators.map((indicator) => {
        if (!hasSymbolHistory) {
            return {
                name: indicator.label,
                type: 'line',
                symbol: 'none',
                lineStyle: { width: 2 },
                itemStyle: { color: indicator.color },
                data: periods.map(() => null),
            };
        }
        if (!indicator.history?.length) {
            return {
                name: indicator.label,
                type: 'line',
                symbol: 'none',
                lineStyle: { width: 2 },
                itemStyle: { color: indicator.color },
                data: historyDates.map(() => null),
            };
        }

        const closeByDate = new Map(indicator.history.map((row) => [
            String(row.date || '').slice(0, 10),
            Number(row.close),
        ]));
        const firstClose = historyDates.map((date) => closeByDate.get(date)).find(Number.isFinite);
        const data = historyDates.map((date) => {
            const close = closeByDate.get(date);
            return Number.isFinite(close) && Number.isFinite(firstClose) && firstClose !== 0
                ? Number((((close / firstClose) - 1) * 100).toFixed(2))
                : null;
        });

        return {
            name: indicator.label,
            type: 'line',
            smooth: true,
            connectNulls: true,
            symbol: 'none',
            lineStyle: { width: 2 },
            itemStyle: { color: indicator.color },
            tooltip: { valueFormatter: (value) => `${Number(value).toFixed(2)}%` },
            data,
        };
    });

    return {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', backgroundColor: '#111827', borderColor: '#374151', textStyle: { color: '#f3f4f6' } },
        legend: { type: 'scroll', bottom: 0, textStyle: { color: '#9ca3af' }, pageTextStyle: { color: '#9ca3af' } },
        grid: { left: 48, right: 24, top: 24, bottom: 72 },
        xAxis: { type: 'category', boundaryGap: false, data: categories, axisLine: { lineStyle: { color: '#374151' } }, axisLabel: { color: '#9ca3af' } },
        yAxis: { type: 'value', scale: true, splitLine: { lineStyle: { color: '#1f2937' } }, axisLabel: { color: '#9ca3af', formatter: '{value}%' } },
        series,
    };
};

const Global = () => {
    const [indicators, setIndicators] = useState(globalIndicators);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [updatedAt, setUpdatedAt] = useState('');
    const [provider, setProvider] = useState('gemini');

    const loadLatestDxyHistory = async () => {
        let latestDxy;
        try {
            latestDxy = await fetchLatestDxyHistory();
        } catch (dxyHistoryError) {
            console.error('Không thể lấy lịch sử giá DXY:', dxyHistoryError);
            const source = sourceLinks.find((item) => item.key === 'dxy');
            latestDxy = {
                value: 'N/A',
                unit: 'Không tìm thấy lịch sử giá',
                sourceUrl: source?.url,
                sourceName: 'Symbol history',
            };
        }

        setIndicators((currentIndicators) => currentIndicators.map((indicator) => (
            indicator.key === 'dxy'
                ? {
                    ...indicator,
                    value: latestDxy.value,
                    unit: latestDxy.asOf
                        ? `${latestDxy.unit} · ${latestDxy.asOf}`
                        : latestDxy.unit,
                    sourceUrl: latestDxy.sourceUrl,
                    sourceName: latestDxy.sourceName,
                }
                : indicator
        )));
        return latestDxy;
    };

    const loadLatestBrentHistory = async () => {
        let latestBrent;
        try {
            latestBrent = await fetchLatestBrentHistory();
        } catch (brentHistoryError) {
            console.error('Không thể lấy lịch sử giá Brent:', brentHistoryError);
            const source = sourceLinks.find((item) => item.key === 'brent');
            latestBrent = {
                value: 'N/A',
                unit: 'Không tìm thấy lịch sử giá',
                sourceUrl: source?.url,
                sourceName: 'Symbol history',
            };
        }

        setIndicators((currentIndicators) => currentIndicators.map((indicator) => (
            indicator.key === 'brent'
                ? {
                    ...indicator,
                    value: latestBrent.value,
                    unit: latestBrent.asOf
                        ? `${latestBrent.unit} · ${latestBrent.asOf}`
                        : latestBrent.unit,
                    sourceUrl: latestBrent.sourceUrl,
                    sourceName: latestBrent.sourceName,
                    history: latestBrent.history || [],
                }
                : indicator
        )));
        return latestBrent;
    };

    const loadLatestWtiHistory = async () => {
        let latestWti;
        try {
            latestWti = await fetchLatestWtiHistory();
        } catch (wtiHistoryError) {
            console.error('Không thể lấy lịch sử giá WTI:', wtiHistoryError);
            const source = sourceLinks.find((item) => item.key === 'wti');
            latestWti = {
                value: 'N/A',
                unit: 'Không tìm thấy lịch sử giá',
                sourceUrl: source?.url,
                sourceName: 'Symbol history',
            };
        }

        setIndicators((currentIndicators) => currentIndicators.map((indicator) => (
            indicator.key === 'wti'
                ? {
                    ...indicator,
                    value: latestWti.value,
                    unit: latestWti.asOf
                        ? `${latestWti.unit} · ${latestWti.asOf}`
                        : latestWti.unit,
                    sourceUrl: latestWti.sourceUrl,
                    sourceName: latestWti.sourceName,
                    history: latestWti.history || [],
                }
                : indicator
        )));
        return latestWti;
    };

    const loadLatestGoldHistory = async () => {
        let latestGold;
        try {
            latestGold = await fetchLatestGoldHistory();
        } catch (goldHistoryError) {
            console.error('Không thể lấy lịch sử giá vàng:', goldHistoryError);
            const source = sourceLinks.find((item) => item.key === 'gold');
            latestGold = {
                value: 'N/A',
                unit: 'Không tìm thấy lịch sử giá',
                sourceUrl: source?.url,
                sourceName: 'Symbol history',
            };
        }

        setIndicators((currentIndicators) => currentIndicators.map((indicator) => (
            indicator.key === 'gold'
                ? {
                    ...indicator,
                    value: latestGold.value,
                    unit: latestGold.asOf
                        ? `${latestGold.unit} · ${latestGold.asOf}`
                        : latestGold.unit,
                    sourceUrl: latestGold.sourceUrl,
                    sourceName: latestGold.sourceName,
                    history: latestGold.history || [],
                }
                : indicator
        )));
        return latestGold;
    };

    const loadLatestNasdaqHistory = async () => {
        let latestNasdaq;
        try {
            latestNasdaq = await fetchLatestNasdaqHistory();
        } catch (nasdaqHistoryError) {
            console.error('Không thể lấy lịch sử Nasdaq:', nasdaqHistoryError);
            const source = sourceLinks.find((item) => item.key === 'nasdaq');
            latestNasdaq = {
                value: 'N/A',
                unit: 'Không tìm thấy lịch sử giá',
                sourceUrl: source?.url,
                sourceName: 'Symbol history',
            };
        }

        setIndicators((currentIndicators) => currentIndicators.map((indicator) => (
            indicator.key === 'nasdaq'
                ? {
                    ...indicator,
                    value: latestNasdaq.value,
                    unit: latestNasdaq.asOf
                        ? `${latestNasdaq.unit} · ${latestNasdaq.asOf}`
                        : latestNasdaq.unit,
                    sourceUrl: latestNasdaq.sourceUrl,
                    sourceName: latestNasdaq.sourceName,
                    history: latestNasdaq.history || [],
                }
                : indicator
        )));
        return latestNasdaq;
    };

    const loadLatestSp500History = async () => {
        let latestSp500;
        try {
            latestSp500 = await fetchLatestSp500History();
        } catch (sp500HistoryError) {
            console.error('Không thể lấy lịch sử S&P 500:', sp500HistoryError);
            const source = sourceLinks.find((item) => item.key === 'sp500');
            latestSp500 = {
                value: 'N/A',
                unit: 'Không tìm thấy lịch sử giá',
                sourceUrl: source?.url,
                sourceName: 'Symbol history',
            };
        }

        setIndicators((currentIndicators) => currentIndicators.map((indicator) => (
            indicator.key === 'sp500'
                ? {
                    ...indicator,
                    value: latestSp500.value,
                    unit: latestSp500.asOf
                        ? `${latestSp500.unit} · ${latestSp500.asOf}`
                        : latestSp500.unit,
                    sourceUrl: latestSp500.sourceUrl,
                    sourceName: latestSp500.sourceName,
                    history: latestSp500.history || [],
                }
                : indicator
        )));
        return latestSp500;
    };

    const loadGlobalMacro = async (selectedProvider = provider) => {
        setLoading(true);
        setError('');
        try {
            const [snapshot, latestBrent, latestWti, latestDxy, latestGold, latestNasdaq, latestSp500] = await Promise.all([
                getGlobalMacroSnapshot(selectedProvider),
                loadLatestBrentHistory(),
                loadLatestWtiHistory(),
                loadLatestDxyHistory(),
                loadLatestGoldHistory(),
                loadLatestNasdaqHistory(),
                loadLatestSp500History(),
            ]);
            setIndicators((currentIndicators) => globalIndicators.map((indicator) => {
                if (indicator.key === 'brent' || indicator.key === 'wti' || indicator.key === 'dxy' || indicator.key === 'gold' || indicator.key === 'nasdaq' || indicator.key === 'sp500') {
                    const latestHist = indicator.key === 'brent'
                        ? latestBrent
                        : indicator.key === 'wti'
                            ? latestWti
                            : indicator.key === 'dxy'
                                ? latestDxy
                                : indicator.key === 'gold'
                                    ? latestGold
                                    : indicator.key === 'nasdaq'
                                        ? latestNasdaq
                                        : latestSp500;
                    const currentHist = currentIndicators.find((item) => item.key === indicator.key) || indicator;
                    if (!latestHist) return currentHist;
                    return {
                        ...currentHist,
                        value: latestHist.value || currentHist.value,
                        unit: latestHist.asOf ? `${latestHist.unit || currentHist.unit} · ${latestHist.asOf}` : (latestHist.unit || currentHist.unit),
                        sourceUrl: latestHist.sourceUrl,
                        sourceName: latestHist.sourceName,
                        history: latestHist.history || currentHist.history || [],
                    };
                }

                const latest = snapshot?.indicators?.[indicator.key];
                if (!latest) return indicator;
                return { ...indicator, value: latest.value || indicator.value, unit: latest.asOf ? `${latest.unit || indicator.unit} · ${latest.asOf}` : (latest.unit || indicator.unit), sourceUrl: latest.sourceUrl, sourceName: latest.sourceName };
            }));
            setUpdatedAt(snapshot?.updatedAt || new Date().toISOString());
        } catch (requestError) {
            setError(requestError.response?.data?.error?.message || requestError.message || 'Không thể cập nhật dữ liệu Global từ Gemini.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLatestBrentHistory();
        loadLatestWtiHistory();
        loadLatestDxyHistory();
        loadLatestGoldHistory();
        loadLatestNasdaqHistory();
        loadLatestSp500History();
    }, []);

    const formatUpdatedAt = updatedAt ? new Date(updatedAt).toLocaleString('vi-VN') : 'chưa cập nhật';

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">Global Macro</p>
                    <h1 className="mt-1 text-3xl font-bold text-gray-100">Kinh tế vĩ mô toàn cầu</h1>
                    <p className="mt-2 text-sm text-gray-400">Theo dõi các biến số quốc tế có ảnh hưởng lớn đến dòng vốn, tỷ giá, hàng hóa và thị trường Việt Nam.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-1.5 text-xs text-gray-300">
                        <span>AI provider</span>
                        <select value={provider} onChange={(event) => setProvider(event.target.value)} className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-gray-100 outline-none">
                            <option value="gemini">Gemini</option>
                            <option value="openai">OpenAI</option>
                        </select>
                    </label>
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">Đang dùng: {provider === 'openai' ? 'OpenAI' : 'Gemini'}</span>
                    <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-300">Gemini · {formatUpdatedAt}</span>
                    <button type="button" onClick={() => loadGlobalMacro(provider)} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />{loading ? 'Đang cập nhật…' : 'Cập nhật AI'}</button>
                </div>
            </div>
            {error && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{error} Đang hiển thị dữ liệu gần nhất.</div>}

            <section className="rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-xl md:p-6">
                <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-gray-100">Diễn biến các chỉ số toàn cầu</h2><p className="mt-1 text-xs text-gray-400">Brent, WTI, Nasdaq, S&amp;P 500 và Gold · % biến động giá đóng cửa trong 30 phiên gần nhất từ symbol-history · phiên đầu = 0%.</p></div><Globe2 className="hidden text-blue-400 sm:block" size={22} /></div>
                <div className="h-[460px]"><ReactECharts option={buildChartOption(indicators)} style={{ width: '100%', height: '100%' }} notMerge lazyUpdate /></div>
            </section>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {indicators.map((indicator, index) => {
                    const Icon = indicator.icon;
                    const rising = indicator.values.at(-1) >= indicator.values.at(-2);
                    const fallback = sourceLinks.find((item) => item.key === indicator.key);
                    const source = indicator.sourceUrl ? { url: indicator.sourceUrl, label: `Xem nguồn ${indicator.sourceName || 'Gemini'} ↗` } : fallback;
                    return <div key={indicator.key} className="rounded-xl border border-gray-700 bg-gray-800/80 p-4 transition-colors hover:border-gray-600"><div className="flex items-start justify-between gap-2"><div className={`rounded-lg bg-gray-900 p-2 ${indicator.tone}`}><Icon size={17} /></div><span className={rising ? 'text-emerald-400' : 'text-rose-400'}>{rising ? '↗' : '↘'}</span></div><p className="mt-3 min-h-10 text-xs text-gray-400">{index + 1}. {indicator.label}</p><p className="mt-1 text-lg font-bold text-gray-100">{indicator.value}</p><p className="mt-1 text-[11px] text-gray-500">{indicator.unit}</p>{source && <a href={source.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[10px] text-blue-400 hover:text-blue-300 hover:underline">{source.label}</a>}</div>;
                })}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{nonChartTopics.map((topic) => { const Icon = topic.icon; const source = sourceLinks.find((item) => item.key === topic.key); return <section key={topic.key} className="rounded-2xl border border-gray-700 bg-gray-800 p-5 shadow-xl"><div className="flex items-start gap-3"><div className="rounded-lg bg-gray-900 p-2 text-blue-400"><Icon size={20} /></div><div><h2 className="font-bold text-gray-100">{topic.label}</h2><p className="mt-1 text-sm leading-6 text-gray-400">{topic.description}</p>{source && <a href={source.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-blue-400 hover:text-blue-300 hover:underline">{source.label}</a>}</div></div></section>; })}</div>
        </div>
    );
};

export default Global;
