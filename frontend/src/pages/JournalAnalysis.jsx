import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Activity, AlertTriangle, BarChart3, Brain, Percent, TrendingDown, TrendingUp } from 'lucide-react';
import { useAccount } from '../context/AccountContext';
import { fetchClosedTrades } from '../features/tradeSlice';
import { calculateTradePnL } from '../utils/tradeCalculations';
import { formatNumber } from '../utils/formatNumber';

const getScoredId = (item) => item?.documentId || item?.id || item?.Label || item?.label || 'unknown';
const getScoredLabel = (item) => item?.Label || item?.label || item?.Name || item?.name || 'Unlabeled';

const formatPercent = (value) => `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`;

const JournalAnalysis = () => {
    const dispatch = useDispatch();
    const { selectedAccount } = useAccount();
    const { closedTrades, closedTradesLoading } = useSelector(state => state.trades);
    const moneyFormat = selectedAccount?.moneyFormat || '#,###.##';

    useEffect(() => {
        if (!selectedAccount) return;
        dispatch(fetchClosedTrades({ accountId: selectedAccount.documentId || selectedAccount.id }));
    }, [dispatch, selectedAccount]);

    const analysis = useMemo(() => {
        const trades = (closedTrades || [])
            .map(trade => ({
                ...trade,
                pnl: calculateTradePnL(trade)
            }))
            .filter(trade => Number.isFinite(trade.pnl));

        const winners = trades.filter(trade => trade.pnl > 0);
        const losers = trades.filter(trade => trade.pnl < 0);
        const grossProfit = winners.reduce((sum, trade) => sum + trade.pnl, 0);
        const grossLoss = losers.reduce((sum, trade) => sum + Math.abs(trade.pnl), 0);
        const winrate = trades.length ? (winners.length / trades.length) * 100 : 0;
        const profitAverage = winners.length ? grossProfit / winners.length : 0;
        const lossAverage = losers.length ? losers.reduce((sum, trade) => sum + trade.pnl, 0) / losers.length : 0;
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

        const scoredMap = new Map();

        trades.forEach(trade => {
            const scoreds = trade.scoreds?.length ? trade.scoreds : [{ id: 'unscored', Label: 'Unscored' }];

            scoreds.forEach(scored => {
                const key = getScoredId(scored);
                const current = scoredMap.get(key) || {
                    id: key,
                    label: getScoredLabel(scored),
                    total: 0,
                    wins: 0,
                    pnl: 0
                };

                current.total += 1;
                current.wins += trade.pnl > 0 ? 1 : 0;
                current.pnl += trade.pnl;
                scoredMap.set(key, current);
            });
        });

        const scoredStats = Array.from(scoredMap.values())
            .map(item => ({
                ...item,
                winrate: item.total ? (item.wins / item.total) * 100 : 0,
                averagePnl: item.total ? item.pnl / item.total : 0
            }))
            .sort((a, b) => b.winrate - a.winrate || b.total - a.total);

        return {
            trades,
            winners,
            losers,
            winrate,
            lossAverage,
            profitAverage,
            profitFactor,
            scoredStats
        };
    }, [closedTrades]);

    const suggestion = useMemo(() => {
        if (!analysis.trades.length) {
            return {
                tone: 'neutral',
                title: 'No closed trades yet',
                body: 'Close a few trades to build a reliable analysis baseline.'
            };
        }

        const bestScored = analysis.scoredStats.find(item => item.total >= 3 && item.winrate >= analysis.winrate);
        const weakScored = [...analysis.scoredStats]
            .filter(item => item.total >= 3)
            .sort((a, b) => a.winrate - b.winrate)[0];

        if (analysis.profitFactor >= 1.5 && analysis.winrate >= 50) {
            return {
                tone: 'positive',
                title: 'Edge looks healthy',
                body: bestScored
                    ? `Prioritize setups tagged "${bestScored.label}" and keep risk steady while the profit factor remains above 1.5.`
                    : 'Keep position sizing consistent and avoid adding new setups until this edge has more samples.'
            };
        }

        if (Math.abs(analysis.lossAverage) > analysis.profitAverage && analysis.losers.length > 0) {
            return {
                tone: 'warning',
                title: 'Losses are too heavy',
                body: weakScored
                    ? `Review entries tagged "${weakScored.label}" first; losses are pulling down expectancy.`
                    : 'Tighten invalidation rules or reduce size until average loss is smaller than average profit.'
            };
        }

        if (analysis.winrate < 45) {
            return {
                tone: 'warning',
                title: 'Winrate needs filtering',
                body: bestScored
                    ? `Trade more selectively around "${bestScored.label}" and pause weaker tags until the sample improves.`
                    : 'Add stricter entry filters and avoid marginal trades until winrate stabilizes.'
            };
        }

        return {
            tone: 'neutral',
            title: 'Performance is balanced',
            body: 'Keep collecting samples and compare scored groups before changing position sizing.'
        };
    }, [analysis]);

    const suggestionTone = {
        positive: 'border-green-500/30 bg-green-500/10 text-green-200',
        warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-100',
        neutral: 'border-blue-500/30 bg-blue-500/10 text-blue-100'
    }[suggestion.tone];

    const metricCards = [
        { label: 'Winrate', value: formatPercent(analysis.winrate), icon: Percent, tone: 'text-blue-300' },
        { label: 'Loss Average', value: formatNumber(analysis.lossAverage, moneyFormat), icon: TrendingDown, tone: 'text-red-300' },
        { label: 'Profit Average', value: formatNumber(analysis.profitAverage, moneyFormat), icon: TrendingUp, tone: 'text-green-300' },
        {
            label: 'Profit Factor',
            value: analysis.profitFactor === Infinity ? '∞' : analysis.profitFactor.toFixed(2),
            icon: BarChart3,
            tone: 'text-purple-300'
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="text-sm font-medium text-blue-300">Journal / Analysis</div>
                    <h2 className="text-3xl font-bold text-white">Trade Analysis</h2>
                </div>
                <div className="text-sm text-gray-400">
                    {analysis.trades.length} closed trades
                </div>
            </div>

            {!selectedAccount ? (
                <div className="rounded-lg border border-gray-700 bg-gray-800 p-6 text-gray-400">
                    Select an account to view analysis.
                </div>
            ) : closedTradesLoading ? (
                <div className="rounded-lg border border-gray-700 bg-gray-800 p-6 text-gray-400">
                    Loading analysis...
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {metricCards.map(card => (
                            <div key={card.label} className="rounded-lg border border-gray-700 bg-gray-800 p-5">
                                <div className="mb-4 flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-400">{card.label}</span>
                                    <card.icon size={18} className={card.tone} />
                                </div>
                                <div className={`font-mono text-2xl font-bold ${card.tone}`}>
                                    {card.value}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className={`rounded-lg border p-5 ${suggestionTone}`}>
                        <div className="mb-2 flex items-center gap-2">
                            {suggestion.tone === 'warning' ? <AlertTriangle size={18} /> : <Brain size={18} />}
                            <h3 className="font-semibold">{suggestion.title}</h3>
                        </div>
                        <p className="text-sm leading-6 opacity-90">{suggestion.body}</p>
                    </div>

                    <div className="rounded-lg border border-gray-700 bg-gray-800">
                        <div className="flex items-center gap-2 border-b border-gray-700 px-5 py-4">
                            <Activity size={18} className="text-blue-300" />
                            <h3 className="font-semibold text-white">Winrate by Scored</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-900/60 text-gray-400">
                                    <tr>
                                        <th className="px-5 py-3 font-medium">Scored</th>
                                        <th className="px-5 py-3 text-right font-medium">Trades</th>
                                        <th className="px-5 py-3 text-right font-medium">Winrate</th>
                                        <th className="px-5 py-3 text-right font-medium">Avg P&L</th>
                                        <th className="px-5 py-3 text-right font-medium">Total P&L</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {analysis.scoredStats.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-5 py-8 text-center text-gray-500">
                                                No scored data found.
                                            </td>
                                        </tr>
                                    ) : analysis.scoredStats.map(item => (
                                        <tr key={item.id} className="hover:bg-gray-700/30">
                                            <td className="px-5 py-3 font-medium text-gray-100">{item.label}</td>
                                            <td className="px-5 py-3 text-right font-mono text-gray-300">{item.total}</td>
                                            <td className={`px-5 py-3 text-right font-mono font-semibold ${item.winrate >= 50 ? 'text-green-300' : 'text-red-300'}`}>
                                                {formatPercent(item.winrate)}
                                            </td>
                                            <td className={`px-5 py-3 text-right font-mono ${item.averagePnl >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                                {formatNumber(item.averagePnl, moneyFormat)}
                                            </td>
                                            <td className={`px-5 py-3 text-right font-mono ${item.pnl >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                                {formatNumber(item.pnl, moneyFormat)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default JournalAnalysis;
