import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts';
import { calculateSMA } from '../indicators/movingAverages';
import { calculateSupertrend, drawSupertrend } from '../indicators/supertrend';

const getRuleId = (rule) => rule?.documentId || rule?.id || '';

const TradingViewChart = ({ data, symbol, signals = [], strategy = null }) => {
    const chartContainerRef = useRef(null);
    const volumeContainerRef = useRef(null);
    const [hoverTooltip, setHoverTooltip] = useState(null);

    const strategyRuleLookup = useMemo(() => {
        const lookup = new Map();
        const groups = [
            { name: 'entry', rules: strategy?.entryRules || [] },
            { name: 'takeprofit', rules: strategy?.takeProfitRules || [] },
            { name: 'stoploss', rules: strategy?.stoplossRules || [] },
            { name: 'exit', rules: strategy?.exitRules || [] }
        ];

        groups.forEach(group => {
            group.rules.forEach(rule => {
                const id = String(getRuleId(rule));
                if (id) lookup.set(id, group.name);
            });
        });

        return lookup;
    }, [strategy]);

    const signalsByDate = useMemo(() => {
        const map = new Map();
        if (!signals || signals.length === 0) return map;
        signals.forEach(sig => {
            const sigDate = sig.date ? sig.date.split('T')[0] : null;
            if (!sigDate) return;

            const rule = sig.rules && sig.rules.length > 0 ? sig.rules[0] : { Name: 'Signal' };
            const ruleId = String(getRuleId(rule));
            const type = strategyRuleLookup.get(ruleId) || 'unknown';

            const colors = {
                entry: '#60a5fa', // blue
                takeprofit: '#4ade80', // green
                stoploss: '#f87171', // red
                exit: '#fb923c', // orange
                unknown: '#9ca3af'
            };

            const list = map.get(sigDate) || [];
            list.push({
                name: rule.Name || 'Signal',
                type,
                date: sigDate,
                color: colors[type] || colors.unknown,
                rule
            });
            map.set(sigDate, list);
        });
        return map;
    }, [signals, strategyRuleLookup]);

    useEffect(() => {
        if (!data || data.length === 0) return;

        // Sort data by date ascending (oldest first) as required by lightweight-charts
        const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));

        // Format data for lightweight-charts
        const candleData = sortedData.map(item => ({
            time: item.date.split('T')[0], // YYYY-MM-DD
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
        }));

        const volumeData = sortedData.map(item => ({
            time: item.date.split('T')[0],
            value: item.volume,
            color: item.close >= item.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
        }));

        const commonChartOptions = {
            layout: {
                background: { type: ColorType.Solid, color: '#1f2937' }, // gray-800
                textColor: '#9ca3af',
            },
            grid: {
                vertLines: { color: '#374151', visible: false }, // gray-700
                horzLines: { color: '#374151', visible: false },
            },
            timeScale: {
                borderColor: '#4b5563',
                rightOffset: 20,
            },
            rightPriceScale: {
                borderColor: '#4b5563',
                autoScale: true,
            },
            crosshair: {
                mode: 0, // CrosshairMode.Normal
            }
        };

        const chart = createChart(chartContainerRef.current, {
            ...commonChartOptions,
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
        });

        // Hide time axis for the top chart
        chart.applyOptions({
            timeScale: {
                visible: false,
            },
        });

        const volumeChart = createChart(volumeContainerRef.current, {
            ...commonChartOptions,
            width: volumeContainerRef.current.clientWidth,
            height: volumeContainerRef.current.clientHeight,
        });

        // Candlestick Series
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#10b981', // emerald-500
            downColor: '#ef4444', // red-500
            borderVisible: false,
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
            priceFormat: {
                type: 'price',
                precision: 2,
                minMove: 0.01,
            },
        });
        candlestickSeries.setData(candleData);

        // MA20 Series
        const ma20Data = calculateSMA(candleData, 5);
        const ma20Series = chart.addSeries(LineSeries, {
            color: '#f59e0b', // amber-500
            lineWidth: 1,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
        });
        ma20Series.setData(ma20Data);

        // Supertrend Series
        const supertrendData = calculateSupertrend(10, 3, sortedData);
        drawSupertrend(chart, LineSeries, supertrendData);

        // Volume Series 
        const volumeSeries = volumeChart.addSeries(HistogramSeries, {
            color: '#26a69a',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: '', // Default axis
        });
        volumeSeries.setData(volumeData);

        // Sync price scale widths
        chart.priceScale('right').applyOptions({
            minimumWidth: 80,
        });

        volumeChart.priceScale('right').applyOptions({
            minimumWidth: 80,
        });

        // Markers (Signals)
        if (signals && signals.length > 0) {
            const markerGapRatio = 0.02;
            const markers = signals.map(sig => {
                const sigDate = sig.date.split('T')[0];
                const exists = sortedData.find(d => d.date.split('T')[0] === sigDate);
                if (!exists) return null;

                const rule = sig.rules && sig.rules.length > 0 ? sig.rules[0] : { Name: 'Signal' };
                const ruleId = String(getRuleId(rule));
                const type = strategyRuleLookup.get(ruleId) || 'unknown';

                const colors = {
                    entry: '#60a5fa', // blue
                    takeprofit: '#4ade80', // green
                    stoploss: '#f87171', // red
                    exit: '#fb923c', // orange
                    unknown: '#9ca3af'
                };

                const isEntry = type === 'entry';
                const price = isEntry
                    ? Number(exists.low) * (1 - markerGapRatio)
                    : Number(exists.high) * (1 + markerGapRatio);

                return {
                    time: sigDate,
                    position: isEntry ? 'atPriceBottom' : 'atPriceTop',
                    price,
                    color: colors[type] || colors.unknown,
                    shape: isEntry ? 'arrowUp' : 'arrowDown',
                    text: '', // Only show symbol icon, hide text from chart
                    size: 2
                };
            }).filter(Boolean);

            markers.sort((a, b) => (a.time > b.time ? 1 : -1));
            createSeriesMarkers(candlestickSeries, markers);
        }

        // Sync TimeScale
        const timeScale1 = chart.timeScale();
        const timeScale2 = volumeChart.timeScale();

        timeScale1.subscribeVisibleLogicalRangeChange((timeRange) => {
            if (timeRange) timeScale2.setVisibleLogicalRange(timeRange);
        });

        timeScale2.subscribeVisibleLogicalRangeChange((timeRange) => {
            if (timeRange) timeScale1.setVisibleLogicalRange(timeRange);
        });

        // Sync Crosshairs & Tooltip
        chart.subscribeCrosshairMove((param) => {
            if (!param.time || param.point.x < 0 || param.point.y < 0) {
                volumeChart.clearCrosshairPosition();
                setHoverTooltip(null);
            } else {
                const volData = volumeData.find(d => d.time === param.time);
                if (volData) {
                    volumeChart.setCrosshairPosition(volData.value, param.time, volumeSeries);
                }

                const dateStr = typeof param.time === 'string'
                    ? param.time
                    : (param.time?.year ? `${param.time.year}-${String(param.time.month).padStart(2, '0')}-${String(param.time.day).padStart(2, '0')}` : null);

                const activeSignals = dateStr ? signalsByDate.get(dateStr) : null;
                if (activeSignals && activeSignals.length > 0) {
                    setHoverTooltip({
                        x: param.point.x,
                        y: param.point.y,
                        date: dateStr,
                        signals: activeSignals
                    });
                } else {
                    setHoverTooltip(null);
                }
            }
        });

        volumeChart.subscribeCrosshairMove((param) => {
            if (!param.time || param.point.x < 0 || param.point.y < 0) {
                chart.clearCrosshairPosition();
            } else {
                const canData = candleData.find(d => d.time === param.time);
                if (canData) {
                    chart.setCrosshairPosition(canData.close, param.time, candlestickSeries);
                }
            }
        });

        // Handle Resize
        const handleResize = () => {
            if (chartContainerRef.current && volumeContainerRef.current) {
                chart.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight,
                });
                volumeChart.applyOptions({
                    width: volumeContainerRef.current.clientWidth,
                    height: volumeContainerRef.current.clientHeight,
                });
            }
        };

        const handleMouseLeave = () => {
            setHoverTooltip(null);
        };

        const chartContainer = chartContainerRef.current;
        if (chartContainer) {
            chartContainer.addEventListener('mouseleave', handleMouseLeave);
        }

        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            if (chartContainer) {
                chartContainer.removeEventListener('mouseleave', handleMouseLeave);
            }
            chart.remove();
            volumeChart.remove();
        };
    }, [data, symbol, signals, strategyRuleLookup, signalsByDate]);

    return (
        <div className="flex flex-col w-full h-full relative border-t-0">
            {(!data || data.length === 0) && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500 z-10">
                    No data available
                </div>
            )}

            {/* Hover Tooltip for Signal markers */}
            {hoverTooltip && hoverTooltip.signals && hoverTooltip.signals.length > 0 && (
                <div
                    className="absolute z-30 pointer-events-none bg-gray-900/95 border border-gray-700 rounded-lg p-2.5 shadow-2xl text-xs text-white space-y-1.5 min-w-[150px]"
                    style={{
                        left: Math.min(hoverTooltip.x + 15, (chartContainerRef.current?.clientWidth || 300) - 170),
                        top: Math.max(10, Math.min(hoverTooltip.y - 10, (chartContainerRef.current?.clientHeight || 300) - 100))
                    }}
                >
                    <div className="text-[11px] text-gray-400 font-semibold border-b border-gray-700/60 pb-1 flex justify-between items-center">
                        <span>📅 {hoverTooltip.date}</span>
                        <span className="text-[10px] text-blue-400 font-mono font-bold">SIGNAL</span>
                    </div>
                    {hoverTooltip.signals.map((sig, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                            <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: sig.color }}
                            />
                            <div className="flex flex-col">
                                <span className="font-semibold text-gray-100">{sig.name}</span>
                                <span className="text-[10px] uppercase font-bold" style={{ color: sig.color }}>
                                    {sig.type}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div
                ref={chartContainerRef}
                className="w-full flex-grow relative"
                style={{ flexBasis: '70%', flexShrink: 0 }}
            />

            <div className="w-full h-px bg-gray-700" />

            <div
                ref={volumeContainerRef}
                className="w-full relative"
                style={{ flexBasis: '30%', flexShrink: 0 }}
            />
        </div>
    );
};

export default TradingViewChart;
