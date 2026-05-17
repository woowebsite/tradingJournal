import api from './api';

export const saveMarketAnalytic = async (data) => {
    const response = await api.post('/market-analytics', { data });
    return response.data;
};

export const getMarketAnalytics = async (params = {}) => {
    const response = await api.get('/market-analytics', { params });
    return response.data;
};
