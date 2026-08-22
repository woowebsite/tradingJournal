/**
 * Helper to parse date string/object into a timezone-agnostic UTC Date object.
 * This avoids local timezone shifts when parsing YYYY-MM-DD strings.
 */
const parseToUTCDate = (dateStr) => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;

    const str = String(dateStr).trim();
    const isoMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[T ](\d{1,2}):(\d{1,2}):(\d{1,2}))?/);
    if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10) - 1; // 0-indexed month
        const day = parseInt(isoMatch[3], 10);
        const hour = isoMatch[4] ? parseInt(isoMatch[4], 10) : 0;
        const minute = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
        const second = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;

        return new Date(Date.UTC(year, month, day, hour, minute, second));
    }

    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    return d;
};

/**
 * Calculates the Anchored VWAP (Volume Weighted Average Price)
 * @param {Array} data - Array of candle objects containing close, high, low, volume, time/date
 * @param {string} anchor - Anchor period: 'Day', 'Week', 'Month', 'Year' (case-insensitive)
 * @param {string} priceSource - Price source: 'typical', 'close', 'hl2', 'ohlc4'
 * @returns {Array} - Array of objects with { time, value }
 */
export const calculateVWAP = (data, anchor = 'Day', priceSource = 'typical') => {
    if (!data || data.length === 0) return [];

    const result = [];
    let cumulativePriceVolume = 0;
    let cumulativePriceSquaredVolume = 0;
    let cumulativeVolume = 0;
    let lastAnchorKey = null;

    const getAnchorKey = (item, anchorType) => {
        const d = parseToUTCDate(item.time || item.date);
        if (!d) return '';

        const year = d.getUTCFullYear();
        const month = d.getUTCMonth() + 1;
        const day = d.getUTCDate();

        switch (anchorType.toLowerCase()) {
            case 'year':
                return `${year}`;
            case 'month':
                return `${year}-${month}`;
            case 'week': {
                // Group by the preceding Monday
                const tempDate = new Date(d);
                const dayOfWeek = tempDate.getUTCDay(); // 0 (Sun) to 6 (Sat)
                const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // distance to Monday
                tempDate.setUTCDate(tempDate.getUTCDate() - diff);
                return `${tempDate.getUTCFullYear()}-${tempDate.getUTCMonth() + 1}-${tempDate.getUTCDate()}`;
            }
            case 'day':
            default:
                return `${year}-${month}-${day}`;
        }
    };

    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const open = item.open !== undefined ? Number(item.open) : Number(item.close);
        const high = item.high !== undefined ? Number(item.high) : Number(item.close);
        const low = item.low !== undefined ? Number(item.low) : Number(item.close);
        const close = Number(item.close);
        const volume = (item.volume !== undefined && item.volume !== null) ? Number(item.volume) : 0;

        let price = close;
        if (priceSource === 'typical') {
            price = (high + low + close) / 3;
        } else if (priceSource === 'hl2') {
            price = (high + low) / 2;
        } else if (priceSource === 'ohlc4') {
            price = (open + high + low + close) / 4;
        }

        const anchorKey = getAnchorKey(item, anchor);

        if (i === 0 || anchorKey !== lastAnchorKey) {
            // Reset anchor accumulation
            cumulativePriceVolume = price * volume;
            cumulativePriceSquaredVolume = price * price * volume;
            cumulativeVolume = volume;
            lastAnchorKey = anchorKey;
        } else {
            cumulativePriceVolume += price * volume;
            cumulativePriceSquaredVolume += price * price * volume;
            cumulativeVolume += volume;
        }

        const vwapValue = cumulativeVolume > 0 ? (cumulativePriceVolume / cumulativeVolume) : price;
        const variance = cumulativeVolume > 0 ? (cumulativePriceSquaredVolume / cumulativeVolume) - (vwapValue * vwapValue) : 0;
        const stdDev = Math.sqrt(Math.max(0, variance));

        result.push({
            time: item.time || (item.date ? String(item.date).split('T')[0] : ''),
            value: +vwapValue.toFixed(2),
            upper1: +(vwapValue + stdDev).toFixed(2),
            lower1: +(vwapValue - stdDev).toFixed(2),
            upper2: +(vwapValue + stdDev * 2).toFixed(2),
            lower2: +(vwapValue - stdDev * 2).toFixed(2),
            upper3: +(vwapValue + stdDev * 3).toFixed(2),
            lower3: +(vwapValue - stdDev * 3).toFixed(2)
        });
    }

    return result;
};

/**
 * Draws the VWAP line series and standard deviation bands on a lightweight-charts instance
 * @param {Object} chart - lightweight-charts chart instance
 * @param {Object} LineSeries - lightweight-charts LineSeries class/constructor reference
 * @param {Array} vwapData - The output of calculateVWAP
 * @param {Object} options - Custom lightweight-charts line series configuration options
 * @returns {Array} - Array of created series instances
 */
export const drawVWAP = (chart, LineSeries, vwapData, options = {}) => {
    const defaultOptions = {
        color: '#3b82f6', // blue-500
        lineWidth: 2,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: true,
        ...options
    };

    const mainSeries = chart.addSeries(LineSeries, defaultOptions);
    
    const formattedData = vwapData.map(item => ({
        time: item.time.split('T')[0],
        value: item.value
    }));

    mainSeries.setData(formattedData);

    const createdSeries = [mainSeries];

    // Config for standard deviation bands
    const bandConfigs = [
        { key: '1', color: 'rgba(59, 130, 246, 0.25)', title: 'SD 1' }, // light blue
        { key: '2', color: 'rgba(245, 158, 11, 0.25)', title: 'SD 2' }, // orange
        { key: '3', color: 'rgba(239, 68, 68, 0.25)', title: 'SD 3' },  // red
    ];

    if (options.showBands !== false) {
        bandConfigs.forEach(config => {
            const upperKey = `upper${config.key}`;
            const lowerKey = `lower${config.key}`;

            if (vwapData.length > 0 && vwapData[0][upperKey] !== undefined) {
                // Upper Band
                const upperSeries = chart.addSeries(LineSeries, {
                    color: config.color,
                    lineWidth: 1,
                    lineStyle: 2, // Dashed
                    crosshairMarkerVisible: false,
                    priceLineVisible: false,
                    lastValueVisible: false,
                });
                upperSeries.setData(vwapData.map(item => ({
                    time: item.time.split('T')[0],
                    value: item[upperKey]
                })));
                createdSeries.push(upperSeries);

                // Lower Band
                const lowerSeries = chart.addSeries(LineSeries, {
                    color: config.color,
                    lineWidth: 1,
                    lineStyle: 2, // Dashed
                    crosshairMarkerVisible: false,
                    priceLineVisible: false,
                    lastValueVisible: false,
                });
                lowerSeries.setData(vwapData.map(item => ({
                    time: item.time.split('T')[0],
                    value: item[lowerKey]
                })));
                createdSeries.push(lowerSeries);
            }
        });
    }

    return createdSeries;
};
