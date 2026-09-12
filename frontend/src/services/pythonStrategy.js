import api from './api';
import { buildStrategyScanPayload } from '../strategies';

export const DEFAULT_PYTHON_STRATEGIES = [
    {
        fileName: 'strategy_supertrend_ma288.py',
        name: 'Supertrend MA288 Strategy'
    },
    {
        fileName: 'strategy_vwap_ma9.py',
        name: 'VWAP MA9 Strategy'
    },
    {
        fileName: 'strategy_supertrend_priceaction.py',
        name: 'Supertrend Price Action Strategy'
    },
    {
        fileName: 'strategy_breakout_st_vwap.py',
        name: 'Breakout ST & VWAP Strategy'
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
export const scanPythonStrategy = async (params = {}) => {
    try {
        const payload = {
            strategyFile: 'strategy_supertrend_ma288.py',
            ticker: 'VNINDEX',
            timeframe: 'D1',
            countback: 500,
            ...params,
            ticker: String(params.ticker || 'VNINDEX').trim().toUpperCase(),
            timeframe: String(params.timeframe || 'D1').trim().toUpperCase(),
        };
        const response = await api.post('/python-strategies/scan', payload);
        return response.data?.data || null;
    } catch (error) {
        console.error(`Failed to scan python strategy for ${params?.ticker}:`, error);
        throw error;
    }
};

/**
 * Tự động tìm bộ tham số tối ưu mang lại Profit Factor cao nhất
 */
export const optimizePythonStrategy = async (params = {}) => {
    try {
        const payload = {
            strategyFile: 'strategy_supertrend_ma288.py',
            ticker: 'VNINDEX',
            timeframe: 'D1',
            countback: 500,
            ...params,
            ticker: String(params.ticker || 'VNINDEX').trim().toUpperCase(),
            timeframe: String(params.timeframe || 'D1').trim().toUpperCase(),
        };
        const response = await api.post('/python-strategies/optimize', payload);
        return response.data?.data || null;
    } catch (error) {
        console.error(`Failed to optimize python strategy for ${params?.ticker}:`, error);
        throw error;
    }
};

/**
 * Xây dựng payload tham số quét chiến lược Python từ Strategy Template
 */
export const buildPythonScanParams = (tpl, symName, currentTf = 'D1', fallbackCtx = {}) => {
    const cfg = tpl?.config || {};
    const targetTf = tpl?.timeframe || currentTf || fallbackCtx.timeframe || 'D1';
    const stratFile = tpl?.strategyFile || fallbackCtx.strategyFile || 'strategy_supertrend_ma288.py';

    const base = {
        strategyFile: stratFile,
        ticker: symName,
        timeframe: targetTf,
        countback: cfg.countback || fallbackCtx.countback || 1000,
    };

    return buildStrategyScanPayload(stratFile, { ...fallbackCtx, ...cfg }, base);
};

