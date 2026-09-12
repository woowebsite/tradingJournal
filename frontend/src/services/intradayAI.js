import api from './api';

export const getAIIntradayDecision = async ({
    provider = 'gemini',
    model,
    prompt,
    systemPrompt,
    apiKey,
    bsaData = [],
    bidAskData = [],
    ticker = '41I1G9000',
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
