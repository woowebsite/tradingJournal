export const DOJI_THRESHOLD = 0.001;
export const VOLUME_FLAT_THRESHOLD = 0.05;
const CANDLE_DIRECTIONS = ['up', 'down', 'doji'];

const unwrap = item => item?.attributes || item || {};
const toFiniteNumber = value => {
    if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

const isValidDayKey = value => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day;
};

const toDayKey = value => {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        const milliseconds = value < 1e12 ? value * 1000 : value;
        const date = new Date(milliseconds);
        return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
    }

    if (typeof value !== 'string' || !value.trim()) return null;
    const trimmed = value.trim();
    const datePrefix = trimmed.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (datePrefix) return isValidDayKey(datePrefix) ? datePrefix : null;

    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

/**
 * Convert history records to one valid OHLCV candle per trading day.
 * When a day is duplicated, the last record returned by the API wins.
 */
export const normalizeDailyCandles = histories => {
    const byDate = new Map();

    (Array.isArray(histories) ? histories : []).forEach(item => {
        const row = unwrap(item);
        const date = toDayKey(row.date ?? row.tradingDate ?? row.time);
        const open = toFiniteNumber(row.open);
        const close = toFiniteNumber(row.close);
        const volume = toFiniteNumber(row.volume);

        if (!date || open === null || close === null || volume === null || volume < 0) {
            return;
        }

        byDate.set(date, { date, open, close, volume });
    });

    return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
};

export const classifyCandleDirection = (candle, dojiThreshold = DOJI_THRESHOLD) => {
    const open = toFiniteNumber(candle?.open);
    const close = toFiniteNumber(candle?.close);
    if (open === null || close === null) return null;

    const referencePrice = Math.abs(open);
    const relativeBody = referencePrice === 0
        ? (close === open ? 0 : Number.POSITIVE_INFINITY)
        : Math.abs(close - open) / referencePrice;

    if (relativeBody <= dojiThreshold) return 'doji';
    return close > open ? 'up' : 'down';
};

export const classifyVolumeChange = (previousVolume, currentVolume, flatThreshold = VOLUME_FLAT_THRESHOLD) => {
    const previous = toFiniteNumber(previousVolume);
    const current = toFiniteNumber(currentVolume);
    if (previous === null || current === null || previous < 0 || current < 0) return null;
    if (previous === 0) return current === 0 ? 'flat' : 'up';

    const change = (current - previous) / previous;
    if (Math.abs(change) <= flatThreshold) return 'flat';
    return change > 0 ? 'up' : 'down';
};

const createPredictionAccumulator = () => ({
    sampleSize: 0,
    counts: { up: 0, down: 0, doji: 0 },
    returnSum: 0,
    returnSampleSize: 0,
});

const addNextCandleToPrediction = (prediction, candle) => {
    if (!candle) return;

    const direction = classifyCandleDirection(candle);
    if (!CANDLE_DIRECTIONS.includes(direction)) return;

    prediction.sampleSize += 1;
    prediction.counts[direction] += 1;

    // A zero open cannot produce a meaningful percentage return, but the
    // candle can still contribute to the direction probabilities.
    if (candle.open !== 0) {
        prediction.returnSum += ((candle.close - candle.open) / Math.abs(candle.open)) * 100;
        prediction.returnSampleSize += 1;
    }
};

const finalizePrediction = prediction => {
    const { sampleSize, counts, returnSum, returnSampleSize } = prediction;
    const probabilities = Object.fromEntries(CANDLE_DIRECTIONS.map(direction => [
        direction,
        sampleSize ? counts[direction] / sampleSize : 0,
    ]));
    const highestCount = Math.max(...CANDLE_DIRECTIONS.map(direction => counts[direction]));
    const leaders = highestCount
        ? CANDLE_DIRECTIONS.filter(direction => counts[direction] === highestCount)
        : [];

    return {
        sampleSize,
        counts: { ...counts },
        probabilities,
        dominantDirection: leaders.length === 1 ? leaders[0] : null,
        averageReturnPercent: returnSampleSize ? returnSum / returnSampleSize : null,
    };
};

/**
 * Group overlapping three-candle windows by price direction and relative volume.
 * Percentages use the number of valid three-candle windows as the denominator.
 */
export const analyzeThreeCandlePatterns = histories => {
    const candles = normalizeDailyCandles(histories);
    const totalWindows = Math.max(0, candles.length - 2);
    if (!totalWindows) return [];

    const patterns = new Map();

    for (let index = 0; index < totalWindows; index += 1) {
        const window = candles.slice(index, index + 3);
        const candleDirections = window.map(candle => classifyCandleDirection(candle));
        const volumeDirections = [
            classifyVolumeChange(window[0].volume, window[1].volume),
            classifyVolumeChange(window[1].volume, window[2].volume),
        ];
        const key = `${candleDirections.join('-')}__${volumeDirections.join('-')}`;
        const lastSeen = window[2].date;
        const occurrence = {
            dates: window.map(candle => candle.date),
            startDate: window[0].date,
            endDate: lastSeen,
        };
        const nextCandle = candles[index + 3];
        const existing = patterns.get(key);

        if (existing) {
            existing.count += 1;
            existing.lastSeen = lastSeen;
            existing.occurrences.push(occurrence);
            addNextCandleToPrediction(existing.prediction, nextCandle);
        } else {
            const prediction = createPredictionAccumulator();
            addNextCandleToPrediction(prediction, nextCandle);
            patterns.set(key, {
                key,
                candles: candleDirections,
                volumes: volumeDirections,
                count: 1,
                percentage: 0,
                lastSeen,
                occurrences: [occurrence],
                prediction,
            });
        }
    }

    return [...patterns.values()]
        .map(pattern => ({
            ...pattern,
            percentage: (pattern.count / totalWindows) * 100,
            prediction: finalizePrediction(pattern.prediction),
            // Expose the latest match first for detail views and navigation.
            occurrences: [...pattern.occurrences].reverse(),
        }))
        .sort((left, right) => (
            right.count - left.count
            || right.lastSeen.localeCompare(left.lastSeen)
            || left.key.localeCompare(right.key)
        ));
};
