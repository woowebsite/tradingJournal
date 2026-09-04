import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createChart, ColorType, CandlestickSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts';
import { getDerivativeHistory } from '../services/24hmoney';
import { evaluateRule } from '../utils/ruleEngine';
import { calculateVWAP } from '../indicators/vwap';
import { calculateSupertrend, drawSupertrend } from '../indicators/supertrend';
import { RefreshCw } from 'lucide-react';

// Robust helper to parse trading date string/number to Unix timestamp in seconds
const parseTradingDateToTimestamp = (dateInput) => {
    if (!dateInput) return null;
    if (typeof dateInput === 'number') {
        return dateInput > 1e11 ? Math.floor(dateInput / 1000) : dateInput;
    }
    const str = String(dateInput).trim();
    if (str.includes('Z') || str.includes('+')) {
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 1000);
    }
    // Match "YYYY-MM-DD HH:mm:ss" or "YYYY/MM/DD HH:mm:ss" or "YYYY-MM-DDTHH:mm:ss"
    const match = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const day = parseInt(match[3], 10);
        const hour = match[4] ? parseInt(match[4], 10) : 0;
        const minute = match[5] ? parseInt(match[5], 10) : 0;
        const second = match[6] ? parseInt(match[6], 10) : 0;
        const d = new Date(year, month, day, hour, minute, second);
        return isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 1000);
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 1000);
};

