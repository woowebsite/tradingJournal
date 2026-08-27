export const calculateSupertrend = (period, multiplier, data) => {
    const length = data.length;
    if (length === 0) return [];

    const tr = new Array(length);
    const atr = new Array(length);
    const basicUpper = new Array(length);
    const basicLower = new Array(length);
    const finalUpper = new Array(length);
    const finalLower = new Array(length);
    const supertrend = new Array(length);
    const direction = new Array(length); // 1 for up, -1 for down

    // 1. Calculate TR
    tr[0] = data[0].high - data[0].low;
    for (let i = 1; i < length; i++) {
        const hl = data[i].high - data[i].low;
        const hc = Math.abs(data[i].high - data[i - 1].close);
        const lc = Math.abs(data[i].low - data[i - 1].close);
        tr[i] = Math.max(hl, hc, lc);
    }

    // 2. Calculate ATR (Wilder's Smoothing)
    if (length >= period) {
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += tr[i];
        }
        atr[period - 1] = sum / period;
        for (let i = period; i < length; i++) {
            atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
        }
    } else {
        let sum = 0;
        for (let i = 0; i < length; i++) {
            sum += tr[i];
        }
        const avg = sum / length;
        for (let i = 0; i < length; i++) {
            atr[i] = avg;
        }
    }

    // Fill initial values for atr
    for (let i = 0; i < period - 1; i++) {
        atr[i] = atr[period - 1] || 0;
    }

    // 3. Calculate Bands and Supertrend
    for (let i = 0; i < length; i++) {
        const src = (data[i].high + data[i].low) / 2;
        basicUpper[i] = src + multiplier * atr[i];
        basicLower[i] = src - multiplier * atr[i];
    }

    // Initialize the first element
    finalUpper[0] = basicUpper[0];
    finalLower[0] = basicLower[0];
    supertrend[0] = finalUpper[0];
    direction[0] = -1;

    for (let i = 1; i < length; i++) {
        const prevClose = data[i - 1].close;

        // Final Upper Band
        if (basicUpper[i] < finalUpper[i - 1] || prevClose > finalUpper[i - 1]) {
            finalUpper[i] = basicUpper[i];
        } else {
            finalUpper[i] = finalUpper[i - 1];
        }

        // Final Lower Band
        if (basicLower[i] > finalLower[i - 1] || prevClose < finalLower[i - 1]) {
            finalLower[i] = basicLower[i];
        } else {
            finalLower[i] = finalLower[i - 1];
        }

        // Supertrend direction and value
        if (supertrend[i - 1] === finalUpper[i - 1]) {
            if (data[i].close > finalUpper[i]) {
                supertrend[i] = finalLower[i];
                direction[i] = 1;
            } else {
                supertrend[i] = finalUpper[i];
                direction[i] = -1;
            }
        } else {
            if (data[i].close < finalLower[i]) {
                supertrend[i] = finalUpper[i];
                direction[i] = -1;
            } else {
                supertrend[i] = finalLower[i];
                direction[i] = 1;
            }
        }
    }

    return supertrend.map((val, idx) => ({
        time: data[idx].time || data[idx].date,
        value: +val.toFixed(2),
        direction: direction[idx]
    }));
};

export const drawSupertrend = (chart, LineSeries, supertrendData) => {
    const segments = [];
    let currentSegment = null;

    for (let i = 0; i < supertrendData.length; i++) {
        const item = supertrendData[i];
        const formattedTime = item.time !== undefined ? item.time : (item.date ? String(item.date).split('T')[0] : '');

        if (!currentSegment) {
            currentSegment = {
                direction: item.direction,
                data: [{ time: formattedTime, value: item.value }]
            };
        } else if (currentSegment.direction === item.direction) {
            currentSegment.data.push({ time: formattedTime, value: item.value });
        } else {
            // Connect transition point
            currentSegment.data.push({ time: formattedTime, value: item.value });
            segments.push(currentSegment);

            currentSegment = {
                direction: item.direction,
                data: [{ time: formattedTime, value: item.value }]
            };
        }
    }
    if (currentSegment) {
        segments.push(currentSegment);
    }

    segments.forEach(segment => {
        const color = segment.direction === 1 ? '#10b981' : '#ef4444'; // Emerald for Up, Red for Down
        chart.addSeries(LineSeries, {
            color: color,
            lineWidth: 2,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
        }).setData(segment.data);
    });
};

