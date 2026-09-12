import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatNumber } from '../../utils/formatNumber';

const SummaryMetricsBar = ({ scanResult, profitFactor }) => {
    const summary = scanResult?.summary;
    if (!scanResult || !summary) return null;

    const activeTrade = summary.activeTrade;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. Profit Factor */}
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 shadow-sm">
                <span className="text-xs text-gray-400 block mb-1">Profit Factor</span>
                <div className="flex items-baseline gap-1.5">
                    <span className={`text-lg font-bold ${
                        profitFactor === '∞' || parseFloat(profitFactor) >= 1.5
                            ? 'text-emerald-400'
                            : parseFloat(profitFactor) >= 1.0
                                ? 'text-sky-400'
                                : 'text-rose-400'
                    }`}>
                        {profitFactor}
                    </span>
                    <span className="text-xs text-gray-400">
                        (Lãi / Lỗ)
                    </span>
                </div>
            </div>

            {/* 2. Total Trades */}
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 shadow-sm">
                <span className="text-xs text-gray-400 block mb-1">Tổng số lệnh (Trades)</span>
                <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-white">{summary.totalTrades}</span>
                    <span className="text-xs text-gray-400">
                        ({summary.closedTrades} đóng, {summary.activeTrade ? '1 mở' : '0 mở'})
                    </span>
                </div>
            </div>

            {/* 3. Win Rate */}
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 shadow-sm">
                <span className="text-xs text-gray-400 block mb-1">Tỷ lệ thắng (Win Rate)</span>
                <div className="flex items-baseline gap-1.5">
                    <span className={`text-lg font-bold ${summary.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {summary.winRate}%
                    </span>
                    <span className="text-xs text-gray-400">
                        ({summary.winTrades} TP / {summary.lossTrades} SL)
                    </span>
                </div>
            </div>

            {/* 4. Total PnL */}
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 shadow-sm">
                <span className="text-xs text-gray-400 block mb-1">Tổng Lợi nhuận (PnL)</span>
                <span className={`text-lg font-bold ${summary.totalPnlPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {summary.totalPnlPercent > 0 ? `+${summary.totalPnlPercent}%` : `${summary.totalPnlPercent}%`}
                </span>
            </div>

            {/* 5. Indicators Current Values */}
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 shadow-sm">
                <span className="text-xs text-gray-400 block mb-1">Chỉ báo kỹ thuật</span>
                <div className="text-xs space-y-0.5">
                    {summary.supertrend !== undefined && (
                        <div className="text-amber-400 truncate">ST: <b>{formatNumber(summary.supertrend || 0)}</b></div>
                    )}
                    {summary.ma288 !== undefined && (
                        <div className="text-purple-400 truncate">MA: <b>{formatNumber(summary.ma288 || 0)}</b></div>
                    )}
                    {summary.vwap !== undefined && (
                        <div className="text-blue-400 truncate">VWAP: <b>{formatNumber(summary.vwap || 0)}</b></div>
                    )}
                    {summary.supertrend === undefined && summary.ma288 === undefined && summary.vwap === undefined && (
                        <div className="text-gray-400 italic">Đã nạp {scanResult?.candles?.length || 0} nến</div>
                    )}
                </div>
            </div>

            {/* 6. Active Position Card */}
            <div className={`border rounded-xl p-3 shadow-sm ${
                activeTrade
                    ? activeTrade.type === 'Long'
                        ? 'bg-emerald-950/30 border-emerald-500/30'
                        : 'bg-red-950/30 border-red-500/30'
                    : 'bg-gray-800/60 border-gray-700/50'
            }`}>
                <span className="text-xs text-gray-400 block mb-1">Trạng thái Vị thế</span>
                {activeTrade ? (
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-1 font-bold text-xs">
                            {activeTrade.type === 'Long' ? (
                                <TrendingUp size={14} className="text-emerald-400" />
                            ) : (
                                <TrendingDown size={14} className="text-red-400" />
                            )}
                            <span className={activeTrade.type === 'Long' ? 'text-emerald-400' : 'text-red-400'}>
                                ĐANG GIỮ {activeTrade.type.toUpperCase()}
                            </span>
                        </div>
                        <div className="text-xs text-gray-300">
                            PnL: <b className={activeTrade.pnl_percent >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                {activeTrade.pnl_percent > 0 ? `+${activeTrade.pnl_percent}%` : `${activeTrade.pnl_percent}%`}
                            </b>
                        </div>
                    </div>
                ) : (
                    <span className="text-xs text-gray-500 italic block mt-1">Đang chờ Entry mới</span>
                )}
            </div>
        </div>
    );
};

export default SummaryMetricsBar;
