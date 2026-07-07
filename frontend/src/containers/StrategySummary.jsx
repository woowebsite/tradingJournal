import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTrades } from '../features/tradeSlice';

const StrategySummary = ({ activeStrategy }) => {
    const dispatch = useDispatch();
    const { items: strategyTrades, loading: strategyTradesLoading } = useSelector(state => state.trades);

    useEffect(() => {
        if (!activeStrategy) return;
        const strategyId = activeStrategy.documentId || activeStrategy.id;

        dispatch(fetchTrades({
            strategyId,
            tradeStatus: 'Closed',
            mode: 'Demo',
            pageSize: 1000
        }));
    }, [activeStrategy, dispatch]);

    const { winRate, totalFinished, winCount, lossCount, strategyStats } = useMemo(() => {
        if (!strategyTrades || strategyTrades.length === 0) {
            return {
                winRate: 0,
                totalFinished: 0,
                winCount: 0,
                lossCount: 0,
                strategyStats: { rewardRisk: 0, avgWin: 0, avgLoss: 0, loading: strategyTradesLoading }
            };
        }

        let wins = 0;
        let losses = 0;
        let grossProfit = 0;
        let grossLoss = 0;

        strategyTrades.forEach(trade => {
            const pnl = Number(trade.pnl);
            if (trade.trade_status !== 'Closed' || trade.mode !== 'Demo' || !Number.isFinite(pnl)) return;

            if (pnl > 0) {
                wins++;
                grossProfit += pnl;
            } else if (pnl < 0) {
                losses++;
                grossLoss += Math.abs(pnl);
            }
        });

        const finished = wins + losses;
        const rate = finished > 0 ? ((wins / finished) * 100).toFixed(1) : 0;
        const avgWin = wins > 0 ? grossProfit / wins : 0;
        const avgLoss = losses > 0 ? grossLoss / losses : 0;
        const rewardRisk = avgLoss > 0 ? (avgWin / avgLoss) : (avgWin > 0 ? 99.99 : 0);

        return {
            winRate: rate,
            totalFinished: finished,
            winCount: wins,
            lossCount: losses,
            strategyStats: {
                rewardRisk: rewardRisk.toFixed(2),
                avgWin: avgWin.toFixed(2),
                avgLoss: avgLoss.toFixed(2),
                loading: strategyTradesLoading
            }
        };
    }, [strategyTrades, strategyTradesLoading]);

    if (!activeStrategy) {
        return <p className="text-gray-500 italic mt-2">No active strategy for this account.</p>;
    }

    return (
        <div className="grid grid-cols-2 gap-4">
            <div>
                <p className="mb-1">
                    <span className="font-semibold text-gray-400">Name:</span>{' '}
                    <span className="text-blue-400 font-medium text-base">{activeStrategy.name}</span>
                </p>
                <p className="mb-1">
                    <span className="font-semibold text-gray-400">Description:</span>{' '}
                    {activeStrategy.description || 'No description'}
                </p>
                <div className="flex gap-6 mt-3">
                    <div>
                        <p className="mb-1">
                            <span className="font-semibold text-gray-400">Win Rate:</span>{' '}
                            <span className={`font-bold text-lg ${winRate >= 50 ? 'text-green-400' : totalFinished === 0 ? 'text-gray-400' : 'text-red-400'}`}>
                                {totalFinished > 0 ? `${winRate}%` : 'N/A'}
                            </span>
                        </p>
                        <span className="text-xs text-gray-500">({winCount}W / {lossCount}L) closed trades</span>
                    </div>
                    <div>
                        <p className="mb-1">
                            <span className="font-semibold text-gray-400">Reward/Risk:</span>{' '}
                            <span className={`font-bold text-lg ${strategyStats.rewardRisk >= 1 ? 'text-green-400' : strategyStats.rewardRisk == 0 ? 'text-gray-400' : 'text-red-400'}`}>
                                {strategyStats.loading ? '...' : strategyStats.rewardRisk > 0 ? strategyStats.rewardRisk : 'N/A'}
                            </span>
                        </p>
                        <span className="text-xs text-gray-500">from closed trades</span>
                    </div>
                </div>
            </div>
            <div>
                <p className="mb-1">
                    <span className="font-semibold text-gray-400">Rules:</span>{' '}
                    {activeStrategy.rules?.length || 0} active rules
                </p>
                <div className="mt-2 text-xs">
                    {activeStrategy.rules?.map((rule, index) => (
                        <p key={index} className="mb-1">
                            <span className="font-semibold text-gray-400">{rule.Name}:</span>{' '}
                            {rule.Description || 'No description'}
                        </p>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StrategySummary;
