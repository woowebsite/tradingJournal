import api from './api';

export const saveNewsUrls = async (type, urls) => {
    const response = await api.post('/news-urls/bulk', { type, urls });
    return response.data;
};

export const getNewsUrls = async () => {
    const response = await api.get('/news-urls/all');
    return response.data?.data ?? response.data;
};
