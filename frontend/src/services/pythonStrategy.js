import api from './api';

export const DEFAULT_PYTHON_STRATEGIES = [
    {
        fileName: 'strategy_supertrend_ma288.py',
        name: 'Supertrend MA288 Strategy'
    },
    {
        fileName: 'strategy_vwap_ma9.py',
        name: 'VWAP MA9 Strategy'
    }
];

/**
 * Lấy danh sách các file chiến lược trong thư mục python-strategy
 */
export const getPythonStrategies = async () => {
    try {
        const response = await api.get('/python-strategies');
        const list = response.data?.data;
        if (Array.isArray(list) && list.length > 0) {
            const existingFileNames = new Set(list.map(s => s.fileName));
            const merged = [...list];
            DEFAULT_PYTHON_STRATEGIES.forEach(d => {
                if (!existingFileNames.has(d.fileName)) {
                    merged.push(d);
                }
            });
            return merged;
        }
        return DEFAULT_PYTHON_STRATEGIES;
    } catch (error) {
        console.error('Failed to load python strategies:', error);
        return DEFAULT_PYTHON_STRATEGIES;
    }
};

/**
 * Quét chiến lược Python và trả về danh sách nến và tín hiệu (không lưu vào DB)
 */
export const scanPythonStrategy = async ({
    strategyFile = 'strategy_supertrend_ma288.py',
    ticker = 'VNINDEX',
    timeframe = 'D1',
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
    vwapAnchor = 'year',
    mult1 = 1.0,
    mult2 = 2.0,
    mult3 = 3.0,
    tpTarget = 'tp1_vwap',
} = {}) => {
    try {
        const response = await api.post('/python-strategies/scan', {
            strategyFile,
            ticker: String(ticker).trim().toUpperCase(),
            timeframe: String(timeframe || 'D1').trim().toUpperCase(),
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
            vwapAnchor,
            mult1,
            mult2,
            mult3,
            tpTarget,
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
    timeframe = 'D1',
    countback = 500,
    allowLong = true,
    allowShort = true,
    vwapAnchor = 'year',
} = {}) => {
    try {
        const response = await api.post('/python-strategies/optimize', {
            strategyFile,
            ticker: String(ticker).trim().toUpperCase(),
            timeframe: String(timeframe || 'D1').trim().toUpperCase(),
            countback,
            allowLong,
            allowShort,
            vwapAnchor,
        });
        return response.data?.data || null;
    } catch (error) {
        console.error(`Failed to optimize python strategy for ${ticker}:`, error);
        throw error;
    }
};


