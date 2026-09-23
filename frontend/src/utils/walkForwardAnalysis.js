/**
 * Walk-Forward Analysis (WFA) Engine
 * Performs In-Sample (IS) vs Out-Of-Sample (OOS) rolling/periodic validation
 * and calculates Walk-Forward Efficiency (WFE) based on quantitative finance standards (Robert Pardo).
 */
import dayjs from 'dayjs';

/**
 * Normalizes a trade date into unix timestamp (milliseconds)
 */
export function getTradeTimestamp(trade) {
    if (!trade) return 0;
    if (trade._syntheticTimestamp) return trade._syntheticTimestamp;

    // 1. Try entry_date first (usually contains full date "YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss")
    const rawDate = trade.entry_date || trade.date || trade.datetime || trade.timestamp || trade.time || trade.open_time;
    const rawTime = trade.entry_time || trade.time_str;

    // If rawDate is number (unix timestamp)
    if (typeof rawDate === 'number' && !isNaN(rawDate) && rawDate > 0) {
        return rawDate < 1e11 ? rawDate * 1000 : rawDate;
    }

    if (typeof rawDate === 'string' && rawDate.trim() !== '') {
        const trimmedDate = rawDate.trim();
        // Numeric string timestamp
        if (/^\d{10,13}$/.test(trimmedDate)) {
            const num = Number(trimmedDate);
            return num < 1e11 ? num * 1000 : num;
        }

        // Try direct parsing of entry_date
        const d = dayjs(trimmedDate);
        if (d.isValid() && d.year() > 1970) {
            return d.valueOf();
        }

        // Try combining entry_date and entry_time if entry_time exists
        if (typeof rawTime === 'string' && rawTime.trim() !== '') {
            const combined = `${trimmedDate} ${rawTime.trim()}`;
            const dCombined = dayjs(combined);
            if (dCombined.isValid() && dCombined.year() > 1970) {
                return dCombined.valueOf();
            }
        }
    }

    // 2. Try rawTime if rawDate was not parsed
    if (typeof rawTime === 'number' && !isNaN(rawTime) && rawTime > 0) {
        return rawTime < 1e11 ? rawTime * 1000 : rawTime;
    }
    if (typeof rawTime === 'string' && rawTime.trim() !== '') {
        const trimmedTime = rawTime.trim();
        if (/^\d{10,13}$/.test(trimmedTime)) {
            const num = Number(trimmedTime);
            return num < 1e11 ? num * 1000 : num;
        }
        const d = dayjs(trimmedTime);
        if (d.isValid() && d.year() > 1970) {
            return d.valueOf();
        }
    }

    // 3. Try exit_date as fallback if entry date is completely missing
    const exitDate = trade.exit_date || trade.exit_time || trade.close_time;
    if (exitDate) {
        if (typeof exitDate === 'number' && !isNaN(exitDate) && exitDate > 0) {
            return exitDate < 1e11 ? exitDate * 1000 : exitDate;
        }
        const dExit = dayjs(exitDate);
        if (dExit.isValid() && dExit.year() > 1970) {
            return dExit.valueOf();
        }
    }

    return 0;
}

/**
 * Calculates core strategy statistics for a group of trades
 */
