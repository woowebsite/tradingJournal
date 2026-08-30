import React, { useEffect, useState, useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { getIntradayBidAsk } from '../services/tcbs';

const IntradayBidAskRatioMiniChart = ({ symbol = '41I1G9000', data = null, className = '' }) => {
    const [fetchedData, setFetchedData] = useState([]);

    const fetchData = useCallback(async () => {
        if (!symbol) return;
        try {
            const res = await getIntradayBidAsk(symbol, { mode: 'baAll' });
            const raw = res?.data && !Array.isArray(res.data) ? res.data : res;
            const obLog = Array.isArray(raw?.overBidAskLog) ? raw.overBidAskLog : (Array.isArray(res?.overBidAskLog) ? res.overBidAskLog : []);
            const listFromData = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);

            const unifiedMap = new Map();
            listFromData.forEach(item => {
                const tStr = String(item?.t || '');
                if (!tStr) return;
                const bs = Number(item.bs ?? item.bv) || 0;
                const oa = Number(item.oa ?? item.av) || 0;
                const total = bs + oa;
                const obp = typeof item.obp === 'number' ? item.obp : (total > 0 ? bs / total : 0.5);
                const osp = typeof item.osp === 'number' ? item.osp : (total > 0 ? oa / total : 1 - obp);
                unifiedMap.set(tStr, { t: tStr, s: Number(item.s) || 0, bs, oa, obp, osp });
            });
            obLog.forEach(item => {
                const tStr = String(item?.t || '');
                if (!tStr) return;
                const existing = unifiedMap.get(tStr) || { t: tStr, s: Number(item.s) || 0 };
                const bs = Number(item.bs) || existing.bs || 0;
                const oa = Number(item.oa) || existing.oa || 0;
                const total = bs + oa;
                const obp = typeof item.obp === 'number' ? item.obp : (existing.obp ?? (total > 0 ? bs / total : 0.5));
                const osp = typeof item.osp === 'number' ? item.osp : (existing.osp ?? (total > 0 ? oa / total : 1 - obp));
                unifiedMap.set(tStr, { ...existing, bs, oa, obp, osp });
            });

            const mergedList = Array.from(unifiedMap.values()).sort((a, b) => {
                if (a.t && b.t) return a.t.localeCompare(b.t);
                return (Number(a.s) || 0) - (Number(b.s) || 0);
            });
            setFetchedData(mergedList);
        } catch (e) {
            console.error('IntradayBidAskRatioMiniChart fetch error:', e);
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

    const { chartOption, latestRatio } = useMemo(() => {
        if (!activeData || activeData.length === 0) {
            return { chartOption: {}, latestRatio: null };
        }

        const times = [];
        const ratioValues = [];
        const baseline = 1.0;

        activeData.forEach(item => {
            times.push(item.t || '--:--');
            const bs = Number(item.bs ?? item.bv) || 0;
            const oa = Number(item.oa ?? item.av) || 0;
            const total = bs + oa;
            const obp = typeof item.obp === 'number' ? item.obp : (total > 0 ? bs / total : 0.5);
            const osp = typeof item.osp === 'number' ? item.osp : (total > 0 ? oa / total : 1 - obp);
            const ratio = osp > 0 ? Number((obp / osp).toFixed(3)) : (oa > 0 ? Number((bs / oa).toFixed(3)) : 1.0);
            ratioValues.push(ratio);
        });

        const COLOR_BUY = '#00E676';
        const COLOR_SELL = '#FF3B30';
        const COLOR_BASELINE = '#9CA3AF';

        const minVal = ratioValues.length > 0 ? Math.min(...ratioValues) : 0.5;
        const maxVal = ratioValues.length > 0 ? Math.max(...ratioValues) : 1.5;

        const rangeSpan = Math.max(Math.abs(maxVal - baseline), Math.abs(baseline - minVal), 0.15);
        const padding = Math.max(rangeSpan * 0.15, 0.05);

        const yMin = Math.max(0, Math.min(minVal, baseline) - padding);
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
                                Tỷ Lệ M/B: ${val.toFixed(3)}x
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
                min: Number(yMin.toFixed(2)),
                max: Number(yMax.toFixed(2)),
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: {
                    color: '#9CA3AF',
                    fontSize: 10,
                    formatter: (val) => `${Number(val).toFixed(2)}x`
                },
                splitLine: {
                    lineStyle: { color: '#1F2937', type: 'dashed', opacity: 0.4 }
                }
            },
            series: [
                {
                    name: 'Ratio',
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
                    data: ratioValues,
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
            latestRatio: ratioValues.length > 0 ? ratioValues[ratioValues.length - 1] : null
        };
    }, [activeData]);

    return (
        <div className={`flex flex-col bg-gray-950/80 border border-gray-800 rounded-xl p-3 h-[225px] relative shadow-inner ${className}`}>
            <div className="flex items-center justify-between px-1 mb-1 shrink-0">
                <span className="text-[11px] font-bold text-gray-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                    Tỷ Lệ Dư Mua / Dư Bán (Ratio)
                </span>
                {latestRatio !== null && (
                    <span className={`font-mono text-xs font-bold ${latestRatio >= 1 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {latestRatio.toFixed(3)}x
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
                        Đang tải dữ liệu Tỷ Lệ Dư Mua/Dư Bán...
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(IntradayBidAskRatioMiniChart);
