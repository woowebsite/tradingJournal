import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';
import { getTCBSDerivatives } from '../services/tcbsJournal';
import { getFuturesHistory } from '../services/tcbs';
import { evaluateRule } from '../utils/ruleEngine';

const RealtimeChart = ({ symbol, jwtToken, setShowOtpModal, strategyRules = [], wsTick, wsStatus }) => {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const seriesRef = useRef(null);
    const [status, setStatus] = useState('Connecting...');

    const candleDataRef = useRef([]); // Stores finished candles and current candle
    const currentCandleRef = useRef(null);
    const strategyRulesRef = useRef(strategyRules);
    const lastMarkersStrRef = useRef('');

    const updateMarkers = () => {
        if (!seriesRef.current) return;

        const currentRules = strategyRulesRef.current;
        if (!currentRules || currentRules.length === 0) {
            try { createSeriesMarkers(seriesRef.current, []); } catch (e) { }
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
            if (!rule.Rule) return;

            // Loop through history to find the first match (most recent interaction)
            for (let i = 0; i < descHistory.length; i++) {
                try {
                    const isMatch = evaluateRule(descHistory, rule.Rule, i);
                    if (isMatch) {
                        generatedSignals.push({
                            time: descHistory[i].time,
                            rule: rule
                        });
                        break; // Stop after finding the most recent match for this rule
                    }
                } catch (e) {
                    // Ignore errors for individual rule evaluations
                }
            }
        });

        // Map to lightweight-charts markers
        const markers = generatedSignals.map(sig => {
            const type = sig.rule.Type ? sig.rule.Type.toLowerCase() : 'unknown';
            const colors = {
                entry: '#60a5fa', // blue
                takeprofit: '#4ade80', // green
                stoploss: '#f87171', // red
                exit: '#fb923c', // orange
                unknown: '#9ca3af'
            };
            const isEntry = type === 'entry';
            return {
                time: sig.time,
                position: isEntry ? 'belowBar' : 'aboveBar',
                color: colors[type] || colors.unknown,
                shape: isEntry ? 'arrowUp' : 'arrowDown',
                text: sig.rule.Name || type,
                size: 1
            };
        });

        // lightweight-charts strictly requires markers to be sorted by time ascending AND unique
        const uniqueTimes = new Map();
        markers.forEach(m => {
            if (uniqueTimes.has(m.time)) {
                uniqueTimes.get(m.time).text += ', ' + m.text;
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
                        open: current ? current.close : price,
                        high: price,
                        low: price,
                        close: price
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
                background: { type: ColorType.Solid, color: '#1f2937' },
                textColor: '#9ca3af',
            },
            grid: {
                vertLines: { color: '#374151', visible: false },
                horzLines: { color: '#374151', visible: false },
            },
            timeScale: {
                borderColor: '#4b5563',
                timeVisible: true, // Show intraday time
                secondsVisible: false,
            },
            rightPriceScale: {
                borderColor: '#4b5563',
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
                    console.log("TCBS getFutureHistory Response:", hisData);

                    if (Array.isArray(hisData) && hisData.length > 0) {
                        const mappedData = hisData.map(item => {
                            const date = new Date(item.tradingDate);
                            return {
                                time: Math.floor(date.getTime() / 1000),
                                open: item.open,
                                high: item.high,
                                low: item.low,
                                close: item.close
                            };
                        }).sort((a, b) => a.time - b.time);

                        if (mappedData.length > 0) {
                            const lastCandle = mappedData.pop();
                            currentCandleRef.current = lastCandle;
                            candleDataRef.current = mappedData;
                            seriesRef.current.setData([...mappedData, lastCandle]);
                            setTimeout(updateMarkers, 0);
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
    }, [symbol]);

    return (
        <div className="flex flex-col w-full h-full relative min-h-[300px]">
            <div className="absolute top-2 left-2 z-10 flex items-center gap-2 pointer-events-none">
                <div className={`w-2 h-2 rounded-full ${status === 'Connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-xs text-gray-400 font-medium bg-gray-900/50 px-2 py-0.5 rounded backdrop-blur">
                    {status}
                </span>
            </div>

            <div
                ref={chartContainerRef}
                className="w-full flex-grow relative rounded overflow-hidden"
            />
        </div>
    );
};

export default RealtimeChart;
