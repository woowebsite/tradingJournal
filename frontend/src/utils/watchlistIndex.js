const DAY_LENGTH = 10;

const toDay = (date) => String(date || '').slice(0, DAY_LENGTH);

const normalizeDate = (bar) => {
    const rawDate = bar?.date ?? bar?.tradingDate ?? bar?.time ?? bar?.timestamp;
    if (typeof rawDate === 'number') {
        const milliseconds = rawDate < 1e12 ? rawDate * 1000 : rawDate;
        return new Date(milliseconds).toISOString();
    }
    const parsed = new Date(rawDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export const normalizeChartHistory = (bars) => (bars || [])
    .map(bar => ({
        date: normalizeDate(bar),
        open: Number(bar.open),
        high: Number(bar.high),
        low: Number(bar.low),
        close: Number(bar.close),
        volume: Number(bar.volume) || 0,
    }))
    .filter(bar => bar.date && ['open', 'high', 'low', 'close'].every(field => Number.isFinite(bar[field])))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

export const buildEqualWeightIndex = (historyGroups) => {
    const validGroups = (historyGroups || [])
        .map(group => [...(group || [])].sort((a, b) => new Date(a.date) - new Date(b.date)))
        .filter(group => group.length > 0 && Number(group[0].close) > 0);

    if (validGroups.length === 0) return [];

    const commonDates = validGroups
        .map(group => new Set(group.map(candle => toDay(candle.date))))
        .reduce((common, dates) => new Set([...common].filter(date => dates.has(date))));

    if (commonDates.size === 0) return [];

    const firstCommonDate = [...commonDates].sort()[0];
    const preparedGroups = validGroups.map(group => {
        const byDate = new Map(group.map(candle => [toDay(candle.date), candle]));
        const baseClose = Number(byDate.get(firstCommonDate)?.close);
        return { byDate, baseClose };
    }).filter(group => Number.isFinite(group.baseClose) && group.baseClose > 0);

    if (preparedGroups.length !== validGroups.length) return [];

    return [...commonDates].sort().map(date => {
        const normalized = preparedGroups.map(({ byDate, baseClose }) => {
            const candle = byDate.get(date);
            return {
                open: Number(candle.open) / baseClose * 100,
                high: Number(candle.high) / baseClose * 100,
                low: Number(candle.low) / baseClose * 100,
                close: Number(candle.close) / baseClose * 100,
                volume: Number(candle.volume) || 0,
            };
        });
        const average = field => normalized.reduce((sum, candle) => sum + candle[field], 0) / normalized.length;

        return {
            date: `${date}T00:00:00.000Z`,
            open: average('open'),
            high: average('high'),
            low: average('low'),
            close: average('close'),
            volume: normalized.reduce((sum, candle) => sum + candle.volume, 0),
        };
    });
};
