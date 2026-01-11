import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

const CandleChart = ({ data, symbol, signals = [] }) => {
    const chartOption = useMemo(() => {
        if (!data || data.length === 0) return {};

        // Helper to ensure consistent date matching
        const formatDate = (dateInput) => {
            const d = new Date(dateInput);
            return d.toISOString().split('T')[0];
        };

        // Data expected to be descending (newest first).
        const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));

        // Add right padding by appending empty categories
        const dates = [...sortedData.map(item => formatDate(item.date)), ...Array(5).fill('')];

        const values = sortedData.map(item => [
            item.open,
            item.close,
            item.low,
            item.high
        ]);

        const volumes = sortedData.map((item, index) => [
            index,
            item.volume,
            item.close > item.open ? 1 : -1
        ]);

        // Process Signals for MarkPoints
        const signalMarks = signals.map(sig => {
            const sigDate = formatDate(sig.date);
            // Ensure we match purely on the date string
            const dataPoint = sortedData.find(d => formatDate(d.date) === sigDate);

            // If historical data exists for this signal date, use its High for positioning
            if (!dataPoint) return null;

            // Determine color/type from rules
            const rule = sig.rules && sig.rules.length > 0 ? sig.rules[0] : { Type: 'unknown', Name: 'Signal' };
            const type = rule.Type || 'unknown';
            const isEntry = type === 'entry';

            const colors = {
                entry: '#60a5fa', // blue
                takeprofit: '#4ade80', // green
                stoploss: '#f87171', // red
                exit: '#fb923c', // orange
                unknown: '#9ca3af'
            };

            return {
                name: rule.Name,
                coord: [sigDate, isEntry ? dataPoint.low : dataPoint.high],
                value: type,
                symbolRotate: isEntry ? 180 : 0,
                symbolOffset: [0, isEntry ? 10 : -10], // Push away from candle: Down for entry, Up for others
                itemStyle: {
                    color: colors[type] || colors.unknown
                },
                tooltip: {
                    formatter: `${rule.Name} (${type}) <br/> ${sigDate}`
                }
            };
        }).filter(Boolean);

        const calculateMA = (dayCount, data) => {
            const result = [];
            for (let i = 0, len = data.length; i < len; i++) {
                if (i < dayCount - 1) {
                    result.push('-');
                    continue;
                }
                let sum = 0;
                for (let j = 0; j < dayCount; j++) {
                    sum += data[i - j].close;
                }
                result.push(+(sum / dayCount).toFixed(2));
            }
            return result;
        };

        const calculateEMA = (dayCount, data, key = 'close') => {
            const k = 2 / (dayCount + 1);
            const result = [];
            let ema = data[0][key];
            result.push(ema);
            for (let i = 1; i < data.length; i++) {
                ema = (data[i][key] * k) + (ema * (1 - k));
                result.push(ema);
            }
            return result;
        };

        const calculateMACD = (shortPeriod, longPeriod, signalPeriod, data) => {
            const shortEMA = calculateEMA(shortPeriod, data);
            const longEMA = calculateEMA(longPeriod, data);

            const macdLine = [];
            for (let i = 0; i < data.length; i++) {
                macdLine.push(shortEMA[i] - longEMA[i]);
            }

            // Calculate Signal Line (EMA of MACD Line)
            // We need to handle the initial ramp up where EMA might differ, 
            // but standard simple approach:
            const signalLineData = macdLine.map(val => ({ close: val })); // Wrap for helper
            const signalLine = calculateEMA(signalPeriod, signalLineData, 'close');

            const histogram = [];
            for (let i = 0; i < data.length; i++) {
                histogram.push(macdLine[i] - signalLine[i]);
            }

            return { macdLine, signalLine, histogram };
        };

        // We need data in ascending order for EMA calculation
        const ascendingData = [...sortedData].reverse();
        const { macdLine: macdReverse, signalLine: signalReverse, histogram: histReverse } = calculateMACD(12, 26, 9, ascendingData);

        // Reverse back to match descending sortedData for chart (or chart expects matching index)
        // Actually, sortedData is descending (newest first). 
        // calculateEMA processed ascending (oldest first). 
        // So we need to reverse the results to match sortedData which is index 0 = newest.
        const macdLine = [...macdReverse].reverse();
        const signalLine = [...signalReverse].reverse();
        const histogram = [...histReverse].reverse();


        const ma9 = calculateMA(9, sortedData);
        const lastDataPoint = sortedData[sortedData.length - 1];
        const lastClose = lastDataPoint ? lastDataPoint.close : null;

        return {
            backgroundColor: '#1f2937', // gray-800
            animation: false,
            legend: {
                bottom: 10,
                left: 'center',
                data: [symbol || 'Chart', 'MACD', 'Signal', 'Histogram'],
                textStyle: { color: '#9ca3af' }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross'
                },
                backgroundColor: 'rgba(55, 65, 81, 0.9)',
                borderColor: '#4b5563',
                textStyle: { color: '#fff' }
            },
            axisPointer: {
                link: [{ xAxisIndex: 'all' }],
                label: {
                    backgroundColor: '#777'
                }
            },
            visualMap: {
                show: false,
                seriesIndex: 1,
                dimension: 2,
                pieces: [
                    { value: 1, color: '#10b981' }, // Up (Green)
                    { value: -1, color: '#ef4444' } // Down (Red)
                ]
            },
            grid: [
                {
                    left: '10%',
                    right: '8%',
                    height: '50%'
                },
                {
                    left: '10%',
                    right: '8%',
                    top: '63%',
                    height: '15%'
                },
                {
                    left: '10%',
                    right: '8%',
                    top: '82%',
                    height: '10%'
                }
            ],
            xAxis: [
                {
                    type: 'category',
                    data: dates,
                    scale: true,
                    boundaryGap: false,
                    axisLine: { onZero: false, lineStyle: { color: '#4b5563' } },
                    axisLabel: { show: false }, // Hide label for top chart
                    splitLine: { show: false }
                },
                {
                    type: 'category',
                    gridIndex: 1,
                    data: dates,
                    scale: true,
                    boundaryGap: false,
                    axisLine: { onZero: false, lineStyle: { color: '#4b5563' } },
                    axisTick: { show: false },
                    axisLabel: { show: false },
                    splitLine: { show: false }
                },
                {
                    type: 'category',
                    gridIndex: 2,
                    data: dates,
                    scale: true,
                    boundaryGap: false,
                    axisLine: { onZero: false, lineStyle: { color: '#4b5563' } },
                    axisTick: { show: false },
                    axisLabel: { color: '#9ca3af' },
                    splitLine: { show: false }
                }
            ],
            yAxis: [
                {
                    scale: true,
                    position: 'right',
                    splitArea: { show: false },
                    splitLine: { lineStyle: { color: '#374151' } },
                    axisLabel: { color: '#9ca3af' }
                },
                {
                    scale: true,
                    gridIndex: 1,
                    splitNumber: 2,
                    axisLabel: { show: false },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: { show: false }
                },
                {
                    scale: true,
                    gridIndex: 2,
                    splitNumber: 2,
                    position: 'right',
                    axisLabel: { color: '#9ca3af', fontSize: 10 },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: { show: false }
                }
            ],
            dataZoom: [
                {
                    type: 'inside',
                    xAxisIndex: [0, 1, 2],
                    start: 0,
                    end: 100
                },
                {
                    show: true,
                    xAxisIndex: [0, 1, 2],
                    type: 'slider',
                    top: '94%',
                    start: 50,
                    end: 100,
                    borderColor: '#4b5563',
                    textStyle: { color: '#9ca3af' }
                }
            ],
            series: [
                {
                    name: symbol || 'Chart',
                    type: 'candlestick',
                    data: values,
                    itemStyle: {
                        color: '#10b981', // Up color (Green)
                        color0: '#ef4444', // Down color (Red)
                        borderColor: '#10b981',
                        borderColor0: '#ef4444'
                    },
                    markPoint: {
                        data: signalMarks,
                        symbol: 'pin',
                        symbolSize: 40,
                        label: {
                            show: true,
                            formatter: '{c}',
                            fontSize: 10,
                            color: '#fff'
                        }
                    },
                    markLine: lastClose ? {
                        symbol: ['none', 'none'],
                        data: [
                            {
                                yAxis: lastClose,
                                label: {
                                    show: true,
                                    position: 'end',
                                    formatter: '{c}',
                                    color: '#fff',
                                    padding: [2, 4],
                                    borderRadius: 2,
                                    backgroundColor: '#3b82f6'
                                }
                            }
                        ],
                        lineStyle: {
                            color: '#3b82f6',
                            type: 'dashed',
                            width: 1
                        },
                        animation: false
                    } : undefined
                },
                {
                    name: 'Volume',
                    type: 'bar',
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: volumes
                },
                {
                    name: 'MA9',
                    type: 'line',
                    data: ma9,
                    smooth: true,
                    showSymbol: false,
                    lineStyle: {
                        opacity: 0.8,
                        width: 1.5,
                        color: '#fbbf24' // Amber-400
                    }
                },
                {
                    name: 'MACD',
                    type: 'line',
                    xAxisIndex: 2,
                    yAxisIndex: 2,
                    data: macdLine,
                    smooth: true,
                    showSymbol: false,
                    lineStyle: {
                        width: 1,
                        color: '#fff'
                    }
                },
                {
                    name: 'Signal',
                    type: 'line',
                    xAxisIndex: 2,
                    yAxisIndex: 2,
                    data: signalLine,
                    smooth: true,
                    showSymbol: false,
                    lineStyle: {
                        width: 1,
                        color: '#f59e0b'
                    }
                },
                {
                    name: 'Histogram',
                    type: 'bar',
                    xAxisIndex: 2,
                    yAxisIndex: 2,
                    data: histogram,
                    itemStyle: {
                        color: (params) => {
                            return params.value >= 0 ? '#10b981' : '#ef4444';
                        }
                    }
                }
            ]
        };
    }, [data, symbol, signals]);

    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                No data available for chart
            </div>
        );
    }

    return (
        <ReactECharts
            option={chartOption}
            style={{ height: '100%', width: '100%' }}
            theme="dark"
        />
    );
};

export default CandleChart;
