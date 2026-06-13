import { calculateTradePnL } from './tradeCalculations';

export const toNumber = (value, fallback = 0) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const getRelationId = (relation) => {
    if (!relation) return '';
    if (typeof relation === 'object') {
        return relation.documentId || relation.id || '';
    }
    return relation;
};

export const resolveSetting = (account, settings = []) => {
    if (!account) return null;

    const accountSetting = account.setting;
    if (accountSetting && typeof accountSetting === 'object') {
        return accountSetting;
    }

    const accountSettingId = getRelationId(accountSetting);
    if (accountSettingId) {
        const matched = settings.find(item => String(getRelationId(item)) === String(accountSettingId));
        if (matched) return matched;
    }

    return settings[0] || null;
};

export const summarizeClosedTrades = (trades = []) => {
    let closedCount = 0;
    let wins = 0;
    let grossProfit = 0;
    let grossLoss = 0;

    trades.forEach(trade => {
        if (!trade || trade.trade_status !== 'Closed') return;

        const pnl = calculateTradePnL(trade);
        closedCount += 1;

        if (pnl > 0) {
            wins += 1;
            grossProfit += pnl;
        } else if (pnl < 0) {
            grossLoss += Math.abs(pnl);
        }
    });

    const losses = Math.max(closedCount - wins, 0);
    const winRate = closedCount > 0 ? (wins / closedCount) * 100 : 0;
    const avgWin = wins > 0 ? grossProfit / wins : 0;
    const avgLoss = losses > 0 ? grossLoss / losses : 0;
    const rawRewardMultiple = avgLoss > 0 ? (avgWin / avgLoss) : 0;
    const rewardMultiple = rawRewardMultiple > 0
        ? Math.min(rawRewardMultiple, 10)
        : (avgWin > 0 ? 2 : 0);

    return {
        closedCount,
        wins,
        losses,
        grossProfit,
        grossLoss,
        winRate,
        avgWin,
        avgLoss,
        rewardMultiple
    };
};

export const recommendGrowthTarget = (setting) => {
    const riskPerTrade = toNumber(setting?.riskPerTrade);
    const maxDrawDown = toNumber(setting?.maxDrawDown);
    const capitalRisk = toNumber(setting?.capitalRisk);

    if (riskPerTrade <= 0.5 && maxDrawDown >= 10 && capitalRisk <= 10) return 10;
    if (riskPerTrade <= 1) return 25;
    if (riskPerTrade <= 1.5 || capitalRisk <= 15) return 50;
    return 100;
};

export const buildRoadmapProjection = ({
    startBalance,
    riskPercent,
    targetGrowthPercent,
    rewardMultiple,
    plannedTrades,
    winRateEstimate,
    maxDrawDownPercent = 0
}) => {
    const baseBalance = Math.max(toNumber(startBalance), 0);
    const riskPct = Math.max(toNumber(riskPercent), 0);
    const growthPct = Math.max(toNumber(targetGrowthPercent), 0);
    const rr = Math.max(toNumber(rewardMultiple, 0), 0);
    const tradesCount = Math.max(Math.floor(toNumber(plannedTrades, 0)), 0);
    const winRate = Math.min(Math.max(toNumber(winRateEstimate, 0) / 100, 0), 1);

    const targetBalance = baseBalance * (1 + growthPct / 100);
    const profitTarget = targetBalance - baseBalance;
    const riskFactor = riskPct / 100;
    const winFactor = 1 + (riskFactor * rr);
    const lossFactor = 1 - riskFactor;
    const rewardPct = riskPct * rr;

    const winOnlyLog = winFactor > 1 ? Math.log(winFactor) : 0;
    const goalLog = baseBalance > 0 && targetBalance > 0 ? Math.log(targetBalance / baseBalance) : 0;
    const lossesLog = lossFactor > 0 ? Math.log(lossFactor) : Number.NEGATIVE_INFINITY;

    const winsOnlyNeeded = winOnlyLog > 0 ? Math.ceil(goalLog / winOnlyLog) : null;

    let winsNeededInPlannedTrades = null;
    if (tradesCount > 0 && winFactor > 0 && lossFactor > 0) {
        const numerator = goalLog - (tradesCount * lossesLog);
        const denominator = Math.log(winFactor) - lossesLog;
        if (denominator > 0) {
            winsNeededInPlannedTrades = Math.ceil(numerator / denominator);
        }
    }

    if (winsNeededInPlannedTrades !== null) {
        winsNeededInPlannedTrades = Math.max(0, Math.min(tradesCount, winsNeededInPlannedTrades));
    }

    const expectedLogGrowth = (winRate > 0 && winRate < 1 && winFactor > 0 && lossFactor > 0)
        ? (winRate * Math.log(winFactor)) + ((1 - winRate) * Math.log(lossFactor))
        : 0;

    const estimatedTradesToGoal = winRate === 1
        ? winsOnlyNeeded
        : (expectedLogGrowth > 0
            ? Math.ceil(goalLog / expectedLogGrowth)
            : null);

    const expectedWinsInPlannedTrades = tradesCount > 0 ? Math.round(tradesCount * winRate) : 0;
    const equityAfterPlannedTradesIfAllWins = tradesCount > 0 ? baseBalance * Math.pow(winFactor, tradesCount) : baseBalance;
    const lossBudget = baseBalance * (riskPct / 100);
    const maxDrawDownLossBudget = baseBalance * (toNumber(maxDrawDownPercent, 0) / 100);

    const rows = Array.from({ length: tradesCount }, (_, index) => {
        const tradeNumber = index + 1;
        const startEquity = baseBalance * Math.pow(winFactor, index);
        const winEquity = startEquity * winFactor;
        const lossEquity = startEquity * lossFactor;
        const winProfit = winEquity - startEquity;
        const lossAmount = startEquity - lossEquity;
        const progress = profitTarget > 0 ? Math.min(100, ((winEquity - baseBalance) / profitTarget) * 100) : 0;

        return {
            tradeNumber,
            startEquity,
            winEquity,
            lossEquity,
            winProfit,
            lossAmount,
            progress
        };
    });

    return {
        baseBalance,
        targetBalance,
        profitTarget,
        riskPct,
        rewardPct,
        rewardMultiple: rr,
        winFactor,
        lossFactor,
        winsOnlyNeeded,
        winsNeededInPlannedTrades,
        expectedWinsInPlannedTrades,
        estimatedTradesToGoal,
        equityAfterPlannedTradesIfAllWins,
        winRateEstimate: winRate * 100,
        lossBudget,
        maxDrawDownLossBudget,
        rows
    };
};
