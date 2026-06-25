import api from './api';

const unwrapList = (response) => response?.data?.data || [];

const getErrorMessage = (error) => {
    return error?.response?.data?.error?.message
        || error?.response?.data?.message
        || error?.message
        || 'Unknown error';
};

export const syncTcbsRecommendations = async () => {
    const tcbsToken = import.meta.env.VITE_TCBS_TOKEN;
    const headers = {};

    if (tcbsToken && /^[\x00-\x7F]+$/.test(tcbsToken)) {
        headers['X-TCBS-Token'] = tcbsToken;
    }

    try {
        const response = await api.get('/tcbs-recommens/sync', { headers });
        return response.data.data;
    } catch (error) {
        throw new Error(`TCBS recommendations sync failed: ${getErrorMessage(error)}`);
    }
};

export const getTcbsRecommendations = async ({ ticker = '', type = '' } = {}) => {
    const params = new URLSearchParams({
        'sort[0]': 'd:desc',
        'sort[1]': 'ticker:asc',
        'pagination[pageSize]': '100',
    });

    if (ticker) {
        params.set('filters[ticker][$eq]', ticker);
    }

    if (type) {
        params.set('filters[type][$eq]', type);
    }

    try {
        const response = await api.get(
            `/tcbs-recommens?${params.toString()}`
        );

        return unwrapList(response);
    } catch (error) {
        throw new Error(`Failed to load TCBS recommendations: ${getErrorMessage(error)}`);
    }
};

export const getTcbsRecommendationOptions = async () => {
    try {
        const response = await api.get(
            '/tcbs-recommens?fields[0]=ticker&fields[1]=type&sort[0]=ticker:asc&pagination[pageSize]=1000'
        );

        return unwrapList(response);
    } catch (error) {
        throw new Error(`Failed to load TCBS recommendation filters: ${getErrorMessage(error)}`);
    }
};
