import React from 'react';
import { TrendingUp, Activity, Anchor, Target, ShieldAlert, Zap, Filter, Layers } from 'lucide-react';

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
        vwapBandFilter: 'all',
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
            optimizable: true,
            defaultOpt: true,
        },
        {
            name: 'vwapBandFilter',
            label: 'Vị trí VWAP Band (Entry)',
            title: 'VWAP_BAND_FILTER',
            icon: Layers,
            iconColor: 'text-amber-400',
            type: 'select',
            column: 1,
            options: [
                { value: 'all', label: 'Tất cả (Không lọc)' },
                { value: 'inside', label: 'Inside (Trong Upperband 1 & Lowerband 1)' },
                { value: 'outside', label: 'Outside (Ngoài Upperband 1 & Lowerband 1)' },
            ],
            optimizable: true,
            defaultOpt: true,
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
            vwapBandFilter: params.vwapBandFilter || 'all',
            entrySetup: setup,
            allowBreakoutHigh,
            allowSweepLow,
            allowLong: params.allowLong !== undefined ? params.allowLong : true,
            allowShort: params.allowShort !== undefined ? params.allowShort : true,
            tpSupertrend: Boolean(params.tpSupertrend),
            tpType: params.tpType || 'P90',
            slType: params.slType || 'current_bar',
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
            vwapBandFilter: params.vwapBandFilter || 'all',
            entrySetup: setup,
            allowBreakoutHigh,
            allowSweepLow,
            allowLong: params.allowLong !== undefined ? params.allowLong : true,
            allowShort: params.allowShort !== undefined ? params.allowShort : true,
            tpType: params.tpType || 'P90',
            slType: params.slType || 'current_bar',
            tpSupertrend: params.tpSupertrend,
            optConfig: {
                stPeriod: Boolean(optFlags.stPeriod),
                stMultiplier: Boolean(optFlags.stMultiplier),
                entrySetup: Boolean(optFlags.entrySetup),
                tpType: Boolean(optFlags.tpType),
                slType: Boolean(optFlags.slType),
                tpSupertrend: Boolean(optFlags.tpSupertrend),
                indicatorFilter: Boolean(optFlags.indicatorFilter),
                vwapBandFilter: Boolean(optFlags.vwapBandFilter),
            }
        };
    },

    // Áp dụng bộ cấu hình tối ưu nhất vào Form state
    applyOptimizeConfig: (config, currentParams) => {
        const nextSetup = config.entrySetup !== undefined ? config.entrySetup : (
            config.allowBreakoutHigh !== undefined && config.allowSweepLow !== undefined
                ? (config.allowBreakoutHigh && !config.allowSweepLow ? 'setup1' : (!config.allowBreakoutHigh && config.allowSweepLow ? 'setup2' : 'both'))
                : (currentParams.entrySetup || 'both')
        );

        return {
            ...currentParams,
            stPeriod: config.stPeriod !== undefined ? config.stPeriod : currentParams.stPeriod,
            stMultiplier: config.stMultiplier !== undefined ? config.stMultiplier : currentParams.stMultiplier,
            vwapAnchor: config.vwapAnchor !== undefined ? config.vwapAnchor : (currentParams.vwapAnchor || 'year'),
            indicatorFilter: config.indicatorFilter !== undefined ? config.indicatorFilter : (currentParams.indicatorFilter || 'st_or_vwap'),
            vwapBandFilter: config.vwapBandFilter !== undefined ? config.vwapBandFilter : (currentParams.vwapBandFilter || 'all'),
            entrySetup: nextSetup,
            allowBreakoutHigh: nextSetup === 'setup1' || nextSetup === 'both',
            allowSweepLow: nextSetup === 'setup2' || nextSetup === 'both',
            tpType: config.tpType !== undefined ? config.tpType : (currentParams.tpType || 'P90'),
            slType: config.slType !== undefined ? config.slType : (currentParams.slType || 'current_bar'),
            tpSupertrend: config.tpSupertrend !== undefined ? Boolean(config.tpSupertrend) : Boolean(currentParams.tpSupertrend),
            allowLong: config.allowLong !== undefined ? Boolean(config.allowLong) : (currentParams.allowLong !== undefined ? Boolean(currentParams.allowLong) : true),
            allowShort: config.allowShort !== undefined ? Boolean(config.allowShort) : (currentParams.allowShort !== undefined ? Boolean(currentParams.allowShort) : true),
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
        const filterMap = {
            'st_or_vwap': 'ST or VWAP',
            'st_and_vwap': 'ST & VWAP',
            'st_only': 'ST Only',
            'vwap_only': 'VWAP Only'
        };
        const bandMap = {
            'inside': ' | Band: Inside',
            'outside': ' | Band: Outside',
            'all': ''
        };
        const filterStr = filterMap[params.indicatorFilter] || params.indicatorFilter || 'ST or VWAP';
        const bandStr = bandMap[params.vwapBandFilter] || '';
        return `Breakout ST(${params.stPeriod}, ${params.stMultiplier}) + VWAP(${params.vwapAnchor || 'year'}) | Lọc: ${filterStr}${bandStr} | ${setupStr} | TP: ${params.tpType} | SL: ${params.slType} | ${params.allowLong ? 'Long' : ''} ${params.allowShort ? 'Short' : ''}`.trim();
    },

    // Hiển thị tóm tắt cấu hình ở thanh Status Bar
    renderStatusBarSummary: (params) => {
        const filterMap = {
            'st_or_vwap': 'ST or VWAP',
            'st_and_vwap': 'ST & VWAP',
            'st_only': 'ST Only',
            'vwap_only': 'VWAP Only'
        };
        const bandMap = {
            'inside': 'Inside VWAP',
            'outside': 'Outside VWAP',
        };
        return (
            <>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-medium font-mono">
                    <TrendingUp size={12} className="text-cyan-400" />
                    ST({params.stPeriod}, {params.stMultiplier})
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 text-xs font-medium font-mono">
                    <Filter size={12} className="text-purple-400" />
                    Lọc: {filterMap[params.indicatorFilter] || params.indicatorFilter}
                </span>
                {params.vwapBandFilter && params.vwapBandFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-medium font-mono">
                        <Layers size={12} className="text-amber-400" />
                        {bandMap[params.vwapBandFilter] || params.vwapBandFilter}
                    </span>
                )}
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-medium">
                    <Target size={12} className="text-emerald-400" />
                    TP: {params.tpType}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs font-medium">
                    <ShieldAlert size={12} className="text-rose-400" />
                    SL: {params.slType}
                </span>
            </>
        );
    },

    // Hiển thị tóm tắt cấu hình trong Banner Best Info
    renderBestInfoDetails: (info) => {
        const filterMap = {
            'st_or_vwap': 'ST or VWAP',
            'st_and_vwap': 'ST & VWAP',
            'st_only': 'ST Only',
            'vwap_only': 'VWAP Only'
        };
        const bandMap = {
            'inside': 'Inside VWAP',
            'outside': 'Outside VWAP',
        };
        return (
            <>
                {' '}| <span className="font-mono text-cyan-300">ST({info.stPeriod}, {info.stMultiplier})</span>
                {' '}| <span className="text-purple-300 font-semibold font-mono">Lọc: {filterMap[info.indicatorFilter] || info.indicatorFilter || 'ST or VWAP'}</span>
                {info.vwapBandFilter && info.vwapBandFilter !== 'all' && (
                    <>{' '}| <span className="text-amber-300 font-semibold font-mono">Band: {bandMap[info.vwapBandFilter] || info.vwapBandFilter}</span></>
                )}
                {' '}| TP: <span className="text-emerald-300 font-semibold">{info.tpType || 'P90'}</span>
                {' '}| SL: <span className="text-rose-300 font-semibold">{info.slType || 'P75'}</span>
            </>
        );
    },

    // Hiển thị tóm tắt trên bảng Leaderboard Modal
    renderLeaderboardBadges: (item) => {
        const filterMap = {
            'st_or_vwap': 'ST or VWAP',
            'st_and_vwap': 'ST & VWAP',
            'st_only': 'ST Only',
            'vwap_only': 'VWAP Only'
        };
        const bandMap = {
            'inside': 'Inside VWAP',
            'outside': 'Outside VWAP',
        };
        const setupMap = {
            'setup1': 'Vượt đỉnh',
            'setup2': 'Phá đáy',
            'both': 'Both'
        };
        return (
            <>
                <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono font-semibold text-[11px]">
                    ST({item.stPeriod}, {item.stMultiplier})
                </span>
                <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-medium text-[11px]">
                    {filterMap[item.indicatorFilter] || item.indicatorFilter || 'ST or VWAP'}
                </span>
                {item.vwapBandFilter && item.vwapBandFilter !== 'all' && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium text-[11px]">
                        {bandMap[item.vwapBandFilter] || item.vwapBandFilter}
                    </span>
                )}
                {item.entrySetup && item.entrySetup !== 'custom' && (
                    <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium text-[11px]">
                        {setupMap[item.entrySetup] || item.entrySetup}
                    </span>
                )}
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium text-[11px]">
                    TP: {item.tpType}
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 font-medium text-[11px]">
                    SL: {item.slType}
                </span>
                {item.tpSupertrend && (
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px]">
                        TP ST
                    </span>
                )}
            </>
        );
    }
};

