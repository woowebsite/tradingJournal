import React from 'react';
import { TrendingUp, BarChart3, Target, Activity, CheckCircle2, Sliders, Layers } from 'lucide-react';

export const supertrendMa288Strategy = {
    id: 'strategy_supertrend_ma288.py',
    name: 'Supertrend MA288 Strategy',
    chartTemplate: 'Supertrend',

    defaultValues: {
        stPeriod: 10,
        stMultiplier: 3.0,
        maPeriod: 288,
        riskReward: 1.5,
        entryType: 'candle_close',
        tpSupertrend: true,
        tpRR: true,
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
            name: 'maPeriod',
            label: 'MA Period',
            title: 'MA_PERIOD',
            icon: BarChart3,
            iconColor: 'text-purple-400',
            type: 'number',
            column: 1,
            min: 1,
            max: 1000,
            placeholder: '288',
            optimizable: true,
            defaultOpt: true,
        },
        {
            name: 'entryType',
            label: 'Điều kiện Vào lệnh (Entry)',
            icon: Activity,
            iconColor: 'text-indigo-400',
            type: 'select',
            column: 2,
            options: [
                { value: 'candle_close', label: 'Đóng cửa nến xanh/đỏ (Mặc định)' },
                { value: 'st_reversal', label: 'Khi Supertrend đổi chiều' }
            ],
            optimizable: true,
            defaultOpt: true,
        },
        {
            name: 'riskReward',
            label: 'Risk : Reward (R:R)',
            title: 'Tỷ lệ Risk : Reward cho lệnh',
            icon: Target,
            iconColor: 'text-amber-400',
            type: 'number',
            column: 2,
            step: 0.1,
            min: 0.1,
            max: 20,
            placeholder: '1.5',
            optimizable: true,
            defaultOpt: true,
            disabledWhen: (vals) => !vals.tpRR,
        },
        {
            name: 'tpOptions',
            label: 'Tùy chọn Chốt lời',
            icon: CheckCircle2,
            iconColor: 'text-emerald-400',
            type: 'tp_options_st',
            column: 2,
            optimizable: true,
            defaultOpt: true,
            optKey: 'tpMode',
        }
    ],

    // Xây dựng payload để gọi API scan
    buildScanPayload: (params, base) => ({
        ...base,
        rr: parseFloat(params.riskReward) || 1.5,
        riskReward: parseFloat(params.riskReward) || 1.5,
        entryType: params.entryType || 'candle_close',
        stPeriod: parseInt(params.stPeriod) || 10,
        stMultiplier: parseFloat(params.stMultiplier) || 3.0,
        maPeriod: parseInt(params.maPeriod) || 288,
        allowLong: params.allowLong !== undefined ? params.allowLong : true,
        allowShort: params.allowShort !== undefined ? params.allowShort : true,
        tpSupertrend: params.tpSupertrend !== undefined ? params.tpSupertrend : true,
        tpRR: params.tpRR !== undefined ? params.tpRR : true,
    }),

    // Xây dựng payload để gọi API optimize
    buildOptimizePayload: (params, optFlags, base) => ({
        ...base,
        stPeriod: params.stPeriod,
        stMultiplier: params.stMultiplier,
        maPeriod: params.maPeriod,
        riskReward: params.riskReward,
        entryType: params.entryType,
        tpSupertrend: params.tpSupertrend,
        tpRR: params.tpRR,
        allowLong: params.allowLong,
        allowShort: params.allowShort,
        optConfig: {
            stPeriod: Boolean(optFlags.stPeriod),
            stMultiplier: Boolean(optFlags.stMultiplier),
            maPeriod: Boolean(optFlags.maPeriod),
            riskReward: Boolean(optFlags.riskReward),
            entryType: Boolean(optFlags.entryType),
            tpMode: Boolean(optFlags.tpMode),
        }
    }),

    // Trích xuất params khi áp dụng config từ optimizer
    applyOptimizeConfig: (config, currentParams) => ({
        ...currentParams,
        ...(config.stPeriod !== undefined && { stPeriod: config.stPeriod }),
        ...(config.stMultiplier !== undefined && { stMultiplier: config.stMultiplier }),
        ...(config.maPeriod !== undefined && { maPeriod: config.maPeriod }),
        ...(config.riskReward !== undefined && { riskReward: config.riskReward }),
        ...(config.entryType !== undefined && { entryType: config.entryType }),
        ...(config.tpSupertrend !== undefined && { tpSupertrend: Boolean(config.tpSupertrend) }),
        ...(config.tpRR !== undefined && { tpRR: Boolean(config.tpRR) }),
        ...(config.allowLong !== undefined && { allowLong: config.allowLong }),
        ...(config.allowShort !== undefined && { allowShort: config.allowShort }),
    }),

    // Cấu hình truyền vào TradingViewChart
    getChartProps: (params) => ({
        template: 'Supertrend_MA',
        supertrendPeriod: parseInt(params.stPeriod) || 10,
        supertrendMultiplier: parseFloat(params.stMultiplier) || 3.0,
        showSupertrend: true,
        showVWAP: false,
        showMA: true,
        maPeriod: parseInt(params.maPeriod) || 288,
    }),

    // Tạo mô tả mặc định khi lưu Template
    generateDescription: (params) => {
        return `Supertrend(${params.stPeriod}, ${params.stMultiplier}) + MA${params.maPeriod} | Entry: ${params.entryType === 'st_reversal' ? 'ST Reversal' : 'Nến đóng'} | R:R: 1:${params.riskReward} | TP ST: ${params.tpSupertrend ? 'Bật' : 'Tắt'} | ${params.allowLong ? 'Long' : ''} ${params.allowShort ? 'Short' : ''}`.trim();
    },

    // Hiển thị tóm tắt cấu hình ở thanh Status Bar
    renderConfigSummaryBadges: (params) => (
        <>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-medium">
                <Activity size={12} className="text-indigo-400" />
                Entry: {params.entryType === 'st_reversal' ? 'Supertrend đảo chiều' : 'Đóng cửa nến xanh/đỏ'}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-medium font-mono">
                <Sliders size={12} className="text-cyan-400" />
                ST({params.stPeriod},{params.stMultiplier}) + MA({params.maPeriod})
            </span>
            {params.tpSupertrend && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-medium">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    ST Đảo chiều
                </span>
            )}
            {params.tpRR && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-medium">
                    <CheckCircle2 size={12} className="text-amber-400" />
                    Cố định R:R ({params.riskReward}R)
                </span>
            )}
        </>
    ),

    // Hiển thị tóm tắt cấu hình trong Banner Best Info
    renderBestInfoDetails: (info) => (
        <>
            {' '}| <span className="font-mono text-cyan-300">ST({info.stPeriod}, {info.stMultiplier}) + MA({info.maPeriod})</span>
            {' '}| Entry: <span className="text-indigo-300 font-semibold">{info.entryType === 'st_reversal' ? 'ST Đảo chiều' : 'Đóng nến'}</span>
            {' '}| R:R: <span className="text-amber-300 font-semibold">{info.riskReward}R</span>
        </>
    ),

    // Hiển thị tóm tắt trên bảng Leaderboard Modal
    renderLeaderboardBadges: (item) => (
        <>
            <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono font-semibold text-[11px]">
                ST({item.stPeriod}, {item.stMultiplier}) + MA({item.maPeriod})
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px]">
                {item.riskReward}R
            </span>
            <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[11px]">
                {item.entryType === 'st_reversal' ? 'ST Đảo chiều' : 'Nến đóng'}
            </span>
            {item.tpSupertrend && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px]">
                    TP ST
                </span>
            )}
        </>
    )
};
