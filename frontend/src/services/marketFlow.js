import api from './api';

export const saveMarketFlow = async (entries) => {
    const response = await api.post('/market-flows/bulk', entries);
    return response.data;
};

export const getSavedMarketFlow = async (params = {}) => {
    const response = await api.get('/market-flows', { params });
    return response.data;
};