export const calculateSMA = (data, count, key = 'close') => {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        if (i < count - 1) {
            // Not enough data for SMA yet
            continue;
        }
        let sum = 0;
        for (let j = 0; j < count; j++) {
            sum += data[i - j][key];
        }
        result.push({
            time: data[i].time,
            value: sum / count,
        });
    }
    return result;
};

export const drawMA = (chart, LineSeries, candleData, period = 200, options = {}) => {
    const isCalculated = Array.isArray(candleData) && candleData.length > 0 && candleData[0].value !== undefined && candleData[0].close === undefined;
    const maData = isCalculated ? candleData : calculateSMA(candleData, period);

    const maSeries = chart.addSeries(LineSeries, {
        color: 'white',
        lineWidth: 2,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
        ...options,
    });
    maSeries.setData(maData);
    return maSeries;
};

