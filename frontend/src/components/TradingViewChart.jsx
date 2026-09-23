import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import dayjs from 'dayjs';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts';
import { calculateSMA, drawMA } from '../indicators/movingAverages';
import { calculateSupertrend, drawSupertrend } from '../indicators/supertrend';
import { calculateIchimoku, drawIchimoku78 } from '../indicators/ichimoku/ichimoku';
import { calculateVWAP, drawVWAP } from '../indicators/vwap';
import { RefreshCw } from 'lucide-react';
import { formatPriceDisplay, getSignalMarkerConfig } from '../utils/chartSignals';

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
    maPeriod = null,
    showMA = false,
    showVWAP = false,
    showSupertrend = true,
    timeframe = 'D1',
    wfaHighlightZone = null,
    onLoadMore = null,
    isLoadingMore = false,
    hasMore = true,
    liveCandle = null
}) => {
    const chartContainerRef = useRef(null);
    const volumeContainerRef = useRef(null);
    const chartRef = useRef(null);
    const candlestickSeriesRef = useRef(null);
    const volumeSeriesRef = useRef(null);
    const savedLogicalRangeMapRef = useRef({});
    const [hoverTooltip, setHoverTooltip] = useState(null);
    const [wfaBoxCoords, setWfaBoxCoords] = useState(null);

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

    // Find the corresponding candle time for a trade / signal (handles exact match, intraday bar span, and daily dates)
    const findMatchingCandleTime = useCallback((sig, sortedCandles) => {
        if (!sig || !sortedCandles || sortedCandles.length === 0) return null;
        const rawDate = sig.date || sig.tradingDate || sig.time || '';
        if (!rawDate && sig.time === undefined) return null;

        // 1. Direct match on getTimeKey
        const directKey = getTimeKey(sig);
        if (directKey !== '' && directKey !== null && directKey !== undefined) {
            const exact = sortedCandles.find(c => c._timeKey === directKey);
            if (exact) return exact._timeKey;
        }

        // 2. Intraday matching (when candles have numeric timestamps in seconds)
        if (isIntraday) {
            let sigSeconds = null;
            if (typeof directKey === 'number') {
                sigSeconds = directKey;
            } else if (typeof sig.time === 'number') {
                sigSeconds = sig.time > 1e11 ? Math.floor(sig.time / 1000) : sig.time;
            } else if (rawDate) {
                let parseable = String(rawDate).trim();
                const rawTime = String(sig.time || '').trim();
                if (parseable && rawTime && rawTime.includes(':') && !parseable.includes('T') && !parseable.includes(':')) {
                    parseable = `${parseable.split(' ')[0]}T${rawTime}Z`;
                }
                const dt = new Date(parseable);
                if (!isNaN(dt.getTime())) {
                    sigSeconds = Math.floor(dt.getTime() / 1000);
                }
            }

            const numericCandles = sortedCandles.filter(c => typeof c._timeKey === 'number');
            if (typeof sigSeconds === 'number' && numericCandles.length > 0) {
                const firstCandle = numericCandles[0];
                const lastCandle = numericCandles[numericCandles.length - 1];

                // If signal is strictly before the earliest loaded candle, it's outside chart range
                if (sigSeconds < firstCandle._timeKey) {
                    return null;
                }

                // Estimate bar interval in seconds (default to 300s / 5m if only 1 candle)
                let barInterval = 300;
                if (numericCandles.length >= 2) {
                    const diff = numericCandles[1]._timeKey - numericCandles[0]._timeKey;
                    if (diff > 0 && diff < 86400) {
                        barInterval = diff;
                    }
                }

                // If signal is on or after the last candle
                if (sigSeconds >= lastCandle._timeKey) {
                    // Only attach to last candle if it's within the current bar span (or max 2 intervals)
                    if (sigSeconds <= lastCandle._timeKey + Math.max(barInterval * 2, 600)) {
                        return lastCandle._timeKey;
                    }
                    // Otherwise it belongs to a future bar not yet loaded on the chart
                    return null;
                }

                // Binary search or find the bar: candle._timeKey <= sigSeconds < nextCandle._timeKey
                for (let i = 0; i < numericCandles.length - 1; i++) {
                    const current = numericCandles[i];
                    const next = numericCandles[i + 1];
                    if (sigSeconds >= current._timeKey && sigSeconds < next._timeKey) {
                        return current._timeKey;
                    }
                }

                if (sigSeconds >= lastCandle._timeKey) {
                    return lastCandle._timeKey;
                }

                return null;
            }

            // If signal has date only ('YYYY-MM-DD') without intraday time, match the first bar of that date
            const sigDateStr = String(rawDate).split('T')[0].split(' ')[0];
            if (sigDateStr && sigDateStr.length === 10) {
                const dateMatch = numericCandles.find(c => {
                    const dt = new Date(c._timeKey * 1000);
                    const cDateStr = dt.toISOString().split('T')[0];
                    return cDateStr === sigDateStr;
                });
                if (dateMatch) return dateMatch._timeKey;
            }

            return null;
        }

        // 3. Daily / Date string matching ('YYYY-MM-DD')
        let sigDateStr = '';
        if (typeof sig.time === 'number') {
            const dt = new Date(sig.time > 1e11 ? sig.time : sig.time * 1000);
            if (!isNaN(dt.getTime())) {
                sigDateStr = dt.toISOString().split('T')[0];
            }
        } else {
            sigDateStr = String(rawDate).split('T')[0].split(' ')[0];
        }

        if (sigDateStr) {
            const dateMatch = sortedCandles.find(c => String(c._timeKey).split('T')[0].split(' ')[0] === sigDateStr);
            if (dateMatch) {
                return dateMatch._timeKey;
            }

            // Try local date string
            try {
                const dt = new Date(rawDate);
                if (!isNaN(dt.getTime())) {
                    const localStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                    const localMatch = sortedCandles.find(c => String(c._timeKey).split('T')[0].split(' ')[0] === localStr);
                    if (localMatch) return localMatch._timeKey;
                }
            } catch {
                // ignore
            }
        }

        return null;
    }, [getTimeKey, isIntraday]);

    const signalsByDate = useMemo(() => {
        const map = new Map();
        if (!signals || signals.length === 0 || !data || data.length === 0) return map;

        const sortedCandles = [...data]
            .map(item => ({ ...item, _timeKey: getTimeKey(item) }))
            .filter(item => item._timeKey !== undefined && item._timeKey !== null && item._timeKey !== '');

        signals.forEach(sig => {
            const matchedTime = findMatchingCandleTime(sig, sortedCandles);
            if (!matchedTime) return;

            const rule = sig.rules && sig.rules.length > 0 ? sig.rules[0] : (sig.rule || { Name: 'Signal' });
            const ruleId = String(getRuleId(rule));
            const type = strategyRuleLookup.get(ruleId) || rule.Type || rule.type || sig.type || 'entry';

            const colors = {
                entry: '#10b981', // green
                takeprofit: '#3b82f6', // blue
                stoploss: '#fb923c', // white
                exit: '#fb923c', // orange
                unknown: '#9ca3af'
            };

            const list = map.get(matchedTime) || [];
            list.push({
                name: sig.name || (rule.signalText || rule.signal_text)?.trim() || rule.Name || sig.text || sig.action || 'Executed Trade',
                type,
                date: matchedTime,
                color: sig.color || colors[type] || colors.unknown,
                price: sig.price ?? rule.price,
                entry: sig.entry ?? rule.entry,
                exitPrice: sig.exitPrice ?? sig.exit_price ?? rule.exitPrice,
                stopLoss: sig.stopLoss ?? sig.stop_loss ?? rule.stopLoss ?? rule.stop_loss,
                takeProfit: sig.takeProfit ?? sig.take_profit ?? rule.takeProfit ?? rule.take_profit,
                pnlPercent: sig.pnlPercent ?? sig.pnl_percent ?? rule.pnlPercent ?? rule.pnl_percent,
                pnlAmount: sig.pnlAmount ?? sig.pnl_amount ?? rule.pnlAmount ?? rule.pnl_amount,
                posType: sig.posType ?? sig.pos_type ?? rule.posType,
                action: sig.action,
                volume: sig.volume,
                status: sig.status,
                rule
            });
            map.set(matchedTime, list);
        });
        return map;
    }, [signals, data, findMatchingCandleTime, getTimeKey, strategyRuleLookup]);

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
        chartRef.current = chart;

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

        const tmpl = String(template || '').toLowerCase();
        const hasIchimoku = tmpl.includes('ichimoku');
        const hasVWAP = Boolean(showVWAP || tmpl === 'vwap' || tmpl.includes('supertrend_vwap') || tmpl.includes('breakout'));
        const isVwapOnly = tmpl === 'vwap';
        const hasSupertrend = showSupertrend === true || (showSupertrend !== false && !isVwapOnly && !hasIchimoku);

        // MA is drawn ONLY IF maPeriod is valid AND (showMA is true OR template is Supertrend_MA, VWAP, Ichimoku) AND showMA is not false
        const shouldDrawMA = Boolean(maPeriod) && showMA !== false && (
            showMA === true ||
            tmpl === 'supertrend_ma' ||
            tmpl === 'vwap' ||
            tmpl.includes('ma') ||
            hasIchimoku
        );

        if (hasIchimoku) {
            // Ichimoku Cloud (9, 26, 52, displacement 26)
            const ichimokuData = calculateIchimoku(candleData, {
                conversionPeriod: 26,
                basePeriod: 78,
            });
            drawIchimoku78(chart, LineSeries, ichimokuData, chartContainerRef.current, candlestickSeries);
            if (shouldDrawMA) {
                drawMA(chart, LineSeries, candleData, maPeriod || 78);
            }
        } else {
            if (hasSupertrend) {
                const supertrendData = calculateSupertrend(supertrendPeriod || 10, supertrendMultiplier || 3, candleData);
                drawSupertrend(chart, LineSeries, supertrendData);
            }
            if (hasVWAP) {
                const vwapData = calculateVWAP(candleData, vwapAnchor || 'Year');
                drawVWAP(chart, LineSeries, vwapData);
            }
            if (shouldDrawMA) {
                const maOpts = tmpl === 'vwap' ? { lineWidth: 1.5, color: '#f59e0b' } : {};
                drawMA(chart, LineSeries, candleData, maPeriod, maOpts);
            }
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
            const rawMarkers = (signals || []).map(sig => {
                const matchedTime = findMatchingCandleTime(sig, sortedData);
                if (!matchedTime) return null;

                const rule = sig.rules && sig.rules.length > 0 ? sig.rules[0] : (sig.rule || { Name: 'Signal' });
                const ruleId = String(getRuleId(rule));
                const rawType = strategyRuleLookup.get(ruleId) || rule.Type || rule.type || sig.type || 'entry';
                const posType = sig.posType || sig.pos_type || rule.posType || (String(sig.type || '').includes('short') ? 'Short' : 'Long');

                const cfg = getSignalMarkerConfig({
                    type: rawType,
                    posType,
                    action: sig.action
                });

                const color = sig.color || cfg.color;
                const shape = sig.shape && ['arrowUp', 'arrowDown', 'circle', 'square'].includes(sig.shape) ? sig.shape : cfg.shape;
                const position = sig.position && ['aboveBar', 'belowBar', 'inBar'].includes(sig.position) ? sig.position : cfg.position;
                const text = sig.text !== undefined && sig.text !== '' ? sig.text : cfg.shortLabel;

                return {
                    time: matchedTime,
                    position,
                    color,
                    shape,
                    text, // On chart: ONLY "Long", "Short", "TP", "SL", "Exit"
                    size: 1
                };
            }).filter(Boolean);

            // Deduplicate markers on same candle and position with identical text & shape to avoid stacked duplicate markers
            const markerMap = new Map();
            rawMarkers.forEach(m => {
                const key = `${m.time}_${m.position}_${m.text}_${m.shape}_${m.color}`;
                if (!markerMap.has(key)) {
                    markerMap.set(key, m);
                }
            });
            const markers = Array.from(markerMap.values());

            const focusKey = focusDate ? getTimeKey({ date: focusDate, time: focusDate }) : null;
            if (focusKey && sortedData.some(candle => candle._timeKey === focusKey)) {
                markers.push({
                    time: focusKey,
                    position: 'belowBar',
                    color: '#fbbf24',
                    shape: 'arrowUp',
                    text: 'Pattern',
                    size: 1.5,
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

        // Sync TimeScale & Zoom Range
        const timeScale1 = chart.timeScale();
        const timeScale2 = volumeChart.timeScale();
        const rangeKey = `${symbol || 'DEFAULT'}_${timeframe || 'D'}`;
        let isChartReady = false;
        let isSyncingTimeScale = false;
        const totalBars = candleData.length;

        timeScale1.subscribeVisibleLogicalRangeChange((timeRange) => {
            if (!timeRange) return;
            if (!isSyncingTimeScale) {
                isSyncingTimeScale = true;
                timeScale2.setVisibleLogicalRange(timeRange);
                isSyncingTimeScale = false;
            }

            const isAutoFitSquash = totalBars > 90 && (timeRange.to - timeRange.from) >= (totalBars - 5);
            if (isChartReady && !isAutoFitSquash && timeRange.to > timeRange.from) {
                savedLogicalRangeMapRef.current[rangeKey] = {
                    from: timeRange.from,
                    to: timeRange.to,
                };
            }
            computeWfaCoords();

            // Infinite historical scroll: when user scrolls near the leftmost boundary
            if (timeRange.from <= 12 && typeof onLoadMoreRef.current === 'function' && !isLoadingMoreRef.current && hasMoreRef.current !== false) {
                const now = Date.now();
                if (now - lastLoadMoreTimeRef.current > 1000) {
                    lastLoadMoreTimeRef.current = now;
                    onLoadMoreRef.current();
                }
            }
        });

        timeScale2.subscribeVisibleLogicalRangeChange((timeRange) => {
            if (!timeRange) return;
            if (!isSyncingTimeScale) {
                isSyncingTimeScale = true;
                timeScale1.setVisibleLogicalRange(timeRange);
                isSyncingTimeScale = false;
            }

            const isAutoFitSquash = totalBars > 90 && (timeRange.to - timeRange.from) >= (totalBars - 5);
            if (isChartReady && !isAutoFitSquash && timeRange.to > timeRange.from) {
                savedLogicalRangeMapRef.current[rangeKey] = {
                    from: timeRange.from,
                    to: timeRange.to,
                };
            }
            computeWfaCoords();
        });

        const prevLength = prevDataLengthRef.current;
        const prevFirstTime = prevFirstTimeRef.current;
        const currentFirstTime = sortedData[0]?._timeKey;
        const prevSymbol = prevSymbolRef.current;
        const prevTf = prevTimeframeRef.current;

        const isSameDataset = prevSymbol === symbol && prevTf === timeframe;
        const isPrepend = isSameDataset && prevLength > 0 && sortedData.length > prevLength && currentFirstTime !== prevFirstTime;

        prevDataLengthRef.current = sortedData.length;
        prevFirstTimeRef.current = currentFirstTime;
        prevSymbolRef.current = symbol;
        prevTimeframeRef.current = timeframe;

        let focusIndex = -1;
        if (focusDate) {
            const matchedTime = findMatchingCandleTime({ date: focusDate, time: focusDate }, sortedData);
            if (matchedTime !== null && matchedTime !== undefined) {
                focusIndex = candleData.findIndex(candle => candle.time === matchedTime);
            }
            if (focusIndex < 0 && sortedData.length > 0) {
                const targetMs = typeof focusDate === 'number'
                    ? (focusDate > 1e11 ? focusDate : focusDate * 1000)
                    : new Date(String(focusDate)).getTime();
                if (!isNaN(targetMs)) {
                    let minDiff = Infinity;
                    let closestIdx = -1;
                    sortedData.forEach((candle, idx) => {
                        let candleMs = 0;
                        if (typeof candle._timeKey === 'number') {
                            candleMs = candle._timeKey * 1000;
                        } else {
                            candleMs = new Date(String(candle._timeKey)).getTime();
                        }
                        if (!isNaN(candleMs)) {
                            const diff = Math.abs(candleMs - targetMs);
                            if (diff < minDiff) {
                                minDiff = diff;
                                closestIdx = idx;
                            }
                        }
                    });
                    focusIndex = closestIdx;
                }
            }
        }

        const prevSavedRange = savedLogicalRangeMapRef.current[rangeKey];

        const applyTargetRange = (targetRange) => {
            if (!targetRange) return;
            try {
                timeScale1.setVisibleLogicalRange(targetRange);
                timeScale2.setVisibleLogicalRange(targetRange);
            } catch (e) {
                // ignore
            }
        };

        if (focusIndex >= 0) {
            const span = prevSavedRange && (prevSavedRange.to - prevSavedRange.from > 5)
                ? (prevSavedRange.to - prevSavedRange.from)
                : 80;
            const halfSpan = span / 2;
            const visibleRange = {
                from: focusIndex - halfSpan,
                to: focusIndex + halfSpan,
            };
            applyTargetRange(visibleRange);
            savedLogicalRangeMapRef.current[rangeKey] = visibleRange;
        } else if (isSameDataset && prevSavedRange) {
            // Restore user's current zoom & pan position instead of resetting to default
            let targetRange = { ...prevSavedRange };
            if (isPrepend) {
                const addedCount = sortedData.length - prevLength;
                targetRange.from += addedCount;
                targetRange.to += addedCount;
            } else if (prevLength > 0 && sortedData.length > prevLength) {
                const addedCount = sortedData.length - prevLength;
                // If user was looking at latest candles (near right edge), auto advance
                if (prevSavedRange.to >= prevLength - 3) {
                    targetRange.from += addedCount;
                    targetRange.to += addedCount;
                }
            }
            applyTargetRange(targetRange);
            savedLogicalRangeMapRef.current[rangeKey] = targetRange;
            requestAnimationFrame(() => applyTargetRange(targetRange));
        } else if (totalBars > 0) {
            // Initial load or symbol/timeframe switch: default to readable recent 80 candles with 5-bar padding
            const defaultRange = {
                from: Math.max(0, totalBars - 80),
                to: totalBars + 5,
            };
            applyTargetRange(defaultRange);
            savedLogicalRangeMapRef.current[rangeKey] = defaultRange;
            requestAnimationFrame(() => applyTargetRange(defaultRange));
        }

        // Allow user pan/zoom interactions to be saved after initial layout finishes
        setTimeout(() => {
            isChartReady = true;
        }, 200);

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
    }, [liveCandle, isIntraday, getTimeKey]);

    // Recompute pixel coordinates for the WFA Validation Zone Box
    const computeWfaCoords = useCallback(() => {
        if (!wfaHighlightZone || !chartRef.current || !data || data.length === 0) {
            setWfaBoxCoords(null);
            return;
        }
        const timeScale = chartRef.current.timeScale();
        if (!timeScale) return;

        const startTs = typeof wfaHighlightZone.startTime === 'number'
            ? wfaHighlightZone.startTime
            : new Date(wfaHighlightZone.startTime).getTime();
        const splitTs = typeof wfaHighlightZone.splitTime === 'number'
            ? wfaHighlightZone.splitTime
            : new Date(wfaHighlightZone.splitTime).getTime();
        const endTs = typeof wfaHighlightZone.endTime === 'number'
            ? wfaHighlightZone.endTime
            : new Date(wfaHighlightZone.endTime).getTime();

        const findNearestCandleKey = (targetMs) => {
            if (!targetMs || isNaN(targetMs) || data.length === 0) return null;
            let closestKey = null;
            let minDiff = Infinity;
            for (let i = 0; i < data.length; i++) {
                const item = data[i];
                const key = getTimeKey(item);
                if (key === undefined || key === null || key === '') continue;
                let candleMs = 0;
                if (typeof key === 'number') {
                    candleMs = key * 1000;
                } else {
                    candleMs = new Date(String(key)).getTime();
                }
                if (isNaN(candleMs)) continue;
                const diff = Math.abs(candleMs - targetMs);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestKey = key;
                }
            }
            return closestKey;
        };

        let startKey = null;
        let splitKey = null;
        let endKey = null;

        // If D1 or specific dateKey is defined, match against all candles belonging to this calendar date
        let targetDateStr = wfaHighlightZone.dateKey || '';
        if (!targetDateStr && wfaHighlightZone.wfaTf === 'D1' && wfaHighlightZone.startTime) {
            try {
                targetDateStr = new Date(wfaHighlightZone.startTime).toISOString().substring(0, 10);
            } catch (e) {
                targetDateStr = dayjs(wfaHighlightZone.startTime).format('YYYY-MM-DD');
            }
        }

        let periodCandles = [];
        if (targetDateStr) {
            periodCandles = data.filter(item => {
                const key = getTimeKey(item);
                if (typeof key === 'number') {
                    try {
                        const cDateStr = new Date(key * 1000).toISOString().substring(0, 10);
                        return cDateStr === targetDateStr;
                    } catch (e) {
                        return false;
                    }
                }
                const rawDate = item.date || item.datetime || item.time;
                if (typeof rawDate === 'string') {
                    return rawDate.includes(targetDateStr);
                }
                if (typeof key === 'string') {
                    return key.startsWith(targetDateStr);
                }
                return false;
            });
        } else if (startTs && endTs) {
            periodCandles = data.filter(item => {
                const key = getTimeKey(item);
                let cMs = 0;
                if (typeof key === 'number') {
                    cMs = key * 1000;
                } else {
                    cMs = new Date(String(key)).getTime();
                }
                return !isNaN(cMs) && cMs >= startTs && cMs <= endTs;
            });
        }

        if (periodCandles.length > 0) {
            startKey = getTimeKey(periodCandles[0]);
            endKey = getTimeKey(periodCandles[periodCandles.length - 1]);

            // Find candle closest to splitTs in this period's candle sequence
            let minDiff = Infinity;
            periodCandles.forEach(c => {
                const key = getTimeKey(c);
                let cMs = 0;
                if (typeof key === 'number') {
                    cMs = key * 1000;
                } else {
                    cMs = new Date(String(key)).getTime();
                }
                if (!isNaN(cMs)) {
                    const diff = Math.abs(cMs - splitTs);
                    if (diff < minDiff) {
                        minDiff = diff;
                        splitKey = key;
                    }
                }
            });
            if (!splitKey) {
                const midIdx = Math.floor(periodCandles.length * 0.7);
                splitKey = getTimeKey(periodCandles[Math.min(midIdx, periodCandles.length - 1)]);
            }
        } else {
            // General fallback: closest candle matching by timestamp
            startKey = findNearestCandleKey(startTs);
            splitKey = findNearestCandleKey(splitTs);
            endKey = findNearestCandleKey(endTs);
        }

        const xStart = startKey ? timeScale.timeToCoordinate(startKey) : null;
        const xSplit = splitKey ? timeScale.timeToCoordinate(splitKey) : null;
        const xEnd = endKey ? timeScale.timeToCoordinate(endKey) : null;

        if (xStart !== null || xSplit !== null || xEnd !== null) {
            let validStart = xStart !== null ? xStart : -5000;
            let validEnd = xEnd !== null ? (xEnd + 8) : (validStart + 300);
            let validSplit = xSplit !== null ? xSplit : (validStart + Math.round((validEnd - validStart) * 0.7));

            if (wfaHighlightZone.wfaMode === 'Chu kỳ xen kẽ (Xen kẽ 1 chu kỳ IS, 1 chu kỳ OOS)') {
                if (wfaHighlightZone.isAlternatingOos) {
                    validSplit = validStart;
                } else {
                    validSplit = validEnd;
                }
            }

            setWfaBoxCoords({
                xStart: validStart,
                xSplit: validSplit,
                xEnd: validEnd,
                cycleIndex: wfaHighlightZone.cycleIndex,
                effCycleIndex: wfaHighlightZone.effCycleIndex,
                formattedLabel: wfaHighlightZone.formattedLabel || wfaHighlightZone.formattedStart,
                wfePercent: wfaHighlightZone.wfePercent,
                wfaTf: wfaHighlightZone.wfaTf,
                wfaMode: wfaHighlightZone.wfaMode
            });
        } else {
            setWfaBoxCoords(null);
        }
    }, [wfaHighlightZone, data, getTimeKey]);

    useEffect(() => {
        const timer = setTimeout(() => {
            computeWfaCoords();
        }, 50);
        return () => clearTimeout(timer);
    }, [wfaHighlightZone, data, computeWfaCoords]);

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
                    className="absolute z-30 pointer-events-none bg-gray-900/95 border border-gray-700/80 rounded-xl p-3 shadow-2xl text-xs text-white space-y-2 min-w-[220px] max-w-[340px] backdrop-blur-md"
                    style={{
                        left: Math.min(hoverTooltip.x + 15, hoverTooltip.chartWidth - 240),
                        top: Math.max(10, Math.min(hoverTooltip.y - 10, hoverTooltip.chartHeight - 180))
                    }}
                >
                    <div className="text-[11px] text-gray-400 font-semibold border-b border-gray-700/60 pb-1.5 flex justify-between items-center">
                        <span>📅 {hoverTooltip.date}</span>
                        <span className="text-[10px] text-blue-400 font-mono font-bold uppercase bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                            {hoverTooltip.signals.length} SIGNAL{hoverTooltip.signals.length > 1 ? 'S' : ''}
                        </span>
                    </div>
                    <div className="space-y-2">
                        {hoverTooltip.signals.map((sig, idx) => {
                            const isEntry = sig.type === 'entry';
                            const isTP = sig.type === 'takeprofit';
                            const isSL = sig.type === 'stoploss';
                            const isExit = sig.type === 'exit';
                            const isLong = String(sig.posType || '').toLowerCase() === 'long';
                            const pnl = sig.pnlPercent !== undefined ? sig.pnlPercent : sig.pnl_percent;
                            const pnlAmt = sig.pnlAmount !== undefined ? sig.pnlAmount : sig.pnl_amount;
                            const execPrice = sig.price ?? (isEntry ? sig.entry : sig.exitPrice);
                            const entryPrice = sig.entry ?? (isEntry ? sig.price : null);
                            const slPrice = sig.stopLoss ?? sig.stop_loss;
                            const tpPrice = sig.takeProfit ?? sig.take_profit;

                            return (
                                <div key={idx} className="bg-gray-800/90 p-2.5 rounded-lg border border-gray-700/60 space-y-1.5">
                                    <div className="flex items-center justify-between gap-1.5">
                                        <div className="flex items-center gap-1.5 font-bold text-xs">
                                            <span
                                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: sig.color }}
                                            />
                                            <span style={{ color: sig.color }}>
                                                {isEntry ? (isLong ? 'Long Entry' : 'Short Entry') :
                                                    isTP ? 'Take Profit' :
                                                        isSL ? 'Stop Loss' :
                                                            isExit ? '🏁 Exit' : (sig.action || 'Signal')}
                                            </span>
                                        </div>
                                        {pnl !== undefined && pnl !== null && (
                                            <span className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${Number(pnl) >= 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                                }`}>
                                                {Number(pnl) >= 0 ? '+' : ''}{Number(pnl).toFixed(2)}%
                                            </span>
                                        )}
                                    </div>

                                    {/* Setup / Signal Description */}
                                    {sig.name && (
                                        <div className="text-[11px] text-gray-300 font-medium leading-tight">
                                            {sig.name}
                                        </div>
                                    )}

                                    {/* Price Details Grid */}
                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1.5 border-t border-gray-700/50">
                                        {execPrice !== undefined && execPrice !== null && (
                                            <div>
                                                <span className="text-gray-400 text-[10px] block">Giá thực thi</span>
                                                <span className="font-mono font-bold text-gray-100">
                                                    ${formatPriceDisplay(execPrice)}
                                                </span>
                                            </div>
                                        )}
                                        {!isEntry && entryPrice !== undefined && entryPrice !== null && (
                                            <div>
                                                <span className="text-gray-400 text-[10px] block">Giá Entry</span>
                                                <span className="font-mono text-gray-300">
                                                    ${formatPriceDisplay(entryPrice)}
                                                </span>
                                            </div>
                                        )}
                                        {slPrice !== undefined && slPrice !== null && (
                                            <div>
                                                <span className="text-rose-400/90 text-[10px] block">Stop Loss (SL)</span>
                                                <span className="font-mono font-medium text-rose-300">
                                                    ${formatPriceDisplay(slPrice)}
                                                </span>
                                            </div>
                                        )}
                                        {tpPrice !== undefined && tpPrice !== null && (
                                            <div>
                                                <span className="text-emerald-400/90 text-[10px] block">Take Profit (TP)</span>
                                                <span className="font-mono font-medium text-emerald-300">
                                                    ${formatPriceDisplay(tpPrice)}
                                                </span>
                                            </div>
                                        )}
                                        {pnlAmt !== undefined && pnlAmt !== null && pnlAmt !== 0 && (
                                            <div>
                                                <span className="text-gray-400 text-[10px] block">PnL Amount</span>
                                                <span className={`font-mono font-medium ${Number(pnlAmt) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {Number(pnlAmt) >= 0 ? '+' : ''}${formatPriceDisplay(pnlAmt)}
                                                </span>
                                            </div>
                                        )}
                                        {sig.volume && (
                                            <div>
                                                <span className="text-gray-400 text-[10px] block">Khối lượng</span>
                                                <span className="font-mono text-gray-300">
                                                    {formatPriceDisplay(sig.volume)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div
                className="w-full flex-grow relative overflow-hidden"
                style={{ flexBasis: '70%', flexShrink: 0 }}
            >
                <div ref={chartContainerRef} className="w-full h-full relative" />

                {/* WFA Validation Zone Box Overlay */}
                {wfaBoxCoords && (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
                        <svg className="w-full h-full">
                            <defs>
                                <linearGradient id="wfaIsGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.14" />
                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.03" />
                                </linearGradient>
                                <linearGradient id="wfaOosGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#a855f7" stopOpacity="0.22" />
                                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.05" />
                                </linearGradient>
                            </defs>

                            {/* 1. In-Sample (IS) Shaded Box */}
                            {wfaBoxCoords.xSplit > wfaBoxCoords.xStart && (
                                <rect
                                    x={Math.min(wfaBoxCoords.xStart, wfaBoxCoords.xSplit)}
                                    y={8}
                                    width={Math.max(2, Math.abs(wfaBoxCoords.xSplit - wfaBoxCoords.xStart))}
                                    height="88%"
                                    fill="url(#wfaIsGrad)"
                                    stroke="rgba(59, 130, 246, 0.5)"
                                    strokeWidth="1.5"
                                    strokeDasharray="4 3"
                                    rx="6"
                                />
                            )}

                            {/* 2. Out-of-Sample (OOS) Validation Box (Vùng kiểm định) */}
                            {wfaBoxCoords.xEnd > wfaBoxCoords.xSplit && (
                                <rect
                                    x={Math.min(wfaBoxCoords.xSplit, wfaBoxCoords.xEnd)}
                                    y={8}
                                    width={Math.max(2, Math.abs(wfaBoxCoords.xEnd - wfaBoxCoords.xSplit))}
                                    height="88%"
                                    fill="url(#wfaOosGrad)"
                                    stroke="rgba(168, 85, 247, 0.85)"
                                    strokeWidth="2"
                                    strokeDasharray="6 3"
                                    rx="6"
                                />
                            )}
                        </svg>

                        {/* Top Labels */}
                        {wfaBoxCoords.xStart >= -150 && wfaBoxCoords.xStart <= (chartContainerRef.current?.clientWidth || 1000) && (
                            <div
                                className="absolute top-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-900/90 border border-blue-500/50 text-[10px] font-mono font-bold text-blue-300 shadow-lg backdrop-blur-sm pointer-events-auto transition-all"
                                style={{ left: `${Math.max(8, wfaBoxCoords.xStart + 6)}px` }}
                            >
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
                                <span>WFA #{wfaBoxCoords.cycleIndex} ({wfaBoxCoords.formattedLabel})</span>
                            </div>
                        )}

                        {wfaBoxCoords.xSplit >= -150 && wfaBoxCoords.xSplit <= (chartContainerRef.current?.clientWidth || 1000) && (
                            <div
                                className="absolute top-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-950/90 border border-purple-500/70 text-[10px] font-mono font-bold text-purple-200 shadow-lg backdrop-blur-sm pointer-events-auto transition-all"
                                style={{ left: `${Math.max(8, wfaBoxCoords.xSplit + 6)}px` }}
                            >
                                <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                                <span>VÙNG KIỂM ĐỊNH OOS</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

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