const RealtimeChart = ({ symbol, jwtToken, setShowOtpModal, strategyRules = [], wsTick, wsStatus, refreshTrigger = 0 }) => {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const seriesRef = useRef(null);

    // Persistent indicator series refs
    const vwapMainSeriesRef = useRef(null);
    const vwapBandsSeriesRef = useRef([]); // [upper1, lower1, upper2, lower2, upper3, lower3]
    const supertrendSeriesRef = useRef([]); // Array of segment series

    const [status, setStatus] = useState('Connecting...');
    const [refreshingHistory, setRefreshingHistory] = useState(false);

    // Indicator display toggles & live metrics
    const [showVWAP, setShowVWAP] = useState(true);
    const [showVWAPBands, setShowVWAPBands] = useState(true);
    const [showSupertrend, setShowSupertrend] = useState(true);
    const [indicatorStats, setIndicatorStats] = useState({
        vwap: null,
        supertrend: null,
        supertrendDirection: null
    });

    const candleDataRef = useRef([]); // Finished historical candles
    const currentCandleRef = useRef(null); // Active building candle
    const strategyRulesRef = useRef(strategyRules);

    // Cached markers to avoid re-evaluating 600+ candles on every tick
    const historicalMarkersRef = useRef([]);
    const lastMarkersStrRef = useRef('');
    const lastMarkerUpdateRef = useRef(0);

    // Latest tick buffer for RAF
    const pendingTickRef = useRef(null);
    const rafIdRef = useRef(null);

    // Keep strategy rules ref updated
    useEffect(() => {
        strategyRulesRef.current = strategyRules;
    }, [strategyRules]);

    // Format time helper
    const formatTime = useCallback((time) => {
        if (typeof time === 'number') return time;
        if (typeof time === 'string' && time.includes('T')) return time.split('T')[0];
        return time;
    }, []);

    // Full scan marker evaluation (runs ONLY when history loads or strategy changes)
    const computeAllMarkers = useCallback(() => {
        if (!seriesRef.current) return;

        const currentRules = strategyRulesRef.current;
        if (!currentRules || currentRules.length === 0) {
            historicalMarkersRef.current = [];
            try { createSeriesMarkers(seriesRef.current, []); } catch (e) { }
            lastMarkersStrRef.current = '';
            return;
        }

        const currentData = candleDataRef.current;
        if (!currentData || currentData.length === 0) return;

        const fullData = [...currentData];
        if (currentCandleRef.current && (fullData.length === 0 || fullData[fullData.length - 1].time !== currentCandleRef.current.time)) {
            fullData.push(currentCandleRef.current);
        }

        // ruleEngine expects DESC array (newest first, index 0 is newest)
        const descHistory = [...fullData].reverse();
        const generatedSignals = [];

        currentRules.forEach(rule => {
            let ruleDefinition = rule.Rule || rule.rule;
            if (typeof ruleDefinition === 'string') {
                try { ruleDefinition = JSON.parse(ruleDefinition); } catch (e) { }
            }
            if (!ruleDefinition) return;

            for (let i = 0; i < descHistory.length; i++) {
                try {
                    const isMatch = evaluateRule(descHistory, ruleDefinition, i);
                    if (isMatch) {
                        const prevMatch = (i + 1 < descHistory.length) ? evaluateRule(descHistory, ruleDefinition, i + 1) : false;
                        if (!prevMatch || i === 0) {
                            generatedSignals.push({
                                time: descHistory[i].time,
                                rule: rule
                            });
                        }
                    }
                } catch (e) {
                    // Ignore errors for individual rule evaluations
                }
            }
        });

        const colors = {
            entry: '#38bdf8',
            takeprofit: '#34d399',
            stoploss: '#f87171',
            exit: '#fb923c',
            rule: '#a78bfa',
            unknown: '#9ca3af'
        };

        const getRuleClassification = (rule) => {
            if (!rule) return 'entry';
            const t = (rule.strategyType || rule.actionType || rule.Type || rule.type || '').toLowerCase();
            if (t.includes('profit') || t.includes('tp') || t === 'takeprofit') return 'takeprofit';
            if (t.includes('loss') || t.includes('sl') || t === 'stoploss') return 'stoploss';
            if (t.includes('exit')) return 'exit';
            if (t.includes('entry')) return 'entry';
            return 'entry';
        };

        const markers = generatedSignals.map(sig => {
            const rawType = getRuleClassification(sig.rule);
            const isEntry = rawType === 'entry';
            const displayText = (sig.rule.signalText || sig.rule.signal_text)?.trim() || sig.rule.Name || sig.rule.name || rawType.toUpperCase();
            return {
                time: sig.time,
                position: isEntry ? 'belowBar' : 'aboveBar',
                color: colors[rawType] || colors.unknown,
                shape: isEntry ? 'arrowUp' : 'arrowDown',
                text: displayText,
                size: 2
            };
        });

        const uniqueTimes = new Map();
        markers.forEach(m => {
            if (uniqueTimes.has(m.time)) {
                const existing = uniqueTimes.get(m.time);
                if (!existing.text.includes(m.text)) {
                    existing.text += ', ' + m.text;
                }
            } else {
                uniqueTimes.set(m.time, { ...m });
            }
        });

        const finalMarkers = Array.from(uniqueTimes.values()).sort((a, b) => a.time - b.time);
        historicalMarkersRef.current = finalMarkers;

        const markersStr = JSON.stringify(finalMarkers);
        if (markersStr !== lastMarkersStrRef.current) {
            lastMarkersStrRef.current = markersStr;
            try {
                createSeriesMarkers(seriesRef.current, finalMarkers);
            } catch (e) {
                console.error('RealtimeChart Set Markers Error:', e);
            }
        }
    }, []);

    // Quick marker update on live candle (only checks latest candle index 0)
    const updateLiveMarker = useCallback(() => {
        if (!seriesRef.current) return;
        const currentRules = strategyRulesRef.current;
        if (!currentRules || currentRules.length === 0) return;

        const now = Date.now();
        if (now - lastMarkerUpdateRef.current < 1000) return; // Throttle to at most once per sec
        lastMarkerUpdateRef.current = now;

        const current = currentCandleRef.current;
        if (!current) return;

        const descHistory = [current, ...[...candleDataRef.current].reverse()];
        const liveSignals = [];

        currentRules.forEach(rule => {
            let ruleDefinition = rule.Rule || rule.rule;
            if (typeof ruleDefinition === 'string') {
                try { ruleDefinition = JSON.parse(ruleDefinition); } catch (e) { }
            }
            if (!ruleDefinition) return;

            try {
                if (evaluateRule(descHistory, ruleDefinition, 0)) {
                    const prevMatch = (descHistory.length > 1) ? evaluateRule(descHistory, ruleDefinition, 1) : false;
                    if (!prevMatch) {
                        liveSignals.push({ time: current.time, rule });
                    }
                }
            } catch (e) { }
        });

        const colors = {
            entry: '#38bdf8',
            takeprofit: '#34d399',
            stoploss: '#f87171',
            exit: '#fb923c',
            rule: '#a78bfa',
            unknown: '#9ca3af'
        };

        const getRuleClassification = (rule) => {
            if (!rule) return 'entry';
            const t = (rule.strategyType || rule.actionType || rule.Type || rule.type || '').toLowerCase();
            if (t.includes('profit') || t.includes('tp') || t === 'takeprofit') return 'takeprofit';
            if (t.includes('loss') || t.includes('sl') || t === 'stoploss') return 'stoploss';
            if (t.includes('exit')) return 'exit';
            if (t.includes('entry')) return 'entry';
            return 'entry';
        };

        const existingWithoutCurrent = historicalMarkersRef.current.filter(m => m.time !== current.time);
        liveSignals.forEach(sig => {
            const rawType = getRuleClassification(sig.rule);
            const isEntry = rawType === 'entry';
            const displayText = (sig.rule.signalText || sig.rule.signal_text)?.trim() || sig.rule.Name || sig.rule.name || rawType.toUpperCase();
            existingWithoutCurrent.push({
                time: current.time,
                position: isEntry ? 'belowBar' : 'aboveBar',
                color: colors[rawType] || colors.unknown,
                shape: isEntry ? 'arrowUp' : 'arrowDown',
                text: displayText,
                size: 2
            });
        });

        existingWithoutCurrent.sort((a, b) => a.time - b.time);
        const markersStr = JSON.stringify(existingWithoutCurrent);
        if (markersStr !== lastMarkersStrRef.current) {
            lastMarkersStrRef.current = markersStr;
            try {
                createSeriesMarkers(seriesRef.current, existingWithoutCurrent);
            } catch (e) { }
        }
    }, []);

    // Update Indicator Data without destroying series
    const updateIndicatorsData = useCallback(() => {
        if (!chartRef.current) return;

        const currentData = candleDataRef.current;
        if (!currentData || currentData.length === 0) return;

        const fullData = [...currentData];
        if (currentCandleRef.current && (fullData.length === 0 || fullData[fullData.length - 1].time !== currentCandleRef.current.time)) {
            fullData.push(currentCandleRef.current);
        }
        if (fullData.length === 0) return;

        let latestVwapVal = null;
        let latestStVal = null;
        let latestStDir = null;

        // 1. VWAP Calculation & Set Data
        try {
            const vwapData = calculateVWAP(fullData, 'Day');
            if (vwapData && vwapData.length > 0) {
                if (vwapMainSeriesRef.current) {
                    vwapMainSeriesRef.current.setData(vwapData.map(item => ({
                        time: formatTime(item.time),
                        value: item.value
                    })));
                }

                // Update 6 Bands
                const bandKeys = ['upper1', 'lower1', 'upper2', 'lower2', 'upper3', 'lower3'];
                vwapBandsSeriesRef.current.forEach((bandSeries, idx) => {
                    const key = bandKeys[idx];
                    if (bandSeries && key) {
                        bandSeries.setData(vwapData.map(item => ({
                            time: formatTime(item.time),
                            value: item[key]
                        })));
                    }
                });

                latestVwapVal = vwapData[vwapData.length - 1]?.value;
            }
        } catch (err) {
            console.error('Failed to calculate VWAP:', err);
        }

        // 2. Supertrend Calculation & Segment Series
        try {
            const supertrendData = calculateSupertrend(10, 3, fullData);
            if (supertrendData && supertrendData.length > 0) {
                // Clear old supertrend series safely
                supertrendSeriesRef.current.forEach(series => {
                    try { chartRef.current?.removeSeries(series); } catch (e) { }
                });
                supertrendSeriesRef.current = [];

                const createdStSeries = drawSupertrend(chartRef.current, LineSeries, supertrendData, {
                    lineWidth: 1,
                    visible: showSupertrend
                });
                supertrendSeriesRef.current = createdStSeries;

                const lastSt = supertrendData[supertrendData.length - 1];
                latestStVal = lastSt?.value;
                latestStDir = lastSt?.direction;
            }
        } catch (err) {
            console.error('Failed to calculate Supertrend:', err);
        }

        setIndicatorStats({
            vwap: latestVwapVal,
            supertrend: latestStVal,
            supertrendDirection: latestStDir
        });
    }, [formatTime, showSupertrend]);

    // Apply visibility toggles instantaneously
    useEffect(() => {
        if (vwapMainSeriesRef.current) {
            vwapMainSeriesRef.current.applyOptions({ visible: showVWAP });
        }
        vwapBandsSeriesRef.current.forEach(s => {
            s?.applyOptions({ visible: showVWAP && showVWAPBands });
        });
    }, [showVWAP, showVWAPBands]);

    useEffect(() => {
        supertrendSeriesRef.current.forEach(s => {
            s?.applyOptions({ visible: showSupertrend });
        });
    }, [showSupertrend]);

    // When strategyRules change, recompute full markers
    useEffect(() => {
        computeAllMarkers();
    }, [strategyRules, computeAllMarkers]);

    useEffect(() => {
        setStatus(wsStatus || 'Connecting...');
    }, [wsStatus]);

    // Load & Synchronize Historical Candles from 24hMoney
    const loadHistory = useCallback(async (isRefresh = false) => {
        if (!seriesRef.current) return;
        try {
            if (!isRefresh) setStatus('Loading Historical Data...');
            setRefreshingHistory(true);

            const targetSymbol = (symbol && !symbol.startsWith('41I')) ? symbol : 'VN30F1M';
            const hisData = await getDerivativeHistory(targetSymbol, '1', 350);

            if (Array.isArray(hisData) && hisData.length > 0) {
                const mappedData = hisData.map(item => {
                    const timeStamp = parseTradingDateToTimestamp(item.time || item.tradingDate || item.date);
                    return {
                        time: timeStamp,
                        date: item.tradingDate || item.date || new Date((timeStamp || 0) * 1000).toISOString(),
                        open: Number(item.open),
                        high: Number(item.high),
                        low: Number(item.low),
                        close: Number(item.close),
                        volume: Number(item.volume || item.v || 1)
                    };
                }).filter(item => item.time !== null).sort((a, b) => a.time - b.time);

                if (mappedData.length > 0) {
                    const lastCandle = mappedData.pop();
                    currentCandleRef.current = lastCandle;
                    candleDataRef.current = mappedData;
                    seriesRef.current.setData([...mappedData, lastCandle]);

                    // Update indicators & markers
                    updateIndicatorsData();
                    computeAllMarkers();
                }
            }
        } catch (error) {
            console.error("Failed to load 24hMoney historical data:", error);
        } finally {
            setRefreshingHistory(false);
        }
    }, [symbol, computeAllMarkers, updateIndicatorsData]);

    // Refresh history on external trigger (e.g. user clicked Refresh Price button in parent)
    useEffect(() => {
        if (refreshTrigger > 0) {
            loadHistory(true);
        }
    }, [refreshTrigger, loadHistory]);

    // Auto-sync historical candles periodically (every 30s) to guarantee no missing minutes
    useEffect(() => {
        const interval = setInterval(() => {
            loadHistory(true);
        }, 30000);
        return () => clearInterval(interval);
    }, [loadHistory]);

    // Process buffered WS tick via RAF
    const processTick = useCallback(() => {
        rafIdRef.current = null;
        const tick = pendingTickRef.current;
        if (!tick || !seriesRef.current) return;

        const price = Number(
            tick.mp ||
            tick.matchPrice ||
            tick.lastPrice ||
            tick.price ||
            tick.bp1 ||
            tick.bidPrice01 ||
            tick.op1 ||
            tick.offerPrice01
        );

        if (!price || isNaN(price)) return;

        // Accurate tick timestamp calculation
        let timeStamp;
        if (tick.s && typeof tick.s === 'number') {
            timeStamp = Math.floor(tick.s / 60) * 60;
        } else if (tick.tm && typeof tick.tm === 'string' && tick.tm.includes(':')) {
            const parts = tick.tm.split(':');
            const now = new Date();
            now.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
            timeStamp = Math.floor(now.getTime() / 1000);
        } else {
            const now = new Date();
            const coeff = 1000 * 60; // 1 min bucket
            timeStamp = Math.floor(Math.floor(now.getTime() / coeff) * 60);
        }

        let current = currentCandleRef.current;
        let isNewCandle = false;

        if (current && current.time === timeStamp) {
            current.high = Math.max(current.high, price);
            current.low = Math.min(current.low, price);
            current.close = price;
        } else {
            if (current) {
                candleDataRef.current.push({ ...current });
                isNewCandle = true;
            }
            current = {
                time: timeStamp,
                date: new Date(timeStamp * 1000).toISOString(),
                open: current ? current.close : price,
                high: price,
                low: price,
                close: price,
                volume: 1
            };
            currentCandleRef.current = current;
        }

        // 1. Fast direct O(1) chart update
        seriesRef.current.update(current);

        // 2. If new candle formed, update indicators & full markers
        if (isNewCandle) {
            updateIndicatorsData();
            computeAllMarkers();
        } else {
            // Otherwise quick live marker check
            updateLiveMarker();
        }
    }, [computeAllMarkers, updateIndicatorsData, updateLiveMarker]);

    // Receive wsTick and schedule RAF
    useEffect(() => {
        if (!wsTick || !seriesRef.current) return;
        pendingTickRef.current = wsTick;
        if (!rafIdRef.current) {
            rafIdRef.current = requestAnimationFrame(processTick);
        }
    }, [wsTick, processTick]);

    // Initialize chart
    useEffect(() => {
        if (!chartContainerRef.current) return;

        // Initialize lightweight chart
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#111827' },
                textColor: '#9ca3af',
            },
            grid: {
                vertLines: { color: '#1f2937', visible: true },
                horzLines: { color: '#1f2937', visible: true },
            },
            localization: {
                locale: 'vi-VN',
                dateFormat: 'dd/MM/yyyy',
                timeFormatter: (timestamp) => {
                    if (!timestamp) return '';
                    const d = new Date(typeof timestamp === 'number' ? timestamp * 1000 : timestamp);
                    return d.toLocaleString('vi-VN', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    });
                },
            },
            timeScale: {
                borderColor: '#374151',
                timeVisible: true,
                secondsVisible: false,
                tickMarkFormatter: (time, tickMarkType) => {
                    const timestampSec = typeof time === 'number' ? time : (time && time.timestamp) ? time.timestamp : null;
                    if (!timestampSec) return '';
                    const d = new Date(timestampSec * 1000);
                    const tz = 'Asia/Ho_Chi_Minh';

                    switch (tickMarkType) {
                        case 0: // Year
                            return d.toLocaleDateString('vi-VN', { timeZone: tz, year: 'numeric' });
                        case 1: // Month
                            return d.toLocaleDateString('vi-VN', { timeZone: tz, month: '2-digit', year: '2-digit' });
                        case 2: // DayOfMonth
                            return d.toLocaleDateString('vi-VN', { timeZone: tz, day: '2-digit', month: '2-digit' });
                        case 3: // Time
                        case 4: // TimeWithSeconds
                        default:
                            return d.toLocaleTimeString('vi-VN', {
                                timeZone: tz,
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                            });
                    }
                }
            },
            rightPriceScale: {
                borderColor: '#374151',
                autoScale: true,
            },
            crosshair: {
                mode: 0,
            }
        });

        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#10b981',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
            priceFormat: {
                type: 'price',
                precision: 1,
                minMove: 0.1,
            },
        });

        chartRef.current = chart;
        seriesRef.current = candlestickSeries;

        // Initialize VWAP main line
        const vwapMain = chart.addSeries(LineSeries, {
            color: '#ffffff',
            lineWidth: 2,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: true,
            title: 'VWAP',
            visible: showVWAP,
        });
        vwapMainSeriesRef.current = vwapMain;

        // Initialize 6 VWAP Bands (Upper & Lower ±1, ±2, ±3 SD) - More prominent & vibrant
        const bandColors = [
            'rgba(56, 189, 248, 0.75)', // ±1 SD Sky Blue (Upper 1)
            'rgba(56, 189, 248, 0.75)', // ±1 SD Sky Blue (Lower 1)
            'rgba(251, 191, 36, 0.80)', // ±2 SD Amber (Upper 2)
            'rgba(251, 191, 36, 0.80)', // ±2 SD Amber (Lower 2)
            'rgba(244, 63, 94, 0.85)',   // ±3 SD Rose (Upper 3)
            'rgba(244, 63, 94, 0.85)',   // ±3 SD Rose (Lower 3)
        ];
        const createdBands = [];
        for (let i = 0; i < 6; i++) {
            const bandSeries = chart.addSeries(LineSeries, {
                color: bandColors[i],
                lineWidth: 1,
                lineStyle: 2, // Dashed
                crosshairMarkerVisible: false,
                priceLineVisible: false,
                lastValueVisible: false,
                visible: showVWAP && showVWAPBands,
            });
            createdBands.push(bandSeries);
        }
        vwapBandsSeriesRef.current = createdBands;

        // Load initial history
        loadHistory(false);

        // Handle Resize with ResizeObserver
        const resizeObserver = new ResizeObserver(entries => {
            if (!entries || entries.length === 0 || !chartRef.current) return;
            const { width, height } = entries[0].contentRect;
            if (width > 0 && height > 0) {
                chartRef.current.applyOptions({ width, height });
            }
        });

        if (chartContainerRef.current) {
            resizeObserver.observe(chartContainerRef.current);
        }

        // Cleanup
        return () => {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
            resizeObserver.disconnect();
            chart.remove();
            chartRef.current = null;
            seriesRef.current = null;
            vwapMainSeriesRef.current = null;
            vwapBandsSeriesRef.current = [];
            supertrendSeriesRef.current = [];
        };
    }, [symbol, loadHistory]);

    return (
        <div className="flex flex-col w-full h-full relative min-h-[300px]">
            {/* Top Controls Overlay */}
            <div className="absolute top-2 left-2 right-2 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-gray-900/80 border border-gray-700/60 px-2.5 py-1 rounded-lg backdrop-blur shadow-sm">
                        <div className={`w-2 h-2 rounded-full ${status === 'Connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                        <span className="text-[11px] text-gray-300 font-medium font-mono">
                            {status === 'Connected' ? 'LIVE' : status}
                        </span>
                    </div>

                    {/* Chart Refresh Button */}
                    <button
                        type="button"
                        onClick={() => loadHistory(true)}
                        disabled={refreshingHistory}
                        className="p-1.5 bg-gray-900/80 hover:bg-gray-800 border border-gray-700/60 text-gray-400 hover:text-white rounded-lg backdrop-blur transition disabled:opacity-50 shadow-sm cursor-pointer"
                        title="Làm mới toàn bộ nến & chỉ báo"
                    >
                        <RefreshCw size={12} className={refreshingHistory ? "animate-spin text-blue-400" : ""} />
                    </button>

                    {/* VWAP Toggle Button */}
                    <button
                        type="button"
                        onClick={() => setShowVWAP(prev => !prev)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur border transition cursor-pointer shadow-sm ${showVWAP
                            ? 'bg-sky-500/15 border-sky-500/50 text-sky-300 hover:bg-sky-500/25'
                            : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:text-gray-200'
                            }`}
                        title="Bật/Tắt đường VWAP phiên"
                    >
                        <span className={`w-2 h-2 rounded-full ${showVWAP ? 'bg-white shadow-[0_0_8px_#ffffff]' : 'bg-gray-600'}`} />
                        <span>VWAP</span>
                        {showVWAP && indicatorStats.vwap !== null && (
                            <span className="font-mono text-[11px] text-white">
                                {Number(indicatorStats.vwap).toFixed(1)}
                            </span>
                        )}
                    </button>

                    {/* VWAP ±1,2,3 SD Bands Toggle */}
                    {showVWAP && (
                        <button
                            type="button"
                            onClick={() => setShowVWAPBands(prev => !prev)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium backdrop-blur border transition cursor-pointer shadow-sm ${showVWAPBands
                                ? 'bg-sky-500/10 border-sky-500/30 text-sky-200 hover:bg-sky-500/20'
                                : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:text-gray-200'
                                }`}
                            title="Bật/Tắt 3 dải Upper & Lower Bands (±1, ±2, ±3 Độ Lệch Chuẩn SD)"
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${showVWAPBands ? 'bg-sky-300' : 'bg-gray-600'}`} />
                            <span>Bands (±1,2,3)</span>
                        </button>
                    )}

                    {/* Supertrend Toggle Button */}
                    <button
                        type="button"
                        onClick={() => setShowSupertrend(prev => !prev)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur border transition cursor-pointer shadow-sm ${showSupertrend
                            ? (indicatorStats.supertrendDirection === 1
                                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/25'
                                : 'bg-rose-500/15 border-rose-500/50 text-rose-300 hover:bg-rose-500/25')
                            : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:text-gray-200'
                            }`}
                        title="Bật/Tắt đường Supertrend (10, 3)"
                    >
                        <span className={`w-2 h-2 rounded-full ${showSupertrend
                            ? (indicatorStats.supertrendDirection === 1 ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-400 shadow-[0_0_8px_#f87171]')
                            : 'bg-gray-600'
                            }`} />
                        <span>ST (10, 3)</span>
                        {showSupertrend && indicatorStats.supertrend !== null && (
                            <span className={`font-mono text-[11px] ${indicatorStats.supertrendDirection === 1 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                {Number(indicatorStats.supertrend).toFixed(1)}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            <div
                ref={chartContainerRef}
                className="w-full flex-grow relative rounded-xl overflow-hidden"
            />
        </div>
    );
};

export default React.memo(RealtimeChart);


