import api from './api';

export const analyzeNewsWithAI = async ({
    newsIds,
    provider = 'z.ai',
    model,
    prompt,
}) => {
    const response = await api.post('/news-analyses/ai/analyze', {
        newsIds,
        provider,
        model,
        prompt,
    });
    return response.data?.data ?? response.data;
};

export const saveNewsAIResult = async (payload) => {
    const response = await api.post('/news-analyses/ai/save', payload);
    return response.data?.data ?? response.data;
};

export const getNewsAIHistory = async () => {
    const response = await api.get('/news-analyses/all-last-30');
    return response.data?.data ?? response.data;
};
