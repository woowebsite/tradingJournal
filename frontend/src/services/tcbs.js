// TCBS External API Service
import api from './api';

const TCBS_API_BASE = '/tcbs-data';

const getTcbsHeaders = () => {
    const token = import.meta.env.VITE_TCBS_TOKEN;
    const isAscii = token && [...token].every(char => char.charCodeAt(0) <= 127);
    return isAscii ? { 'X-TCBS-Token': token } : {};
};

const fetchTcbs = async (resource, params = {}) => {
    const response = await api.get(`${TCBS_API_BASE}/${resource}`, {
        params,
        headers: getTcbsHeaders(),
    });
    return response.data;
};

export const normalizeTcbsResolution = (resolution = 'D') => {
    const raw = String(resolution || 'D').trim().toUpperCase();
    if (raw === 'M1' || raw === '1') return '1';
    if (raw === 'M5' || raw === '5') return '5';
    if (raw === 'M30' || raw === '30') return '30';
    if (raw === 'W1' || raw === 'W' || raw === '1W') return 'W';
    return 'D';
};

export const getStockHistory = async (ticker, type = 'stock', resolution = 'D') => {
    const to = Math.floor(Date.now() / 1000);
    const countBack = 500;
    const normalizedResolution = normalizeTcbsResolution(resolution);
    const url = 'stock-history';

    try {
        const jsonData = await fetchTcbs(url, { ticker, type, resolution: normalizedResolution, to, countBack });
        return jsonData.data || jsonData || [];
    } catch (error) {
        console.error("Failed to fetch from TCBS:", error);
        throw error;
    }
};

export const getFuturesHistory = async (ticker, type = 'derivative', resolution = '1') => {
    const to = Math.floor(Date.now() / 1000);
    const countBack = 598;
    const normalizedResolution = normalizeTcbsResolution(resolution);
    const url = 'futures-history';

    try {
        const jsonData = await fetchTcbs(url, { ticker, type, resolution: normalizedResolution, to, countBack });

        // Transform data map if necessary
        // TCBS response example needed? Assuming standard array of objects based on URL params.
        // Usually returns structure like: { data: [...] } or just [...]
        // Based on typical TCBS:
        // { "data": [ { "open": ..., "high": ..., "low": ..., "close": ..., "volume": ..., "tradingDate": "..." }, ... ] }

        // Let's assume standard response and return the array.
        // We might need to inspect the response if it fails.
        return jsonData.data || jsonData || [];

    } catch (error) {
        console.error("Failed to fetch from TCBS:", error);
        throw error;
    }
};

export const getIntradaySnapshots = async (tickers) => {
    // tickers: "BIC,BTP,..."
    const url = 'intraday-snapshots';
    try {
        const jsonData = await fetchTcbs(url, { tickers });
        return jsonData.data || [];
    } catch (error) {
        console.error("Failed to fetch snapshots:", error);
        throw error;
    }
};

export const syncInvestorData = async (ticker, wsize = '1M') => {
    const response = await api.get('/tcbs-strategies/sync-investor', {
        params: { ticker, wsize },
        headers: getTcbsHeaders(),
    });
    return response.data?.data || response.data;
};

export const getMarketFlowLeader = async ({ exchange = 'ALL', industry = '2300', type = '1d' } = {}) => {
    const url = 'market-flow-leader';
    try {
        return await fetchTcbs(url, { exchange, industry, type });
    } catch (error) {
        console.error("Failed to fetch market flow:", error);
        throw error;
    }
};


export const getTechnicalIndicators = async (ticker) => {
    // URL: /api-tcbs/ta/v1/summary/gaugechart/${ticker}?period=D
    const url = 'technical-indicators';

    try {
        const data = await fetchTcbs(url, { ticker, period: 'D' });
        return data;
    } catch (error) {
        console.error("Failed to fetch indicators:", error);
        throw error; // Or return [] if we want to digest error?
    }
};


