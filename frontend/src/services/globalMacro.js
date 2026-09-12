import api from './api';

export const getGlobalMacroSnapshot = async (provider = 'gemini') => {
    const response = await api.post('/news-analyses/ai/global-macro', { provider });
    return response.data?.data ?? response.data;
};

export const getLatestDxyHistory = async () => {
    const response = await api.get('/news-analyses/dxy-price');
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

export const getLatestGoldHistory = async () => {
    const response = await api.get('/news-analyses/gold-price');
    return response.data?.data ?? response.data;
};

export const getLatestNasdaqHistory = async () => {
    const response = await api.get('/news-analyses/nasdaq-price');
    return response.data?.data ?? response.data;
};

export const getLatestSp500History = async () => {
    const response = await api.get('/news-analyses/sp500-price');
    return response.data?.data ?? response.data;
};

export const getLatestFedFundsRate = async () => {
    const response = await api.get('/news-analyses/fed-funds-rate');
    return response.data?.data ?? response.data;
};

export const getLatestUsCpi = async () => {
    const response = await api.get('/news-analyses/us-cpi');
    return response.data?.data ?? response.data;
};
