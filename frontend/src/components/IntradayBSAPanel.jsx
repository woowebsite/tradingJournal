import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    RefreshCw,
    TrendingUp,
    TrendingDown,
    Activity,
    Scale,
    ArrowUpRight,
    ArrowDownRight,
    LineChart as LineChartIcon,
    Table as TableIcon,
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { getIntradayBSA } from '../services/tcbs';

const TIME_WINDOWS = [
    { label: '1 phút', value: '1' },
    { label: '3 phút', value: '3' },
    { label: '5 phút', value: '5' },
    { label: '10 phút', value: '10' },
    { label: '15 phút', value: '15' },
    { label: '30 phút', value: '30' },
];

const T_WINDOWS = [
    { label: '15 phút', value: '15m' },
    { label: '30 phút', value: '30m' },
    { label: '60 phút', value: '60m' },
    { label: '1 ngày', value: '1d' },
];

const METRIC_OPTIONS = [
    { label: 'Khối lượng Ròng (Net Vol)', value: 'net_vol' },
    { label: 'Chênh lệch % (Mua - Bán)', value: 'diff_pct' },
    { label: 'Tỷ lệ Mua CĐ (%)', value: 'buy_pct' },
    { label: 'Tích lũy Cung Cầu (Cum Delta)', value: 'cum_vol' },
];

// Memoized Table Row for high-performance rendering of 240+ rows
const BSATableRow = React.memo(({ row, idx }) => {
    const bu = Number(row.bu) || 0;
    const bms = Number(row.bms) || 0;
    const bup = typeof row.bup === 'number' ? row.bup : Number(row.bup) || 0;
    const sd = Number(row.sd) || 0;
    const sms = Number(row.sms) || 0;
    const sdp = typeof row.sdp === 'number' ? row.sdp : Number(row.sdp) || 0;
    const bsr = typeof row.bsr === 'number' ? row.bsr : Number(row.bsr) || 0;
    const isBullish = bsr >= 1;

    return (
        <tr key={row.s || idx} className="hover:bg-gray-800/50 transition">
            <td className="py-1.5 px-3 font-semibold text-white font-sans">
                {row.t || '--:--'}
            </td>
            <td className="py-1.5 px-3 text-right text-emerald-300">
                <span className="font-semibold">{bu.toLocaleString()}</span>
                <span className="text-[10px] text-gray-500 ml-1">({bms.toLocaleString()})</span>
            </td>
            <td className="py-1.5 px-3 text-right text-emerald-400 font-semibold">
                {(bup * 100).toFixed(1)}%
            </td>
            <td className="py-1.5 px-3 text-right text-rose-300">
                <span className="font-semibold">{sd.toLocaleString()}</span>
                <span className="text-[10px] text-gray-500 ml-1">({sms.toLocaleString()})</span>
            </td>
            <td className="py-1.5 px-3 text-right text-rose-400 font-semibold">
                {(sdp * 100).toFixed(1)}%
            </td>
            <td className={`py-1.5 px-3 text-right font-bold ${isBullish ? 'text-emerald-400' : 'text-rose-400'}`}>
                {bsr.toFixed(3)}
            </td>
            <td className="py-1.5 px-3">
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden flex border border-gray-700/40">
                    <div
                        className="bg-emerald-500"
                        style={{ width: `${Math.min(100, Math.max(0, bup * 100))}%` }}
                    />
                    <div
                        className="bg-rose-500"
                        style={{ width: `${Math.min(100, Math.max(0, sdp * 100))}%` }}
                    />
                </div>
            </td>
        </tr>
    );
});

