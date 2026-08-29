import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    RefreshCw,
    Scale,
    ArrowUpRight,
    ArrowDownRight,
    LineChart as LineChartIcon,
    Table as TableIcon,
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { getIntradayBidAsk } from '../services/tcbs';

const MODE_OPTIONS = [
    { label: 'Tất cả (baAll)', value: 'baAll' },
    { label: 'Top 10 (ba10)', value: 'ba10' },
    { label: 'Top 5 (ba5)', value: 'ba5' },
    { label: 'Top 3 (ba3)', value: 'ba3' },
];

// Memoized Table Row for high performance
const BidAskTableRow = React.memo(({ row, idx }) => {
    const bs = Number(row.bs ?? row.bv ?? row.raw?.bs ?? row.raw?.bv) || 0;
    const oa = Number(row.oa ?? row.av ?? row.raw?.oa ?? row.raw?.av) || 0;
    const diffVol = bs - oa;
    const totalVol = bs + oa;

    // obp: Tỷ lệ dư mua
    const obp = typeof row.obp === 'number'
        ? row.obp
        : (typeof row.raw?.obp === 'number' ? row.raw.obp : (totalVol > 0 ? bs / totalVol : 0.5));

    // osp: Tỷ lệ dư bán
    const osp = typeof row.osp === 'number'
        ? row.osp
        : (typeof row.raw?.osp === 'number' ? row.raw.osp : (totalVol > 0 ? oa / totalVol : 1 - obp));

    // aobp: Trung bình 5 ngày dư mua
    const aobp = typeof row.aobp === 'number'
        ? row.aobp
        : (typeof row.raw?.aobp === 'number' ? row.raw.aobp : 0.5);

    // sp: Spread giữa giá mua và bán
    const sp = typeof row.sp === 'number' ? row.sp : (typeof row.raw?.sp === 'number' ? row.raw.sp : 0);
    // avsp: Trung bình spread
    const avsp = typeof row.avsp === 'number' ? row.avsp : (typeof row.raw?.avsp === 'number' ? row.raw.avsp : 0);

    const ratio = osp > 0 ? (obp / osp) : (oa > 0 ? (bs / oa) : 1);
    const isBull = ratio >= 1;

    return (
        <tr key={row.s || idx} className="hover:bg-gray-800/50 transition">
            <td className="py-1.5 px-3 font-semibold text-white font-sans">
                {row.t || '--:--'}
            </td>
            {/* Dư Mua (bs & obp) */}
            <td className="py-1.5 px-3 text-right text-emerald-300">
                <span className="font-semibold">{bs.toLocaleString()}</span>
                <span className="text-[10px] text-emerald-400 font-semibold ml-1.5">
                    ({(obp * 100).toFixed(1)}%)
                </span>
            </td>
            {/* Dư Bán (oa & osp) */}
            <td className="py-1.5 px-3 text-right text-rose-300">
                <span className="font-semibold">{oa.toLocaleString()}</span>
                <span className="text-[10px] text-rose-400 font-semibold ml-1.5">
                    ({(osp * 100).toFixed(1)}%)
                </span>
            </td>
            {/* TB 5 Ngày Dư Mua (aobp) */}
            <td className="py-1.5 px-3 text-right text-amber-400 font-semibold">
                {(aobp * 100).toFixed(1)}%
            </td>
            {/* Chênh lệch KL (bs - oa) */}
            <td className={`py-1.5 px-3 text-right font-bold ${diffVol >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {diffVol > 0 ? `+${diffVol.toLocaleString()}` : diffVol.toLocaleString()}
            </td>
            {/* Tỷ lệ Dư Mua / Dư Bán (Ratio) */}
            <td className={`py-1.5 px-3 text-right font-bold ${isBull ? 'text-emerald-400' : 'text-rose-400'}`}>
                {ratio.toFixed(3)}x
            </td>
            {/* Spread (sp / avsp) */}
            <td className="py-1.5 px-3 text-right text-gray-300">
                <span className="font-semibold">{sp.toFixed(2)}</span>
                <span className="text-[10px] text-gray-500 ml-1">({avsp.toFixed(2)})</span>
            </td>
            {/* Tương quan Progress */}
            <td className="py-1.5 px-3">
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden flex border border-gray-700/40">
                    <div
                        className="bg-emerald-500"
                        style={{ width: `${Math.min(100, Math.max(0, obp * 100))}%` }}
                    />
                    <div
                        className="bg-rose-500"
                        style={{ width: `${Math.min(100, Math.max(0, osp * 100))}%` }}
                    />
                </div>
            </td>
        </tr>
    );
});

// Memoized Table component to only render when Table or Both view mode is active
const BidAskTable = React.memo(({ bidAskData, loading, error }) => {
    return (
        <div className="flex-1 min-h-[380px] bg-gray-900/60 border border-gray-700/70 rounded-xl overflow-hidden flex flex-col">
            <div className="px-3 py-2 bg-gray-900/90 border-b border-gray-700 flex items-center justify-between text-xs text-gray-400 font-medium">
                <span>Bảng Chi tiết Dư Mua - Dư Bán ({bidAskData.length} mốc)</span>
                {loading && <span className="text-purple-400 animate-pulse">Đang tải...</span>}
            </div>

            <div className="flex-1 min-h-[340px] max-h-[520px] overflow-y-auto custom-scrollbar">
                {error ? (
                    <div className="p-4 text-center text-xs text-rose-400">{error}</div>
                ) : bidAskData.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-500">
                        {loading ? 'Đang tải dữ liệu Dư mua - Dư bán...' : 'Không có dữ liệu Bid-Ask cho khung thời gian này.'}
                    </div>
                ) : (
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-gray-900 text-[11px] text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-700 z-10">
                            <tr>
                                <th className="py-2 px-3">Thời Gian</th>
                                <th className="py-2 px-3 text-right text-emerald-400">Dư Mua (bs / obp)</th>
                                <th className="py-2 px-3 text-right text-rose-400">Dư Bán (oa / osp)</th>
                                <th className="py-2 px-3 text-right text-amber-400">TB 5N (aobp)</th>
                                <th className="py-2 px-3 text-right">Chênh Lệch KL</th>
                                <th className="py-2 px-3 text-right text-purple-300">Tỷ Lệ M/B (Ratio)</th>
                                <th className="py-2 px-3 text-right">Spread (sp / avsp)</th>
                                <th className="py-2 px-3 text-center w-24">Tương Quan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/80 font-mono text-[11px]">
                            {bidAskData.map((row, idx) => (
                                <BidAskTableRow key={row.s || idx} row={row} idx={idx} />
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
});

const IntradayBidAskPanel = ({ defaultTicker = '41I1G9000', className = '' }) => {
    const [ticker, setTicker] = useState(defaultTicker);
    const [mode, setMode] = useState('baAll');
    const [bidAskData, setBidAskData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('chart'); // 'chart' | 'both' | 'table'

    const fetchData = useCallback(async () => {
        if (!ticker) return;
        setLoading(true);
        setError(null);
        try {
            const res = await getIntradayBidAsk(ticker, { mode });

            const raw = res?.data && !Array.isArray(res.data) ? res.data : res;
            const obLog = Array.isArray(raw?.overBidAskLog)
                ? raw.overBidAskLog
                : (Array.isArray(res?.overBidAskLog) ? res.overBidAskLog : []);

            const avgOB = Array.isArray(raw?.avgOBPercent)
                ? raw.avgOBPercent
                : (Array.isArray(res?.avgOBPercent) ? res.avgOBPercent : []);

            const listFromData = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);

            // Build unified map by time t
            const unifiedMap = new Map();

            // 1. Process items from listFromData
            listFromData.forEach(item => {
                const tStr = String(item?.t || '');
                if (!tStr) return;
                const bs = Number(item.bs ?? item.bv ?? item.raw?.bs ?? item.raw?.bv) || 0;
                const oa = Number(item.oa ?? item.av ?? item.raw?.oa ?? item.raw?.av) || 0;
                const totalVol = bs + oa;
                const obp = typeof item.obp === 'number'
                    ? item.obp
                    : (typeof item.raw?.obp === 'number' ? item.raw.obp : (totalVol > 0 ? bs / totalVol : 0.5));
                const osp = typeof item.osp === 'number'
                    ? item.osp
                    : (typeof item.raw?.osp === 'number' ? item.raw.osp : (totalVol > 0 ? oa / totalVol : 1 - obp));

                unifiedMap.set(tStr, {
                    t: tStr,
                    s: Number(item.s) || 0,
                    bs,
                    oa,
                    bv: bs,
                    av: oa,
                    obp,
                    osp,
                    aobp: typeof item.aobp === 'number' ? item.aobp : (typeof item.raw?.aobp === 'number' ? item.raw.aobp : 0.5),
                    sp: typeof item.sp === 'number' ? item.sp : (typeof item.raw?.sp === 'number' ? item.raw.sp : 0),
                    avsp: typeof item.avsp === 'number' ? item.avsp : (typeof item.raw?.avsp === 'number' ? item.raw.avsp : 0),
                    raw: item.raw || item
                });
            });

            // 2. Merge overBidAskLog
            obLog.forEach(item => {
                const tStr = String(item?.t || '');
                if (!tStr) return;
                const existing = unifiedMap.get(tStr) || { t: tStr, s: Number(item.s) || 0, raw: {} };
                const bs = Number(item.bs) || existing.bs || 0;
                const oa = Number(item.oa) || existing.oa || 0;
                const totalVol = bs + oa;
                const obp = typeof item.obp === 'number'
                    ? item.obp
                    : (existing.obp ?? (totalVol > 0 ? bs / totalVol : 0.5));
                const osp = typeof item.osp === 'number'
                    ? item.osp
                    : (existing.osp ?? (totalVol > 0 ? oa / totalVol : 1 - obp));
                const sp = typeof item.sp === 'number' ? item.sp : (existing.sp || 0);

                unifiedMap.set(tStr, {
                    ...existing,
                    bs,
                    oa,
                    bv: bs,
                    av: oa,
                    obp,
                    osp,
                    sp,
                    raw: { ...(existing.raw || {}), ...item }
                });
            });

            // 3. Merge avgOBPercent
            avgOB.forEach(item => {
                const tStr = String(item?.t || '');
                if (!tStr) return;
                const existing = unifiedMap.get(tStr) || { t: tStr, s: Number(item.s) || 0, raw: {} };
                const aobp = typeof item.aobp === 'number' ? item.aobp : (existing.aobp ?? 0.5);
                const avsp = typeof item.avsp === 'number' ? item.avsp : (existing.avsp ?? 0);
                unifiedMap.set(tStr, {
                    ...existing,
                    aobp,
                    avsp,
                    raw: { ...(existing.raw || {}), ...item }
                });
            });

            const mergedList = Array.from(unifiedMap.values());

            // Sort chronological (earlier -> later)
            mergedList.sort((a, b) => {
                if (a.t && b.t) return a.t.localeCompare(b.t);
                return (Number(a.s) || 0) - (Number(b.s) || 0);
            });

            setBidAskData(mergedList);
        } catch (err) {
            console.error('Failed to fetch Intraday Bid-Ask:', err);
            setError(err.message || 'Không thể tải dữ liệu Bid-Ask');
        } finally {
            setLoading(false);
        }
    }, [ticker, mode]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Chronological data for time-series chart (earliest to latest, left to right)
    const chronologicalData = useMemo(() => {
        return bidAskData;
    }, [bidAskData]);

    // Latest snapshot (last element in chronological list)
    const latestItem = useMemo(() => {
        return bidAskData.length > 0 ? bidAskData[bidAskData.length - 1] : null;
    }, [bidAskData]);

    // Aggregated statistics
    const summary = useMemo(() => {
        if (bidAskData.length === 0) return null;

        let totalBs = 0;
        let totalOa = 0;
        let bidDominantCount = 0;
        let askDominantCount = 0;
        let maxRatio = -Infinity;
        let minRatio = Infinity;

        bidAskData.forEach(item => {
            const bs = Number(item.bs ?? item.bv) || 0;
            const oa = Number(item.oa ?? item.av) || 0;
            const obp = typeof item.obp === 'number' ? item.obp : (bs + oa > 0 ? bs / (bs + oa) : 0.5);
            const osp = typeof item.osp === 'number' ? item.osp : 1 - obp;
            const ratio = osp > 0 ? obp / osp : 1.0;

            totalBs += bs;
            totalOa += oa;

            if (ratio > 1) bidDominantCount++;
            else if (ratio < 1) askDominantCount++;

            if (ratio > maxRatio) maxRatio = ratio;
            if (ratio < minRatio) minRatio = ratio;
        });

        const totalVol = totalBs + totalOa;
        const bidVolPct = totalVol > 0 ? (totalBs / totalVol) : 0.5;
        const askVolPct = totalVol > 0 ? (totalOa / totalVol) : 0.5;
        const overallRatio = askVolPct > 0 ? (bidVolPct / askVolPct) : 1.0;

        return {
            totalBs,
            totalOa,
            bidVolPct,
            askVolPct,
            overallRatio,
            bidDominantCount,
            askDominantCount,
            neutralCount: bidAskData.length - bidDominantCount - askDominantCount,
            maxRatio: maxRatio === -Infinity ? 1.0 : maxRatio,
            minRatio: minRatio === Infinity ? 1.0 : minRatio,
        };
    }, [bidAskData]);

    // Build ECharts option for Ratio (Tỷ lệ Dư mua / Dư bán)
    const chartOption = useMemo(() => {
        if (!chronologicalData || chronologicalData.length === 0) return {};

        const times = [];
        const ratioValues = [];
        const baseline = 1.0; // Reference balance point is 1.0x

        chronologicalData.forEach(item => {
            times.push(item.t || '--:--');
            const bs = Number(item.bs ?? item.bv) || 0;
            const oa = Number(item.oa ?? item.av) || 0;
            const total = bs + oa;

            const obp = typeof item.obp === 'number' ? item.obp : (total > 0 ? bs / total : 0.5);
            const osp = typeof item.osp === 'number' ? item.osp : (total > 0 ? oa / total : 1 - obp);

            const ratio = osp > 0 ? Number((obp / osp).toFixed(3)) : (oa > 0 ? Number((bs / oa).toFixed(3)) : 1.0);
            ratioValues.push(ratio);
        });

        const COLOR_BUY = '#00E676'; // vibrant neon green
        const COLOR_SELL = '#FF3B30'; // vibrant red
        const COLOR_BASELINE = '#E5E7EB'; // clean white-gray

        const minVal = ratioValues.length > 0 ? Math.min(...ratioValues) : 0.5;
        const maxVal = ratioValues.length > 0 ? Math.max(...ratioValues) : 1.5;

        const rangeSpan = Math.max(Math.abs(maxVal - baseline), Math.abs(baseline - minVal), 0.15);
        const padding = Math.max(rangeSpan * 0.15, 0.05);

        let yMin = Math.max(0, Math.min(minVal, baseline) - padding);
        let yMax = Math.max(maxVal, baseline) + padding;

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
                    const r = chronologicalData[param.dataIndex];
                    if (!r) return '';

                    const currentVal = Number(param.value);
                    const isBull = currentVal > baseline;
                    const isNeutral = currentVal === baseline;
                    const statusText = isNeutral
                        ? '⚖️ Cân bằng Dư mua / Dư bán'
                        : isBull
                            ? '🟢 Phe MUA Áp Đảo (Dư Mua > Dư Bán)'
                            : '🔴 Phe BÁN Áp Đảo (Dư Bán > Dư Mua)';
                    const statusColor = isNeutral ? '#9CA3AF' : (isBull ? '#34D399' : '#F87171');

                    const bs = Number(r.bs ?? r.bv) || 0;
                    const oa = Number(r.oa ?? r.av) || 0;
                    const obp = typeof r.obp === 'number' ? r.obp * 100 : 50;
                    const osp = typeof r.osp === 'number' ? r.osp * 100 : 50;
                    const aobp = typeof r.aobp === 'number' ? r.aobp * 100 : 50;
                    const sp = typeof r.sp === 'number' ? r.sp : 0;
                    const avsp = typeof r.avsp === 'number' ? r.avsp : 0;

                    return `
                        <div style="font-family: ui-sans-serif, system-ui, sans-serif; min-width: 230px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #374151; padding-bottom: 6px; margin-bottom: 8px;">
                                <span style="font-weight: 700; color: #FFFFFF; font-size: 13px;">⏰ ${r.t || '--:--'}</span>
                                <span style="font-size: 11px; font-weight: 600; color: ${statusColor};">${statusText}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px;">
                                <span style="color: #34D399; font-weight: 600;">Dư Mua (bs):</span>
                                <span style="color: #F3F4F6; font-family: monospace; font-weight: 600;">
                                    ${bs.toLocaleString()} CP <span style="color: #9CA3AF; font-size: 11px;">(${obp.toFixed(1)}%)</span>
                                </span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px;">
                                <span style="color: #F87171; font-weight: 600;">Dư Bán (oa):</span>
                                <span style="color: #F3F4F6; font-family: monospace; font-weight: 600;">
                                    ${oa.toLocaleString()} CP <span style="color: #9CA3AF; font-size: 11px;">(${osp.toFixed(1)}%)</span>
                                </span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px;">
                                <span style="color: #FBBF24; font-weight: 600;">TB 5N Dư Mua (aobp):</span>
                                <span style="color: #F3F4F6; font-family: monospace; font-weight: 600;">${aobp.toFixed(1)}%</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; border-top: 1px dashed #374151; padding-top: 6px; font-size: 11px;">
                                <span style="color: #9CA3AF;">Tỷ Lệ M/B (Ratio):</span>
                                <span style="color: ${currentVal >= baseline ? '#34D399' : '#F87171'}; font-weight: 700; font-family: monospace; font-size: 12px;">
                                    ${currentVal.toFixed(3)}x
                                </span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-top: 2px; font-size: 11px;">
                                <span style="color: #9CA3AF;">Spread Giá (sp / avsp):</span>
                                <span style="color: #E5E7EB; font-family: monospace;">${sp.toFixed(2)} <span style="color: #9CA3AF;">(${avsp.toFixed(2)})</span></span>
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
                min: Number(yMin.toFixed(2)),
                max: Number(yMax.toFixed(2)),
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: {
                    color: '#9CA3AF',
                    fontSize: 11,
                    formatter: (val) => `${Number(val).toFixed(2)}x`
                },
                splitLine: {
                    lineStyle: { color: '#1F2937', type: 'dashed', opacity: 0.6 }
                }
            },
            series: [
                {
                    name: 'Tỷ Lệ Dư Mua / Dư Bán (Ratio)',
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
                    data: ratioValues,
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
                                    formatter: 'Cân bằng (1.0x)',
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
    }, [chronologicalData]);

    return (
        <div className={`bg-gray-800/95 backdrop-blur border border-gray-700/80 rounded-xl shadow-xl flex flex-col overflow-hidden ${className}`}>
            {/* Panel Header */}
            <div className="px-4 py-3 bg-gray-900/70 border-b border-gray-700/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                        <Scale size={16} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-base tracking-wide">{ticker}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium border border-purple-500/30">
                                Sổ Lệnh Intraday (Bid - Ask)
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-400">Tỷ lệ Dư mua / Dư bán (Ratio) & So sánh TB 5 ngày</p>
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
                                ? 'bg-purple-600 text-white shadow'
                                : 'text-gray-400 hover:text-white'
                                }`}
                            title="Hiển thị biểu đồ Tỷ lệ Dư Mua / Dư Bán"
                        >
                            <LineChartIcon size={13} />
                            <span>Biểu đồ</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${viewMode === 'table'
                                ? 'bg-purple-600 text-white shadow'
                                : 'text-gray-400 hover:text-white'
                                }`}
                            title="Hiển thị bảng dữ liệu"
                        >
                            <TableIcon size={13} />
                            <span>Bảng</span>
                        </button>
                    </div>

                    {/* Mode Select */}
                    <div className="flex items-center gap-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-gray-400 font-medium uppercase">Mode:</span>
                        <select
                            value={mode}
                            onChange={(e) => setMode(e.target.value)}
                            className="bg-transparent text-xs text-white outline-none cursor-pointer font-medium"
                        >
                            {MODE_OPTIONS.map(m => (
                                <option key={m.value} value={m.value} className="bg-gray-900 text-white">
                                    {m.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Refresh Button */}
                    <button
                        type="button"
                        onClick={fetchData}
                        disabled={loading}
                        className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-purple-400 transition border border-gray-600 disabled:opacity-50"
                        title="Làm mới dữ liệu Bid-Ask"
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
                        {/* Tổng Dư Mua Card */}
                        <div className="bg-gradient-to-br from-emerald-950/30 to-gray-900/60 border border-emerald-500/20 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between shadow-sm">
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 truncate">
                                    <ArrowUpRight size={14} className="shrink-0" /> Tổng Dư Mua (bs)
                                </span>
                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold font-mono shrink-0">
                                    {(summary.bidVolPct * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div className="mt-1.5">
                                <div className="text-lg sm:text-xl font-extrabold text-white font-mono tracking-tight tabular-nums">
                                    {summary.totalBs.toLocaleString()} <span className="text-[11px] text-gray-400 font-medium">CP</span>
                                </div>
                                <div className="text-[11px] text-emerald-400/80 font-mono mt-0.5 flex items-center justify-between">
                                    <span>{summary.bidDominantCount} mốc ưu thế</span>
                                    <span className="text-gray-500 text-[10px]">Lệnh Chờ Mua</span>
                                </div>
                            </div>
                        </div>

                        {/* Tổng Dư Bán Card */}
                        <div className="bg-gradient-to-br from-rose-950/30 to-gray-900/60 border border-rose-500/20 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between shadow-sm">
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-semibold text-rose-400 flex items-center gap-1 truncate">
                                    <ArrowDownRight size={14} className="shrink-0" /> Tổng Dư Bán (oa)
                                </span>
                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold font-mono shrink-0">
                                    {(summary.askVolPct * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div className="mt-1.5">
                                <div className="text-lg sm:text-xl font-extrabold text-white font-mono tracking-tight tabular-nums">
                                    {summary.totalOa.toLocaleString()} <span className="text-[11px] text-gray-400 font-medium">CP</span>
                                </div>
                                <div className="text-[11px] text-rose-400/80 font-mono mt-0.5 flex items-center justify-between">
                                    <span>{summary.askDominantCount} mốc ưu thế</span>
                                    <span className="text-gray-500 text-[10px]">Lệnh Chờ Bán</span>
                                </div>
                            </div>
                        </div>

                        {/* Tỷ Lệ Dư Mua / Dư Bán Card */}
                        <div className="bg-gradient-to-br from-gray-850 to-gray-900/80 border border-gray-700/80 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between shadow-sm">
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-semibold text-gray-300 flex items-center gap-1 truncate">
                                    <Scale size={13} className="text-purple-400 shrink-0" /> Tương Quan Sổ Lệnh
                                </span>
                                <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold font-mono shrink-0 ${summary.overallRatio >= 1 ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300' : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'}`}>
                                    {summary.overallRatio >= 1 ? 'Dư Mua' : 'Dư Bán'}
                                </span>
                            </div>
                            <div className="mt-1.5">
                                <div className={`text-lg sm:text-xl font-extrabold font-mono tracking-tight tabular-nums ${summary.overallRatio >= 1 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {summary.overallRatio.toFixed(3)} <span className="text-[11px] text-gray-400 font-medium">Ratio</span>
                                </div>
                                <div className="text-[11px] text-gray-400 mt-0.5 flex items-center justify-between">
                                    <span>{summary.overallRatio >= 1 ? '🟢 Dư Mua Áp Đảo' : '🔴 Dư Bán Áp Đảo'}</span>
                                    {latestItem && <span className="text-gray-300 font-mono text-[10px]">{latestItem.t}</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Progress Bar Cán Cân Dư Mua - Dư Bán */}
                {summary && (
                    <div className="flex flex-col gap-1.5 bg-gray-900/50 p-2.5 rounded-lg border border-gray-700/60">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                Dư Mua: {(summary.bidVolPct * 100).toFixed(1)}% ({summary.totalBs.toLocaleString()} CP)
                            </span>
                            <span className="text-gray-400 text-[11px] font-medium">Cán Cân Sổ Lệnh (Dư Mua vs Dư Bán)</span>
                            <span className="text-rose-400 font-semibold flex items-center gap-1">
                                Dư Bán: {(summary.askVolPct * 100).toFixed(1)}% ({summary.totalOa.toLocaleString()} CP)
                            </span>
                        </div>
                        <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden flex border border-gray-700/50">
                            <div
                                className="bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(0, summary.bidVolPct * 100))}%` }}
                            />
                            <div
                                className="bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(0, summary.askVolPct * 100))}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* SECTION: Time Series Bid-Ask Chart (Ratio) */}
                {viewMode === 'chart' && (
                    <div className="bg-gray-900/90 border border-gray-700/80 rounded-xl overflow-hidden flex flex-col shadow-inner">
                        {/* Chart Box Header */}
                        <div className="px-4 py-2.5 bg-gray-900 border-b border-gray-700/80 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <LineChartIcon size={16} className="text-purple-400" />
                                <span className="font-semibold text-white text-xs sm:text-sm">
                                    Tỷ Lệ Dư Mua / Dư Bán (Ratio)
                                </span>
                                {loading && <span className="text-purple-400 text-xs animate-pulse">Đang cập nhật...</span>}
                            </div>
                        </div>

                        {/* Chart Render Area */}
                        <div className="p-2 sm:p-3 relative" style={{ minHeight: '400px' }}>
                            {error ? (
                                <div className="h-64 flex items-center justify-center text-xs text-rose-400">{error}</div>
                            ) : bidAskData.length === 0 ? (
                                <div className="h-64 flex items-center justify-center text-xs text-gray-500">
                                    {loading ? 'Đang tải dữ liệu chuỗi thời gian...' : 'Không có dữ liệu Bid-Ask cho khung thời gian này.'}
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
                                    <span className="text-emerald-400 font-semibold">Trên 1.0x: Phe Mua Đặt Lệnh Áp Đảo (Dư Mua &gt; Dư Bán)</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-full bg-[#FF3B30] inline-block shadow-[0_0_8px_#FF3B30]"></span>
                                    <span className="text-rose-400 font-semibold">Dưới 1.0x: Phe Bán Đè Lệnh Áp Đảo (Dư Bán &gt; Dư Mua)</span>
                                </span>
                            </div>
                            <div className="flex items-center gap-3 font-mono text-[10px]">
                                <span className="text-gray-400">Đỉnh Mua: <span className="text-emerald-400 font-bold">{summary?.maxRatio?.toFixed(3)}x</span></span>
                                <span className="text-gray-400">Đáy Bán: <span className="text-rose-400 font-bold">{summary?.minRatio?.toFixed(3)}x</span></span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Data Table: Render conditionally ONLY when user selects 'table' */}
                {viewMode === 'table' && (
                    <BidAskTable bidAskData={bidAskData} loading={loading} error={error} />
                )}
            </div>
        </div>
    );
};

export default IntradayBidAskPanel;