export const getTickerOverview = async (ticker) => {
    try {
        const normalizedTicker = String(ticker || '')
            .replace(/:(HOSE|HNX|UPCOM)$/i, '')
            .trim()
            .toUpperCase();
        if (!normalizedTicker || normalizedTicker.length > 4 || normalizedTicker.startsWith('VN30') || normalizedTicker.startsWith('VNINDEX')) {
            return {};
        }
        const url = 'ticker-overview';
        const data = await fetchTcbs(url, { ticker: normalizedTicker });
        return data?.data || data || {};
    } catch (err) {
        console.warn(`Could not get ticker overview for ${ticker}:`, err?.message || err);
        return {};
    }
};

export const getStockRatio = async (ticker) => {
    try {
        const normalizedTicker = String(ticker || '')
            .replace(/:(HOSE|HNX|UPCOM)$/i, '')
            .trim()
            .toUpperCase();
        if (!normalizedTicker || normalizedTicker.length > 4 || normalizedTicker.startsWith('VN30') || normalizedTicker.startsWith('VNINDEX')) {
            return {};
        }
        const url = 'stock-ratio';
        const data = await fetchTcbs(url, { ticker: normalizedTicker });
        return data?.data || data || {};
    } catch (err) {
        console.warn(`Could not get stock ratio for ${ticker}:`, err?.message || err);
        return {};
    }
};

const upsertStockRatio = async (symbolId, ratio) => {
    const existing = await api.get('/stock-ratios', {
        params: {
            'filters[symbol][documentId][$eq]': symbolId,
            'pagination[pageSize]': 1,
        },
    });
    const existingRatio = existing.data?.data?.[0];
    const ratioId = existingRatio?.documentId || existingRatio?.id;
    const payload = { data: { ...ratio, symbol: symbolId } };

    if (ratioId) {
        const response = await api.put(`/stock-ratios/${ratioId}`, payload);
        return response.data.data;
    }

    const response = await api.post('/stock-ratios', payload);
    return response.data.data;
};

export const upsertSymbolTechnicalAnalysis = async (symbolId, analysis) => {
    const existing = await api.get('/symbol-technical-analyses', {
        params: {
            'filters[symbol][documentId][$eq]': symbolId,
            'pagination[pageSize]': 1,
        },
    });
    const existingAnalysis = existing.data?.data?.[0];
    const analysisId = existingAnalysis?.documentId || existingAnalysis?.id;
    const payload = { data: { ...analysis, symbol: symbolId } };

    if (analysisId) {
        const response = await api.put(`/symbol-technical-analyses/${analysisId}`, payload);
        return response.data.data;
    }

    const response = await api.post('/symbol-technical-analyses', payload);
    return response.data.data;
};

export const updateMarketInfo = async (ticker, symbolId) => {
    try {
        const normalizedTicker = String(ticker || '')
            .replace(/:(HOSE|HNX|UPCOM)$/i, '')
            .trim()
            .toUpperCase();
        if (!normalizedTicker || normalizedTicker.length > 4 || normalizedTicker.startsWith('VN30') || normalizedTicker.startsWith('VNINDEX')) {
            return null;
        }

        const [overview, ratio] = await Promise.all([
            getTickerOverview(normalizedTicker),
            getStockRatio(normalizedTicker),
        ]);

        if (!overview || Object.keys(overview).length === 0) {
            return null;
        }

        const payload = {
            data: {
                ...overview,
                Name: overview.ticker || normalizedTicker,
                sector: overview.industry,
            }
        };

        const res = await api.put(`/symbols/${symbolId}`, payload);
        if (ratio && Object.keys(ratio).length > 0) {
            await upsertStockRatio(symbolId, ratio);
        }
        return res.data.data;
    } catch (error) {
        console.warn("Skipping market info update for non-stock or error:", error?.message || error);
        return null;
    }
};
