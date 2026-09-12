import api from './api';

const unwrapData = (response) => response?.data?.data ?? response?.data ?? response;

export const normalizeStrategyTemplate = (item) => {
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

export const getStrategyTemplates = async (params = {}) => {
    const response = await api.get('/strategy-templates', {
        params: {
            sort: 'updatedAt:desc',
            'pagination[pageSize]': 200,
            populate: '*',
            ...params
        }
    });

    const data = unwrapData(response);
    const items = Array.isArray(data) ? data : data?.items || data?.results || [];
    return items.map(normalizeStrategyTemplate).filter(Boolean);
};

export const createStrategyTemplate = async (templateData) => {
    const response = await api.post('/strategy-templates', { data: templateData });
    return normalizeStrategyTemplate(unwrapData(response));
};

export const updateStrategyTemplate = async (templateId, templateData) => {
    const response = await api.put(`/strategy-templates/${templateId}`, { data: templateData });
    return normalizeStrategyTemplate(unwrapData(response));
};

export const deleteStrategyTemplate = async (templateId) => {
    await api.delete(`/strategy-templates/${templateId}`);
};
