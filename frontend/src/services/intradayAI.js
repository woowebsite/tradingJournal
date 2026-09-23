import api from './api';

export const getAIIntradayDecision = async ({
    provider = 'gemini',
    model,
    prompt,
    systemPrompt,
    apiKey,
    bsaData = [],
    bidAskData = [],
    ticker = 'VN30F1M',
    dataScope = 30,
}) => {
    const response = await api.post('/news-analyses/ai/intraday-decision', {
        provider,
        model,
        prompt,
        systemPrompt,
        apiKey,
        bsaData,
        bidAskData,
        ticker,
        dataScope,
    });

    return response.data?.data ?? response.data;
};
