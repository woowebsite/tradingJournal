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

export const getStrategyDetail = async (strategyKey, ticker = 'NNC') => {
    const normalizedTicker = ticker.trim().toUpperCase();
    const response = await api.get(
        `/tcbs-strategies/get-detail?strategyKey=${encodeURIComponent(strategyKey)}&ticker=${encodeURIComponent(normalizedTicker)}`
    );
    return response.data.data;
};

export const getAllStrategyDetails = async (ticker = '') => {
    const normalizedTicker = ticker.trim().toUpperCase();
    const pageSize = 100;
    let page = 1;
    let allDetails = [];
    let pageCount = 1;

    do {
        const params = new URLSearchParams({
            'pagination[page]': String(page),
            'pagination[pageSize]': String(pageSize),
            'sort[0]': 'ticker:asc',
            'sort[1]': 'strategyKey:asc',
        });

        if (normalizedTicker) {
            params.set('filters[ticker][$eq]', normalizedTicker);
        }

        const response = await api.get(
            `/tcbs-strategy-details?${params.toString()}`
        );
        const data = response.data.data || [];
        allDetails = allDetails.concat(data);
        pageCount = response.data.meta?.pagination?.pageCount || 1;
        page += 1;
    } while (page <= pageCount);

    return allDetails;
};

export const syncStrategyDetail = async (strategyKey, strategyName, ticker = 'NNC') => {
    const normalizedTicker = ticker.trim().toUpperCase();

    const tcbsToken = import.meta.env.VITE_TCBS_TOKEN;
    const headers = {};

    if (tcbsToken && /^[\x00-\x7F]+$/.test(tcbsToken)) {
        headers['X-TCBS-Token'] = tcbsToken;
    }

    const params = new URLSearchParams({
        strategyKey,
        strategyName,
        ticker: normalizedTicker,
    });

    const response = await api.get(`/tcbs-strategies/sync-detail?${params.toString()}`, { headers });
    return response.data.data;
};

export const getBacktestConclusion = async (ticker = 'All') => {
    const normalizedTicker = String(ticker || 'All').trim() || 'All';
    const token = import.meta.env.VITE_TCBS_TOKEN;
    const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    };

    if (token && /^[\x00-\x7F]+$/.test(token)) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
        `/api-tcbs/tcbs-hfc-data/v2/digital/backtest-conclusion?ticker=${encodeURIComponent(normalizedTicker)}`,
        { method: 'GET', headers }
    );

    if (!response.ok) {
        throw new Error(`TCBS backtest conclusion API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
};
