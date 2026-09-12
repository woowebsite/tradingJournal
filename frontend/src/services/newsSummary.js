import api from './api';

export const getNewsSummaries = async () => {
    const response = await api.get('/news-summaries?sort[0]=day:desc&sort[1]=createdAt:desc&pagination[pageSize]=200');
    return response.data?.data ?? response.data ?? [];
};

export const deleteNewsSummary = async (id) => {
    const response = await api.delete(`/news-summaries/${id}`);
    return response.data?.data ?? response.data ?? null;
};
