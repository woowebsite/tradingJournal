import api from './api';

export const saveMarketFlow = async (entries) => {
    const response = await api.post('/market-flows/bulk', entries);
    return response.data;
};

export const getSavedMarketFlow = async (params = {}) => {
    const response = await api.get('/market-flows', { params });
    return response.data;
};

export const getSavedMarketFlowLast30 = async () => {
    const response = await api.get('/market-flows/all-last-30');
    // backend returns { data: items }, so unwrap if present
    return response.data?.data ?? response.data;
};