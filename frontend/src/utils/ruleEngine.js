/**
 * Utility to evaluate rules against a dataset (candles).
 */

export const evaluateRule = (history, ruleJson, index) => {
    // If no rule or empty rules array, assume true or handle as needed
    if (!ruleJson) return true;

    // Recursive function to evaluate a single logic node
    const evaluateNode = (node) => {
        if (node.condition) {
            // It's a group (AND/OR)
            if (!node.rules || node.rules.length === 0) return true;

            if (node.condition === 'AND') {
                return node.rules.every(child => evaluateNode(child));
            } else if (node.condition === 'OR') {
                return node.rules.some(child => evaluateNode(child));
            }
            return false;
        } else {
            // It's a leaf rule (comparison)
            return evaluateLeaf(node, history, index);
        }
    };

    return evaluateNode(ruleJson);
};

const evaluateLeaf = (node, history, index) => {
    const { operator, left, right } = node;

    const leftValue = resolveValue(left, history, index);
    const rightValue = resolveValue(right, history, index);

    // console.log(`Eval Leaf: ${leftValue} ${operator} ${rightValue} (Index: ${index})`);

    // If values are null/undefined (e.g. not enough history), fail safely?
    if (leftValue === null || rightValue === null) return false;

    // Ensure numeric comparison if possible
    switch (operator) {
        case '>': return leftValue > rightValue;
        case '>=': return leftValue >= rightValue;
        case '<': return leftValue < rightValue;
        case '<=': return leftValue <= rightValue;
        case '==': return leftValue == rightValue;
        case '!=': return leftValue != rightValue;
        default: return false;
    }
};

const resolveValue = (operand, history, index) => {
    if (!operand) return null;

    if (operand.type === 'number') {
        return operand.value;
    }

    if (operand.type === 'field') {
        const candle = history[index];
        if (!candle) return null;
        // Check for direct property or attributes (Strapi v4 vs v5) using helper
        // getValue is defined below or above, need to make sure it's accessible.
        // Since I defined it outside, it should be fine.
        const val = getValue(candle, operand.value);
        // console.log(`Resolve Field ${operand.value}: ${val}`);
        return val;
    }

    if (operand.type === 'function') {
        return executeFunction(operand, history, index);
    }

    return null;
};

const getValue = (candle, field) => {
    if (!candle) return undefined;
    const raw = candle[field] !== undefined ? candle[field] : (candle.attributes ? candle.attributes[field] : undefined);
    const num = Number(raw);
    return !isNaN(num) ? num : raw;
};

