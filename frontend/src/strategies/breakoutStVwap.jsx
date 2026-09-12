import React from 'react';
import { TrendingUp, Activity, Anchor, Target, ShieldAlert, Zap, Filter } from 'lucide-react';

export const breakoutStVwapStrategy = {
    id: 'strategy_breakout_st_vwap.py',
    name: 'Breakout ST & VWAP Strategy',
    chartTemplate: 'Supertrend',
    hasInsightSupport: true,

    defaultValues: {
        stPeriod: 10,
        stMultiplier: 3.0,
        vwapAnchor: 'year',
        indicatorFilter: 'st_or_vwap',
        entrySetup: 'both',
        allowBreakoutHigh: true,
        allowSweepLow: true,
        tpType: 'P90',
        slType: 'current_bar',
        customTpVal: 0,
        customSlVal: 0,
        riskReward: 1.5,
        tpSupertrend: false,
        allowLong: true,
        allowShort: true,
    },

    fields: [
        {
            name: 'stPeriod',
            label: 'ST Period',
            title: 'SUPERTREND_PERIOD',
            icon: TrendingUp,
            iconColor: 'text-emerald-400',
            type: 'number',
            column: 1,
            min: 1,
            max: 500,
            placeholder: '10',
            optimizable: true,
            defaultOpt: true,
        },
        {
            name: 'stMultiplier',
            label: 'ST Multiplier',
            title: 'SUPERTREND_MULTIPLIER',
            icon: Activity,
            iconColor: 'text-emerald-400',
            type: 'number',
            column: 1,
            step: 0.1,
            min: 0.1,
            max: 50,
            placeholder: '3.0',
            optimizable: true,
            defaultOpt: true,
        },
        {
            name: 'vwapAnchor',
            label: 'VWAP Anchor',
            title: 'VWAP_ANCHOR_PERIOD',
            icon: Anchor,
            iconColor: 'text-sky-400',
            type: 'select',
            column: 1,
            options: [
                { value: 'year', label: 'Năm (Yearly)' },
                { value: 'quarter', label: 'Quý (Quarterly)' },
                { value: 'month', label: 'Tháng (Monthly)' },
                { value: 'week', label: 'Tuần (Weekly)' },
                { value: 'day', label: 'Ngày (Daily)' },
            ],
            optimizable: false,
        },
        {
            name: 'indicatorFilter',
            label: 'Điều kiện Indicator Lọc Trend',
            title: 'INDICATOR_FILTER_CONDITION',
            icon: Filter,
            iconColor: 'text-purple-400',
            type: 'select',
            column: 1,
            options: [
                { value: 'st_or_vwap', label: 'ST Up HOẶC Giá > VWAP (Mặc định)' },
                { value: 'st_and_vwap', label: 'ST Up VÀ Giá > VWAP' },
                { value: 'st_only', label: 'Chỉ dùng Supertrend' },
                { value: 'vwap_only', label: 'Chỉ dùng VWAP' },
            ],
            optimizable: false,
        },
        {
            name: 'entrySetup',
            label: 'Điều kiện Vào lệnh (Entry)',
            title: 'BREAKOUT_ENTRY_SETUPS',
            icon: Activity,
            iconColor: 'text-indigo-400',
            type: 'select',
            column: 2,
            options: [
                { value: 'setup1', label: 'Setup 1 (Vượt đỉnh)' },
                { value: 'setup2', label: 'Setup 2 (Phá đáy)' },
                { value: 'both', label: 'Cả 2 Setup (Setup 1 & Setup 2)' },
            ],
            optimizable: true,
            defaultOpt: true,
        },
        {
            name: 'tpType',
            label: 'Take Profit (từ Entry)',
            icon: Target,
            iconColor: 'text-emerald-400',
            type: 'select_spread_tp',
            column: 2,
            optimizable: true,
            defaultOpt: true,
        },
        {
            name: 'slType',
            label: 'Cắt lỗ / Stop Loss (từ Entry)',
            icon: ShieldAlert,
            iconColor: 'text-rose-400',
            type: 'select_spread_sl',
            column: 2,
            optimizable: true,
            defaultOpt: true,
        },
        {
            name: 'insightRow',
            type: 'insight_spread_row',
            column: 2,
            optimizable: true,
            defaultOpt: true,
            optKey: 'tpSupertrend',
        }
    ],

    // Xây dựng payload để gọi API scan
    buildScanPayload: (params, base) => {
        const setup = params.entrySetup || (params.allowBreakoutHigh && !params.allowSweepLow ? 'setup1' : (!params.allowBreakoutHigh && params.allowSweepLow ? 'setup2' : 'both'));
        const allowBreakoutHigh = setup === 'setup1' || setup === 'both';
        const allowSweepLow = setup === 'setup2' || setup === 'both';

        return {
            ...base,
            stPeriod: parseInt(params.stPeriod) || 10,
            stMultiplier: parseFloat(params.stMultiplier) || 3.0,
            vwapAnchor: params.vwapAnchor || 'year',
            indicatorFilter: params.indicatorFilter || 'st_or_vwap',
            entrySetup: setup,
            allowBreakoutHigh,
            allowSweepLow,
            allowLong: params.allowLong !== undefined ? params.allowLong : true,
            allowShort: params.allowShort !== undefined ? params.allowShort : true,
            tpSupertrend: Boolean(params.tpSupertrend),
            tpType: params.tpType || 'P90',
            slType: params.slType || 'P75',
            customTpVal: parseFloat(params.customTpVal) || 0,
            customSlVal: parseFloat(params.customSlVal) || 0,
            riskReward: parseFloat(params.riskReward) || 1.5,
        };
    },

    // Xây dựng payload để gọi API optimize
    buildOptimizePayload: (params, optFlags, base) => {
        const setup = params.entrySetup || (params.allowBreakoutHigh && !params.allowSweepLow ? 'setup1' : (!params.allowBreakoutHigh && params.allowSweepLow ? 'setup2' : 'both'));
        const allowBreakoutHigh = setup === 'setup1' || setup === 'both';
        const allowSweepLow = setup === 'setup2' || setup === 'both';

        return {
            ...base,
            stPeriod: params.stPeriod,
            stMultiplier: params.stMultiplier,
            vwapAnchor: params.vwapAnchor || 'year',
            indicatorFilter: params.indicatorFilter || 'st_or_vwap',
            entrySetup: setup,
            allowBreakoutHigh,
            allowSweepLow,
            allowLong: params.allowLong,
            allowShort: params.allowShort,
            tpType: params.tpType,
            slType: params.slType,
            tpSupertrend: params.tpSupertrend,
            optConfig: {
                stPeriod: Boolean(optFlags.stPeriod),
                stMultiplier: Boolean(optFlags.stMultiplier),
                entrySetup: Boolean(optFlags.entrySetup),
                tpType: Boolean(optFlags.tpType),
                slType: Boolean(optFlags.slType),
                tpSupertrend: Boolean(optFlags.tpSupertrend),
                indicatorFilter: Boolean(optFlags.indicatorFilter),
            }
        };
    },

    // Áp dụng bộ cấu hình tối ưu nhất vào Form state
    applyOptimizeConfig: (config, currentParams) => {
        const nextSetup = config.entrySetup !== undefined ? config.entrySetup : (
            config.allowBreakoutHigh !== undefined && config.allowSweepLow !== undefined
                ? (config.allowBreakoutHigh && !config.allowSweepLow ? 'setup1' : (!config.allowBreakoutHigh && config.allowSweepLow ? 'setup2' : 'both'))
                : currentParams.entrySetup
        );

        return {
            ...currentParams,
            stPeriod: config.stPeriod !== undefined ? config.stPeriod : currentParams.stPeriod,
            stMultiplier: config.stMultiplier !== undefined ? config.stMultiplier : currentParams.stMultiplier,
            vwapAnchor: config.vwapAnchor !== undefined ? config.vwapAnchor : currentParams.vwapAnchor,
            indicatorFilter: config.indicatorFilter !== undefined ? config.indicatorFilter : currentParams.indicatorFilter,
            entrySetup: nextSetup,
            allowBreakoutHigh: nextSetup === 'setup1' || nextSetup === 'both',
            allowSweepLow: nextSetup === 'setup2' || nextSetup === 'both',
            tpType: config.tpType !== undefined ? config.tpType : currentParams.tpType,
            slType: config.slType !== undefined ? config.slType : currentParams.slType,
            tpSupertrend: config.tpSupertrend !== undefined ? config.tpSupertrend : currentParams.tpSupertrend,
        };
    },

    // Cấu hình truyền vào TradingViewChart (Chỉ hiển thị Supertrend + VWAP, KHÔNG hiển thị MA)
    getChartProps: (params) => ({
        template: 'Supertrend_VWAP',
        supertrendPeriod: parseInt(params.stPeriod) || 10,
        supertrendMultiplier: parseFloat(params.stMultiplier) || 3.0,
        vwapAnchor: params.vwapAnchor || 'year',
        showSupertrend: true,
        showVWAP: true,
        showMA: false,
        maPeriod: null,
    }),

    // Tạo mô tả mặc định khi lưu Template
    generateDescription: (params) => {
        const setupStr = params.entrySetup === 'setup1' ? 'Setup 1 (Vượt đỉnh)' : (params.entrySetup === 'setup2' ? 'Setup 2 (Phá đáy)' : 'Both Setups');
        return `Breakout ST(${params.stPeriod}, ${params.stMultiplier}) + VWAP(${params.vwapAnchor || 'year'}) | ${setupStr} | TP: ${params.tpType} | SL: ${params.slType} | ${params.allowLong ? 'Long' : ''} ${params.allowShort ? 'Short' : ''}`.trim();
    }
};

