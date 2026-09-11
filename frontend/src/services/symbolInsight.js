import api from './api';

const unwrapData = (response) => response?.data?.data ?? response?.data ?? response;

export const normalizeSymbolInsight = (item) => {
    if (!item) return null;

    const attributes = item.attributes || item;
    const documentId = item.documentId ?? attributes.documentId ?? null;
    const id = documentId || item.id || attributes.id;

    return {
        id,
        rawId: item.id ?? attributes.id ?? null,
        documentId,
        ...attributes
    };
};

export const getSymbolInsights = async (params = {}) => {
    const response = await api.get('/symbol-insights', {
        params: {
            sort: 'savedAt:desc',
            'pagination[pageSize]': 100,
            populate: '*',
            ...params
        }
    });

    const data = unwrapData(response);
    const items = Array.isArray(data) ? data : data?.items || data?.results || [];
    return items.map(normalizeSymbolInsight).filter(Boolean);
};

export const getSymbolInsightsBySymbol = async (symbolId) => {
    if (!symbolId) return [];

    const isDocumentId = typeof symbolId === 'string' && symbolId.length > 5 && isNaN(Number(symbolId));
    const filterKey = isDocumentId ? 'filters[symbol][documentId][$eq]' : 'filters[symbol][id][$eq]';

    const response = await api.get('/symbol-insights', {
        params: {
            [filterKey]: symbolId,
            sort: 'savedAt:desc',
            'pagination[pageSize]': 50,
            populate: '*'
        }
    });

    const data = unwrapData(response);
    const items = Array.isArray(data) ? data : data?.items || data?.results || [];
    return items.map(normalizeSymbolInsight).filter(Boolean);
};

export const createSymbolInsight = async (insightData) => {
    const response = await api.post('/symbol-insights', { data: insightData });
    return normalizeSymbolInsight(unwrapData(response));
};

export const updateSymbolInsight = async (insightId, insightData) => {
    const response = await api.put(`/symbol-insights/${insightId}`, { data: insightData });
    return normalizeSymbolInsight(unwrapData(response));
};

export const deleteSymbolInsight = async (insightId) => {
    await api.delete(`/symbol-insights/${insightId}`);
};
