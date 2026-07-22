import api from './api';

export const getGlobalMacroSnapshot = async (provider = 'gemini') => {
    const response = await api.post('/news-analyses/ai/global-macro', { provider });
    return response.data?.data ?? response.data;
};
