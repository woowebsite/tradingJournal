import api from './api';

export const saveMarketFlow = async (entries) => {
    const response = await api.post('/market-flows/bulk', entries);
    return response.data;
};