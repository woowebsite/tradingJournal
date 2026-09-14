import React, { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { BarChart2 } from 'lucide-react';
import { formatNumber } from '../utils/formatNumber';

const PatternOccurrencesChart = ({ occurrences = [], timeframe = 'D1', candlePattern = '' }) => {
    const [viewMode, setViewMode] = useState('bar'); // 'bar' | 'cum' | 'list'

    const occList = useMemo(() => {
        if (!occurrences || occurrences.length === 0) return [];
        // Chronological order: oldest to newest for the chart timeline
        const list = [...occurrences].reverse();
        let runningCum = 0;
        return list.map((occ, idx) => {
            const ret = occ.nextReturn !== null ? occ.nextReturn : 0;
            runningCum += ret;
            const rawTime = occ.patternEndDate || (typeof occ.patternEndTime === 'number' ? (occ.patternEndTime < 10000000000 ? occ.patternEndTime * 1000 : occ.patternEndTime) : occ.patternEndTime);
            const dt = dayjs(rawTime);
            const timeLabel = dt.isValid() ? dt.format(timeframe === 'D1' || timeframe === 'W1' ? 'DD/MM' : 'DD/MM HH:mm') : `#${idx + 1}`;
            const fullTimeLabel = dt.isValid() ? dt.format(timeframe === 'D1' || timeframe === 'W1' ? 'DD/MM/YYYY' : 'DD/MM/YYYY HH:mm') : `#${idx + 1}`;

            return {
                ...occ,
                seq: idx + 1,
                timeLabel,
                fullTimeLabel,
                ret: parseFloat(ret.toFixed(2)),
                spreadPercent: parseFloat((occ.nextSpreadPercent || 0).toFixed(2)),
                cumReturn: parseFloat(runningCum.toFixed(2)),
            };
        });
    }, [occurrences, timeframe]);

    const metrics = useMemo(() => {
        const total = occList.length;
        if (total === 0) return null;
        const bullCount = occList.filter(o => o.nextDirection === 'up').length;
        const bearCount = occList.filter(o => o.nextDirection === 'down').length;
        const bullRate = (bullCount / total) * 100;
        const bearRate = (bearCount / total) * 100;
        const avgRet = occList.reduce((acc, o) => acc + o.ret, 0) / total;
        const totalCumRet = occList[total - 1]?.cumReturn || 0;
        const avgSpread = occList.reduce((acc, o) => acc + o.spreadPercent, 0) / total;

        return {
            total,
            bullCount,
            bearCount,
            bullRate,
            bearRate,
            avgRet,
            totalCumRet,
            avgSpread
        };
    }, [occList]);

    // 1. Combo Option: Bar (Return %) + Line (Spread %)
    const comboOption = useMemo(() => {
        if (occList.length === 0 || !metrics) return {};

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                backgroundColor: '#111827',
                borderColor: '#374151',
                padding: [8, 12],
                textStyle: { color: '#f3f4f6' },
                formatter: (params) => {
                    const dataIndex = params[0]?.dataIndex;
                    const item = occList[dataIndex];
                    if (!item) return '';
                    const dirText = item.nextDirection === 'up'
                        ? '<span style="color:#34d399;font-weight:bold;">▲ TĂNG</span>'
                        : (item.nextDirection === 'down'
                            ? '<span style="color:#f87171;font-weight:bold;">▼ GIẢM</span>'
                            : '<span style="color:#9ca3af;font-weight:bold;">DOJI</span>');
                    const retColor = item.ret >= 0 ? '#34d399' : '#f87171';
                    const retSign = item.ret >= 0 ? '+' : '';
                    return `
                        <div style="font-family: monospace; font-size: 11px; line-height: 1.5;">
                            <div style="font-weight:bold; color:#e5e7eb; border-bottom: 1px solid #374151; padding-bottom: 4px; margin-bottom: 4px;">
                                Lần #${item.seq} • ${item.fullTimeLabel}
                            </div>
                            <div>Kết quả nến sau: ${dirText} (<b style="color:${retColor};">${retSign}${item.ret}%</b>)</div>
                            <div>Biên độ Spread: <b style="color:#fbbf24;">${item.spreadPercent}%</b></div>
                            <div>Lũy kế 20 lần: <b style="color:${item.cumReturn >= 0 ? '#34d399' : '#f87171'};">${item.cumReturn >= 0 ? '+' : ''}${item.cumReturn}%</b></div>
                        </div>
                    `;
                }
            },
            legend: {
                data: ['Lợi nhuận Nến sau (%)', 'Biên độ Spread (%)'],
                textStyle: { color: '#9ca3af', fontSize: 10 },
                top: 0,
                right: 0
            },
            grid: {
                left: '2%',
                right: '4%',
                bottom: '10%',
                top: '18%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: occList.map(o => `#${o.seq}\n${o.timeLabel}`),
                axisLabel: {
                    color: '#9ca3af',
                    fontSize: 9,
                    interval: 0,
                    lineHeight: 11
                },
                axisLine: { lineStyle: { color: '#374151' } },
                axisTick: { show: false }
            },
            yAxis: [
                {
                    type: 'value',
                    name: 'Lợi nhuận %',
                    nameTextStyle: { color: '#9ca3af', fontSize: 9 },
                    axisLabel: {
                        color: '#9ca3af',
                        fontSize: 9,
                        formatter: '{value}%'
                    },
                    splitLine: { lineStyle: { color: '#1f2937', type: 'dashed' } }
                },
                {
                    type: 'value',
                    name: 'Spread %',
                    nameTextStyle: { color: '#fbbf24', fontSize: 9 },
                    axisLabel: {
                        color: '#fbbf24',
                        fontSize: 9,
                        formatter: '{value}%'
                    },
                    splitLine: { show: false }
                }
            ],
            series: [
                {
                    name: 'Lợi nhuận Nến sau (%)',
                    type: 'bar',
                    yAxisIndex: 0,
                    barWidth: '46%',
                    data: occList.map(o => ({
                        value: o.ret,
                        itemStyle: {
                            color: o.ret >= 0
                                ? {
                                    type: 'linear',
                                    x: 0, y: 0, x2: 0, y2: 1,
                                    colorStops: [{ offset: 0, color: '#10b981' }, { offset: 1, color: '#059669' }]
                                }
                                : {
                                    type: 'linear',
                                    x: 0, y: 0, x2: 0, y2: 1,
                                    colorStops: [{ offset: 0, color: '#e11d48' }, { offset: 1, color: '#f43f5e' }]
                                },
                            borderRadius: o.ret >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3]
                        }
                    })),
                    label: {
                        show: true,
                        position: 'top',
                        formatter: (p) => `${p.value >= 0 ? '+' : ''}${p.value}%`,
                        color: (p) => p.value >= 0 ? '#34d399' : '#f87171',
                        fontSize: 8.5,
                        fontWeight: 'bold',
                        fontFamily: 'monospace'
                    },
                    markLine: {
                        symbol: 'none',
                        data: [
                            { yAxis: 0, lineStyle: { color: '#4b5563', width: 1.5, type: 'solid' } },
                            {
                                yAxis: parseFloat((metrics?.avgRet || 0).toFixed(2)),
                                lineStyle: { color: '#06b6d4', width: 1.5, type: 'dashed' },
                                label: {
                                    show: true,
                                    position: 'end',
                                    formatter: `E[R]: ${(metrics?.avgRet || 0) >= 0 ? '+' : ''}${(metrics?.avgRet || 0).toFixed(2)}%`,
                                    color: '#22d3ee',
                                    fontSize: 9,
                                    fontFamily: 'monospace'
                                }
                            }
                        ]
                    }
                },
                {
                    name: 'Biên độ Spread (%)',
                    type: 'line',
                    yAxisIndex: 1,
                    data: occList.map(o => o.spreadPercent),
                    smooth: 0.3,
                    symbol: 'circle',
                    symbolSize: 5,
                    itemStyle: { color: '#fbbf24' },
                    lineStyle: { width: 2, color: '#fbbf24' }
                }
            ]
        };
    }, [occList, metrics]);

    // 2. Cumulative Equity Curve Option
    const cumOption = useMemo(() => {
        if (occList.length === 0 || !metrics) return {};
        const isPos = metrics.totalCumRet >= 0;

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                backgroundColor: '#111827',
                borderColor: '#374151',
                padding: [8, 12],
                textStyle: { color: '#f3f4f6' },
                formatter: (params) => {
                    const dataIndex = params[0]?.dataIndex;
                    const item = occList[dataIndex];
                    if (!item) return '';
                    return `
                        <div style="font-family: monospace; font-size: 11px;">
                            <div style="font-weight:bold; color:#e5e7eb; border-bottom: 1px solid #374151; padding-bottom: 4px; margin-bottom: 4px;">
                                Lần #${item.seq} • ${item.fullTimeLabel}
                            </div>
                            <div style="color:#9ca3af;">Lợi nhuận lần này: <b style="color:${item.ret >= 0 ? '#34d399' : '#f87171'};">${item.ret >= 0 ? '+' : ''}${item.ret}%</b></div>
                            <div style="color:#9ca3af; margin-top: 2px;">Lũy kế tích lũy: <b style="color:${item.cumReturn >= 0 ? '#38bdf8' : '#f43f5e'}; font-size: 12px;">${item.cumReturn >= 0 ? '+' : ''}${item.cumReturn}%</b></div>
                        </div>
                    `;
                }
            },
            grid: {
                left: '2%',
                right: '4%',
                bottom: '10%',
                top: '16%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: occList.map(o => `#${o.seq}\n${o.timeLabel}`),
                axisLabel: {
                    color: '#9ca3af',
                    fontSize: 9,
                    interval: 0,
                    lineHeight: 11
                },
                axisLine: { lineStyle: { color: '#374151' } }
            },
            yAxis: {
                type: 'value',
                name: 'Lũy kế PnL (%)',
                nameTextStyle: { color: '#9ca3af', fontSize: 9 },
                axisLabel: {
                    color: '#9ca3af',
                    fontSize: 9,
                    formatter: '{value}%'
                },
                splitLine: { lineStyle: { color: '#1f2937', type: 'dashed' } }
            },
            series: [
                {
                    name: 'Lợi nhuận tích lũy (%)',
                    type: 'line',
                    data: occList.map(o => o.cumReturn),
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 6,
                    itemStyle: { color: isPos ? '#38bdf8' : '#f43f5e' },
                    lineStyle: { width: 2.5, color: isPos ? '#38bdf8' : '#f43f5e' },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: isPos
                                ? [{ offset: 0, color: 'rgba(56, 189, 248, 0.35)' }, { offset: 1, color: 'rgba(56, 189, 248, 0.02)' }]
                                : [{ offset: 0, color: 'rgba(244, 63, 94, 0.35)' }, { offset: 1, color: 'rgba(244, 63, 94, 0.02)' }]
                        }
                    },
                    markLine: {
                        symbol: 'none',
                        data: [{ yAxis: 0, lineStyle: { color: '#6b7280', width: 1.5, type: 'solid' } }]
                    }
                }
            ]
        };
    }, [occList, metrics]);

    if (!metrics) return null;

    return (
        <div className="bg-gray-900/70 border border-gray-700/60 rounded-xl p-3.5 space-y-3 shadow-md">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-2.5">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
                        <BarChart2 size={16} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-gray-100">
                                Biểu đồ {metrics.total} lần xuất hiện gần nhất
                            </h4>
                            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.2 rounded">
                                Trình tự thời gian
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-400">
                            Hiệu suất nến kế tiếp (% Lợi nhuận, Tăng/Giảm & Biên độ Spread)
                        </p>
                    </div>
                </div>

                {/* View Switcher Tabs */}
                <div className="flex items-center gap-1 bg-gray-950/80 p-1 rounded-lg border border-gray-800 shrink-0 self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={() => setViewMode('bar')}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                            viewMode === 'bar'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                                : 'text-gray-400 hover:text-gray-200'
                        }`}
                    >
                        Lợi nhuận & Spread
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('cum')}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                            viewMode === 'cum'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                                : 'text-gray-400 hover:text-gray-200'
                        }`}
                    >
                        Lũy kế PnL
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                            viewMode === 'list'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                                : 'text-gray-400 hover:text-gray-200'
                        }`}
                    >
                        Danh sách thẻ
                    </button>
                </div>
            </div>

            {/* Quick Strip Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                <div className="bg-gray-950/70 border border-gray-800/90 rounded-lg p-2 flex items-center justify-between">
                    <span className="text-gray-400">Tỷ lệ Tăng / Giảm:</span>
                    <span className="font-bold flex items-center gap-1.5">
                        <span className="text-emerald-400">▲ {metrics.bullCount} ({metrics.bullRate.toFixed(0)}%)</span>
                        <span className="text-gray-600">/</span>
                        <span className="text-rose-400">▼ {metrics.bearCount} ({metrics.bearRate.toFixed(0)}%)</span>
                    </span>
                </div>
                <div className="bg-gray-950/70 border border-gray-800/90 rounded-lg p-2 flex items-center justify-between">
                    <span className="text-gray-400">E[R] TB 20 lần:</span>
                    <span className={`font-bold ${metrics.avgRet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {metrics.avgRet >= 0 ? '+' : ''}{metrics.avgRet.toFixed(2)}%
                    </span>
                </div>
                <div className="bg-gray-950/70 border border-gray-800/90 rounded-lg p-2 flex items-center justify-between">
                    <span className="text-gray-400">Tổng Lũy kế PnL:</span>
                    <span className={`font-bold ${metrics.totalCumRet >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}>
                        {metrics.totalCumRet >= 0 ? '+' : ''}{metrics.totalCumRet.toFixed(2)}%
                    </span>
                </div>
                <div className="bg-gray-950/70 border border-gray-800/90 rounded-lg p-2 flex items-center justify-between">
                    <span className="text-gray-400">Spread TB:</span>
                    <span className="text-amber-300 font-bold">
                        {metrics.avgSpread.toFixed(2)}%
                    </span>
                </div>
            </div>

            {/* Main Content Area */}
            {viewMode === 'bar' && (
                <div className="h-[230px] w-full bg-gray-950/50 rounded-lg border border-gray-800/60 p-1">
                    <ReactECharts option={comboOption} style={{ height: '100%', width: '100%' }} notMerge lazyUpdate />
                </div>
            )}

            {viewMode === 'cum' && (
                <div className="h-[230px] w-full bg-gray-950/50 rounded-lg border border-gray-800/60 p-1">
                    <ReactECharts option={cumOption} style={{ height: '100%', width: '100%' }} notMerge lazyUpdate />
                </div>
            )}

            {viewMode === 'list' && (
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1 bg-gray-950/40 p-2 rounded-lg border border-gray-800/60">
                    {occurrences.map((occ, idx) => {
                        const rawTime = occ.patternEndDate || (typeof occ.patternEndTime === 'number' ? (occ.patternEndTime < 10000000000 ? occ.patternEndTime * 1000 : occ.patternEndTime) : occ.patternEndTime);
                        const formattedTime = dayjs(rawTime).format(timeframe === 'D1' || timeframe === 'W1' ? 'DD/MM/YYYY' : 'DD/MM/YYYY HH:mm');
                        return (
                            <div
                                key={`${occ.patternEndDate}-${idx}`}
                                className="flex items-center gap-2 bg-gray-950/90 border border-gray-800 px-2.5 py-1.5 rounded-lg text-xs font-mono"
                            >
                                <span className="text-gray-500 font-semibold">#{occurrences.length - idx}</span>
                                <span className="text-gray-300 font-semibold">{formattedTime}</span>
                                <span className="text-gray-600">→</span>
                                <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                                    occ.nextDirection === 'up'
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : (occ.nextDirection === 'down' ? 'bg-rose-500/20 text-rose-300' : 'bg-gray-700 text-gray-300')
                                }`}>
                                    {occ.nextDirection === 'up' ? '▲ TĂNG' : (occ.nextDirection === 'down' ? '▼ GIẢM' : 'DOJI')}
                                </span>
                                {occ.nextReturn !== null && (
                                    <span className={`font-bold ${occ.nextReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {occ.nextReturn >= 0 ? '+' : ''}{occ.nextReturn.toFixed(2)}%
                                    </span>
                                )}
                                <span className="text-amber-400/80 text-[11px]">
                                    (Spread: {occ.nextSpreadPercent.toFixed(2)}%)
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default PatternOccurrencesChart;
