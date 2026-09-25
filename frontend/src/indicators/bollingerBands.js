export const calculateBollingerBands = (data, period = 26, stdDev = 1.0, key = 'close') => {
    const upper = [];
    const middle = [];
    const lower = [];

    if (!Array.isArray(data) || data.length < period) {
        return { upper, middle, lower };
    }

    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += Number(data[i - j][key] || 0);
        }
        const mean = sum / period;

        let varianceSum = 0;
        for (let j = 0; j < period; j++) {
            const diff = Number(data[i - j][key] || 0) - mean;
            varianceSum += diff * diff;
        }
        const stdev = Math.sqrt(varianceSum / period);

        const time = data[i].time;
        const upperVal = mean + (stdDev * stdev);
        const lowerVal = mean - (stdDev * stdev);

        middle.push({ time, value: mean });
        upper.push({ time, value: upperVal });
        lower.push({ time, value: lowerVal });
    }

    return { upper, middle, lower };
};

export const drawBollingerBands = (chart, LineSeries, candleData, period = 26, stdDev = 1.0, options = {}) => {
    const { upper, middle, lower } = calculateBollingerBands(candleData, period, stdDev);

    const upperSeries = chart.addSeries(LineSeries, {
        title: `BB Upper (${period}, ${stdDev})`,
        color: '#38bdf8', // light blue / cyan
        lineWidth: 1.5,
        lineStyle: 0,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
        ...options.upperOptions,
    });
    upperSeries.setData(upper);

    const middleSeries = chart.addSeries(LineSeries, {
        title: `BB Basis (${period})`,
        color: '#818cf8', // indigo / purple
        lineWidth: 1,
        lineStyle: 2, // Dashed
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
        ...options.middleOptions,
    });
    middleSeries.setData(middle);

    const lowerSeries = chart.addSeries(LineSeries, {
        title: `BB Lower (${period}, ${stdDev})`,
        color: '#38bdf8', // light blue / cyan
        lineWidth: 1.5,
        lineStyle: 0,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
        ...options.lowerOptions,
    });
    lowerSeries.setData(lower);

    return { upperSeries, middleSeries, lowerSeries };
};
