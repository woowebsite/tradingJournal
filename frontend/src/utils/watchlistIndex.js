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

export const buildEqualWeightIndex = (historyGroups, referenceHistory = [], baseValue = 100) => {
    const validGroups = (historyGroups || [])
        .map(group => [...(group || [])].sort((a, b) => new Date(a.date) - new Date(b.date)))
        .filter(group => group.length > 0 && Number(group[0].close) > 0);

    if (validGroups.length === 0) return [];

    const commonDates = validGroups
        .map(group => new Set(group.map(candle => toDay(candle.date))))
        .reduce((common, dates) => new Set([...common].filter(date => dates.has(date))));

    if (commonDates.size === 0) return [];

    const referenceByDate = new Map((referenceHistory || []).map(candle => [toDay(candle.date), candle]));
    const comparableDates = referenceByDate.size > 0
        ? new Set([...commonDates].filter(date => referenceByDate.has(date)))
        : commonDates;
    if (comparableDates.size === 0) return [];

    const firstCommonDate = [...comparableDates].sort()[0];
    const referenceClose = Number(referenceByDate.get(firstCommonDate)?.close);
    const indexBase = Number.isFinite(referenceClose) && referenceClose > 0 ? referenceClose : baseValue;
    const preparedGroups = validGroups.map(group => {
        const byDate = new Map(group.map(candle => [toDay(candle.date), candle]));
        const baseClose = Number(byDate.get(firstCommonDate)?.close);
        return { byDate, baseClose };
    }).filter(group => Number.isFinite(group.baseClose) && group.baseClose > 0);

    if (preparedGroups.length !== validGroups.length) return [];

    return [...comparableDates].sort().map(date => {
        const normalized = preparedGroups.map(({ byDate, baseClose }) => {
            const candle = byDate.get(date);
            return {
                open: Number(candle.open) / baseClose * indexBase,
                high: Number(candle.high) / baseClose * indexBase,
                low: Number(candle.low) / baseClose * indexBase,
                close: Number(candle.close) / baseClose * indexBase,
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

const getRatioWeight = (ratio) => {
    const capitalize = Number(ratio?.capitalize);
    const outstandingShare = Number(ratio?.outstandingShare);
    const tradeVolume = Number(ratio?.tradeVolume);

    if (![capitalize, outstandingShare, tradeVolume].every(Number.isFinite)
        || capitalize <= 0 || outstandingShare <= 0 || tradeVolume <= 0) {
        return null;
    }

    return capitalize;
};

export const buildMarketCapWeights = (ratioGroups = []) => {
    const rawWeights = ratioGroups.map(getRatioWeight);
    const knownWeights = rawWeights.filter(weight => Number.isFinite(weight) && weight > 0);
    const fallbackWeight = knownWeights.length > 0
        ? knownWeights.reduce((sum, weight) => sum + weight, 0) / knownWeights.length
        : 1;

    return rawWeights.map((weight, index) => ({
        index,
        weight: weight || fallbackWeight,
        hasValidRatio: Number.isFinite(weight) && weight > 0,
        fallbackWeight: !(Number.isFinite(weight) && weight > 0),
    }));
};

export const buildMarketCapWeightedIndex = (historyGroups, ratioGroups, referenceHistory = [], baseValue = 100) => {
    const weights = buildMarketCapWeights(ratioGroups);
    const groups = (historyGroups || []).map((group, index) => {
        const history = [...(group || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
        return history.length > 0 && Number(history[0].close) > 0
            ? { history, weight: weights[index]?.weight || 1 }
            : null;
    }).filter(Boolean);

    if (groups.length === 0) return [];
    const validGroups = groups;

    const commonDates = validGroups
        .map(({ history }) => new Set(history.map(candle => toDay(candle.date))))
        .reduce((common, dates) => new Set([...common].filter(date => dates.has(date))));
    if (commonDates.size === 0) return [];

    const referenceByDate = new Map((referenceHistory || []).map(candle => [toDay(candle.date), candle]));
    const comparableDates = referenceByDate.size > 0
        ? new Set([...commonDates].filter(date => referenceByDate.has(date)))
        : commonDates;
    if (comparableDates.size === 0) return [];

    const firstCommonDate = [...comparableDates].sort()[0];
    const referenceClose = Number(referenceByDate.get(firstCommonDate)?.close);
    const indexBase = Number.isFinite(referenceClose) && referenceClose > 0 ? referenceClose : baseValue;
    const preparedGroups = validGroups.map(({ history, weight }) => {
        const byDate = new Map(history.map(candle => [toDay(candle.date), candle]));
        const baseClose = Number(byDate.get(firstCommonDate)?.close);
        return { byDate, baseClose, weight };
    }).filter(group => Number.isFinite(group.baseClose) && group.baseClose > 0);
    if (preparedGroups.length === 0) return [];

    const totalWeight = preparedGroups.reduce((sum, group) => sum + group.weight, 0);
    if (!Number.isFinite(totalWeight) || totalWeight <= 0) return [];

    return [...comparableDates].sort().map(date => {
        const weighted = preparedGroups.map(({ byDate, baseClose, weight }) => {
            const candle = byDate.get(date);
            const normalizedWeight = weight / totalWeight;
            return {
                open: Number(candle.open) / baseClose * indexBase * normalizedWeight,
                high: Number(candle.high) / baseClose * indexBase * normalizedWeight,
                low: Number(candle.low) / baseClose * indexBase * normalizedWeight,
                close: Number(candle.close) / baseClose * indexBase * normalizedWeight,
                volume: Number(candle.volume) || 0,
            };
        });
        const sum = field => weighted.reduce((total, candle) => total + candle[field], 0);

        return {
            date: `${date}T00:00:00.000Z`,
            open: sum('open'),
            high: sum('high'),
            low: sum('low'),
            close: sum('close'),
            volume: sum('volume'),
        };
    });
};
