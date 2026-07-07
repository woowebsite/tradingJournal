import React, { useEffect, useMemo, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts';
import { calculateSMA } from '../indicators/movingAverages';
import { calculateSupertrend, drawSupertrend } from '../indicators/supertrend';

const getRuleId = (rule) => rule?.documentId || rule?.id || '';

const TradingViewChart = ({ data, symbol, signals = [], strategy = null }) => {
    const chartContainerRef = useRef(null);
    const volumeContainerRef = useRef(null);

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
                    text: rule.Name,
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

        // Sync Crosshairs
        chart.subscribeCrosshairMove((param) => {
            if (!param.time || param.point.x < 0 || param.point.y < 0) {
                volumeChart.clearCrosshairPosition();
            } else {
                const volData = volumeData.find(d => d.time === param.time);
                if (volData) {
                    volumeChart.setCrosshairPosition(volData.value, param.time, volumeSeries);
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

        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
            volumeChart.remove();
        };
    }, [data, symbol, signals, strategyRuleLookup]);

    return (
        <div className="flex flex-col w-full h-full relative border-t-0">
            {(!data || data.length === 0) && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500 z-10">
                    No data available
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