const executeFunction = (funcNode, history, index) => {
    const { name, params } = funcNode;

    // Helper: protect against out of bounds
    const getCandle = (idx) => (idx >= 0 && idx < history.length) ? history[idx] : null;

    if (name === 'highest') {
        const field = params.field || 'high';
        const period = params.period || 14;
        const offset = params.offset || 0;

        let maxVal = -Infinity;
        let count = 0;

        for (let i = 0; i < period; i++) {
            const targetIndex = index + offset + i;
            const candle = getCandle(targetIndex);

            if (candle) {
                const val = getValue(candle, field);
                if (val !== undefined && typeof val === 'number') {
                    if (val > maxVal) maxVal = val;
                    count++;
                }
            }
        }

        if (count === 0) return null;
        return maxVal;
    }

    if (name === 'lowest') {
        const field = params.field || 'low';
        const period = params.period || 14;
        const offset = params.offset || 0;

        let minVal = Infinity;
        let count = 0;

        for (let i = 0; i < period; i++) {
            const targetIndex = index + offset + i;
            const candle = getCandle(targetIndex);

            if (candle) {
                const val = getValue(candle, field);
                if (val !== undefined && typeof val === 'number') {
                    if (val < minVal) minVal = val;
                    count++;
                }
            }
        }

        if (count === 0) return null;
        return minVal;
    }

    if (name === 'sma') {
        const field = params.field || 'close';
        const period = params.period || 14;
        const offset = params.offset || 0;

        let sum = 0;
        let count = 0;
        for (let i = 0; i < period; i++) {
            const candle = getCandle(index + offset + i);
            if (candle) {
                const val = getValue(candle, field);
                if (val !== undefined && typeof val === 'number') {
                    sum += val;
                    count++;
                }
            }
        }
        if (count < period) return null;
        return sum / count;
    }

    if (name === 'ema') {
        // EMA is tricky as it's recursive.
        // We need to calculate it starting from `period` candles ago (or more for accuracy).
        // For a single point "index + offset", we need the EMA series ending there.
        // Simplified: Start SMA at index+offset+lookback, then EMA forward.
        // For short history (50), we might just calc from end?
        const field = params.field || 'close';
        const period = params.period || 14;
        const offset = params.offset || 0;

        // Effective index is the point in time we want the value for.
        // Since history is DESC (0 is newest), "index + offset" is the target time.
        // We need to calculate EMA up to that point, starting from older data.
        const targetIdx = index + offset;
        if (targetIdx >= history.length) return null;

        // Lookback: how far back to go to initialize?
        // Ideally go to end of history or at least 3x period.
        const lookback = Math.min(history.length - 1, targetIdx + period * 3);

        let k = 2 / (period + 1);
        let ema = undefined;

        // Iterate from Oldest (lookback) to Newest (targetIdx)
        for (let i = lookback; i >= targetIdx; i--) {
            const candle = getCandle(i);
            const val = getValue(candle, field);
            if (val === undefined || typeof val !== 'number') continue;

            if (ema === undefined) {
                ema = val; // Initialize with first available price (or SMA of first N)
            } else {
                ema = val * k + ema * (1 - k);
            }
        }
        return ema;
    }

    if (name === 'macd') {
        const field = params.field || 'close';
        const fast = params.fast || 12;
        const slow = params.slow || 26;
        const sig = params.signal || 9;
        const output = params.output || 'macd'; // 'macd', 'signal', 'hist'
        const offset = params.offset || 0;

        // We need to calculate MACD series to get the Signal line (which is EMA of MACD).
        // Target: index + offset.
        // We need enough data to stabilize Fast/Slow EMA, AND then 9 periods for Signal.

        const targetIdx = index + offset;
        if (targetIdx >= history.length) return null;

        // Calculation:
        // 1. Calculate Fast EMA series
        // 2. Calculate Slow EMA series
        // 3. MACD = Fast - Slow
        // 4. Signal = EMA(MACD, 9)

        // Optimization: Just calculate for the range we need? 
        // We need Signal at targetIdx. Signal depends on previous MACD values.

        // Let's iterate forward from a safe lookback.
        // Safe lookback: targetIdx + slow * 3 + sig * 3
        const lookback = Math.min(history.length - 1, targetIdx + slow * 2 + sig * 2);

        let kFast = 2 / (fast + 1);
        let kSlow = 2 / (slow + 1);
        let kSig = 2 / (sig + 1);

        let emaFast = undefined;
        let emaSlow = undefined;
        let signal = undefined;

        // Store recent MACDs to calc Signal if needed?
        // Actually standard EMA algo updates state step by step.
        // We can track `signal` state using `macd` value.

        let result = null;

        for (let i = lookback; i >= targetIdx; i--) {
            const candle = getCandle(i);
            const val = getValue(candle, field);
            if (val === undefined || typeof val !== 'number') continue;

            // Update Fast
            if (emaFast === undefined) emaFast = val;
            else emaFast = val * kFast + emaFast * (1 - kFast);

            // Update Slow
            if (emaSlow === undefined) emaSlow = val;
            else emaSlow = val * kSlow + emaSlow * (1 - kSlow);

            // Update MACD & Signal
            if (emaFast !== undefined && emaSlow !== undefined) {
                const macdLine = emaFast - emaSlow;

                if (signal === undefined) signal = macdLine;
                else signal = macdLine * kSig + signal * (1 - kSig);

                if (i === targetIdx) {
                    if (output === 'macd') result = macdLine;
                    else if (output === 'signal') result = signal;
                    else if (output === 'hist') result = macdLine - signal;
                }
            }
        }

        return result;
    }

    if (name === 'rsi') {
        const field = params.field || 'close';
        const period = params.period || 14;
        const offset = params.offset || 0;

        const targetIdx = index + offset;
        // Needs previous date for change.
        if (targetIdx + period + 5 >= history.length) return null; // Not enough data

        // Need lookback
        const lookback = Math.min(history.length - 2, targetIdx + period * 4);

        // Smoothed RSI:
        // AvgGain = (PrevAvgGain * (period-1) + CurrGain) / period

        let avgGain = 0;
        let avgLoss = 0;
        let valid = false;

        // Initial SMA approach for first `period`? 
        // The standard Wilder's RSI uses Smoothed Moving Average.
        // First value: Average of gains/losses. Subsequent: Smoothing.

        // Let's implement simpler RSI or standard? Standard.

        // 1. Calculate initial Average Gain/Loss for the first 'period' window available in lookback?
        // Actually, iterating from old to new is best.

        let prevVal = undefined;
        let count = 0;

        let currentRSI = null;

        for (let i = lookback; i >= targetIdx; i--) {
            const candle = getCandle(i);
            const val = getValue(candle, field);

            if (val === undefined || val === null) continue;

            if (prevVal === undefined) {
                prevVal = val;
                continue;
            }

            const change = val - prevVal;
            prevVal = val;

            let gain = change > 0 ? change : 0;
            let loss = change < 0 ? -change : 0;

            if (!valid) {
                // Accumulate for first period
                avgGain += gain;
                avgLoss += loss;
                count++;
                if (count === period) {
                    avgGain /= period;
                    avgLoss /= period;
                    valid = true;
                }
            } else {
                avgGain = (avgGain * (period - 1) + gain) / period;
                avgLoss = (avgLoss * (period - 1) + loss) / period;
            }

            if (valid && i === targetIdx) {
                if (avgLoss === 0) currentRSI = 100;
                else {
                    const rs = avgGain / avgLoss;
                    currentRSI = 100 - (100 / (1 + rs));
                }
            }
        }
        return currentRSI;
    }

    return null;
};

