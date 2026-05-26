import api from './api';

export const syncTcbsStrategySignals = async ({
    strategyKey = 'price_volume_increase',
    strategyName = 'Bùng nổ khối lượng',
    ticker = 'NNC',
} = {}) => {
    const params = new URLSearchParams({
        strategyKey,
        strategyName,
        ticker,
    });

    const tcbsToken = import.meta.env.VITE_TCBS_TOKEN;
    const headers = {};

    if (tcbsToken && /^[\x00-\x7F]+$/.test(tcbsToken)) {
        headers['X-TCBS-Token'] = tcbsToken;
    }

    const response = await api.get(`/tcbs-strategies/sync-signal?${params.toString()}`, { headers });
    return response.data.data;
};

export const fetchRecentTcbsStrategySignals = async (ticker = 'NNC') => {
    const normalizedTicker = ticker.trim().toUpperCase();
    const response = await api.get(
        `/tcbs-strategy-signals?filters[ticker][$eq]=${encodeURIComponent(normalizedTicker)}&sort=TDate:desc&pagination[pageSize]=10&populate=strategy`
    );

    return response.data.data || [];
};

export const getTcbsStrategySignals = async (strategyKey, ticker = 'NNC') => {
    const normalizedTicker = ticker.trim().toUpperCase();
    const response = await api.get(
        `/tcbs-strategy-signals?filters[ticker][$eq]=${encodeURIComponent(normalizedTicker)}&filters[strategyKey][$eq]=${encodeURIComponent(strategyKey)}&sort=TDate:desc&pagination[pageSize]=1000`
    );

    return response.data.data || [];
};
