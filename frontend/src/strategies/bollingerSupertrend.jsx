import React from 'react';
import { TrendingUp, Activity, BarChart3, Target, ShieldAlert, Zap, Layers, Clock } from 'lucide-react';

export const bollingerSupertrendStrategy = {
    id: 'strategy_bollinger_supertrend.py',
    name: 'Bollinger Band (26, 1) & Supertrend (10, 3) Breakout',
    chartTemplate: 'Supertrend',

    defaultValues: {
        bbPeriod: 26,
        bbStd: 1.0,
        stPeriod: 50,
        stMultiplier: 6.0,
        maxPendingBars: 5,
        signalCandleType: 'upper_band',
        slType: 'touch_lower_band',
        tpType: 'rr_2',
        allowLong: true,
        allowShort: true,
    },

    fields: [
        {
            name: 'bbPeriod',
            label: 'BB Period (Chu kỳ Bollinger Band)',
            title: 'BOLLINGER_BAND_PERIOD',
            icon: BarChart3,
            iconColor: 'text-sky-400',
            type: 'number',
            column: 1,
            min: 1,
            max: 500,
            placeholder: '26',
            optimizable: true,
            defaultOpt: true,
        },
        {
            name: 'bbStd',
            label: 'BB Std Dev (Độ lệch chuẩn)',
            title: 'BOLLINGER_BAND_STD_DEV',
            icon: Activity,
            iconColor: 'text-sky-400',
            type: 'number',
            column: 1,
            step: 0.1,
            min: 0.1,
            max: 10,
            placeholder: '1.0',
            optimizable: true,
            defaultOpt: true,
        },
        {
            name: 'stPeriod',
            label: 'ST Period (Chu kỳ Supertrend)',
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
            label: 'ST Multiplier (Hệ số Supertrend)',
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
            name: 'signalCandleType',
            label: 'Điều kiện nến Signal',
            title: 'SIGNAL_CANDLE_CONDITION',
            icon: Zap,
            iconColor: 'text-amber-400',
            type: 'select',
            column: 2,
            options: [
                { value: 'upper_band', label: 'Close > Upper band, open < Upper band' },
                { value: 'lower_band', label: 'Close > Lower band, open < Lower band' },
            ],
            optimizable: true,
            defaultOpt: true,
        },
        {
            name: 'slType',
            label: 'Stoploss (Cắt lỗ)',
            title: 'STOPLOSS_TYPE',
            icon: ShieldAlert,
            iconColor: 'text-rose-400',
            type: 'select',
            column: 2,
            options: [
                { value: 'close_below_ma', label: 'Giá đóng cửa dưới MA' },
                { value: 'touch_lower_band', label: 'Giá chạm Lower Band' },
                { value: 'signal_candle_low', label: 'Đáy nến signal' },
                { value: 'entry_candle_low', label: 'Đáy nến entry' },
            ],
            optimizable: true,
            defaultOpt: true,
        },
        {
            name: 'tpType',
            label: 'Take Profit (Chốt lời)',
            title: 'TAKE_PROFIT_TYPE',
            icon: Target,
            iconColor: 'text-emerald-400',
            type: 'select',
            column: 2,
            options: [
                { value: 'rr_2', label: 'RRR 2:1' },
                { value: 'rr_3', label: 'RRR 3:1' },
                { value: 'rr_5', label: 'RRR 5:1' },
                { value: 'close_upper_band', label: 'Giá đóng cửa < Upper Band' },
            ],
            optimizable: true,
            defaultOpt: true,
        },
        {
            name: 'maxPendingBars',
            label: 'Hạn chờ Breakout (Số nến tối đa)',
            title: 'MAX_PENDING_BARS',
            icon: Clock,
            iconColor: 'text-amber-400',
            type: 'number',
            column: 2,
            min: 1,
            max: 50,
            placeholder: '5',
            optimizable: true,
            defaultOpt: false,
        }
    ],

    // Xây dựng payload để gọi API scan
    buildScanPayload: (params, base) => ({
        ...base,
        bbPeriod: parseInt(params.bbPeriod) || 26,
        bbStd: parseFloat(params.bbStd) || 1.0,
        stPeriod: parseInt(params.stPeriod) || 10,
        stMultiplier: parseFloat(params.stMultiplier) || 3.0,
        maxPendingBars: parseInt(params.maxPendingBars) || 5,
        signalCandleType: params.signalCandleType || 'upper_band',
        slType: params.slType || 'touch_lower_band',
        tpType: params.tpType || 'rr_2',
        allowLong: params.allowLong !== undefined ? params.allowLong : true,
        allowShort: params.allowShort !== undefined ? params.allowShort : true,
    }),

    // Xây dựng payload để gọi API optimize
    buildOptimizePayload: (params, optFlags, base) => ({
        ...base,
        bbPeriod: params.bbPeriod,
        bbStd: params.bbStd,
        stPeriod: params.stPeriod,
        stMultiplier: params.stMultiplier,
        maxPendingBars: params.maxPendingBars,
        signalCandleType: params.signalCandleType || 'upper_band',
        slType: params.slType || 'touch_lower_band',
        tpType: params.tpType || 'rr_2',
        allowLong: params.allowLong,
        allowShort: params.allowShort,
        optConfig: {
            bbPeriod: Boolean(optFlags.bbPeriod),
            bbStd: Boolean(optFlags.bbStd),
            stPeriod: Boolean(optFlags.stPeriod),
            stMultiplier: Boolean(optFlags.stMultiplier),
            maxPendingBars: Boolean(optFlags.maxPendingBars),
            signalCandleType: Boolean(optFlags.signalCandleType),
            slType: Boolean(optFlags.slType),
            tpType: Boolean(optFlags.tpType),
        }
    }),

    // Trích xuất params khi áp dụng config từ optimizer
    applyOptimizeConfig: (config, currentParams) => ({
        ...currentParams,
        ...(config.bbPeriod !== undefined && { bbPeriod: config.bbPeriod }),
        ...(config.bbStd !== undefined && { bbStd: config.bbStd }),
        ...(config.stPeriod !== undefined && { stPeriod: config.stPeriod }),
        ...(config.stMultiplier !== undefined && { stMultiplier: config.stMultiplier }),
        ...(config.maxPendingBars !== undefined && { maxPendingBars: config.maxPendingBars }),
        ...(config.signalCandleType !== undefined && { signalCandleType: config.signalCandleType }),
        ...(config.slType !== undefined && { slType: config.slType }),
        ...(config.tpType !== undefined && { tpType: config.tpType }),
    }),

    // Cấu hình truyền vào TradingViewChart
    getChartProps: (params) => ({
        template: 'Bollinger_Supertrend',
        supertrendPeriod: parseInt(params.stPeriod) || 10,
        supertrendMultiplier: parseFloat(params.stMultiplier) || 3.0,
        showSupertrend: true,
        showBollingerBands: true,
        bbPeriod: parseInt(params.bbPeriod) || 26,
        bbStdDev: parseFloat(params.bbStd) || 1.0,
        showVWAP: false,
        showMA: false,
    }),

    // Tạo mô tả mặc định khi lưu Template
    generateDescription: (params) => {
        const signalLabels = {
            upper_band: 'Signal: Upper Band',
            lower_band: 'Signal: Lower Band',
        };
        const slLabels = {
            close_below_ma: 'SL: Đóng cửa dưới MA',
            touch_lower_band: 'SL: Chạm Lower Band',
            signal_candle_low: 'SL: Đáy Signal',
            entry_candle_low: 'SL: Đáy Entry'
        };
        const tpLabels = {
            rr_2: 'TP: RRR 2:1',
            rr_3: 'TP: RRR 3:1',
            rr_5: 'TP: RRR 5:1',
            close_upper_band: 'TP: Đóng < Upper Band'
        };
        return `BB(${params.bbPeriod || 26}, ${params.bbStd || 1.0}) + ST(${params.stPeriod || 10}, ${params.stMultiplier || 3.0}) | ${signalLabels[params.signalCandleType] || 'Signal: Upper Band'} | ${slLabels[params.slType] || 'SL: Lower Band'} | ${tpLabels[params.tpType] || 'TP: RRR 2:1'} | ${params.allowLong ? 'Long' : ''} ${params.allowShort ? 'Short' : ''}`.trim();
    },

    // Hiển thị tóm tắt cấu hình ở thanh Status Bar
    renderConfigSummaryBadges: (params) => {
        const signalLabels = {
            upper_band: 'Signal: Upper Band',
            lower_band: 'Signal: Lower Band',
        };
        const slLabels = {
            close_below_ma: 'Close < MA',
            touch_lower_band: 'Chạm Lower Band',
            signal_candle_low: 'Đáy Signal',
            entry_candle_low: 'Đáy Entry'
        };
        const tpLabels = {
            rr_2: 'RRR 2:1',
            rr_3: 'RRR 3:1',
            rr_5: 'RRR 5:1',
            close_upper_band: 'Close < Upper Band'
        };
        return (
            <>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/20 text-xs font-medium">
                    <BarChart3 size={12} className="text-sky-400" />
                    BB({params.bbPeriod || 26}, {params.bbStd || 1.0})
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-medium font-mono">
                    <TrendingUp size={12} className="text-emerald-400" />
                    ST({params.stPeriod || 10}, {params.stMultiplier || 3.0})
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 text-xs font-medium">
                    <Zap size={12} className="text-purple-400" />
                    {signalLabels[params.signalCandleType] || 'Signal: Upper Band'}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs font-medium">
                    <ShieldAlert size={12} className="text-rose-400" />
                    {slLabels[params.slType] || params.slType || 'Lower Band'}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-medium">
                    <Target size={12} className="text-emerald-400" />
                    {tpLabels[params.tpType] || params.tpType || 'RRR 2:1'}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-medium">
                    <Clock size={12} className="text-amber-400" />
                    Chờ: {params.maxPendingBars || 5} nến
                </span>
            </>
        );
    }
};