export function calculateSubsetStats(trades = []) {
    const closed = trades.filter(t => t && (t.status === 'Closed' || t.status === 'closed' || t.pnl_percent !== undefined));
    const count = closed.length;

    if (count === 0) {
        return {
            count: 0,
            winCount: 0,
            lossCount: 0,
            winRate: 0,
            totalPnl: 0,
            avgPnl: 0,
            profitFactor: 0,
            sharpeRatio: 0,
            maxDrawdown: 0,
            avgDurationHours: 0,
            bestTrade: 0,
            worstTrade: 0
        };
    }

    const returns = closed.map(t => Number(t.pnl_percent || 0));
    const winTrades = closed.filter(t => Number(t.pnl_percent || 0) > 0);
    const lossTrades = closed.filter(t => Number(t.pnl_percent || 0) < 0);

    const winCount = winTrades.length;
    const lossCount = lossTrades.length;
    const winRate = (winCount / count) * 100;

    const totalPnl = returns.reduce((acc, r) => acc + r, 0);
    const avgPnl = totalPnl / count;

    const totalWinPnl = winTrades.reduce((acc, t) => acc + Number(t.pnl_percent || 0), 0);
    const totalLossPnl = Math.abs(lossTrades.reduce((acc, t) => acc + Number(t.pnl_percent || 0), 0));
    const profitFactor = totalLossPnl === 0 ? (totalWinPnl > 0 ? 99.9 : 0) : totalWinPnl / totalLossPnl;

    // Sharpe Ratio calculation
    const variance = returns.reduce((acc, r) => acc + Math.pow(r - avgPnl, 2), 0) / Math.max(1, count - 1);
    const std = Math.sqrt(variance);
    const sharpeRatio = std === 0 ? 0 : avgPnl / std;

    // Max Drawdown calculation from cumulative PnL
    let peak = 0;
    let maxDd = 0;
    let cumPnl = 0;
    returns.forEach(r => {
        cumPnl += r;
        if (cumPnl > peak) {
            peak = cumPnl;
        }
        const dd = peak - cumPnl;
        if (dd > maxDd) {
            maxDd = dd;
        }
    });

    // Average holding time in hours
    let totalDurationMs = 0;
    let validDurations = 0;
    closed.forEach(t => {
        const entryTs = getTradeTimestamp(t);
        const exitVal = t.exit_time || t.exit_date || t.close_time;
        if (entryTs && exitVal) {
            const exitTs = typeof exitVal === 'number' ? (exitVal < 1e11 ? exitVal * 1000 : exitVal) : dayjs(exitVal).valueOf();
            if (exitTs > entryTs) {
                totalDurationMs += (exitTs - entryTs);
                validDurations++;
            }
        }
    });
    const avgDurationHours = validDurations > 0 ? (totalDurationMs / validDurations) / (1000 * 3600) : 0;

    const bestTrade = returns.length > 0 ? Math.max(...returns) : 0;
    const worstTrade = returns.length > 0 ? Math.min(...returns) : 0;

    return {
        count,
        winCount,
        lossCount,
        winRate,
        totalPnl,
        avgPnl,
        profitFactor,
        sharpeRatio,
        maxDrawdown: maxDd,
        avgDurationHours,
        bestTrade,
        worstTrade
    };
}

/**
 * Gets duration in ms for a given WFA timeframe
 */
export function getWfaTfDurationMs(wfaTf) {
    switch (wfaTf) {
        case 'H1':
        case '60':
            return 3600 * 1000;
        case 'H4':
        case '240':
            return 4 * 3600 * 1000;
        case 'D1':
        case '1D':
        case 'D':
            return 24 * 3600 * 1000;
        case 'W1':
        case '1W':
        case 'W':
            return 7 * 24 * 3600 * 1000;
        case 'M1':
        case '1M':
        case 'M':
            return 30 * 24 * 3600 * 1000;
        case 'Q1':
            return 90 * 24 * 3600 * 1000;
        default:
            return 24 * 3600 * 1000;
    }
}

/**
 * Aligns a timestamp to the exact start of a calendar interval in UTC
 */
export function alignCycleStart(ts, wfaTf) {
    const d = new Date(ts);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const date = d.getUTCDate();
    const dayOfWeek = d.getUTCDay(); // 0 is Sunday, 1 is Monday...
    const hours = d.getUTCHours();

    switch (wfaTf) {
        case 'H1':
            return Date.UTC(year, month, date, hours, 0, 0, 0);
        case 'H4': {
            const bucketHour = Math.floor(hours / 4) * 4;
            return Date.UTC(year, month, date, bucketHour, 0, 0, 0);
        }
        case 'D1':
            return Date.UTC(year, month, date, 0, 0, 0, 0);
        case 'W1': {
            // Aligns to Monday 00:00:00 UTC
            const diffDays = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            return Date.UTC(year, month, date - diffDays, 0, 0, 0, 0);
        }
        case 'M1':
            return Date.UTC(year, month, 1, 0, 0, 0, 0);
        case 'Q1': {
            const quarterMonth = Math.floor(month / 3) * 3;
            return Date.UTC(year, quarterMonth, 1, 0, 0, 0, 0);
        }
        default:
            return Date.UTC(year, month, date, 0, 0, 0, 0);
    }
}

/**
 * Gets the start timestamp of the next calendar interval in UTC
 */
