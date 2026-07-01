import { calculateEMA } from './ema';

export const calculateMACD = (shortPeriod, longPeriod, signalPeriod, data) => {
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
