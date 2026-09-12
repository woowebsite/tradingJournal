import { supertrendMa288Strategy } from './supertrendMa288';
import { vwapMa9Strategy } from './vwapMa9';
import { supertrendPriceActionStrategy } from './supertrendPriceAction';

const STRATEGY_REGISTRY = {
    [supertrendMa288Strategy.id]: supertrendMa288Strategy,
    [vwapMa9Strategy.id]: vwapMa9Strategy,
    [supertrendPriceActionStrategy.id]: supertrendPriceActionStrategy,
};

/**
 * Lấy cấu hình Schema của chiến lược theo tên file
 */
export const getStrategyConfig = (fileName) => {
    if (!fileName) return supertrendMa288Strategy;
    if (STRATEGY_REGISTRY[fileName]) {
        return STRATEGY_REGISTRY[fileName];
    }
    const clean = String(fileName).toLowerCase();
    if (clean.includes('vwap')) return vwapMa9Strategy;
    if (clean.includes('priceaction') || clean.includes('price_action')) return supertrendPriceActionStrategy;
    return supertrendMa288Strategy;
};

/**
 * Lấy danh sách toàn bộ các chiến lược đã đăng ký
 */
export const getAllStrategies = () => Object.values(STRATEGY_REGISTRY);

/**
 * Lấy bộ giá trị mặc định cho chiến lược
 */
export const getDefaultParams = (fileName) => {
    const strat = getStrategyConfig(fileName);
    return { ...strat.defaultValues };
};

/**
 * Lấy bộ cờ tối ưu hóa mặc định cho chiến lược
 */
export const getDefaultOptFlags = (fileName) => {
    const strat = getStrategyConfig(fileName);
    const flags = {};
    (strat.fields || []).forEach(field => {
        if (field.optimizable) {
            const key = field.optKey || field.name;
            flags[key] = field.defaultOpt !== undefined ? field.defaultOpt : true;
        }
    });
    return flags;
};

/**
 * Xây dựng payload gọi API scan
 */
export const buildStrategyScanPayload = (fileName, params, basePayload) => {
    const strat = getStrategyConfig(fileName);
    if (typeof strat.buildScanPayload === 'function') {
        return strat.buildScanPayload(params, basePayload);
    }
    return { ...basePayload, ...params };
};

/**
 * Xây dựng payload gọi API optimize
 */
export const buildStrategyOptimizePayload = (fileName, params, optFlags, basePayload) => {
    const strat = getStrategyConfig(fileName);
    if (typeof strat.buildOptimizePayload === 'function') {
        return strat.buildOptimizePayload(params, optFlags, basePayload);
    }
    return { ...basePayload, ...params, optConfig: optFlags };
};

/**
 * Cập nhật params khi áp dụng cấu hình từ Optimizer
 */
export const applyStrategyOptimizeConfig = (fileName, config, currentParams) => {
    const strat = getStrategyConfig(fileName);
    if (typeof strat.applyOptimizeConfig === 'function') {
        return strat.applyOptimizeConfig(config, currentParams);
    }
    return { ...currentParams, ...config };
};
