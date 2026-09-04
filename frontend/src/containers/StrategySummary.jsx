import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Edit } from 'lucide-react';
import { fetchTrades } from '../features/tradeSlice';
import { fetchStrategies, updateStrategy } from '../features/strategySlice';
import { fetchRules, updateRule } from '../features/ruleSlice';
import { fetchWebhooks } from '../features/webhookSlice';
import { StrategyModal } from '../pages/ManageStrategies';

const StrategySummary = ({ activeStrategy, trades = [] }) => {
    const dispatch = useDispatch();
    const { items: availableRules } = useSelector(state => state.rules);
    const { items: availableWebhooks } = useSelector(state => state.webhooks);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    useEffect(() => {
        dispatch(fetchRules());
        dispatch(fetchWebhooks());
    }, [dispatch]);

    const { winRate, totalFinished, winCount, lossCount, strategyStats } = useMemo(() => {
        if (!trades || trades.length === 0) {
            return {
                winRate: 0,
                totalFinished: 0,
                winCount: 0,
                lossCount: 0,
                strategyStats: { rewardRisk: 0, avgWin: 0, avgLoss: 0, loading: false }
            };
        }

        let wins = 0;
        let losses = 0;
        let grossProfit = 0;
        let grossLoss = 0;

        trades.forEach(trade => {
            const pnl = Number(trade.pnl !== null && trade.pnl !== undefined ? trade.pnl : trade.derivedPnl);
            if (trade.trade_status !== 'Closed' || !Number.isFinite(pnl)) return;

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
                loading: false
            }
        };
    }, [trades]);

    const handleUpdateStrategy = async (strategyData) => {
        const strategyId = activeStrategy?.documentId || activeStrategy?.id;
        if (!strategyId) return;

        try {
            const { rulePercents = {}, ruleSignalTexts = {}, ...sanitizedStrategyData } = strategyData;
            await dispatch(updateStrategy({ id: strategyId, data: sanitizedStrategyData })).unwrap();

            const ruleUpdates = new Map();
            Object.entries(rulePercents)
                .filter(([, percent]) => percent !== '' && percent !== undefined && percent !== null)
                .forEach(([ruleId, percent]) => {
                    ruleUpdates.set(ruleId, { ...(ruleUpdates.get(ruleId) || {}), percent: Number(percent) });
                });

            Object.entries(ruleSignalTexts)
                .forEach(([ruleId, signalText]) => {
                    if (signalText !== undefined && signalText !== null) {
                        ruleUpdates.set(ruleId, { ...(ruleUpdates.get(ruleId) || {}), signalText: String(signalText).trim() });
                    }
                });

            if (ruleUpdates.size > 0) {
                await Promise.all(
                    Array.from(ruleUpdates.entries()).map(([ruleId, updateData]) =>
                        dispatch(updateRule({ id: ruleId, data: updateData })).unwrap()
                    )
                );
                dispatch(fetchRules());
            }

            await dispatch(fetchStrategies()).unwrap();
            setIsEditModalOpen(false);
        } catch (error) {
            console.error('Failed to update strategy:', error);
            alert(`Failed to update strategy: ${error?.error?.message || error?.message || error}`);
        }
    };

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
                    <div className="whitespace-pre-line text-gray-300 text-xs">
                        {activeStrategy.description || 'No description'}
                    </div>
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

                <StrategyModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onSubmit={handleUpdateStrategy}
                    initialData={activeStrategy}
                    availableRules={availableRules}
                    availableWebhooks={availableWebhooks}
                />

                {activeStrategy && (
                    <div className="col-span-2 flex justify-start mt-4">
                        <button
                            type="button"
                            onClick={() => setIsEditModalOpen(true)}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 hover:text-emerald-200"
                        >
                            <Edit size={13} />
                            Edit
                        </button>
                    </div>
                )}
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