// Memoized Table component to only render and execute when Table or Both view mode is active
const BSATable = React.memo(({ bsaData, loading, error }) => {
    return (
        <div className="flex-1 min-h-[400px] bg-gray-900/60 border border-gray-700/70 rounded-xl overflow-hidden flex flex-col">
            <div className="px-3 py-2 bg-gray-900/90 border-b border-gray-700 flex items-center justify-between text-xs text-gray-400 font-medium">
                <span>Bảng Chi tiết chuỗi thời gian ({bsaData.length} mốc)</span>
                {loading && <span className="text-blue-400 animate-pulse">Đang tải...</span>}
            </div>

            <div className="flex-1 min-h-[360px] max-h-[550px] overflow-y-auto custom-scrollbar">
                {error ? (
                    <div className="p-4 text-center text-xs text-rose-400">{error}</div>
                ) : bsaData.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-500">
                        {loading ? 'Đang tải dữ liệu cung cầu BSA...' : 'Không có dữ liệu BSA cho khung thời gian này.'}
                    </div>
                ) : (
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-gray-900 text-[11px] text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-700 z-10">
                            <tr>
                                <th className="py-2 px-3">Thời Gian</th>
                                <th className="py-2 px-3 text-right text-emerald-400">Mua CĐ (Lệnh / KL)</th>
                                <th className="py-2 px-3 text-right text-emerald-400">% Mua</th>
                                <th className="py-2 px-3 text-right text-rose-400">Bán CĐ (Lệnh / KL)</th>
                                <th className="py-2 px-3 text-right text-rose-400">% Bán</th>
                                <th className="py-2 px-3 text-right">Tỷ Lệ M/B (BSR)</th>
                                <th className="py-2 px-3 text-center w-28">Tương Quan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/80 font-mono text-[11px]">
                            {bsaData.map((row, idx) => (
                                <BSATableRow key={row.s || idx} row={row} idx={idx} />
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
});

const IntradayBSAPanel = ({ defaultTicker = '41I1G9000', className = '' }) => {
    const [ticker, setTicker] = useState(defaultTicker);
    const [timeWindow, setTimeWindow] = useState('5');
    const [tWindow, setTWindow] = useState('60m');
    const [type, setType] = useState('all');
    const [bsaData, setBsaData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('chart'); // Default to 'chart' mode
    const [chartMetric, setChartMetric] = useState('net_vol'); // Default to 'net_vol' (Khối lượng Ròng)

    const fetchData = useCallback(async () => {
        if (!ticker) return;
        setLoading(true);
        setError(null);
        try {
            const res = await getIntradayBSA(ticker, { timeWindow, tWindow, type });
            const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            // Sort by timestamp or time descending for latest on top (table view)
            const sorted = [...list].sort((a, b) => (Number(b.s) || 0) - (Number(a.s) || 0));
            setBsaData(sorted);
        } catch (err) {
            console.error('Failed to fetch Intraday BSA:', err);
            setError(err.message || 'Không thể tải dữ liệu BSA');
        } finally {
            setLoading(false);
        }
    }, [ticker, timeWindow, tWindow, type]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Chronological data for the time-series chart (earliest to latest, left to right)
    const chronologicalData = useMemo(() => {
        if (!bsaData.length) return [];
        return [...bsaData].sort((a, b) => (Number(a.s) || 0) - (Number(b.s) || 0));
    }, [bsaData]);

    // Calculate aggregated statistics
    const latestItem = useMemo(() => bsaData[0] || null, [bsaData]);

    const summary = useMemo(() => {
        if (bsaData.length === 0) return null;

        let totalBu = 0;
        let totalBms = 0;
        let totalSd = 0;
        let totalSms = 0;
        let buyDominantCount = 0;
        let sellDominantCount = 0;
        let maxBuyDiff = -Infinity;
        let maxSellDiff = Infinity;

        bsaData.forEach(item => {
            const bu = Number(item.bu) || 0;
            const bms = Number(item.bms) || 0;
            const sd = Number(item.sd) || 0;
            const sms = Number(item.sms) || 0;
            const bup = typeof item.bup === 'number' ? item.bup : Number(item.bup) || 0;
            const sdp = typeof item.sdp === 'number' ? item.sdp : Number(item.sdp) || 0;
            const diffPct = (bup - sdp) * 100;

            totalBu += bu;
            totalBms += bms;
            totalSd += sd;
            totalSms += sms;

            if (diffPct > 0) buyDominantCount++;
            else if (diffPct < 0) sellDominantCount++;

            if (diffPct > maxBuyDiff) maxBuyDiff = diffPct;
            if (diffPct < maxSellDiff) maxSellDiff = diffPct;
        });

        const totalVol = totalBms + totalSms;
        const totalOrders = totalBu + totalSd;
        const buyVolPct = totalVol > 0 ? (totalBms / totalVol) : 0;
        const sellVolPct = totalVol > 0 ? (totalSms / totalVol) : 0;
        const overallBsr = totalSd > 0 ? (totalBu / totalSd) : (totalBu > 0 ? 99 : 1);

        return {
            totalBu,
            totalBms,
            totalSd,
            totalSms,
            buyVolPct,
            sellVolPct,
            overallBsr,
            totalOrders,
            totalVol,
            buyDominantCount,
            sellDominantCount,
            neutralCount: bsaData.length - buyDominantCount - sellDominantCount,
            maxBuyDiff: maxBuyDiff === -Infinity ? 0 : maxBuyDiff,
            maxSellDiff: maxSellDiff === Infinity ? 0 : maxSellDiff,
        };
    }, [bsaData]);

    // Build ECharts option matching the user screenshot
    const chartOption = useMemo(() => {
        if (!chronologicalData || chronologicalData.length === 0) return {};

        const times = [];
        const numericValues = [];
        let cumDelta = 0;

        let baseline = 0;
        if (chartMetric === 'buy_pct') {
            baseline = 50;
        } else if (chartMetric === 'net_vol' || chartMetric === 'cum_vol' || chartMetric === 'diff_pct') {
            baseline = 0;
        }

        chronologicalData.forEach(item => {
            times.push(item.t || '--:--');
            const bu = Number(item.bu) || 0;
            const bms = Number(item.bms) || 0;
            const bup = typeof item.bup === 'number' ? item.bup : Number(item.bup) || 0;
            const sd = Number(item.sd) || 0;
            const sms = Number(item.sms) || 0;
            const sdp = typeof item.sdp === 'number' ? item.sdp : Number(item.sdp) || 0;
            const netVol = bms - sms;

            cumDelta += netVol;

            let val = 0;
            if (chartMetric === 'buy_pct') {
                val = Number((bup * 100).toFixed(2));
            } else if (chartMetric === 'net_vol') {
                val = netVol;
            } else if (chartMetric === 'cum_vol') {
                val = cumDelta;
            } else {
                // diff_pct: (bup - sdp) * 100
                val = Number(((bup - sdp) * 100).toFixed(2));
            }

            numericValues.push(val);
        });

        // Vibrant neon green and intense red matching user screenshot
        const COLOR_BUY = '#00E676'; // vibrant neon green
        const COLOR_SELL = '#FF3B30'; // vibrant red
        const COLOR_BASELINE = '#E5E7EB'; // clean white-gray

        const minVal = numericValues.length > 0 ? Math.min(...numericValues) : -10;
        const maxVal = numericValues.length > 0 ? Math.max(...numericValues) : 10;

        // Ensure baseline is included in the visible Y-axis range with margin
        const rangeSpan = Math.max(Math.abs(maxVal - baseline), Math.abs(baseline - minVal), 5);
        const padding = Math.max(rangeSpan * 0.15, 2);

        let yMin = Math.min(minVal, baseline) - padding;
        let yMax = Math.max(maxVal, baseline) + padding;

        if (chartMetric === 'buy_pct') {
            yMin = Math.max(0, Math.floor(yMin));
            yMax = Math.min(100, Math.ceil(yMax));
        } else if (chartMetric === 'diff_pct') {
            yMin = Math.max(-100, Math.floor(yMin));
            yMax = Math.min(100, Math.ceil(yMax));
        }

        const totalSpan = yMax - yMin;
        let baselineRatio = totalSpan > 0 ? (yMax - baseline) / totalSpan : 0.5;
        baselineRatio = Math.max(0.001, Math.min(0.999, baselineRatio));

        return {
            backgroundColor: '#111827',
            animation: false,
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(17, 24, 39, 0.95)',
                borderColor: '#374151',
                borderWidth: 1,
                padding: [10, 14],
                textStyle: { color: '#F3F4F6', fontSize: 12 },
                formatter: (params) => {
                    const param = params[0];
                    if (!param) return '';
                    const dataIndex = param.dataIndex;
                    const r = chronologicalData[dataIndex];
                    if (!r) return '';

                    const currentVal = Number(param.value);
                    const isBull = currentVal > baseline;
                    const isNeutral = currentVal === baseline;
                    const statusText = isNeutral
                        ? '⚖️ Trạng thái: Cân bằng'
                        : isBull
                            ? '🟢 Phe MUA Áp Đảo (Cầu > Cung)'
                            : '🔴 Phe BÁN Áp Đảo (Cung > Cầu)';
                    const statusColor = isNeutral ? '#9CA3AF' : (isBull ? '#34D399' : '#F87171');

                    const bu = Number(r.bu) || 0;
                    const bms = Number(r.bms) || 0;
                    const bup = typeof r.bup === 'number' ? r.bup : Number(r.bup) || 0;
                    const sd = Number(r.sd) || 0;
                    const sms = Number(r.sms) || 0;
                    const sdp = typeof r.sdp === 'number' ? r.sdp : Number(r.sdp) || 0;
                    const bsr = typeof r.bsr === 'number' ? r.bsr : Number(r.bsr) || 0;

                    return `
                        <div style="font-family: ui-sans-serif, system-ui, sans-serif; min-width: 220px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #374151; padding-bottom: 6px; margin-bottom: 8px;">
                                <span style="font-weight: 700; color: #FFFFFF; font-size: 13px;">⏰ ${r.t || '--:--'}</span>
                                <span style="font-size: 11px; font-weight: 600; color: ${statusColor};">${statusText}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px;">
                                <span style="color: #34D399; font-weight: 600;">Mua Chủ Động:</span>
                                <span style="color: #F3F4F6; font-family: monospace; font-weight: 600;">
                                    ${(bup * 100).toFixed(1)}% <span style="color: #9CA3AF; font-size: 11px;">(${bms.toLocaleString()} KL / ${bu} lệnh)</span>
                                </span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px;">
                                <span style="color: #F87171; font-weight: 600;">Bán Chủ Động:</span>
                                <span style="color: #F3F4F6; font-family: monospace; font-weight: 600;">
                                    ${(sdp * 100).toFixed(1)}% <span style="color: #9CA3AF; font-size: 11px;">(${sms.toLocaleString()} KL / ${sd} lệnh)</span>
                                </span>
                            </div>
                            <div style="display: flex; justify-content: space-between; border-top: 1px dashed #374151; padding-top: 6px; font-size: 11px;">
                                <span style="color: #9CA3AF;">Giá trị đồ thị:</span>
                                <span style="color: ${currentVal >= baseline ? '#34D399' : '#F87171'}; font-weight: 700; font-family: monospace;">
                                    ${currentVal > 0 ? '+' : ''}${currentVal.toLocaleString()}${chartMetric.includes('pct') ? '%' : ' CP'}
                                </span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-top: 2px; font-size: 11px;">
                                <span style="color: #9CA3AF;">Tỷ Lệ BSR (M/B):</span>
                                <span style="color: ${bsr >= 1 ? '#34D399' : '#F87171'}; font-weight: 700; font-family: monospace;">
                                    ${bsr.toFixed(3)}
                                </span>
                            </div>
                        </div>
                    `;
                },
                axisPointer: {
                    type: 'line',
                    lineStyle: {
                        color: '#9CA3AF',
                        type: 'dashed',
                        width: 1
                    }
                }
            },
            grid: {
                left: '2%',
                right: '3%',
                top: '8%',
                bottom: '8%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: times,
                boundaryGap: false,
                axisLine: { lineStyle: { color: '#374151', width: 1 } },
                axisTick: { show: false },
                axisLabel: {
                    color: '#9CA3AF',
                    fontSize: 11,
                    interval: Math.max(1, Math.floor(times.length / 8)),
                    showMaxLabel: true,
                },
                splitLine: {
                    show: true,
                    lineStyle: { color: '#1F2937', type: 'dashed', opacity: 0.6 }
                }
            },
            yAxis: {
                type: 'value',
                min: yMin,
                max: yMax,
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: {
                    color: '#9CA3AF',
                    fontSize: 11,
                    formatter: (val) => {
                        if (chartMetric === 'buy_pct') return `${val}%`;
                        if (chartMetric === 'diff_pct') return `${val > 0 ? '+' : ''}${val}%`;
                        if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                        if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
                        return val;
                    }
                },
                splitLine: {
                    lineStyle: { color: '#1F2937', type: 'dashed', opacity: 0.6 }
                }
            },
            series: [
                {
                    name: 'Market Order',
                    type: 'line',
                    smooth: 0.22,
                    symbol: 'none',
                    emphasis: {
                        disabled: true
                    },
                    lineStyle: {
                        width: 2.8,
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops: [
                                { offset: 0, color: COLOR_BUY },
                                { offset: Math.max(0, baselineRatio - 0.001), color: COLOR_BUY },
                                { offset: Math.min(1, baselineRatio + 0.001), color: COLOR_SELL },
                                { offset: 1, color: COLOR_SELL }
                            ],
                            global: false
                        },
                        shadowColor: 'rgba(0, 0, 0, 0.6)',
                        shadowBlur: 5,
                        shadowOffsetY: 2
                    },
                    data: numericValues,
                    markLine: {
                        symbol: ['none', 'none'],
                        silent: true,
                        lineStyle: {
                            color: COLOR_BASELINE,
                            width: 2,
                            type: 'solid'
                        },
                        data: [
                            {
                                yAxis: baseline,
                                label: {
                                    show: true,
                                    position: 'insideStartTop',
                                    formatter: 'Cân bằng',
                                    color: '#F3F4F6',
                                    fontSize: 13,
                                    fontWeight: 'bold',
                                    padding: [0, 0, 6, 4]
                                }
                            }
                        ]
                    }
                }
            ]
        };
    }, [chronologicalData, chartMetric]);

    return (
        <div className={`bg-gray-800/95 backdrop-blur border border-gray-700/80 rounded-xl shadow-xl flex flex-col overflow-hidden ${className}`}>
            {/* Panel Header */}
            <div className="px-4 py-3 bg-gray-900/70 border-b border-gray-700/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                        <Activity size={16} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-base tracking-wide">{ticker}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium border border-blue-500/30">
                                Cung Cầu Intraday (BSA)
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-400">Khớp lệnh Mua / Bán chủ động & Độ lệch mất cân bằng cung cầu</p>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* View Switcher: Chart | Table */}
                    <div className="flex items-center bg-gray-900 border border-gray-700 rounded-lg p-0.5">
                        <button
                            type="button"
                            onClick={() => setViewMode('chart')}
                            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${viewMode === 'chart'
                                ? 'bg-blue-600 text-white shadow'
                                : 'text-gray-400 hover:text-white'
                                }`}
                            title="Hiển thị biểu đồ"
                        >
                            <LineChartIcon size={13} />
                            <span>Biểu đồ</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${viewMode === 'table'
                                ? 'bg-blue-600 text-white shadow'
                                : 'text-gray-400 hover:text-white'
                                }`}
                            title="Hiển thị bảng dữ liệu"
                        >
                            <TableIcon size={13} />
                            <span>Bảng</span>
                        </button>
                    </div>

                    {/* Time Window Select */}
                    <div className="flex items-center gap-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-gray-400 font-medium uppercase">Cửa sổ:</span>
                        <select
                            value={timeWindow}
                            onChange={(e) => setTimeWindow(e.target.value)}
                            className="bg-transparent text-xs text-white outline-none cursor-pointer font-medium"
                        >
                            {TIME_WINDOWS.map(w => (
                                <option key={w.value} value={w.value} className="bg-gray-900 text-white">
                                    {w.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Total Window Select */}
                    <div className="flex items-center gap-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-gray-400 font-medium uppercase">Khung:</span>
                        <select
                            value={tWindow}
                            onChange={(e) => setTWindow(e.target.value)}
                            className="bg-transparent text-xs text-white outline-none cursor-pointer font-medium"
                        >
                            {T_WINDOWS.map(w => (
                                <option key={w.value} value={w.value} className="bg-gray-900 text-white">
                                    {w.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Refresh Button */}
                    <button
                        type="button"
                        onClick={fetchData}
                        disabled={loading}
                        className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-blue-400 transition border border-gray-600 disabled:opacity-50"
                        title="Làm mới dữ liệu BSA"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="p-4 flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
                {/* Summary Metrics Cards */}
                {summary && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {/* Mua Chủ Động Card */}
                        <div className="bg-gradient-to-br from-emerald-950/30 to-gray-900/60 border border-emerald-500/20 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between shadow-sm">
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 truncate">
                                    <ArrowUpRight size={14} className="shrink-0" /> Mua Chủ Động
                                </span>
                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold font-mono shrink-0">
                                    {(summary.buyVolPct * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div className="mt-1.5">
                                <div className="text-lg sm:text-xl font-extrabold text-white font-mono tracking-tight tabular-nums">
                                    {summary.totalBms.toLocaleString()} <span className="text-[11px] text-gray-400 font-medium">KL</span>
                                </div>
                                <div className="text-[11px] text-emerald-400/80 font-mono mt-0.5 flex items-center justify-between">
                                    <span>{summary.totalBu.toLocaleString()} lệnh</span>
                                    <span className="text-gray-500 text-[10px]">{summary.buyDominantCount} mốc ưu thế</span>
                                </div>
                            </div>
                        </div>

                        {/* Bán Chủ Động Card */}
                        <div className="bg-gradient-to-br from-rose-950/30 to-gray-900/60 border border-rose-500/20 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between shadow-sm">
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-semibold text-rose-400 flex items-center gap-1 truncate">
                                    <ArrowDownRight size={14} className="shrink-0" /> Bán Chủ Động
                                </span>
                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold font-mono shrink-0">
                                    {(summary.sellVolPct * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div className="mt-1.5">
                                <div className="text-lg sm:text-xl font-extrabold text-white font-mono tracking-tight tabular-nums">
                                    {summary.totalSms.toLocaleString()} <span className="text-[11px] text-gray-400 font-medium">KL</span>
                                </div>
                                <div className="text-[11px] text-rose-400/80 font-mono mt-0.5 flex items-center justify-between">
                                    <span>{summary.totalSd.toLocaleString()} lệnh</span>
                                    <span className="text-gray-500 text-[10px]">{summary.sellDominantCount} mốc ưu thế</span>
                                </div>
                            </div>
                        </div>

                        {/* Tỷ Lệ Mua / Bán (BSR) Card */}
                        <div className="bg-gradient-to-br from-gray-850 to-gray-900/80 border border-gray-700/80 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between shadow-sm">
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-semibold text-gray-300 flex items-center gap-1 truncate">
                                    <Scale size={13} className="text-blue-400 shrink-0" /> Tương Quan BSR
                                </span>
                                <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold font-mono shrink-0 ${summary.overallBsr >= 1 ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300' : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'}`}>
                                    {summary.overallBsr >= 1 ? 'Phe Mua' : 'Phe Bán'}
                                </span>
                            </div>
                            <div className="mt-1.5">
                                <div className={`text-lg sm:text-xl font-extrabold font-mono tracking-tight tabular-nums ${summary.overallBsr >= 1 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {summary.overallBsr.toFixed(3)} <span className="text-[11px] text-gray-400 font-medium">BSR</span>
                                </div>
                                <div className="text-[11px] text-gray-400 mt-0.5 flex items-center justify-between">
                                    <span>{summary.overallBsr >= 1 ? '🟢 Mua Áp Đảo' : '🔴 Bán Áp Đảo'}</span>
                                    {latestItem && <span className="text-gray-300 font-mono text-[10px]">{latestItem.t}</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Progress Bar Cán Cân Cung - Cầu */}
                {summary && (
                    <div className="flex flex-col gap-1.5 bg-gray-900/50 p-2.5 rounded-lg border border-gray-700/60">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                Mua: {(summary.buyVolPct * 100).toFixed(1)}% ({summary.buyDominantCount} mốc)
                            </span>
                            <span className="text-gray-400 text-[11px] font-medium">Cán Cân Cung - Cầu Toàn Khung</span>
                            <span className="text-rose-400 font-semibold flex items-center gap-1">
                                Bán: {(summary.sellVolPct * 100).toFixed(1)}% ({summary.sellDominantCount} mốc)
                            </span>
                        </div>
                        <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden flex border border-gray-700/50">
                            <div
                                className="bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(0, summary.buyVolPct * 100))}%` }}
                            />
                            <div
                                className="bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(0, summary.sellVolPct * 100))}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* SECTION: Time Series Imbalance Chart */}
                {viewMode === 'chart' && (
                    <div className="bg-gray-900/90 border border-gray-700/80 rounded-xl overflow-hidden flex flex-col shadow-inner">
                        {/* Chart Box Header */}
                        <div className="px-3.5 py-2 bg-gray-900 border-b border-gray-700/80 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <LineChartIcon size={15} className="text-emerald-400 shrink-0" />
                                <span className="font-semibold text-white text-xs sm:text-sm">
                                    Market Order
                                </span>
                                {loading && <span className="text-blue-400 text-xs animate-pulse">Đang cập nhật...</span>}
                            </div>

                            {/* Metric Selector Dropdown */}
                            <div className="flex items-center gap-1.5 shrink-0 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1">
                                <span className="text-[11px] text-gray-400 font-medium">Chỉ số:</span>
                                <select
                                    value={chartMetric}
                                    onChange={(e) => setChartMetric(e.target.value)}
                                    className="bg-transparent text-xs text-emerald-400 font-semibold outline-none cursor-pointer"
                                >
                                    {METRIC_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value} className="bg-gray-900 text-white font-medium">
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Chart Render Area */}
                        <div className="p-2 sm:p-3 relative" style={{ minHeight: '400px' }}>
                            {error ? (
                                <div className="h-64 flex items-center justify-center text-xs text-rose-400">{error}</div>
                            ) : bsaData.length === 0 ? (
                                <div className="h-64 flex items-center justify-center text-xs text-gray-500">
                                    {loading ? 'Đang tải dữ liệu chuỗi thời gian...' : 'Không có dữ liệu BSA cho khung thời gian này.'}
                                </div>
                            ) : (
                                <div className="w-full h-[440px] sm:h-[480px]">
                                    <ReactECharts
                                        option={chartOption}
                                        style={{ width: '100%', height: '100%' }}
                                        notMerge={true}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Chart Legend / Visual Guide Bar */}
                        <div className="px-4 py-2 bg-gray-950/70 border-t border-gray-800/80 flex flex-wrap items-center justify-between text-[11px] text-gray-400 gap-2">
                            <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-full bg-[#00E676] inline-block shadow-[0_0_8px_#00E676]"></span>
                                    <span className="text-emerald-400 font-semibold">Trên Cân Bằng: Phe Mua Chủ Động Chiếm Ưu Thế</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-full bg-[#FF3B30] inline-block shadow-[0_0_8px_#FF3B30]"></span>
                                    <span className="text-rose-400 font-semibold">Dưới Cân Bằng: Phe Bán Chủ Động Chiếm Ưu Thế</span>
                                </span>
                            </div>
                            <div className="flex items-center gap-3 font-mono text-[10px]">
                                <span className="text-gray-400">Đỉnh Mua: <span className="text-emerald-400 font-bold">+{summary?.maxBuyDiff?.toFixed(1)}%</span></span>
                                <span className="text-gray-400">Đỉnh Bán: <span className="text-rose-400 font-bold">{summary?.maxSellDiff?.toFixed(1)}%</span></span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Data Table: Render conditionally ONLY when user selects 'table' */}
                {viewMode === 'table' && (
                    <BSATable bsaData={bsaData} loading={loading} error={error} />
                )}
            </div>
        </div>
    );
};

export default IntradayBSAPanel;
