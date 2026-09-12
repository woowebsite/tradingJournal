import React from 'react';
import { Activity, RefreshCw, BrainCircuit } from 'lucide-react';
import TradingViewChart from '../TradingViewChart';

const TradingChartSection = ({
    chartCardRef,
    scanning,
    chartCandles,
    chartSignals,
    symbol,
    timeframe,
    currentStrategy,
    params,
    focusDate,
    onLoadMore,
    loadingMore,
    hasMore
}) => {
    const chartProps = typeof currentStrategy?.getChartProps === 'function'
        ? currentStrategy.getChartProps(params)
        : { template: 'Supertrend' };

    return (
        <div ref={chartCardRef} className="bg-gray-800 rounded-2xl border border-gray-700/80 p-4 shadow-xl flex flex-col space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-700/60 pb-3 gap-2">
                <div className="flex items-center gap-2">
                    <Activity size={18} className="text-blue-400" />
                    <h2 className="text-base font-bold text-gray-100">
                        Biểu đồ Nến & Chu kỳ Lệnh ({symbol || 'Chưa chọn mã'})
                    </h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                    <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Mũi tên xanh Green ↑: Entry Long
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> Mũi tên đỏ Red ↓: Entry Short
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> Mũi tên xanh Blue: Take Profit
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> Chấm tròn đỏ ●: Stop Loss
                    </span>
                </div>
            </div>

            <div className="h-[480px] w-full relative rounded-xl overflow-hidden bg-gray-900">
                {scanning ? (
                    <div className="h-full w-full flex flex-col items-center justify-center space-y-3">
                        <RefreshCw size={36} className="text-purple-400 animate-spin" />
                        <p className="text-sm text-gray-400">Đang chạy chiến lược Python & mô phỏng lệnh 1 lúc...</p>
                    </div>
                ) : chartCandles.length > 0 ? (
                    <TradingViewChart
                        data={chartCandles}
                        symbol={symbol}
                        signals={chartSignals}
                        timeframe={timeframe}
                        focusDate={focusDate}
                        onLoadMore={onLoadMore}
                        isLoadingMore={loadingMore}
                        hasMore={hasMore}
                        {...chartProps}
                    />
                ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center text-gray-500 space-y-2">
                        <BrainCircuit size={40} className="opacity-40" />
                        <p className="text-sm">Vui lòng chọn Symbol và bấm <b>Run Scan</b> để nạp biểu đồ</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TradingChartSection;
