import api from './api';

/**
 * Lấy danh sách các file chiến lược trong thư mục python-strategy
 */
export const getPythonStrategies = async () => {
    try {
        const response = await api.get('/python-strategies');
        return response.data?.data || [];
    } catch (error) {
        console.error('Failed to load python strategies:', error);
        return [
            {
                fileName: 'strategy_supertrend_ma288.py',
                name: 'Supertrend MA288 Strategy'
            }
        ];
    }
};

/**
 * Quét chiến lược Python và trả về danh sách nến và tín hiệu (không lưu vào DB)
 */
export const scanPythonStrategy = async ({
    strategyFile = 'strategy_supertrend_ma288.py',
    ticker = 'VNINDEX',
    countback = 500,
    rr = 1.5,
    entryType = 'candle_close',
    stPeriod = 10,
    stMultiplier = 3.0,
    maPeriod = 288,
    tpSupertrend = true,
    tpRR = true,
    allowLong = true,
    allowShort = true,
} = {}) => {
    try {
        const response = await api.post('/python-strategies/scan', {
            strategyFile,
            ticker: String(ticker).trim().toUpperCase(),
            countback,
            rr,
            entryType,
            stPeriod,
            stMultiplier,
            maPeriod,
            tpSupertrend,
            tpRR,
            allowLong,
            allowShort,
        });
        return response.data?.data || null;
    } catch (error) {
        console.error(`Failed to scan python strategy for ${ticker}:`, error);
        throw error;
    }
};

/**
 * Tự động tìm bộ tham số tối ưu mang lại Profit Factor cao nhất
 */
export const optimizePythonStrategy = async ({
    strategyFile = 'strategy_supertrend_ma288.py',
    ticker = 'VNINDEX',
    countback = 500,
    allowLong = true,
    allowShort = true,
} = {}) => {
    try {
        const response = await api.post('/python-strategies/optimize', {
            strategyFile,
            ticker: String(ticker).trim().toUpperCase(),
            countback,
            allowLong,
            allowShort,
        });
        return response.data?.data || null;
    } catch (error) {
        console.error(`Failed to optimize python strategy for ${ticker}:`, error);
        throw error;
    }
};

