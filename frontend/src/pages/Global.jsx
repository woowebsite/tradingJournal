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
import { getGlobalMacroSnapshot } from '../services/globalMacro';

const periods = ['Jul 25', 'Aug 25', 'Sep 25', 'Oct 25', 'Nov 25', 'Dec 25', 'Jan 26', 'Feb 26', 'Mar 26', 'Apr 26', 'May 26', 'Jun 26'];

const sourceLinks = [
    { key: 'fed', label: 'Federal Reserve ↗', url: 'https://www.federalreserve.gov/monetarypolicy/openmarket.htm' },
    { key: 'usCpi', label: 'BLS CPI ↗', url: 'https://www.bls.gov/cpi/' },
    { key: 'us10y', label: 'U.S. Treasury US10Y ↗', url: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates' },
    { key: 'us2y', label: 'U.S. Treasury US2Y ↗', url: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates' },
    { key: 'dxy', label: 'Investing.com DXY ↗', url: 'https://www.investing.com/indices/usdollar-historical-data' },
    { key: 'brent', label: 'Investing.com Brent ↗', url: 'https://www.investing.com/commodities/brent-oil' },
    { key: 'wti', label: 'Investing.com WTI ↗', url: 'https://www.investing.com/commodities/crude-oil' },
    { key: 'steel', label: 'Fastmarkets HRC ↗', url: 'https://www.tacto.ai/en/commodities/steel-price' },
    { key: 'pmi', label: 'S&P Global PMI ↗', url: 'https://www.pmi.spglobal.com/' },
    { key: 'flows', label: 'FTSE Emerging ↗', url: 'https://www.investing.com/indices/ftse-emerging-historical-data' },
    { key: 'china', label: 'China NBS ↗', url: 'https://www.stats.gov.cn/english/' },
    { key: 'news', label: 'Reuters World ↗', url: 'https://www.reuters.com/world/' },
];

const globalIndicators = [
    { key: 'fed', label: 'Fed Funds Rate', value: '3,63%', unit: 'EFFR · 20/07/2026', tone: 'text-sky-400', color: '#38bdf8', icon: Landmark, values: [100, 100, 100, 99.5, 99.5, 99, 99, 99, 99, 98.5, 98.5, 98.5] },
    { key: 'usCpi', label: 'Lạm phát Mỹ', value: '3,5%', unit: 'CPI-U · YoY · 06/2026', tone: 'text-amber-400', color: '#fbbf24', icon: Activity, values: [100, 101, 101, 102, 103, 103, 104, 104, 105, 106, 106, 107] },
    { key: 'us10y', label: 'Lợi suất US10Y', value: '4,60%', unit: 'Treasury nominal · 20/07/2026', tone: 'text-violet-400', color: '#a78bfa', icon: TrendingUp, values: [100, 101, 102, 101, 103, 104, 103, 104, 105, 106, 105, 107] },
    { key: 'us2y', label: 'Lợi suất US2Y', value: '4,21%', unit: 'Treasury nominal · 20/07/2026', tone: 'text-fuchsia-400', color: '#e879f9', icon: TrendingUp, values: [100, 99, 100, 99, 101, 101, 100, 101, 102, 102, 101, 102] },
    { key: 'dxy', label: 'DXY', value: '101,14', unit: 'đóng cửa · 22/07/2026', tone: 'text-rose-400', color: '#fb7185', icon: CircleDollarSign, values: [100, 99, 98, 99, 100, 99, 98, 97, 98, 99, 100, 101] },
    { key: 'brent', label: 'Brent', value: '94,17', unit: 'USD/thùng · realtime', tone: 'text-orange-400', color: '#fb923c', icon: Flame, values: [100, 102, 101, 103, 105, 104, 103, 106, 108, 107, 109, 110] },
    { key: 'wti', label: 'WTI', value: '86,88', unit: 'USD/thùng · realtime', tone: 'text-red-400', color: '#f87171', icon: Flame, values: [100, 101, 100, 102, 104, 103, 102, 105, 107, 106, 108, 109] },
    { key: 'steel', label: 'Giá thép', value: '710', unit: 'EUR/t · HRC Bắc Âu · 14/07/2026', tone: 'text-slate-300', color: '#cbd5e1', icon: Factory, values: [100, 99, 98, 99, 100, 101, 100, 99, 101, 102, 103, 103] },
    { key: 'pmi', label: 'Global PMI', value: '52,0', unit: 'Global Composite · 06/2026', tone: 'text-cyan-400', color: '#22d3ee', icon: BarChart3, values: [100, 100, 101, 101, 102, 103, 102, 103, 104, 105, 105, 106] },
    { key: 'flows', label: 'Dòng vốn quốc tế FTSE / MSCI', value: 'FTSE 756,43', unit: 'MSCI EM 1.616,96 · 20-21/07/2026', tone: 'text-lime-400', color: '#a3e635', icon: Globe2, values: [100, 101, 102, 101, 103, 104, 105, 104, 106, 107, 108, 109] },
];

const nonChartTopics = [
    { key: 'china', label: 'Kinh tế Trung Quốc', description: 'Theo dõi GDP, bất động sản, xuất nhập khẩu, chính sách PBOC và dữ liệu sản xuất – tiêu dùng.', icon: Ship },
    { key: 'news', label: 'Tin tức thế giới', description: 'Theo dõi các sự kiện địa chính trị, chính sách tiền tệ, thương mại và rủi ro thị trường toàn cầu.', icon: Newspaper },
];

const buildChartOption = (indicators) => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#111827', borderColor: '#374151', textStyle: { color: '#f3f4f6' } },
    legend: { type: 'scroll', bottom: 0, textStyle: { color: '#9ca3af' }, pageTextStyle: { color: '#9ca3af' } },
    grid: { left: 48, right: 24, top: 24, bottom: 72 },
    xAxis: { type: 'category', boundaryGap: false, data: periods, axisLine: { lineStyle: { color: '#374151' } }, axisLabel: { color: '#9ca3af' } },
    yAxis: { type: 'value', min: 96, max: 114, splitLine: { lineStyle: { color: '#1f2937' } }, axisLabel: { color: '#9ca3af' } },
    series: indicators.map((indicator) => ({ name: indicator.label, type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 2 }, itemStyle: { color: indicator.color }, data: indicator.values })),
});

const Global = () => {
    const [indicators, setIndicators] = useState(globalIndicators);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [updatedAt, setUpdatedAt] = useState('');
    const [provider, setProvider] = useState('gemini');

    const loadGlobalMacro = async (selectedProvider = provider) => {
        setLoading(true);
        setError('');
        try {
            const snapshot = await getGlobalMacroSnapshot(selectedProvider);
            setIndicators(globalIndicators.map((indicator) => {
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
        loadGlobalMacro(provider);
        const refreshTimer = window.setInterval(() => loadGlobalMacro(provider), 30 * 60 * 1000);
        return () => window.clearInterval(refreshTimer);
    }, [provider]);
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
                    <button type="button" onClick={loadGlobalMacro} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />{loading ? 'Đang cập nhật…' : 'Cập nhật Gemini'}</button>
                </div>
            </div>
            {error && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{error} Đang hiển thị dữ liệu gần nhất.</div>}

            <section className="rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-xl md:p-6">
                <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-gray-100">Diễn biến các chỉ số toàn cầu</h2><p className="mt-1 text-xs text-gray-400">Chỉ số cơ sở 100 tại kỳ đầu · Trung Quốc và tin tức thế giới được tách khỏi biểu đồ.</p></div><Globe2 className="hidden text-blue-400 sm:block" size={22} /></div>
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
