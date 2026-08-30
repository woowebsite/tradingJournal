import React, { useEffect, useState, useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { getIntradayBSA } from '../services/tcbs';

const IntradayCumDeltaMiniChart = ({ symbol = '41I1G9000', data = null, className = '' }) => {
    const [fetchedData, setFetchedData] = useState([]);

    const fetchData = useCallback(async () => {
        if (!symbol) return;
        try {
            const res = await getIntradayBSA(symbol, { timeWindow: '5', tWindow: '60m', type: 'all' });
            const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            setFetchedData(list);
        } catch (e) {
            console.error('IntradayCumDeltaMiniChart fetch error:', e);
        }
    }, [symbol]);

    useEffect(() => {
        if (!data || data.length === 0) {
            fetchData();
            const interval = setInterval(fetchData, 15000);
            return () => clearInterval(interval);
        }
    }, [symbol, data, fetchData]);

    const activeData = useMemo(() => {
        if (Array.isArray(data) && data.length > 0) return data;
        return fetchedData;
    }, [data, fetchedData]);

    const { chartOption, latestCumDelta } = useMemo(() => {
        if (!activeData || activeData.length === 0) {
            return { chartOption: {}, latestCumDelta: null };
        }

        // Chronological order (earliest to latest)
        const sorted = [...activeData].sort((a, b) => (Number(a.s) || 0) - (Number(b.s) || 0));
        const times = [];
        const numericValues = [];
        let cumDelta = 0;
        const baseline = 0;

        sorted.forEach(item => {
            times.push(item.t || '--:--');
            const bms = Number(item.bms) || 0;
            const sms = Number(item.sms) || 0;
            const netVol = bms - sms;
            cumDelta += netVol;
            numericValues.push(cumDelta);
        });

        const COLOR_BUY = '#00E676';
        const COLOR_SELL = '#FF3B30';
        const COLOR_BASELINE = '#9CA3AF';

        const minVal = numericValues.length > 0 ? Math.min(...numericValues) : -10;
        const maxVal = numericValues.length > 0 ? Math.max(...numericValues) : 10;

        const rangeSpan = Math.max(Math.abs(maxVal - baseline), Math.abs(baseline - minVal), 5);
        const padding = Math.max(rangeSpan * 0.15, 2);

        const yMin = Math.min(minVal, baseline) - padding;
        const yMax = Math.max(maxVal, baseline) + padding;

        let colorStops = [];
        if (minVal >= baseline) {
            colorStops = [
                { offset: 0, color: COLOR_BUY },
                { offset: 1, color: COLOR_BUY }
            ];
        } else if (maxVal <= baseline) {
            colorStops = [
                { offset: 0, color: COLOR_SELL },
                { offset: 1, color: COLOR_SELL }
            ];
        } else {
            const dataSpan = maxVal - minVal;
            const baselineRatio = dataSpan > 0 ? (maxVal - baseline) / dataSpan : 0.5;
            const clampedRatio = Math.max(0.001, Math.min(0.999, baselineRatio));
            colorStops = [
                { offset: 0, color: COLOR_BUY },
                { offset: Math.max(0, clampedRatio - 0.001), color: COLOR_BUY },
                { offset: Math.min(1, clampedRatio + 0.001), color: COLOR_SELL },
                { offset: 1, color: COLOR_SELL }
            ];
        }

        const opt = {
            backgroundColor: 'transparent',
            animation: false,
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(17, 24, 39, 0.95)',
                borderColor: '#374151',
                borderWidth: 1,
                padding: [6, 10],
                textStyle: { color: '#F3F4F6', fontSize: 11 },
                formatter: (params) => {
                    const param = params[0];
                    if (!param) return '';
                    const val = Number(param.value);
                    const isBull = val > baseline;
                    return `
                        <div style="font-family: ui-sans-serif, system-ui, sans-serif;">
                            <div style="color: #9CA3AF; margin-bottom: 2px; font-size: 10px;">⏰ ${param.name}</div>
                            <div style="font-weight: 700; color: ${isBull ? '#34D399' : '#F87171'}; font-size: 12px;">
                                Cum Delta: ${val > 0 ? '+' : ''}${val.toLocaleString()} CP
                            </div>
                        </div>
                    `;
                }
            },
            grid: {
                left: '2%',
                right: '3%',
                top: '10%',
                bottom: '15%',
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
                    fontSize: 10,
                    interval: Math.max(1, Math.floor(times.length / 6)),
                    showMaxLabel: true
                },
                splitLine: {
                    show: true,
                    lineStyle: { color: '#1F2937', type: 'dashed', opacity: 0.4 }
                }
            },
            yAxis: {
                type: 'value',
                min: Math.floor(yMin),
                max: Math.ceil(yMax),
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: {
                    color: '#9CA3AF',
                    fontSize: 10,
                    formatter: (val) => {
                        if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                        if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
                        return val;
                    }
                },
                splitLine: {
                    lineStyle: { color: '#1F2937', type: 'dashed', opacity: 0.4 }
                }
            },
            series: [
                {
                    name: 'Cum Delta',
                    type: 'line',
                    smooth: 0.22,
                    symbol: 'none',
                    emphasis: { disabled: true },
                    lineStyle: {
                        width: 2.2,
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops,
                            global: false
                        },
                        shadowColor: 'rgba(0, 0, 0, 0.4)',
                        shadowBlur: 4
                    },
                    data: numericValues,
                    markLine: {
                        symbol: ['none', 'none'],
                        silent: true,
                        lineStyle: {
                            color: COLOR_BASELINE,
                            width: 1,
                            type: 'dashed'
                        },
                        data: [{ yAxis: baseline }]
                    }
                }
            ]
        };

        return {
            chartOption: opt,
            latestCumDelta: numericValues.length > 0 ? numericValues[numericValues.length - 1] : null
        };
    }, [activeData]);

    return (
        <div className={`flex flex-col bg-gray-950/80 border border-gray-800 rounded-xl p-3 h-[225px] relative shadow-inner ${className}`}>
            <div className="flex items-center justify-between px-1 mb-1 shrink-0">
                <span className="text-[11px] font-bold text-gray-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    Tích Lũy Cung Cầu (Cum Delta)
                </span>
                {latestCumDelta !== null && (
                    <span className={`font-mono text-xs font-bold ${latestCumDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {latestCumDelta > 0 ? '+' : ''}{latestCumDelta.toLocaleString()} CP
                    </span>
                )}
            </div>
            <div className="flex-1 min-h-0 w-full">
                {activeData && activeData.length > 0 ? (
                    <ReactECharts
                        option={chartOption}
                        style={{ height: '100%', width: '100%' }}
                        opts={{ renderer: 'canvas' }}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-600 text-xs italic">
                        Đang tải dữ liệu Cum Delta...
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(IntradayCumDeltaMiniChart);
