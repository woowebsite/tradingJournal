import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts';
import { calculateSMA, drawMA } from '../indicators/movingAverages';
import { calculateSupertrend, drawSupertrend } from '../indicators/supertrend';
import { calculateIchimoku, drawIchimoku78 } from '../indicators/ichimoku/ichimoku';
import { calculateVWAP, drawVWAP } from '../indicators/vwap';
import { RefreshCw } from 'lucide-react';

const getRuleId = (rule) => rule?.documentId || rule?.id || '';

const TradingViewChart = ({
    data,
    symbol,
    signals = [],
    strategy = null,
    template = 'Supertrend',
    disableScrollZoom = false,
    disableChartMove = false,
    focusDate = null,
    vwapAnchor = 'Year',
    supertrendPeriod = 10,
    supertrendMultiplier = 3,
    maPeriod = 288,
    timeframe = 'D1',
    onLoadMore = null,
    isLoadingMore = false,
    hasMore = true,
    liveCandle = null
}) => {
    const chartContainerRef = useRef(null);
    const volumeContainerRef = useRef(null);
    const candlestickSeriesRef = useRef(null);
    const volumeSeriesRef = useRef(null);
    const previousVisibleLogicalRangeRef = useRef(null);
    const [hoverTooltip, setHoverTooltip] = useState(null);

    const onLoadMoreRef = useRef(onLoadMore);
    onLoadMoreRef.current = onLoadMore;
    const isLoadingMoreRef = useRef(isLoadingMore);
    isLoadingMoreRef.current = isLoadingMore;
    const hasMoreRef = useRef(hasMore);
    hasMoreRef.current = hasMore;

    const prevDataLengthRef = useRef(0);
    const prevFirstTimeRef = useRef(null);
    const prevSymbolRef = useRef(symbol);
    const prevTimeframeRef = useRef(timeframe);
    const lastLoadMoreTimeRef = useRef(0);

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

    const isIntraday = useMemo(() => {
        const tf = String(timeframe || '').toUpperCase();
        if (['M1', '1M', 'M5', '5M', 'M15', '15M', 'M30', '30M', 'H1', '1H', 'H4', '4H'].includes(tf)) return true;
        if (!data || data.length === 0) return false;
        return data.some(item => {
            const d = String(item.date || item.tradingDate || '');
            const t = String(item.time || '');
            return (d.includes('T') && !d.endsWith('T00:00:00.000Z') && !d.endsWith('T00:00:00Z')) || (t && t.includes(':') && t !== '00:00:00');
        });
    }, [data, timeframe]);

    const getTimeKey = useCallback((item) => {
        if (!item) return '';
        if (typeof item.time === 'number') return item.time;
        if (typeof item._timeKey === 'number') return item._timeKey;
        const rawDate = item.date || item.tradingDate || '';
        const rawTime = item.time || '';
        if (isIntraday) {
            let combined = rawDate;
            if (rawDate && rawTime && typeof rawTime === 'string' && rawTime.includes(':') && !String(rawDate).includes('T')) {
                combined = `${String(rawDate).split(' ')[0]}T${rawTime}Z`;
            } else if (!rawDate && rawTime) {
                combined = rawTime;
            }
            const dt = new Date(combined);
            return isNaN(dt.getTime()) ? String(rawDate || rawTime) : Math.floor(dt.getTime() / 1000);
        }
        return String(rawDate || rawTime).split('T')[0];
    }, [isIntraday]);

    const signalsByDate = useMemo(() => {
        const map = new Map();
        if (!signals || signals.length === 0) return map;
        signals.forEach(sig => {
            const sigKey = getTimeKey(sig);
            if (!sigKey) return;

            const rule = sig.rules && sig.rules.length > 0 ? sig.rules[0] : (sig.rule || { Name: 'Signal' });
            const ruleId = String(getRuleId(rule));
            const type = strategyRuleLookup.get(ruleId) || rule.Type || rule.type || sig.type || 'unknown';

            const colors = {
                entry: '#60a5fa', // blue
                takeprofit: '#4ade80', // green
                stoploss: '#f87171', // red
                exit: '#fb923c', // orange
                unknown: '#9ca3af'
            };

            const list = map.get(sigKey) || [];
            list.push({
                name: (rule.signalText || rule.signal_text)?.trim() || rule.Name || 'Signal',
                type,
                date: sigKey,
                color: colors[type] || colors.unknown,
                rule
            });
            map.set(sigKey, list);
        });
        return map;
    }, [signals, strategyRuleLookup, isIntraday]);

    useEffect(() => {
        if (!data || data.length === 0) return;

        // lightweight-charts requires strictly ascending, unique times.
        const sortedData = [...data]
            .map(item => ({ ...item, _timeKey: getTimeKey(item) }))
            .filter(item => item._timeKey !== undefined && item._timeKey !== null && item._timeKey !== '')
            .sort((a, b) => {
                if (typeof a._timeKey === 'number' && typeof b._timeKey === 'number') {
                    return a._timeKey - b._timeKey;
                }
                return String(a._timeKey).localeCompare(String(b._timeKey));
            })
            .reduce((unique, item) => {
                const previous = unique[unique.length - 1];
                if (!previous || previous._timeKey !== item._timeKey) {
                    unique.push(item);
                }
                return unique;
            }, []);

        // Format data for lightweight-charts
        const candleData = sortedData.map(item => ({
            time: item._timeKey,
            open: Number(item.open),
            high: Number(item.high),
            low: Number(item.low),
            close: Number(item.close),
            volume: Number(item.volume || 0),
        }));

        const volumeData = sortedData.map(item => ({
            time: item._timeKey,
            value: Number(item.volume || 0),
            color: Number(item.close) >= Number(item.open) ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
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
                timeVisible: isIntraday,
                secondsVisible: false,
            },
            rightPriceScale: {
                borderColor: '#4b5563',
                autoScale: true,
            },
            crosshair: {
                mode: 0, // CrosshairMode.Normal
            },
            handleScale: {
                mouseWheel: !disableScrollZoom,
            },
            handleScroll: {
                mouseWheel: !disableChartMove,
                pressedMouseMove: !disableChartMove,
                horzTouchDrag: !disableChartMove,
                vertTouchDrag: !disableChartMove,
            },
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
        candlestickSeriesRef.current = candlestickSeries;

        if (template === 'Ichimoku') {
            // Ichimoku Cloud (9, 26, 52, displacement 26)
            const ichimokuData = calculateIchimoku(candleData, {
                conversionPeriod: 26,
                basePeriod: 78,
            });
            drawIchimoku78(chart, LineSeries, ichimokuData, chartContainerRef.current, candlestickSeries);
            drawMA(chart, LineSeries, candleData, maPeriod || 78);
        } else if (template === 'VWAP') {
            const vwapData = calculateVWAP(candleData, vwapAnchor || 'Year');
            drawVWAP(chart, LineSeries, vwapData);
            drawMA(chart, LineSeries, candleData, maPeriod || 9, { lineWidth: 1.5, color: '#f59e0b' });
        } else {
            const supertrendData = calculateSupertrend(supertrendPeriod || 10, supertrendMultiplier || 3, candleData);
            drawSupertrend(chart, LineSeries, supertrendData);
            drawMA(chart, LineSeries, candleData, maPeriod || 288);
        }

        // Volume Series 
        const volumeSeries = volumeChart.addSeries(HistogramSeries, {
            color: '#26a69a',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: '', // Default axis
        });
        volumeSeries.setData(volumeData);
        volumeSeriesRef.current = volumeSeries;

        // Sync price scale widths
        chart.priceScale('right').applyOptions({
            minimumWidth: 80,
        });

        volumeChart.priceScale('right').applyOptions({
            minimumWidth: 80,
        });

        // Markers (Signals and an optional externally-selected candle)
        if ((signals && signals.length > 0) || focusDate) {
            const markers = signals.map(sig => {
                const sigKey = getTimeKey(sig);
                const exists = sortedData.some(d => d._timeKey === sigKey);
                if (!exists) return null;

                const rule = sig.rules && sig.rules.length > 0 ? sig.rules[0] : (sig.rule || { Name: 'Signal' });
                const ruleId = String(getRuleId(rule));
                const rawType = strategyRuleLookup.get(ruleId) || rule.Type || rule.type || sig.type || 'entry';
                const lowerType = String(rawType).toLowerCase();
                const posType = String(sig.posType || sig.pos_type || sig.type || rule.Name || '').toLowerCase();
                const isShort = posType.includes('short') || sig.type === 'Short' || sig.pos_type === 'Short';

                let color = '#10b981'; // Green
                let shape = 'arrowUp';
                let position = 'belowBar';
                let text = '';

                if (lowerType === 'takeprofit') {
                    color = '#3b82f6';
                    if (isShort) {
                        position = 'belowBar';
                        shape = 'arrowUp';
                    } else {
                        position = 'aboveBar';
                        shape = 'arrowDown';
                    }
                } else if (lowerType === 'stoploss') {
                    color = '#ef4444';
                    shape = 'circle';
                    position = isShort ? 'aboveBar' : 'belowBar';
                    text = '';
                } else if (isShort) {
                    color = '#ef4444';
                    shape = 'arrowDown';
                    position = 'aboveBar';
                } else {
                    color = '#10b981';
                    shape = 'arrowUp';
                    position = 'belowBar';
                }

                // Cho phép override nếu sig có chỉ định trực tiếp hợp lệ
                if (sig.color) color = sig.color;
                if (sig.shape && ['arrowUp', 'arrowDown', 'circle', 'square'].includes(sig.shape)) shape = sig.shape;
                if (sig.position && ['aboveBar', 'belowBar', 'inBar'].includes(sig.position)) position = sig.position;
                if (sig.text !== undefined && sig.text !== '') text = sig.text;

                return {
                    time: sigKey,
                    position,
                    color,
                    shape,
                    text,
                    size: 2
                };
            }).filter(Boolean);

            const focusKey = focusDate ? getTimeKey({ date: focusDate, time: focusDate }) : null;
            if (focusKey && sortedData.some(candle => candle._timeKey === focusKey)) {
                markers.push({
                    time: focusKey,
                    position: 'belowBar',
                    color: '#fbbf24',
                    shape: 'arrowUp',
                    text: 'Pattern',
                    size: 2.5,
                });
            }

            markers.sort((a, b) => {
                if (typeof a.time === 'number' && typeof b.time === 'number') {
                    return a.time - b.time;
                }
                return String(a.time).localeCompare(String(b.time));
            });
            createSeriesMarkers(candlestickSeries, markers);
        }

        // Sync TimeScale
        const timeScale1 = chart.timeScale();
        const timeScale2 = volumeChart.timeScale();

        timeScale1.subscribeVisibleLogicalRangeChange((timeRange) => {
            if (timeRange) {
                timeScale2.setVisibleLogicalRange(timeRange);
                previousVisibleLogicalRangeRef.current = timeRange;

                // Infinite historical scroll: when user scrolls near the leftmost boundary
                if (timeRange.from <= 12 && typeof onLoadMoreRef.current === 'function' && !isLoadingMoreRef.current && hasMoreRef.current !== false) {
                    const now = Date.now();
                    if (now - lastLoadMoreTimeRef.current > 1000) {
                        lastLoadMoreTimeRef.current = now;
                        onLoadMoreRef.current();
                    }
                }
            }
        });

        timeScale2.subscribeVisibleLogicalRangeChange((timeRange) => {
            if (timeRange) {
                timeScale1.setVisibleLogicalRange(timeRange);
                previousVisibleLogicalRangeRef.current = timeRange;
            }
        });

        const prevLength = prevDataLengthRef.current;
        const prevFirstTime = prevFirstTimeRef.current;
        const currentFirstTime = sortedData[0]?._timeKey;
        const prevSymbol = prevSymbolRef.current;
        const prevTf = prevTimeframeRef.current;

        const isSameDataset = prevSymbol === symbol && prevTf === timeframe;
        const isPrepend = isSameDataset && prevLength > 0 && sortedData.length > prevLength && currentFirstTime !== prevFirstTime;

        if (isPrepend && previousVisibleLogicalRangeRef.current) {
            const addedCount = sortedData.length - prevLength;
            const prevRange = previousVisibleLogicalRangeRef.current;
            const shiftedRange = {
                from: prevRange.from + addedCount,
                to: prevRange.to + addedCount,
            };
            timeScale1.setVisibleLogicalRange(shiftedRange);
            timeScale2.setVisibleLogicalRange(shiftedRange);
            previousVisibleLogicalRangeRef.current = shiftedRange;
        }

        prevDataLengthRef.current = sortedData.length;
        prevFirstTimeRef.current = currentFirstTime;
        prevSymbolRef.current = symbol;
        prevTimeframeRef.current = timeframe;

        const focusKey = focusDate ? getTimeKey({ date: focusDate, time: focusDate }) : null;
        const focusIndex = focusKey ? candleData.findIndex(candle => candle.time === focusKey) : -1;
        if (focusIndex >= 0) {
            const prevRange = previousVisibleLogicalRangeRef.current;
            // Preserve the user's current zoom level (number of visible bars), default to 80 bars
            const span = prevRange && (prevRange.to - prevRange.from > 5)
                ? (prevRange.to - prevRange.from)
                : 80;
            const halfSpan = span / 2;
            const visibleRange = {
                from: focusIndex - halfSpan,
                to: focusIndex + halfSpan,
            };
            timeScale1.setVisibleLogicalRange(visibleRange);
            timeScale2.setVisibleLogicalRange(visibleRange);
        }

        // Sync Crosshairs & Tooltip
        let isSyncingCrosshair = false;
        const volumeMap = new Map(volumeData.map(d => [d.time, d.value]));
        const candleMap = new Map(candleData.map(d => [d.time, d.close]));

        chart.subscribeCrosshairMove((param) => {
            if (isSyncingCrosshair) return;
            if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
                isSyncingCrosshair = true;
                volumeChart.clearCrosshairPosition();
                isSyncingCrosshair = false;
                setHoverTooltip(prev => (prev !== null ? null : prev));
            } else {
                const volVal = volumeMap.get(param.time);
                if (volVal !== undefined) {
                    isSyncingCrosshair = true;
                    volumeChart.setCrosshairPosition(volVal, param.time, volumeSeries);
                    isSyncingCrosshair = false;
                }

                const activeSignals = signalsByDate.get(param.time);
                if (activeSignals && activeSignals.length > 0) {
                    let dateDisplay = String(param.time);
                    if (typeof param.time === 'number') {
                        const dt = new Date(param.time * 1000);
                        dateDisplay = dt.toISOString().replace('T', ' ').substring(0, 19);
                    } else if (param.time?.year) {
                        dateDisplay = `${param.time.year}-${String(param.time.month).padStart(2, '0')}-${String(param.time.day).padStart(2, '0')}`;
                    }

                    const posX = Math.round(param.point.x);
                    const posY = Math.round(param.point.y);

                    setHoverTooltip(prev => {
                        if (
                            prev &&
                            prev.time === param.time &&
                            Math.abs(prev.x - posX) < 4 &&
                            Math.abs(prev.y - posY) < 4
                        ) {
                            return prev;
                        }
                        return {
                            time: param.time,
                            x: posX,
                            y: posY,
                            date: dateDisplay,
                            signals: activeSignals,
                            chartWidth: chartContainerRef.current?.clientWidth || 300,
                            chartHeight: chartContainerRef.current?.clientHeight || 300,
                        };
                    });
                } else {
                    setHoverTooltip(prev => (prev !== null ? null : prev));
                }
            }
        });

        volumeChart.subscribeCrosshairMove((param) => {
            if (isSyncingCrosshair) return;
            if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
                isSyncingCrosshair = true;
                chart.clearCrosshairPosition();
                isSyncingCrosshair = false;
            } else {
                const canClose = candleMap.get(param.time);
                if (canClose !== undefined) {
                    isSyncingCrosshair = true;
                    chart.setCrosshairPosition(canClose, param.time, candlestickSeries);
                    isSyncingCrosshair = false;
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
            setHoverTooltip(prev => (prev !== null ? null : prev));
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
            candlestickSeriesRef.current = null;
            volumeSeriesRef.current = null;
            chart.remove();
            volumeChart.remove();
        };
    }, [data, symbol, signals, strategyRuleLookup, signalsByDate, template, vwapAnchor, disableScrollZoom, disableChartMove, focusDate, timeframe, supertrendPeriod, supertrendMultiplier, maPeriod, getTimeKey]);

    // Live Realtime Kline Update Effect
    useEffect(() => {
        if (!liveCandle || !candlestickSeriesRef.current) return;
        try {
            const timeKey = getTimeKey(liveCandle);
            if (!timeKey) return;
            candlestickSeriesRef.current.update({
                time: timeKey,
                open: Number(liveCandle.open),
                high: Number(liveCandle.high),
                low: Number(liveCandle.low),
                close: Number(liveCandle.close),
            });
            if (volumeSeriesRef.current && liveCandle.volume !== undefined) {
                volumeSeriesRef.current.update({
                    time: timeKey,
                    value: Number(liveCandle.volume || 0),
                    color: Number(liveCandle.close) >= Number(liveCandle.open) ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
                });
            }
        } catch (e) {
            console.warn('[Realtime Chart Update Warning]', e?.message || e);
        }
    }, [liveCandle, isIntraday]);

    return (
        <div className="flex flex-col w-full h-full relative border-t-0">
            {isLoadingMore && (
                <div className="absolute top-3 left-3 z-30 flex items-center gap-2 bg-gray-900/90 border border-purple-500/40 text-purple-300 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xl animate-pulse pointer-events-none">
                    <RefreshCw size={14} className="animate-spin text-purple-400" />
                    <span>Đang tải thêm nến quá khứ...</span>
                </div>
            )}

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
                        left: Math.min(hoverTooltip.x + 15, hoverTooltip.chartWidth - 170),
                        top: Math.max(10, Math.min(hoverTooltip.y - 10, hoverTooltip.chartHeight - 100))
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

export default React.memo(TradingViewChart);
