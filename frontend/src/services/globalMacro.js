import api from './api';

export const getGlobalMacroSnapshot = async (provider = 'gemini') => {
    const response = await api.post('/news-analyses/ai/global-macro', { provider });
    return response.data?.data ?? response.data;
};

export const getLatestBrentHistory = async () => {
    const response = await api.get('/news-analyses/brent-price');
    return response.data?.data ?? response.data;
};

export const getLatestWtiHistory = async () => {
    const response = await api.get('/news-analyses/wti-price');
    return response.data?.data ?? response.data;
};