export function getNextCycleStart(startTs, wfaTf) {
    const d = new Date(startTs);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const date = d.getUTCDate();
    const hours = d.getUTCHours();

    switch (wfaTf) {
        case 'H1':
            return Date.UTC(year, month, date, hours + 1, 0, 0, 0);
        case 'H4':
            return Date.UTC(year, month, date, hours + 4, 0, 0, 0);
        case 'D1':
            return Date.UTC(year, month, date + 1, 0, 0, 0, 0);
        case 'W1':
            return Date.UTC(year, month, date + 7, 0, 0, 0, 0);
        case 'M1':
            return Date.UTC(year, month + 1, 1, 0, 0, 0, 0);
        case 'Q1':
            return Date.UTC(year, month + 3, 1, 0, 0, 0, 0);
        default:
            return Date.UTC(year, month, date + 1, 0, 0, 0, 0);
    }
}

/**
 * Performs Walk-Forward Analysis on a list of trades
 *
 * @param {Array} trades - List of trades from backtest
 * @param {Object} config - WFA configuration
 * @returns {Object} Full Walk-Forward Analysis results & cycle breakdowns
 */
export function calculateWalkForwardAnalysis(trades = [], config = {}) {
    const {
        wfaTf = 'D1',
        wfaMode = 'Chỉ kiểm định Out-of-Sample (OOS)',
        wfaOosPercent = 30,
        wfaCycleOffset = 0,
        wfaScope = 'Tất cả các chu kỳ',
        wfaTargetCycle = 1
    } = config;

    if (!Array.isArray(trades) || trades.length === 0) {
        return null;
    }

    const closedTrades = trades.filter(t => t && (t.status === 'Closed' || t.status === 'closed' || t.pnl_percent !== undefined || t.exit_date || t.exit_price !== undefined));
    const targetTrades = closedTrades.length > 0 ? closedTrades : trades;

    if (targetTrades.length === 0) {
        return {
            insufficientData: true,
            totalTrades: 0,
            message: 'Không tìm thấy lệnh giao dịch để thực hiện Walk-Forward Analysis.'
        };
    }

    const cycleDurationMs = getWfaTfDurationMs(wfaTf);

    // Extract timestamps for all trades
    const tradesWithTs = targetTrades.map((t, idx) => ({
        trade: t,
        ts: getTradeTimestamp(t),
        idx
    }));

    const validTsTrades = tradesWithTs.filter(item => item.ts > 0);

    let sortedTrades = [];
    let firstTradeTs = 0;
    let lastTradeTs = 0;

    if (validTsTrades.length >= 2) {
        validTsTrades.sort((a, b) => a.ts - b.ts);
        sortedTrades = validTsTrades.map(item => item.trade);
        firstTradeTs = validTsTrades[0].ts;
        lastTradeTs = validTsTrades[validTsTrades.length - 1].ts;
    } else {
        // Fallback: If dates cannot be extracted directly, synthesize rolling timestamps from trade index
        const baseStart = Date.now() - (targetTrades.length * (cycleDurationMs / 5));
        sortedTrades = targetTrades.map((t, idx) => {
            const synthTs = baseStart + idx * (cycleDurationMs / 5);
            return {
                ...t,
                _syntheticTimestamp: synthTs
            };
        });
        firstTradeTs = baseStart;
        lastTradeTs = baseStart + (sortedTrades.length - 1) * (cycleDurationMs / 5);
    }

    const oosRatio = Math.max(0.05, Math.min(0.95, Number(wfaOosPercent) / 100));
    const isRatio = 1 - oosRatio;

    const cycles = [];

    if (wfaTf === 'D1') {
        // Group trades by distinct calendar trading days (YYYY-MM-DD)
        const dayMap = new Map();
        sortedTrades.forEach(trade => {
            const ts = getTradeTimestamp(trade);
            if (!ts) return;
            // Get date string (prefer trade's own date string if available to avoid timezone shift)
            const rawDate = trade.entry_date || trade.date || trade.datetime || trade.timestamp;
            let dateKey = '';
            if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawDate.trim())) {
                dateKey = rawDate.trim().substring(0, 10);
            } else {
                dateKey = dayjs(ts).format('YYYY-MM-DD');
            }

            if (!dayMap.has(dateKey)) {
                dayMap.set(dateKey, []);
            }
            dayMap.get(dateKey).push(trade);
        });

        const sortedDateKeys = Array.from(dayMap.keys()).sort();
        sortedDateKeys.forEach((dateKey, idx) => {
            const cycleIndex = idx + 1;
            const effCycleIndex = cycleIndex + Number(wfaCycleOffset || 0);
            const targetCycleWithOffset = Number(wfaTargetCycle || 1) + Number(wfaCycleOffset || 0);

            let isInScope = true;
            if (wfaScope === 'Chỉ 1 chu kỳ mục tiêu (Single Cycle)') {
                isInScope = (cycleIndex === targetCycleWithOffset);
            } else if (wfaScope === 'Từ chu kỳ mục tiêu trở đi (From Cycle N)') {
                isInScope = (cycleIndex >= targetCycleWithOffset);
            } else {
                isInScope = true;
            }

            const dayTrades = dayMap.get(dateKey) || [];
            const dayStartTs = Date.parse(`${dateKey}T00:00:00.000Z`);
            const dayEndTs = Date.parse(`${dateKey}T23:59:59.999Z`);

            // Calculate intra-day split time based on trades or day duration
            let splitTime = dayStartTs + Math.round((dayEndTs - dayStartTs) * isRatio);
            if (dayTrades.length >= 2) {
                const splitIdx = Math.max(1, Math.min(dayTrades.length - 1, Math.floor(dayTrades.length * isRatio)));
                const tBefore = getTradeTimestamp(dayTrades[splitIdx - 1]);
                const tAfter = getTradeTimestamp(dayTrades[splitIdx]);
                splitTime = Math.round((tBefore + tAfter) / 2);
            }

            const formattedLabel = dayjs(dateKey).format('DD/MM/YYYY');

            cycles.push({
                cycleIndex,
                effCycleIndex,
                dateKey,
                startTime: dayStartTs,
                splitTime,
                endTime: dayEndTs,
                formattedStart: `${dateKey} 00:00`,
                formattedEnd: `${dateKey} 23:59`,
                formattedLabel,
                isInScope,
                isAlternatingOos: effCycleIndex % 2 === 0,
                isAlternatingIs: effCycleIndex % 2 === 1,
                tradesIS: [],
                tradesOOS: []
            });
        });
    } else {
        // Standard rolling calendar cycles for other timeframes (W1, M1, H1, H4...)
        const alignedFirstStart = alignCycleStart(firstTradeTs, wfaTf);
        const alignedLastEnd = getNextCycleStart(alignCycleStart(lastTradeTs, wfaTf), wfaTf);

        let currentStart = alignedFirstStart;
        let cycleIndex = 1;

        while (currentStart < alignedLastEnd && cycleIndex <= 1000) {
            const cycleStart = currentStart;
            const cycleEnd = getNextCycleStart(cycleStart, wfaTf);
            const cycleSpan = cycleEnd - cycleStart;
            const splitTime = Math.round(cycleStart + cycleSpan * isRatio);

            const effCycleIndex = cycleIndex + Number(wfaCycleOffset || 0);
            const targetCycleWithOffset = Number(wfaTargetCycle || 1) + Number(wfaCycleOffset || 0);

            let isInScope = true;
            if (wfaScope === 'Chỉ 1 chu kỳ mục tiêu (Single Cycle)') {
                isInScope = (cycleIndex === targetCycleWithOffset);
            } else if (wfaScope === 'Từ chu kỳ mục tiêu trở đi (From Cycle N)') {
                isInScope = (cycleIndex >= targetCycleWithOffset);
            } else {
                isInScope = true;
            }

            let formattedLabel = '';
            if (wfaTf === 'W1') {
                formattedLabel = `${dayjs(cycleStart).format('DD/MM')} - ${dayjs(cycleEnd - 1000).format('DD/MM/YYYY')}`;
            } else if (wfaTf === 'H1' || wfaTf === 'H4') {
                formattedLabel = `${dayjs(cycleStart).format('DD/MM HH:mm')} - ${dayjs(cycleEnd - 1000).format('HH:mm')}`;
            } else if (wfaTf === 'M1') {
                formattedLabel = dayjs(cycleStart).format('MM/YYYY');
            } else {
                formattedLabel = dayjs(cycleStart).format('DD/MM/YYYY');
            }

            cycles.push({
                cycleIndex,
                effCycleIndex,
                startTime: cycleStart,
                splitTime,
                endTime: cycleEnd,
                formattedStart: dayjs(cycleStart).format('YYYY-MM-DD HH:mm'),
                formattedEnd: dayjs(cycleEnd - 1000).format('YYYY-MM-DD HH:mm'),
                formattedLabel,
                isInScope,
                isAlternatingOos: effCycleIndex % 2 === 0,
                isAlternatingIs: effCycleIndex % 2 === 1,
                tradesIS: [],
                tradesOOS: []
            });

            currentStart = cycleEnd;
            cycleIndex++;
        }
    }

    // 1. Assign all trades to their respective cycles
    cycles.forEach(c => {
        c._tradesAll = [];
    });

    sortedTrades.forEach(trade => {
        const ts = getTradeTimestamp(trade);
        if (!ts) return;

        let cycle = null;
        if (wfaTf === 'D1') {
            const rawDate = trade.entry_date || trade.date || trade.datetime || trade.timestamp;
            let dateKey = '';
            if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawDate.trim())) {
                dateKey = rawDate.trim().substring(0, 10);
            } else {
                dateKey = new Date(ts).toISOString().substring(0, 10);
            }
            cycle = cycles.find(c => c.dateKey === dateKey);
        }

        if (!cycle) {
            cycle = cycles.find(c => ts >= c.startTime && ts < c.endTime) || cycles[cycles.length - 1];
        }
        if (cycle) {
            cycle._tradesAll.push(trade);
        }
    });

    // 2. Partition each cycle's trades into IS and OOS
    const allIsTrades = [];
    const allOosTrades = [];

    cycles.forEach(cycle => {
        const tradesInCycle = cycle._tradesAll || [];
        tradesInCycle.sort((a, b) => getTradeTimestamp(a) - getTradeTimestamp(b));

        if (wfaMode === 'Chu kỳ xen kẽ (Xen kẽ 1 chu kỳ IS, 1 chu kỳ OOS)') {
            if (cycle.isAlternatingOos && cycle.isInScope) {
                cycle.tradesOOS = tradesInCycle;
                cycle.tradesIS = [];
                cycle.splitTime = cycle.startTime;
                tradesInCycle.forEach(t => allOosTrades.push({ ...t, wfaType: 'OOS', cycleIndex: cycle.cycleIndex }));
            } else if (cycle.isAlternatingIs && cycle.isInScope) {
                cycle.tradesIS = tradesInCycle;
                cycle.tradesOOS = [];
                cycle.splitTime = cycle.endTime;
                tradesInCycle.forEach(t => allIsTrades.push({ ...t, wfaType: 'IS', cycleIndex: cycle.cycleIndex }));
            }
        } else {
            // Intra-cycle split: split trades proportionally so OOS is guaranteed to have the ending period trades
            if (tradesInCycle.length >= 2) {
                const splitIdx = Math.max(1, Math.min(tradesInCycle.length - 1, Math.floor(tradesInCycle.length * isRatio)));
                const tBefore = getTradeTimestamp(tradesInCycle[splitIdx - 1]);
                const tAfter = getTradeTimestamp(tradesInCycle[splitIdx]);
                cycle.splitTime = Math.round((tBefore + tAfter) / 2);

                if (cycle.isInScope) {
                    cycle.tradesIS = tradesInCycle.slice(0, splitIdx);
                    cycle.tradesOOS = tradesInCycle.slice(splitIdx);
                    cycle.tradesIS.forEach(t => allIsTrades.push({ ...t, wfaType: 'IS', cycleIndex: cycle.cycleIndex }));
                    cycle.tradesOOS.forEach(t => allOosTrades.push({ ...t, wfaType: 'OOS', cycleIndex: cycle.cycleIndex }));
                }
            } else if (tradesInCycle.length === 1) {
                if (cycle.isInScope) {
                    cycle.tradesIS = tradesInCycle;
                    cycle.tradesOOS = [];
                    cycle.splitTime = getTradeTimestamp(tradesInCycle[0]) + 1000;
                    allIsTrades.push({ ...tradesInCycle[0], wfaType: 'IS', cycleIndex: cycle.cycleIndex });
                }
            } else {
                cycle.tradesIS = [];
                cycle.tradesOOS = [];
            }
        }
    });

    // Compute stats for each cycle
    const cycleBreakdown = cycles.map(c => {
        const isStats = calculateSubsetStats(c.tradesIS);
        const oosStats = calculateSubsetStats(c.tradesOOS);
        
        let cycleWfe = 0;
        if (isStats.totalPnl > 0 && oosStats.totalPnl > 0) {
            cycleWfe = (oosStats.totalPnl / isStats.totalPnl) * 100;
        } else if (oosStats.totalPnl > 0 && isStats.totalPnl <= 0) {
            cycleWfe = 100;
        } else if (oosStats.totalPnl <= 0) {
            cycleWfe = 0;
        }

        let status = 'NO_TRADES';
        if (oosStats.count > 0 || isStats.count > 0) {
            if (oosStats.totalPnl > 0) status = 'PASS';
            else if (oosStats.totalPnl === 0 && isStats.totalPnl > 0) status = 'NEUTRAL';
            else status = 'FAIL';
        }

        return {
            ...c,
            isStats,
            oosStats,
            cycleWfe,
            status
        };
    }).filter(c => c.isInScope || c.tradesIS.length > 0 || c.tradesOOS.length > 0);

    // Compute Overall IS vs OOS stats
    const isOverallStats = calculateSubsetStats(allIsTrades);
    const oosOverallStats = calculateSubsetStats(allOosTrades);
    const fullStats = calculateSubsetStats(sortedTrades);

    // Calculate Walk-Forward Efficiency (WFE)
    let wfePercent = 0;
    if (isOverallStats.totalPnl > 0 && oosOverallStats.totalPnl > 0) {
        wfePercent = (oosOverallStats.totalPnl / isOverallStats.totalPnl) * 100;
    } else if (oosOverallStats.totalPnl > 0 && isOverallStats.totalPnl <= 0) {
        wfePercent = 100;
    } else if (oosOverallStats.totalPnl <= 0) {
        wfePercent = 0;
    }

    // Determine WFA Robustness Grade
    let robustnessGrade = 'OVERFITTED';
    let robustnessLabel = 'Nguy Cơ Overfitting Cao (Overfitted)';
    let robustnessColor = 'rose';
    let robustnessDesc = 'Hiệu suất ngoài mẫu (OOS) sụt giảm mạnh so với trong mẫu (IS). Cần thận trọng xem xét lại quy tắc vào lệnh hoặc giảm số lượng tham số tối ưu.';

    if (oosOverallStats.count >= 3) {
        if (wfePercent >= 70 && oosOverallStats.profitFactor >= 1.3 && oosOverallStats.winRate >= 45) {
            robustnessGrade = 'EXCELLENT';
            robustnessLabel = 'Rất Bền Vững & Tổng Quát Hóa Tốt (Highly Robust)';
            robustnessColor = 'emerald';
            robustnessDesc = 'Chiến lược thể hiện hiệu suất xuất sắc trên tập dữ liệu chưa từng thấy (OOS) với tỷ lệ WFE > 70%. Hệ thống sẵn sàng cho giao dịch Live.';
        } else if (wfePercent >= 50 && oosOverallStats.totalPnl > 0) {
            robustnessGrade = 'ROBUST';
            robustnessLabel = 'Đạt Chuẩn Kiểm Định (Robust - Pass)';
            robustnessColor = 'emerald';
            robustnessDesc = 'Hiệu suất ngoài mẫu duy trì trên 50% so với trong mẫu. Chiến lược vượt qua bài kiểm tra Walk-Forward theo chuẩn Robert Pardo.';
        } else if (wfePercent >= 30 && oosOverallStats.totalPnl >= 0) {
            robustnessGrade = 'MODERATE';
            robustnessLabel = 'Hiệu Suất Trung Bình (Moderate / Caution)';
            robustnessColor = 'amber';
            robustnessDesc = 'Có sự suy giảm hiệu suất ở giai đoạn Out-of-Sample nhưng vẫn giữ được lợi nhuận dương. Nên chạy thêm paper trading.';
        }
    } else if (oosOverallStats.count > 0) {
        robustnessGrade = 'INSUFFICIENT_OOS';
        robustnessLabel = 'Chưa Đủ Mẫu Lệnh OOS (Few OOS Trades)';
        robustnessColor = 'amber';
        robustnessDesc = 'Số lượng lệnh Out-of-Sample còn ít (< 3 lệnh). Hãy tăng số chu kỳ hoặc mở rộng tỷ lệ OOS để có kết quả kiểm định chính xác hơn.';
    }

    return {
        insufficientData: false,
        totalTrades: sortedTrades.length,
        wfaTf,
        wfaMode,
        wfaOosPercent,
        wfaCycleOffset,
        wfaScope,
        wfaTargetCycle,
        cycleDurationMs,
        totalCyclesCount: cycles.length,
        isOverallStats,
        oosOverallStats,
        fullStats,
        wfePercent,
        robustnessGrade,
        robustnessLabel,
        robustnessColor,
        robustnessDesc,
        cycleBreakdown,
        allIsTrades,
        allOosTrades
    };
}
