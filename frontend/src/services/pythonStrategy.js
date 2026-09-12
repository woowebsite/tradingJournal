import api from './api';

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
    const stratFile = (tpl?.strategyFile || '').toLowerCase();
    const tplName = (tpl?.name || '').toLowerCase();

    const isVWAP = stratFile.includes('vwap') || tplName.includes('vwap') || fallbackCtx.chartTemplate === 'VWAP';
    const isPriceAction = stratFile.includes('priceaction') || stratFile.includes('price_action') || tplName.includes('price action') || tplName.includes('pa');

    if (isPriceAction) {
        return {
            strategyFile: tpl?.strategyFile || 'strategy_supertrend_priceaction.py',
            ticker: symName,
            timeframe: targetTf,
            countback: cfg.countback || 1000,
            stPeriod: parseInt(cfg.stPeriod || fallbackCtx.stPeriod || 10) || 10,
            stMultiplier: parseFloat(cfg.stMultiplier || fallbackCtx.stMultiplier || 3.0) || 3.0,
            allowLong: cfg.allowLong !== undefined ? cfg.allowLong : true,
            allowShort: cfg.allowShort !== undefined ? cfg.allowShort : true,
            tpSupertrend: cfg.tpSupertrend !== undefined ? cfg.tpSupertrend : false,
            paEngulfing: cfg.paEngulfing !== undefined ? cfg.paEngulfing : true,
            paBd3bu2: cfg.paBd3bu2 !== undefined ? cfg.paBd3bu2 : true,
            paIncludeOpposite: cfg.paIncludeOpposite !== undefined ? cfg.paIncludeOpposite : true,
            paPointUp: cfg.paPointUp !== undefined ? cfg.paPointUp : false,
            paSwingUp: cfg.paSwingUp !== undefined ? cfg.paSwingUp : false,
            tpType: cfg.tpType || 'P50',
            slType: cfg.slType || 'P75',
            customTpVal: parseFloat(cfg.customTpVal) || 0,
            customSlVal: parseFloat(cfg.customSlVal) || 0,
        };
    } else if (isVWAP) {
        return {
            strategyFile: tpl?.strategyFile || 'strategy_vwap_ma9.py',
            ticker: symName,
            timeframe: targetTf,
            countback: cfg.countback || 1000,
            maPeriod: parseInt(cfg.vwapMaPeriod || cfg.maPeriod || fallbackCtx.maPeriod || 9) || 9,
            vwapMaPeriod: parseInt(cfg.vwapMaPeriod || cfg.maPeriod || fallbackCtx.maPeriod || 9) || 9,
            vwapAnchor: cfg.vwapAnchor || fallbackCtx.vwapAnchor || 'year',
            mult1: parseFloat(cfg.mult1) || 1.0,
            mult2: parseFloat(cfg.mult2) || 2.0,
            mult3: parseFloat(cfg.mult3) || 3.0,
            tpTarget: cfg.vwapTpTarget || cfg.tpTarget || 'tp1_vwap',
            vwapTpTarget: cfg.vwapTpTarget || cfg.tpTarget || 'tp1_vwap',
            allowLong: cfg.allowLong !== undefined ? cfg.allowLong : true,
            allowShort: cfg.allowShort !== undefined ? cfg.allowShort : true,
        };
    } else {
        return {
            strategyFile: tpl?.strategyFile || 'strategy_supertrend_ma288.py',
            ticker: symName,
            timeframe: targetTf,
            countback: cfg.countback || 1000,
            rr: parseFloat(cfg.rr || cfg.riskReward) || 1.5,
            riskReward: parseFloat(cfg.riskReward || cfg.rr) || 1.5,
            entryType: cfg.entryType || 'candle_close',
            stPeriod: parseInt(cfg.stPeriod || fallbackCtx.stPeriod || 10) || 10,
            stMultiplier: parseFloat(cfg.stMultiplier || fallbackCtx.stMultiplier || 3.0) || 3.0,
            maPeriod: parseInt(cfg.maPeriod || fallbackCtx.maPeriod || 288) || 288,
            tpSupertrend: cfg.tpSupertrend !== undefined ? cfg.tpSupertrend : true,
            tpRR: cfg.tpRR !== undefined ? cfg.tpRR : true,
            allowLong: cfg.allowLong !== undefined ? cfg.allowLong : true,
            allowShort: cfg.allowShort !== undefined ? cfg.allowShort : true,
        };
    }
};
