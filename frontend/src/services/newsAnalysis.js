import api from './api';

export const refreshNewsAnalysis = async (urls, ignoreList = []) => {
    const response = await api.post('/news-analyses/refresh', { urls, ignoreList });
    return response.data;
};

export const getNewsAnalysisLast30 = async () => {
    const response = await api.get('/news-analyses/all-last-30');
    return response.data?.data ?? response.data;
};
