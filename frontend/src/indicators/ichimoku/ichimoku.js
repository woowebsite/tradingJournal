const midpoint = (data, index, period) => {
    const start = index - period + 1;
    if (start < 0) return null;

    let highest = -Infinity;
    let lowest = Infinity;
    for (let i = start; i <= index; i += 1) {
        highest = Math.max(highest, Number(data[i].high));
        lowest = Math.min(lowest, Number(data[i].low));
    }
    return (highest + lowest) / 2;
};

export const calculateIchimoku = (
    data,
    { conversionPeriod = 9, basePeriod = 26, spanBPeriod = 52, displacement = 26 } = {},
) => {
    if (!Array.isArray(data) || data.length === 0) return {
        conversion: [],
        base: [],
        spanA: [],
        spanB: [],
    };

    const conversion = [];
    const base = [];
    const spanA = [];
    const spanB = [];

    data.forEach((candle, index) => {
        const conversionValue = midpoint(data, index, conversionPeriod);
        const baseValue = midpoint(data, index, basePeriod);
        const spanBValue = midpoint(data, index, spanBPeriod);
        const time = candle.time !== undefined ? candle.time : String(candle.date || '').split('T')[0];

        if (conversionValue != null) conversion.push({ time, value: conversionValue });
        if (baseValue != null) base.push({ time, value: baseValue });

        // Senkou spans are plotted displacement periods ahead of their source candle.
        const displacedCandle = data[index + displacement];
        if (displacedCandle && conversionValue != null && baseValue != null) {
            spanA.push({
                time: displacedCandle.time !== undefined ? displacedCandle.time : String(displacedCandle.date || '').split('T')[0],
                value: (conversionValue + baseValue) / 2,
            });
        }
        if (displacedCandle && spanBValue != null) {
            spanB.push({
                time: displacedCandle.time !== undefined ? displacedCandle.time : String(displacedCandle.date || '').split('T')[0],
                value: spanBValue,
            });
        }
    });

    return { conversion, base, spanA, spanB };
};

const drawCloud = (chart, priceSeries, container, spanA, spanB) => {
    if (!container || spanA.length === 0 || spanB.length === 0) return () => {};

    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '2';
    container.appendChild(canvas);

    const aByTime = new Map(spanA.map(item => [item.time, item.value]));
    const bByTime = new Map(spanB.map(item => [item.time, item.value]));
    const times = [...new Set([...aByTime.keys()].filter(time => bByTime.has(time)))];

    const redraw = () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.floor(width * ratio));
        canvas.height = Math.max(1, Math.floor(height * ratio));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const context = canvas.getContext('2d');
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, width, height);

        for (let index = 1; index < times.length; index += 1) {
            const previousTime = times[index - 1];
            const currentTime = times[index];
            const previousX = chart.timeScale().timeToCoordinate(previousTime);
            const currentX = chart.timeScale().timeToCoordinate(currentTime);
            const previousAY = priceSeries.priceToCoordinate(aByTime.get(previousTime));
            const currentAY = priceSeries.priceToCoordinate(aByTime.get(currentTime));
            const previousBY = priceSeries.priceToCoordinate(bByTime.get(previousTime));
            const currentBY = priceSeries.priceToCoordinate(bByTime.get(currentTime));

            if ([previousX, currentX, previousAY, currentAY, previousBY, currentBY].some(value => value == null)) continue;

            const isBullish = (aByTime.get(previousTime) + aByTime.get(currentTime))
                >= (bByTime.get(previousTime) + bByTime.get(currentTime));
            context.beginPath();
            context.moveTo(previousX, previousAY);
            context.lineTo(currentX, currentAY);
            context.lineTo(currentX, currentBY);
            context.lineTo(previousX, previousBY);
            context.closePath();
            context.fillStyle = isBullish ? 'rgba(34, 197, 94, 0.16)' : 'rgba(236, 72, 153, 0.16)';
            context.fill();
        }
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(redraw);
    window.addEventListener('resize', redraw);
    redraw();
    return () => {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(redraw);
        window.removeEventListener('resize', redraw);
        canvas.remove();
    };
};

export const drawIchimoku = (chart, LineSeries, data, container, priceSeries) => {
    const addLine = (seriesData, color, lineWidth = 1) => {
        if (seriesData.length === 0) return;
        chart.addSeries(LineSeries, {
            color,
            lineWidth,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
        }).setData(seriesData);
    };

    addLine(data.conversion, '#38bdf8');
    addLine(data.base, 'red');
    addLine(data.spanA, '#22c55e');
    addLine(data.spanB, '#ef4444');
    return drawCloud(chart, priceSeries, container, data.spanA, data.spanB);
};

export const drawIchimoku78 = (chart, LineSeries, data) => {
    const addLine = (seriesData, color, lineWidth = 1) => {
        if (seriesData.length === 0) return;
        chart.addSeries(LineSeries, {
            color,
            lineWidth,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
        }).setData(seriesData);
    };

    addLine(data.conversion, 'red');
    addLine(data.base, 'rgba(46, 129, 255, 1)', 2);
};
