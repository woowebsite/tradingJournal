import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, CandlestickSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts';
import { getFuturesHistory } from '../services/tcbs';
import { evaluateRule } from '../utils/ruleEngine';
import { calculateVWAP, drawVWAP } from '../indicators/vwap';
import { calculateSupertrend, drawSupertrend } from '../indicators/supertrend';

const RealtimeChart = ({ symbol, jwtToken, setShowOtpModal, strategyRules = [], wsTick, wsStatus }) => {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const seriesRef = useRef(null);
    const indicatorSeriesRef = useRef([]); // Stores references to active VWAP and Supertrend series
    const [status, setStatus] = useState('Connecting...');

    // Indicator display toggles & live metrics
    const [showVWAP, setShowVWAP] = useState(true);
    const [showVWAPBands, setShowVWAPBands] = useState(true);
    const [showSupertrend, setShowSupertrend] = useState(true);
    const [indicatorStats, setIndicatorStats] = useState({
        vwap: null,
        supertrend: null,
        supertrendDirection: null
    });

    const candleDataRef = useRef([]); // Stores finished candles and current candle
    const currentCandleRef = useRef(null);
    const strategyRulesRef = useRef(strategyRules);
    const lastMarkersStrRef = useRef('');

    // Render VWAP and Supertrend indicators on top of the chart
    const renderIndicators = useCallback(() => {
        if (!chartRef.current) return;

        // Clear existing indicator series
        indicatorSeriesRef.current.forEach(series => {
            try {
                chartRef.current?.removeSeries(series);
            } catch (e) {
                // Ignore removal error if already cleaned up
            }
        });
        indicatorSeriesRef.current = [];

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

        // 1. Calculate & Draw VWAP + 3 Upper & Lower SD Bands (Day-anchored)
        if (showVWAP) {
            try {
                const vwapData = calculateVWAP(fullData, 'Day');
                if (vwapData && vwapData.length > 0) {
                    const createdVwapSeries = drawVWAP(chartRef.current, LineSeries, vwapData, {
                        color: '#ffffff', // clean white for main VWAP
                        lineWidth: 2,
                        showBands: showVWAPBands,
                        title: 'VWAP',
                    });
                    indicatorSeriesRef.current.push(...createdVwapSeries);
                    latestVwapVal = vwapData[vwapData.length - 1]?.value;
                }
            } catch (err) {
                console.error('Failed to draw VWAP on RealtimeChart:', err);
            }
        }

        // 2. Calculate & Draw Supertrend (10, 3)
        if (showSupertrend) {
            try {
                const supertrendData = calculateSupertrend(10, 3, fullData);
                if (supertrendData && supertrendData.length > 0) {
                    const createdStSeries = drawSupertrend(chartRef.current, LineSeries, supertrendData, {
                        lineWidth: 1,
                    });
                    indicatorSeriesRef.current.push(...createdStSeries);
                    const lastSt = supertrendData[supertrendData.length - 1];
                    latestStVal = lastSt?.value;
                    latestStDir = lastSt?.direction;
                }
            } catch (err) {
                console.error('Failed to draw Supertrend on RealtimeChart:', err);
            }
        }

        setIndicatorStats({
            vwap: latestVwapVal,
            supertrend: latestStVal,
            supertrendDirection: latestStDir
        });
    }, [showVWAP, showVWAPBands, showSupertrend]);

    const updateMarkers = () => {
        if (!seriesRef.current) return;

        const currentRules = strategyRulesRef.current;
        if (!currentRules || currentRules.length === 0) {
            try { createSeriesMarkers(seriesRef.current, []); } catch (e) { }
            lastMarkersStrRef.current = '';
            return;
        }

        const currentData = candleDataRef.current;
        if (!currentData || currentData.length === 0) return;

        // Build the full array including the current live candle
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

            // Scan through candles to identify match signals
            for (let i = 0; i < descHistory.length; i++) {
                try {
                    const isMatch = evaluateRule(descHistory, ruleDefinition, i);
                    if (isMatch) {
                        // Check if previous candle in time (i + 1 in DESC array) also matched
                        const prevMatch = (i + 1 < descHistory.length) ? evaluateRule(descHistory, ruleDefinition, i + 1) : false;
                        // Trigger on signal onset (crossover/change) or single isolated signal
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

        // Map to lightweight-charts markers
        const markers = generatedSignals.map(sig => {
            const rawType = (sig.rule.Type || sig.rule.type || '').toLowerCase();
            const colors = {
                entry: '#38bdf8', // bright sky blue
                takeprofit: '#34d399', // bright emerald green
                stoploss: '#f87171', // bright red
                exit: '#fb923c', // orange
                rule: '#a78bfa', // purple
                unknown: '#9ca3af'
            };
            const isEntry = rawType === 'entry';
            return {
                time: sig.time,
                position: isEntry ? 'belowBar' : 'aboveBar',
                color: colors[rawType] || colors.unknown,
                shape: isEntry ? 'arrowUp' : 'arrowDown',
                text: sig.rule.Name || sig.rule.name || rawType.toUpperCase(),
                size: 2
            };
        });

        // lightweight-charts strictly requires markers to be sorted by time ascending AND unique
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

        const finalMarkers = Array.from(uniqueTimes.values());
        finalMarkers.sort((a, b) => a.time - b.time);

        const markersStr = JSON.stringify(finalMarkers);
        if (markersStr === lastMarkersStrRef.current) {
            return;
        }
        lastMarkersStrRef.current = markersStr;

        try {
            createSeriesMarkers(seriesRef.current, finalMarkers);
        } catch (e) {
            console.error('RealtimeChart Set Markers Error:', e);
        }
    };

    useEffect(() => {
        setStatus(wsStatus || 'Connecting...');
    }, [wsStatus]);

    // Handle incoming ticks from parent WebSocket
    useEffect(() => {
        if (!wsTick || !seriesRef.current) return;

        try {
            const price = Number(
                wsTick.mp ||
                wsTick.matchPrice ||
                wsTick.lastPrice ||
                wsTick.price ||
                wsTick.bidPrice01 ||
                wsTick.offerPrice01
            );

            if (price && !isNaN(price)) {
                const now = new Date();
                const coeff = 1000 * 60; // 1 min bucket
                const rounded = new Date(Math.floor(now.getTime() / coeff) * coeff);
                const timeStamp = Math.floor(rounded.getTime() / 1000);

                let current = currentCandleRef.current;
                if (current && current.time === timeStamp) {
                    current.high = Math.max(current.high, price);
                    current.low = Math.min(current.low, price);
                    current.close = price;
                } else {
                    if (current) {
                        candleDataRef.current.push({ ...current });
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

                // Update chart
                seriesRef.current.update(current);
                updateMarkers();
            }
        } catch (e) {
            console.error('RealtimeChart process tick error:', e);
        }
    }, [wsTick]);

    useEffect(() => {
        strategyRulesRef.current = strategyRules;
        updateMarkers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [strategyRules]);

    // Re-render indicators when showVWAP / showSupertrend toggle changes
    useEffect(() => {
        renderIndicators();
    }, [renderIndicators]);

    useEffect(() => {
        if (!symbol) return;
        if (!chartContainerRef.current) return;
        if (!jwtToken) {
            setStatus('Authentication Required');
            setShowOtpModal(true);
            return;
        }

        // Initialize lightweight chart
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#111827' }, // matching app theme
                textColor: '#9ca3af',
            },
            grid: {
                vertLines: { color: '#1f2937', visible: true },
                horzLines: { color: '#1f2937', visible: true },
            },
            timeScale: {
                borderColor: '#374151',
                timeVisible: true, // Show intraday time
                secondsVisible: false,
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

        const loadHistoryAndConnect = async () => {
            try {
                setStatus('Loading Historical Data...');

                // Fetch generic stock history using 1-minute resolution for derivatives
                try {
                    const hisData = await getFuturesHistory(symbol, 'derivative', '1');

                    if (Array.isArray(hisData) && hisData.length > 0) {
                        const mappedData = hisData.map(item => {
                            const date = new Date(item.tradingDate);
                            return {
                                time: Math.floor(date.getTime() / 1000),
                                date: item.tradingDate,
                                open: Number(item.open),
                                high: Number(item.high),
                                low: Number(item.low),
                                close: Number(item.close),
                                volume: Number(item.volume || item.v || 1)
                            };
                        }).sort((a, b) => a.time - b.time);

                        if (mappedData.length > 0) {
                            const lastCandle = mappedData.pop();
                            currentCandleRef.current = lastCandle;
                            candleDataRef.current = mappedData;
                            seriesRef.current.setData([...mappedData, lastCandle]);
                            setTimeout(() => {
                                updateMarkers();
                                renderIndicators();
                            }, 0);
                        }
                    }
                } catch (e) {
                    console.warn("Failed to fetch getFutureHistory:", e);
                }
            } catch (error) {
                console.error("Failed to load REST historical data:", error);
            }
        };

        loadHistoryAndConnect();

        // Handle Resize
        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight,
                });
            }
        };
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [symbol, jwtToken]);

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


