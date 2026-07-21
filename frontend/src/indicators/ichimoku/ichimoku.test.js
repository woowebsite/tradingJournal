import { describe, expect, it } from 'vitest';
import { calculateIchimoku } from './ichimoku';

describe('calculateIchimoku', () => {
    it('calculates the standard Ichimoku lines and displacement', () => {
        const candles = Array.from({ length: 60 }, (_, index) => ({
            time: `2026-01-${String(index + 1).padStart(2, '0')}`,
            high: 100 + index,
            low: 90 + index,
            close: 95 + index,
        }));
        const result = calculateIchimoku(candles, {
            conversionPeriod: 3,
            basePeriod: 5,
            spanBPeriod: 7,
            displacement: 2,
        });

        expect(result.conversion).toHaveLength(58);
        expect(result.base).toHaveLength(56);
        expect(result.spanA).toHaveLength(54);
        expect(result.spanB).toHaveLength(52);
        expect(result.spanA[0].time).toBe('2026-01-07');
    });
});
