import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Activity } from 'lucide-react';
import { fetchClosedTrades } from '../../features/tradeSlice';
import { useAccount } from '../../context/AccountContext';

const StrategyPanel = ({ activeStrategy, allSignals }) => {
    const dispatch = useDispatch();
    const { selectedAccount } = useAccount();
    const { closedTrades, closedTradesLoading } = useSelector(state => state.trades);

    // Filter signals for strategy to calculate Winrate
    const strategySignals = activeStrategy ? allSignals.filter(signal => {
        if (!signal.rules || signal.rules.length === 0) return false;
        const strategyRuleIds = new Set(activeStrategy.rules?.flatMap(r => [r.id?.toString(), r.documentId?.toString()]).filter(Boolean));
        return signal.rules.some(r => strategyRuleIds.has(r.id?.toString()) || strategyRuleIds.has(r.documentId?.toString()));
    }) : [];

    let winCount = 0;
    let lossCount = 0;
    strategySignals.forEach(signal => {
        signal.rules?.forEach(rule => {
            if (rule.Type === 'takeprofit') winCount++;
            if (rule.Type === 'stoploss') lossCount++;
        });
    });

    const totalFinished = winCount + lossCount;
    const winRate = totalFinished > 0 ? ((winCount / totalFinished) * 100).toFixed(1) : 0;

    useEffect(() => {
        if (!activeStrategy || !selectedAccount) return;
        const strategyId = activeStrategy.documentId || activeStrategy.id;
        const accountId = selectedAccount.documentId || selectedAccount.id;

        dispatch(fetchClosedTrades({ accountId, strategyId }));
    }, [activeStrategy, selectedAccount, dispatch]);

    const strategyStats = useMemo(() => {
        if (!closedTrades || closedTrades.length === 0) {
            return { rewardRisk: 0, avgWin: 0, avgLoss: 0, loading: closedTradesLoading };
        }

        let wins = 0;
        let losses = 0;
        let grossProfit = 0;
        let grossLoss = 0;

        closedTrades.forEach(trade => {
            const details = trade.trade_details || [];
            const sortedDetails = [...details].sort((a, b) => new Date(a.date) - new Date(b.date));

            let pnl = 0;
            if (sortedDetails && sortedDetails.length > 0) {
                pnl = sortedDetails.reduce((acc, d) => {
                    const val = (parseFloat(d.price) || 0) * (parseFloat(d.volume) || 0);
                    return d.type === 'Sell' ? acc + val : acc - val;
                }, 0);
            }

            if (trade.trade_status === 'Closed') {
                if (pnl > 0) {
                    wins++;
                    grossProfit += pnl;
                } else if (pnl < 0) {
                    losses++;
                    grossLoss += Math.abs(pnl);
                }
            }
        });

        const avgWin = wins > 0 ? grossProfit / wins : 0;
        const avgLoss = losses > 0 ? grossLoss / losses : 0;
        console.log('avgWin', avgWin);
        console.log('avgLoss', avgLoss);
        const rewardRisk = avgLoss > 0 ? (avgWin / avgLoss) : (avgWin > 0 ? 99.99 : 0);

        return {
            rewardRisk: rewardRisk.toFixed(2),
            avgWin: avgWin.toFixed(2),
            avgLoss: avgLoss.toFixed(2),
            loading: closedTradesLoading
        };
    }, [closedTrades, closedTradesLoading]);

    console.log('closedTrades', closedTrades);

    return (
        <div className="h-60 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col shrink-0">
            <div className="p-2 border-b border-gray-700 bg-gray-900/50 flex items-center gap-2">
                <Activity size={18} className="text-purple-400" />
                <h3 className="text-lg font-bold text-white">Strategy Summary</h3>
            </div>
            <div className="p-2 overflow-y-auto custom-scrollbar flex-1 text-sm text-gray-300">
                {activeStrategy ? (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="mb-1"><span className="font-semibold text-gray-400">Name:</span> <span className="text-blue-400 font-medium text-base">{activeStrategy.name}</span></p>
                            <p className="mb-1"><span className="font-semibold text-gray-400">Description:</span> {activeStrategy.description || 'No description'}</p>
                            <div className="flex gap-6 mt-3">
                                <div>
                                    <p className="mb-1">
                                        <span className="font-semibold text-gray-400">Win Rate:</span>{' '}
                                        <span className={`font-bold text-lg ${winRate >= 50 ? 'text-green-400' : totalFinished === 0 ? 'text-gray-400' : 'text-red-400'}`}>
                                            {totalFinished > 0 ? `${winRate}%` : 'N/A'}
                                        </span>
                                    </p>
                                    <span className="text-xs text-gray-500">({winCount}W / {lossCount}L) signals</span>
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
                            <p className="mb-1"><span className="font-semibold text-gray-400">Rules:</span> {activeStrategy.rules?.length || 0} active rules</p>
                            <div className="mt-2 text-xs">
                                {activeStrategy.rules?.map((rule, index) => (
                                    <p key={index} className="mb-1"><span className="font-semibold text-gray-400">{rule.Name}:</span> {rule.Description || 'No description'}</p>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="text-gray-500 italic mt-2">No active strategy for this account.</p>
                )}
            </div>
        </div>
    );
};

export default StrategyPanel;
