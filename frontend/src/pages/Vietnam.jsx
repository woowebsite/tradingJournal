import ReactECharts from 'echarts-for-react';
import {
    ArrowDownRight,
    ArrowUpRight,
    Building2,
    CircleDollarSign,
    Factory,
    Gauge,
    Landmark,
    Ship,
    TrendingUp,
} from 'lucide-react';

const periods = ['Jul 25', 'Aug 25', 'Sep 25', 'Oct 25', 'Nov 25', 'Dec 25', 'Jan 26', 'Feb 26', 'Mar 26', 'Apr 26', 'May 26', 'Jun 26'];

const sourceLinks = [
    {
        key: 'nsoSocioEconomic',
        label: 'Xem nguồn NSO ↗',
        url: 'https://www.nso.gov.vn/du-lieu-va-so-lieu-thong-ke/2026/07/thong-cao-bao-chi-ve-tinh-hinh-kinh-te-xa-hoi-quy-ii-va-sau-thang-dau-nam-2026/',
    },
    {
        key: 'nsoPrices',
        label: 'Xem nguồn NSO ↗',
        url: 'https://www.nso.gov.vn/tin-tuc-thong-ke/2026/07/thong-cao-bao-chi-ve-tinh-hinh-gia-thang-sau-quy-ii-va-6-thang-dau-nam-2026/',
    },
    {
        key: 'nsoInterestRates',
        label: 'Xem nguồn NSO ↗',
        url: 'https://www.nso.gov.vn/du-lieu-dac-ta/2019/12/htcttkqg-lai-suat/',
    },
    {
        key: 'nsoFiscal',
        label: 'Xem nguồn NSO - Ngân sách ↗',
        url: 'https://www.nso.gov.vn/ngan-hang-bao-hiem-va-thu-chi-ngan-sach/',
    },
    {
        key: 'nsoFdi',
        label: 'Xem nguồn NSO - FDI ↗',
        url: 'https://www.nso.gov.vn/du-lieu-va-so-lieu-thong-ke/2026/07/thong-cao-bao-chi-ve-tinh-hinh-kinh-te-xa-hoi-quy-ii-va-sau-thang-dau-nam-2026/',
    },
    {
        key: 'constructionRealEstate',
        label: 'Xem nguồn Bộ Xây dựng ↗',
        url: 'https://kinhtexaydung.gov.vn/wp-content/uploads/2026/05/Bao-cao-dien-bien-thi-truong-nam-2025-gui-TTTT-1.pdf',
    },
    {
        key: 'sbvPolicy',
        label: 'Xem nguồn NHNN ↗',
        url: 'https://sbv.gov.vn/vi/web/sbv_portal/trang-chu',
    },
    {
        key: 'investingUsdVnd',
        label: 'Xem nguồn Investing.com ↗',
        url: 'https://vn.investing.com/currencies/usd-vnd',
    },
];

// The chart is intentionally driven by one data structure so it can be replaced by an API response later.
const macroIndicators = [
    { key: 'gdp', label: 'Tăng trưởng GDP', value: '8,18%', unit: '6T/2026 · YoY', tone: 'text-emerald-400', color: '#34d399', icon: TrendingUp, values: [100, 100, 101, 101, 102, 102, 103, 104, 105, 106, 107, 108.18], sourceKey: 'nsoSocioEconomic' },
    { key: 'cpi', label: 'Lạm phát (CPI)', value: '4,38%', unit: 'bình quân 6T/2026 · YoY', tone: 'text-amber-400', color: '#fbbf24', icon: Gauge, values: [100, 101, 101, 102, 102, 103, 103, 104, 105, 105, 106, 104.38], sourceKey: 'nsoPrices' },
    { key: 'rates', label: 'Lãi suất', value: 'Chưa công bố', unit: 'chưa có mức bình quân quốc gia trong báo cáo NSO 6T/2026', tone: 'text-sky-400', color: '#38bdf8', icon: Landmark, values: [100, 100, 100, 99.5, 99.5, 99, 99, 99, 98.5, 98.5, 98.5, 98.5], sourceKey: 'nsoInterestRates' },
    { key: 'credit', label: 'Tín dụng', value: '7,41%', unit: 'đến 26/06/2026 · YoY', tone: 'text-violet-400', color: '#a78bfa', icon: CircleDollarSign, values: [100, 101, 102, 103, 104, 105, 106, 107, 107.41, 107.41, 107.41, 107.41], sourceKey: 'nsoSocioEconomic' },
    { key: 'fx', label: 'Tỷ giá USD/VND', value: '26.313,5', unit: 'VND/USD · dữ liệu 22/07/2026', detail: '+0,01% trong ngày · mua 26.311,9 · bán 26.315,1', tone: 'text-rose-400', color: '#fb7185', icon: CircleDollarSign, values: [100, 101, 101, 102, 103, 103, 104, 105, 106, 107, 108, 100.6445], sourceKey: 'investingUsdVnd' },
    { key: 'fiscal', label: 'Chính sách tài khóa', value: 'Ổn định', unit: 'chỉ số chính sách', tone: 'text-indigo-400', color: '#818cf8', icon: Landmark, values: [100, 100, 101, 101, 102, 102, 103, 103, 104, 105, 105, 106], sourceKey: 'nsoFiscal' },
    { key: 'trade', label: 'Xuất nhập khẩu', value: '549,69 tỷ USD', unit: 'tổng 6T/2026 · +27,1% YoY · nhập siêu 16,65 tỷ USD', tone: 'text-cyan-400', color: '#22d3ee', icon: Ship, values: [100, 101, 100, 102, 103, 104, 103, 105, 106, 107, 108, 127.1], sourceKey: 'nsoSocioEconomic' },
    { key: 'fdi', label: 'FDI', value: '4,9 tỷ USD', unit: 'giải ngân', tone: 'text-lime-400', color: '#a3e635', icon: Factory, values: [100, 100, 101, 102, 103, 104, 105, 106, 108, 109, 110, 112], sourceKey: 'nsoFdi' },
    { key: 'realEstate', label: 'Bất động sản', value: 'Phục hồi', unit: 'chỉ số thị trường', tone: 'text-orange-400', color: '#fb923c', icon: Building2, values: [100, 99, 99, 100, 101, 101, 102, 104, 105, 106, 108, 109], sourceKey: 'constructionRealEstate' },
    { key: 'policy', label: 'Chính sách Chính phủ & NHNN', value: 'Hỗ trợ tăng trưởng', unit: 'chỉ số chính sách', tone: 'text-fuchsia-400', color: '#e879f9', icon: Landmark, values: [100, 101, 102, 102, 103, 104, 105, 106, 107, 108, 109, 110], sourceKey: 'sbvPolicy' },
];

const chartOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#111827', borderColor: '#374151', textStyle: { color: '#f3f4f6' } },
    legend: { type: 'scroll', bottom: 0, textStyle: { color: '#9ca3af' }, pageTextStyle: { color: '#9ca3af' } },
    grid: { left: 48, right: 24, top: 24, bottom: 72 },
    xAxis: { type: 'category', boundaryGap: false, data: periods, axisLine: { lineStyle: { color: '#374151' } }, axisLabel: { color: '#9ca3af' } },
    yAxis: { type: 'value', min: 96, max: 132, splitLine: { lineStyle: { color: '#1f2937' } }, axisLabel: { color: '#9ca3af' } },
    series: macroIndicators.map((indicator) => ({ name: indicator.label, type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 2 }, itemStyle: { color: indicator.color }, data: indicator.values })),
};

const Vietnam = () => (
    <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-red-400">Vietnam Macro</p>
                <h1 className="mt-1 text-3xl font-bold text-gray-100">Kinh tế vĩ mô Việt Nam</h1>
                <p className="mt-2 text-sm text-gray-400">Theo dõi các động lực chính ảnh hưởng đến thị trường và nền kinh tế Việt Nam.</p>
            </div>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">NSO snapshot · 03/07/2026</span>
        </div>

        <section className="rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-xl md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-gray-100">Diễn biến các yếu tố vĩ mô</h2>
                    <p className="mt-1 text-xs text-gray-400">Điểm mới nhất lấy từ NSO; chỉ số cơ sở 100 dùng để so sánh xu hướng giữa các chỉ tiêu khác đơn vị.</p>
                </div>
                <TrendingUp className="hidden text-red-400 sm:block" size={22} />
            </div>
            <div className="h-[460px]">
                <ReactECharts option={chartOption} style={{ width: '100%', height: '100%' }} notMerge lazyUpdate />
            </div>
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {macroIndicators.map((indicator, index) => {
                const Icon = indicator.icon;
                const rising = indicator.values.at(-1) >= indicator.values.at(-2);
                const source = sourceLinks.find((item) => item.key === indicator.sourceKey);
                return (
                    <div key={indicator.key} className="rounded-xl border border-gray-700 bg-gray-800/80 p-4 transition-colors hover:border-gray-600">
                        <div className="flex items-start justify-between gap-2">
                            <div className={`rounded-lg bg-gray-900 p-2 ${indicator.tone}`}><Icon size={17} /></div>
                            {rising ? <ArrowUpRight className="text-emerald-400" size={16} /> : <ArrowDownRight className="text-rose-400" size={16} />}
                        </div>
                        <p className="mt-3 min-h-10 text-xs text-gray-400">{index + 1}. {indicator.label}</p>
                        <p className="mt-1 text-lg font-bold text-gray-100">{indicator.value}</p>
                        <p className="mt-1 text-[11px] text-gray-500">{indicator.unit}</p>
                        {indicator.detail && <p className="mt-1 text-[10px] text-gray-500">{indicator.detail}</p>}
                        {source && (
                            <a href={source.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[10px] text-blue-400 hover:text-blue-300 hover:underline">
                                {source.label}
                            </a>
                        )}
                    </div>
                );
            })}
        </div>
    </div>
);

export default Vietnam;