/**
 * Filter a history array to return only candles that satisfy the rule.
 * Useful for scanning or backtesting.
 */
export const filterHistoryByRule = (history, ruleJson) => {
    if (!history || !Array.isArray(history)) return [];

    // Sort logic? History usually assumed sorted by Date ASC or DESC.
    // The engine index logic assumes 'previous' means 'index - 1' or 'index - offset'.
    // If history is sorted DESC (newest first, index 0 is today), index + 1 is yesterday.

    // CHECK: How is history usually stored?
    // In ManageMarket.jsx: sort=date:desc. So index 0 is Newest.
    // In executeFunction above: targetIndex = index - offset - i.
    // If index=0 (newest), offset=1 => index - 1 = -1. This goes forward in time? No.
    // If array is [Today, Yesterday, 2DaysAgo...]
    // Index 0 (Today). Index 1 (Yesterday).
    // offset 1 (Yesterday). Target = 0 + 1 = 1?

    // Let's adjust logic based on sort order.
    // Assuming DESC sort (Newest at 0):
    // Previous means index + 1.
    // "highest(3, offset 1)" = highest of indices [index+1, index+2, index+3].

    // Let's standardise on data passing.
    // We'll auto-detect or assume the caller passes data in a logical order?
    // Usually indicators work best on ASC arrays [Oldest ... Newest].
    // If we pass DESC [Newest ... Oldest], then "previous" is index + 1.

    // Let's assume the user passes the array as is.
    // BUT we need to know the direction to calculate "highest previous".
    // Let's assume standard time series calc:
    // If array is DESC (0 is newest):
    //   Lookback = index + offset + i

    // Updates needed in code below:

    return history.filter((candle, index) => {
        // We pass the whole array and current index
        return evaluateRule(history, ruleJson, index);
    });
};
