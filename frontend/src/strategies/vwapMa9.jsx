import React from 'react';
import { BarChart3, Clock, Activity, Target, ShieldAlert } from 'lucide-react';

export const vwapMa9Strategy = {
    id: 'strategy_vwap_ma9.py',
    name: 'VWAP MA9 Strategy',
    chartTemplate: 'VWAP',

    defaultValues: {
        vwapMaPeriod: 9,
        vwapAnchor: 'year',
        mult1: 1.0,
        mult2: 2.0,
        mult3: 3.0,
        vwapTpTarget: 'tp1_vwap',
        allowLong: true,
        allowShort: true,
    },

    fields: [
        {
            name: 'vwapMaPeriod',
            label: 'MA Period',
            title: 'Chu kỳ MA (SMA)',
            icon: BarChart3,
            iconColor: 'text-amber-400',
            type: 'number',
            column: 1,
            min: 1,
            max: 500,
            placeholder: '9',
            optimizable: true,
            defaultOpt: true,
            optKey: 'maPeriod',
        },
        {
            name: 'vwapAnchor',
            label: 'Anchor',
            title: 'Chu kỳ Anchor của VWAP',
            icon: Clock,
            iconColor: 'text-blue-400',
            type: 'select',
            column: 1,
            options: [
                { value: 'day', label: 'Ngày (Daily)' },
                { value: 'week', label: 'Tuần (Weekly)' },
                { value: 'month', label: 'Tháng (Month)' },
                { value: 'quarter', label: 'Quý (Quarter)' },
                { value: 'year', label: 'Năm (Year)' },
            ],
            optimizable: true,
            defaultOpt: false,
            optKey: 'vwapAnchor',
        },
        {
            name: 'mult2',
            label: 'Band 2 (σ)',
            title: 'Hệ số dải Upper 2 / Lower 2',
            icon: Activity,
            iconColor: 'text-purple-400',
            type: 'number',
            column: 1,
            step: 0.1,
            min: 0.5,
            max: 5.0,
            placeholder: '2.0',
            optimizable: true,
            defaultOpt: true,
            optKey: 'mult2',
        },
        {
            name: 'mult3',
            label: 'Band 3 (σ)',
            title: 'Hệ số dải Upper 3 / Lower 3',
            icon: Activity,
            iconColor: 'text-rose-400',
            type: 'number',
            column: 1,
            step: 0.1,
            min: 1.0,
            max: 6.0,
            placeholder: '3.0',
            optimizable: true,
            defaultOpt: true,
            optKey: 'mult3',
        },
        {
            name: 'vwapTpTarget',
            label: 'Mục tiêu Chốt lời (Take Profit)',
            icon: Target,
            iconColor: 'text-emerald-400',
            type: 'select',
            column: 2,
            options: [
                { value: 'tp1_vwap', label: 'TP 1: Tại đường VWAP (Mặc định)' },
                { value: 'tp2_upper2', label: 'TP 2: Tại dải Upper 2' },
                { value: 'tp3_upper3', label: 'TP 3: Tại dải Upper 3' }
            ],
            optimizable: true,
            defaultOpt: true,
            optKey: 'tpTarget',
        }
    ],

    // Xây dựng payload để gọi API scan
    buildScanPayload: (params, base) => ({
        ...base,
        maPeriod: parseInt(params.vwapMaPeriod) || 9,
        vwapMaPeriod: parseInt(params.vwapMaPeriod) || 9,
        vwapAnchor: params.vwapAnchor || 'year',
        mult1: parseFloat(params.mult1) || 1.0,
        mult2: parseFloat(params.mult2) || 2.0,
        mult3: parseFloat(params.mult3) || 3.0,
        tpTarget: params.vwapTpTarget || 'tp1_vwap',
        vwapTpTarget: params.vwapTpTarget || 'tp1_vwap',
        allowLong: params.allowLong !== undefined ? params.allowLong : true,
        allowShort: params.allowShort !== undefined ? params.allowShort : true,
    }),

    // Xây dựng payload để gọi API optimize
    buildOptimizePayload: (params, optFlags, base) => ({
        ...base,
        vwapAnchor: params.vwapAnchor,
        vwapMaPeriod: params.vwapMaPeriod,
        mult1: params.mult1,
        mult2: params.mult2,
        mult3: params.mult3,
        vwapTpTarget: params.vwapTpTarget,
        allowLong: params.allowLong,
        allowShort: params.allowShort,
        optConfig: {
            maPeriod: Boolean(optFlags.maPeriod),
            mult2: Boolean(optFlags.mult2),
            mult3: Boolean(optFlags.mult3),
            tpTarget: Boolean(optFlags.tpTarget),
            vwapAnchor: Boolean(optFlags.vwapAnchor),
        }
    }),

    // Trích xuất params khi áp dụng config từ optimizer
    applyOptimizeConfig: (config, currentParams) => ({
        ...currentParams,
        ...(config.maPeriod !== undefined && { vwapMaPeriod: config.maPeriod }),
        ...(config.tpTarget !== undefined && { vwapTpTarget: config.tpTarget }),
        ...(config.mult2 !== undefined && { mult2: config.mult2 }),
        ...(config.mult3 !== undefined && { mult3: config.mult3 }),
        ...(config.vwapAnchor !== undefined && { vwapAnchor: config.vwapAnchor }),
        ...(config.allowLong !== undefined && { allowLong: config.allowLong }),
        ...(config.allowShort !== undefined && { allowShort: config.allowShort }),
    }),

    // Cấu hình truyền vào TradingViewChart
    getChartProps: (params) => ({
        template: 'VWAP',
        vwapAnchor: params.vwapAnchor || 'year',
        showSupertrend: false,
        showVWAP: true,
        showMA: true,
        maPeriod: parseInt(params.vwapMaPeriod) || 9,
    }),

    // Tạo mô tả mặc định khi lưu Template
    generateDescription: (params) => {
        return `VWAP(${params.vwapAnchor}) + MA${params.vwapMaPeriod} | TP: ${params.vwapTpTarget} | Dải: ${params.mult1 || 1.0}x/${params.mult2}x/${params.mult3}x | ${params.allowLong ? 'Long' : ''} ${params.allowShort ? 'Short' : ''}`.trim();
    },

    // Hiển thị tóm tắt cấu hình ở thanh Status Bar
    renderConfigSummaryBadges: (params) => (
        <>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20 text-xs font-medium">
                <Activity size={12} className="text-blue-400" />
                VWAP ({(params.vwapAnchor || 'year').toUpperCase()}) + MA({params.vwapMaPeriod})
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-medium">
                <Target size={12} className="text-emerald-400" />
                {params.vwapTpTarget === 'tp1_vwap' ? 'TP: VWAP' : (params.vwapTpTarget === 'tp2_upper2' ? 'TP: Upper 2' : 'TP: Upper 3')}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs font-medium">
                <ShieldAlert size={12} className="text-rose-400" />
                SL: Lower 2
            </span>
        </>
    ),

    // Hiển thị tóm tắt cấu hình trong Banner Best Info
    renderBestInfoDetails: (info) => (
        <>
            {' '}| <span className="font-mono text-cyan-300">VWAP + MA({info.maPeriod}) | Band 2 ({info.mult2}σ) | Band 3 ({info.mult3}σ)</span>
            {' '}| TP: <span className="text-emerald-300 font-semibold">{info.tpTarget === 'tp1_vwap' ? 'VWAP' : (info.tpTarget === 'tp2_upper2' ? 'Upper 2' : 'Upper 3')}</span>
        </>
    ),

    // Hiển thị tóm tắt trên bảng Leaderboard Modal
    renderLeaderboardBadges: (item) => (
        <>
            <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono font-semibold text-[11px]">
                MA({item.maPeriod})
            </span>
            <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[11px]">
                {item.vwapAnchor?.toUpperCase()}
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px]">
                TP: {item.tpTarget === 'tp1_vwap' ? 'VWAP' : (item.tpTarget === 'tp2_upper2' ? 'Upper 2' : 'Upper 3')}
            </span>
            <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono text-[11px]">
                ({item.mult2}σ, {item.mult3}σ)
            </span>
        </>
    )
};
