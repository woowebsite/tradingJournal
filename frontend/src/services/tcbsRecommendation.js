import api from './api';

const unwrapList = (response) => response?.data?.data || [];

export const syncTcbsRecommendations = async () => {
    const tcbsToken = import.meta.env.VITE_TCBS_TOKEN;
    const headers = {};

    if (tcbsToken && /^[\x00-\x7F]+$/.test(tcbsToken)) {
        headers['X-TCBS-Token'] = tcbsToken;
    }

    const response = await api.get('/tcbs-recommens/sync', { headers });
    return response.data.data;
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

    const response = await api.get(
        `/tcbs-recommens?${params.toString()}`
    );

    return unwrapList(response);
};

export const getTcbsRecommendationOptions = async () => {
    const response = await api.get(
        '/tcbs-recommens?fields[0]=ticker&fields[1]=type&sort[0]=ticker:asc&pagination[pageSize]=1000'
    );

    return unwrapList(response);
};
