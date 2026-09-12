import React from 'react';
import { TrendingUp, Activity, Sliders, Target, ShieldAlert } from 'lucide-react';

export const supertrendPriceActionStrategy = {
    id: 'strategy_supertrend_priceaction.py',
    name: 'Supertrend Price Action Strategy',
    chartTemplate: 'Supertrend',
    hasInsightSupport: true, // Đánh dấu hỗ trợ nạp SymbolInsight

    defaultValues: {
        stPeriod: 10,
        stMultiplier: 3.0,
        paEngulfing: true,
        paBd3bu2: true,
        paIncludeOpposite: true,
        paPointUp: false,
        paSwingUp: false,
        tpType: 'P50',
        slType: 'P75',
        customTpVal: 0,
        customSlVal: 0,
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
            name: 'paPatterns',
            label: 'Price Action Filter',
            type: 'price_action_patterns',
            column: 1,
            optimizable: true,
            defaultOpt: true,
            optKey: 'paPatterns',
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
            label: 'Stop Loss (từ Entry)',
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
    buildScanPayload: (params, base) => ({
        ...base,
        stPeriod: parseInt(params.stPeriod) || 10,
        stMultiplier: parseFloat(params.stMultiplier) || 3.0,
        allowLong: params.allowLong !== undefined ? params.allowLong : true,
        allowShort: params.allowShort !== undefined ? params.allowShort : true,
        tpSupertrend: Boolean(params.tpSupertrend),
        paEngulfing: Boolean(params.paEngulfing),
        paBd3bu2: Boolean(params.paBd3bu2),
        paIncludeOpposite: Boolean(params.paIncludeOpposite),
        paPointUp: Boolean(params.paPointUp),
        paSwingUp: Boolean(params.paSwingUp),
        tpType: params.tpType || 'P50',
        slType: params.slType || 'P75',
        customTpVal: parseFloat(params.customTpVal) || 0,
        customSlVal: parseFloat(params.customSlVal) || 0,
    }),

    // Xây dựng payload để gọi API optimize
    buildOptimizePayload: (params, optFlags, base) => ({
        ...base,
        stPeriod: params.stPeriod,
        stMultiplier: params.stMultiplier,
        paEngulfing: params.paEngulfing,
        paBd3bu2: params.paBd3bu2,
        paIncludeOpposite: params.paIncludeOpposite,
        paPointUp: params.paPointUp,
        paSwingUp: params.paSwingUp,
        tpType: params.tpType,
        slType: params.slType,
        tpSupertrend: params.tpSupertrend,
        allowLong: params.allowLong,
        allowShort: params.allowShort,
        optConfig: {
            stPeriod: Boolean(optFlags.stPeriod),
            stMultiplier: Boolean(optFlags.stMultiplier),
            paPatterns: Boolean(optFlags.paPatterns),
            tpType: Boolean(optFlags.tpType),
            slType: Boolean(optFlags.slType),
            tpSupertrend: Boolean(optFlags.tpSupertrend),
        }
    }),

    // Trích xuất params khi áp dụng config từ optimizer
    applyOptimizeConfig: (config, currentParams) => ({
        ...currentParams,
        ...(config.stPeriod !== undefined && { stPeriod: config.stPeriod }),
        ...(config.stMultiplier !== undefined && { stMultiplier: config.stMultiplier }),
        ...(config.paEngulfing !== undefined && { paEngulfing: Boolean(config.paEngulfing) }),
        ...(config.paBd3bu2 !== undefined && { paBd3bu2: Boolean(config.paBd3bu2) }),
        ...(config.paIncludeOpposite !== undefined && { paIncludeOpposite: Boolean(config.paIncludeOpposite) }),
        ...(config.paPointUp !== undefined && { paPointUp: Boolean(config.paPointUp) }),
        ...(config.paSwingUp !== undefined && { paSwingUp: Boolean(config.paSwingUp) }),
        ...(config.tpType !== undefined && { tpType: config.tpType }),
        ...(config.slType !== undefined && { slType: config.slType }),
        ...(config.tpSupertrend !== undefined && { tpSupertrend: Boolean(config.tpSupertrend) }),
        ...(config.allowLong !== undefined && { allowLong: config.allowLong }),
        ...(config.allowShort !== undefined && { allowShort: config.allowShort }),
    }),

    // Cấu hình truyền vào TradingViewChart
    getChartProps: (params) => ({
        template: 'Supertrend',
        supertrendPeriod: parseInt(params.stPeriod) || 10,
        supertrendMultiplier: parseFloat(params.stMultiplier) || 3.0,
        showMA: false,
        maPeriod: null,
    }),

    // Tạo mô tả mặc định khi lưu Template
    generateDescription: (params) => {
        const pas = [];
        if (params.paEngulfing) pas.push('Engulfing');
        if (params.paBd3bu2) pas.push('BD3BU2');
        if (params.paIncludeOpposite) pas.push('IncludeOpposite');
        if (params.paPointUp) pas.push('PointUp');
        if (params.paSwingUp) pas.push('SwingUp');
        const paStr = pas.length > 0 ? pas.join(', ') : 'All PA';
        return `ST(${params.stPeriod}, ${params.stMultiplier}) + PA [${paStr}] | TP: ${params.tpType} | SL: ${params.slType} | ${params.allowLong ? 'Long' : ''} ${params.allowShort ? 'Short' : ''}`.trim();
    },

    // Hiển thị tóm tắt cấu hình ở thanh Status Bar
    renderConfigSummaryBadges: (params) => {
        const pas = [
            params.paEngulfing && 'Engulfing',
            params.paBd3bu2 && 'BD3BU2',
            params.paIncludeOpposite && 'IncludeOpposite',
            params.paPointUp && 'PointUp',
            params.paSwingUp && 'SwingUp'
        ].filter(Boolean);

        return (
            <>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-medium font-mono">
                    <Sliders size={12} className="text-cyan-400" />
                    ST({params.stPeriod},{params.stMultiplier})
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 text-xs font-medium">
                    <Activity size={12} className="text-purple-400" />
                    PA: {pas.length > 0 ? pas.join(', ') : 'None'}
                </span>
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
    renderBestInfoDetails: (info) => (
        <>
            {' '}| <span className="font-mono text-cyan-300">ST({info.stPeriod}, {info.stMultiplier})</span>
            {' '}| <span className="text-purple-300 font-medium">PA: {info.paSummary || 'Active'}</span>
            {' '}| TP: <span className="text-emerald-300 font-semibold">{info.tpType || 'P50'}</span>
            {' '}| SL: <span className="text-rose-300 font-semibold">{info.slType || 'P75'}</span>
        </>
    ),

    // Hiển thị tóm tắt trên bảng Leaderboard Modal
    renderLeaderboardBadges: (item) => (
        <>
            <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono font-semibold text-[11px]">
                ST({item.stPeriod}, {item.stMultiplier})
            </span>
            <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-medium text-[11px]" title="Price Action Combo">
                {item.paSummary || 'Top PA'}
            </span>
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
    )
};
