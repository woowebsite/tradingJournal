import React from 'react';
import { Sparkles, Trophy } from 'lucide-react';

const OptimalConfigBanner = ({
    bestInfo,
    onClose,
    onOpenLeaderboard,
    hasLeaderboard,
    currentStrategy
}) => {
    if (!bestInfo) return null;

    return (
        <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/40 rounded-xl p-3.5 text-sm text-amber-200 flex items-center justify-between gap-3 shadow-md shadow-amber-500/5">
            <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 shrink-0">
                    <Sparkles size={18} />
                </div>
                <div className="text-xs leading-relaxed">
                    <span className="font-bold text-amber-300">
                        {bestInfo.rank ? `Đang áp dụng cấu hình Top #${bestInfo.rank}:` : 'Đang áp dụng cấu hình tối ưu:'}
                    </span>
                    <span className="ml-1.5 inline-block text-gray-300">
                        Profit Factor: <strong className="text-emerald-400 text-sm font-bold">{bestInfo.profitFactor}</strong>
                        {' '}| Win Rate: <strong className="text-sky-300 font-bold">{bestInfo.winRate}%</strong> ({bestInfo.totalTrades || bestInfo.closedTrades} lệnh)
                        {' '}| PnL: <strong className={Number(bestInfo.totalPnlPercent || 0) >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{bestInfo.totalPnlPercent > 0 ? '+' : ''}{bestInfo.totalPnlPercent}%</strong>
                        {typeof currentStrategy?.renderBestInfoDetails === 'function' ? (
                            currentStrategy.renderBestInfoDetails(bestInfo)
                        ) : null}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                {hasLeaderboard && (
                    <button
                        type="button"
                        onClick={onOpenLeaderboard}
                        className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                    >
                        <Trophy size={13} />
                        <span>Xem BXH</span>
                    </button>
                )}
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition cursor-pointer text-xs"
                    title="Đóng thông báo"
                >
                    ✕
                </button>
            </div>
        </div>
    );
};

export default OptimalConfigBanner;
