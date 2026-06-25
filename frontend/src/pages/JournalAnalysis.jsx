import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ReactECharts from 'echarts-for-react';
import { AlertTriangle, BarChart3, Brain, Gauge, LineChart, Percent, TrendingDown, TrendingUp } from 'lucide-react';
import { useAccount } from '../context/AccountContext';
import { fetchClosedTrades } from '../features/tradeSlice';
import { calculateTradePnL } from '../utils/tradeCalculations';
import { formatNumber } from '../utils/formatNumber';

const getScoredId = (item) => item?.documentId || item?.id || item?.Label || item?.label || 'unknown';
const getScoredLabel = (item) => item?.Label || item?.label || item?.Name || item?.name || 'Unlabeled';
const getTradeDate = (trade) => {
    const details = trade.trade_details || [];
    const sortedDetails = [...details].sort((a, b) => new Date(a.date) - new Date(b.date));
    return trade.date || sortedDetails[sortedDetails.length - 1]?.date || trade.updatedAt || trade.createdAt;
};

const formatPercent = (value) => `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`;
const formatProfitFactor = (value) => value === Infinity ? '∞' : Number.isFinite(value) ? value.toFixed(2) : '0.00';

const getQualitySuggestion = (item) => {
    if (item.total < 3) return { label: 'Need sample', tone: 'bg-gray-600/30 text-gray-300 border-gray-500/30' };
    if (item.expectancy < 0) return { label: 'Pause / review', tone: 'bg-red-500/15 text-red-300 border-red-500/30' };
    if (item.profitFactor >= 1.5 && item.winrate >= 50) return { label: 'Prioritize', tone: 'bg-green-500/15 text-green-300 border-green-500/30' };
    if (item.winrate < 45) return { label: 'Filter harder', tone: 'bg-yellow-500/15 text-yellow-200 border-yellow-500/30' };
    return { label: 'Monitor', tone: 'bg-blue-500/15 text-blue-200 border-blue-500/30' };
};

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
                pnl: calculateTradePnL(trade),
                analysisDate: getTradeDate(trade)
            }))
            .filter(trade => Number.isFinite(trade.pnl));

        const winners = trades.filter(trade => trade.pnl > 0);
        const losers = trades.filter(trade => trade.pnl < 0);
        const grossProfit = winners.reduce((sum, trade) => sum + trade.pnl, 0);
        const grossLoss = losers.reduce((sum, trade) => sum + Math.abs(trade.pnl), 0);
        const winrate = trades.length ? (winners.length / trades.length) * 100 : 0;
        const lossRate = trades.length ? (losers.length / trades.length) * 100 : 0;
        const profitAverage = winners.length ? grossProfit / winners.length : 0;
        const lossAverage = losers.length ? losers.reduce((sum, trade) => sum + trade.pnl, 0) / losers.length : 0;
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
        const expectancy = ((winrate / 100) * profitAverage) - ((lossRate / 100) * Math.abs(lossAverage));

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
                    losses: 0,
                    grossProfit: 0,
                    grossLoss: 0,
                    pnl: 0
                };

                current.total += 1;
                current.wins += trade.pnl > 0 ? 1 : 0;
                current.losses += trade.pnl < 0 ? 1 : 0;
                current.grossProfit += trade.pnl > 0 ? trade.pnl : 0;
                current.grossLoss += trade.pnl < 0 ? Math.abs(trade.pnl) : 0;
                current.pnl += trade.pnl;
                scoredMap.set(key, current);
            });
        });

        const scoredStats = Array.from(scoredMap.values())
            .map(item => {
                const winrate = item.total ? (item.wins / item.total) * 100 : 0;
                const lossRate = item.total ? (item.losses / item.total) * 100 : 0;
                const averageWin = item.wins ? item.grossProfit / item.wins : 0;
                const averageLoss = item.losses ? item.grossLoss / item.losses : 0;
                const profitFactor = item.grossLoss > 0 ? item.grossProfit / item.grossLoss : item.grossProfit > 0 ? Infinity : 0;
                const expectancy = ((winrate / 100) * averageWin) - ((lossRate / 100) * averageLoss);

                return {
                    ...item,
                    winrate,
                    averagePnl: item.total ? item.pnl / item.total : 0,
                    averageWin,
                    averageLoss,
                    profitFactor,
                    expectancy
                };
            })
            .sort((a, b) => b.winrate - a.winrate || b.total - a.total);

        let cumulativePnl = 0;
        let peakPnl = 0;
        let maxDrawdown = 0;

        const equityCurve = [...trades]
            .sort((a, b) => new Date(a.analysisDate || 0) - new Date(b.analysisDate || 0))
            .map((trade, index) => {
                cumulativePnl += trade.pnl;
                peakPnl = Math.max(peakPnl, cumulativePnl);
                maxDrawdown = Math.min(maxDrawdown, cumulativePnl - peakPnl);

                return {
                    index: index + 1,
                    date: trade.analysisDate,
                    label: trade.analysisDate ? new Date(trade.analysisDate).toLocaleDateString() : `Trade ${index + 1}`,
                    pnl: trade.pnl,
                    equity: cumulativePnl,
                    symbol: trade.symbol?.Name || trade.symbol?.name || 'N/A'
                };
            });

        return {
            trades,
            winners,
            losers,
            winrate,
            lossAverage,
            profitAverage,
            profitFactor,
            expectancy,
            equityCurve,
            totalPnl: cumulativePnl,
            maxDrawdown,
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

        if (analysis.expectancy < 0) {
            return {
                tone: 'warning',
                title: 'Expectancy is negative',
                body: weakScored
                    ? `Reduce or pause trades tagged "${weakScored.label}" until the average outcome per trade turns positive.`
                    : 'Lower risk per trade and tighten setup selection until the average outcome per trade turns positive.'
            };
        }

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
        },
        {
            label: 'Expectancy',
            value: formatNumber(analysis.expectancy, moneyFormat),
            icon: Gauge,
            tone: analysis.expectancy >= 0 ? 'text-emerald-300' : 'text-orange-300'
        }
    ];

    const equityChartOption = useMemo(() => ({
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            backgroundColor: '#111827',
            borderColor: '#374151',
            textStyle: { color: '#e5e7eb' },
            formatter: (params) => {
                const point = params?.[0];
                const item = analysis.equityCurve[point?.dataIndex];
                if (!item) return '';

                return [
                    `<div style="font-weight:600;margin-bottom:4px;">${item.label}</div>`,
                    `<div>Trade: ${item.symbol}</div>`,
                    `<div>P&L: ${formatNumber(item.pnl, moneyFormat)}</div>`,
                    `<div>Equity: ${formatNumber(item.equity, moneyFormat)}</div>`
                ].join('');
            }
        },
        grid: { left: 16, right: 20, top: 24, bottom: 24, containLabel: true },
        xAxis: {
            type: 'category',
            data: analysis.equityCurve.map(item => item.label),
            axisLine: { lineStyle: { color: '#4b5563' } },
            axisLabel: { color: '#9ca3af' },
            axisTick: { show: false }
        },
        yAxis: {
            type: 'value',
            axisLine: { show: false },
            axisLabel: {
                color: '#9ca3af',
                formatter: (value) => formatNumber(value, moneyFormat)
            },
            splitLine: { lineStyle: { color: '#374151', type: 'dashed' } }
        },
        series: [
            {
                name: 'Equity',
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                data: analysis.equityCurve.map(item => item.equity),
                lineStyle: { color: '#38bdf8', width: 3 },
                itemStyle: { color: '#38bdf8' },
                areaStyle: { color: 'rgba(56, 189, 248, 0.12)' }
            }
        ]
    }), [analysis.equityCurve, moneyFormat]);

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
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
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
                            <BarChart3 size={18} className="text-purple-300" />
                            <h3 className="font-semibold text-white">Trade Quality Dashboard</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-900/60 text-gray-400">
                                    <tr>
                                        <th className="px-5 py-3 font-medium">Setup / Scored</th>
                                        <th className="px-5 py-3 text-right font-medium">Trades</th>
                                        <th className="px-5 py-3 text-right font-medium">Winrate</th>
                                        <th className="px-5 py-3 text-right font-medium">Avg Win</th>
                                        <th className="px-5 py-3 text-right font-medium">Avg Loss</th>
                                        <th className="px-5 py-3 text-right font-medium">PF</th>
                                        <th className="px-5 py-3 text-right font-medium">Expectancy</th>
                                        <th className="px-5 py-3 text-right font-medium">Suggestion</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {analysis.scoredStats.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="px-5 py-8 text-center text-gray-500">
                                                No scored data found.
                                            </td>
                                        </tr>
                                    ) : analysis.scoredStats.map(item => {
                                        const qualitySuggestion = getQualitySuggestion(item);

                                        return (
                                            <tr key={item.id} className="hover:bg-gray-700/30">
                                                <td className="px-5 py-3 font-medium text-gray-100">{item.label}</td>
                                                <td className="px-5 py-3 text-right font-mono text-gray-300">{item.total}</td>
                                                <td className={`px-5 py-3 text-right font-mono font-semibold ${item.winrate >= 50 ? 'text-green-300' : 'text-red-300'}`}>
                                                    {formatPercent(item.winrate)}
                                                </td>
                                                <td className="px-5 py-3 text-right font-mono text-green-300">
                                                    {formatNumber(item.averageWin, moneyFormat)}
                                                </td>
                                                <td className="px-5 py-3 text-right font-mono text-red-300">
                                                    {formatNumber(-item.averageLoss, moneyFormat)}
                                                </td>
                                                <td className={`px-5 py-3 text-right font-mono ${item.profitFactor >= 1 ? 'text-green-300' : 'text-red-300'}`}>
                                                    {formatProfitFactor(item.profitFactor)}
                                                </td>
                                                <td className={`px-5 py-3 text-right font-mono ${item.expectancy >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                                    {formatNumber(item.expectancy, moneyFormat)}
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <span className={`inline-flex rounded border px-2 py-1 text-xs font-semibold ${qualitySuggestion.tone}`}>
                                                        {qualitySuggestion.label}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="rounded-lg border border-gray-700 bg-gray-800">
                        <div className="flex flex-col gap-3 border-b border-gray-700 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center gap-2">
                                <LineChart size={18} className="text-sky-300" />
                                <h3 className="font-semibold text-white">Equity Curve</h3>
                            </div>
                            <div className="flex flex-wrap gap-3 text-sm">
                                <div className="rounded border border-gray-700 bg-gray-900/60 px-3 py-1.5">
                                    <span className="text-gray-400">Total P&L </span>
                                    <span className={`font-mono font-semibold ${analysis.totalPnl >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                        {formatNumber(analysis.totalPnl, moneyFormat)}
                                    </span>
                                </div>
                                <div className="rounded border border-gray-700 bg-gray-900/60 px-3 py-1.5">
                                    <span className="text-gray-400">Max Drawdown </span>
                                    <span className="font-mono font-semibold text-red-300">
                                        {formatNumber(analysis.maxDrawdown, moneyFormat)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        {analysis.equityCurve.length === 0 ? (
                            <div className="px-5 py-10 text-center text-gray-500">
                                No closed trades found for equity curve.
                            </div>
                        ) : (
                            <div className="h-[360px] px-3 py-4">
                                <ReactECharts
                                    option={equityChartOption}
                                    style={{ height: '100%', width: '100%' }}
                                    notMerge
                                    lazyUpdate
                                />
                            </div>
                        )}
                    </div>

                </>
            )}
        </div>
    );
};

export default JournalAnalysis;
