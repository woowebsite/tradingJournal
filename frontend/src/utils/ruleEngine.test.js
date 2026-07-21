import { describe, expect, it } from 'vitest';
import { evaluateRule } from './ruleEngine';
import { calculateSupertrend } from '../indicators/supertrend';

const breakoutRule = {
    condition: 'AND',
    rules: [{
        left: { name: 'close', type: 'function', params: {} },
        right: {
            name: 'highest',
            type: 'function',
            params: { field: 'high', offset: 1, period: 52 },
        },
        operator: '>',
    }],
};

describe('highest breakout rule', () => {
    it('compares the current close with the previous 52 candles in DESC history', () => {
        const previousCandles = Array.from({ length: 52 }, (_, index) => ({
            high: index === 20 ? 120 : 100,
            close: 95,
        }));

        expect(evaluateRule([{ high: 121, close: 121 }, ...previousCandles], breakoutRule, 0)).toBe(true);
        expect(evaluateRule([{ high: 120, close: 120 }, ...previousCandles], breakoutRule, 0)).toBe(false);
    });

    it('does not evaluate a partial 52-candle window', () => {
        const incompleteHistory = [
            { high: 150, close: 150 },
            ...Array.from({ length: 51 }, () => ({ high: 100, close: 95 })),
        ];

        expect(evaluateRule(incompleteHistory, breakoutRule, 0)).toBe(false);
    });
});

describe('supertrend rule', () => {
    it('uses the same full history initialization as the chart', () => {
        const ascendingHistory = Array.from({ length: 300 }, (_, index) => {
            const center = 100 + Math.sin(index / 8) * 12 + index * 0.04;
            return {
                date: new Date(Date.UTC(2025, 0, index + 1)).toISOString(),
                open: center - 0.5,
                high: center + 2,
                low: center - 2,
                close: center + Math.cos(index / 5),
            };
        });
        const descendingHistory = [...ascendingHistory].reverse();
        const chartSupertrend = calculateSupertrend(10, 3, ascendingHistory).at(-1).value;
        const rule = {
            condition: 'AND',
            rules: [{
                left: { name: 'supertrend', type: 'function', params: { period: 10, multiplier: 3 } },
                right: { type: 'number', value: chartSupertrend },
                operator: '==',
            }],
        };

        expect(evaluateRule(descendingHistory, rule, 0)).toBe(true);
    });
});
