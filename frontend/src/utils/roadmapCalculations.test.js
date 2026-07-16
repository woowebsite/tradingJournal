import { describe, expect, it } from 'vitest';
import { getStrategyId } from './roadmapCalculations';

describe('getStrategyId', () => {
    it('returns null for nullish strategy values', () => {
        expect(getStrategyId(null)).toBeNull();
        expect(getStrategyId(undefined)).toBeNull();
    });

    it('extracts documentId or id from object relations', () => {
        expect(getStrategyId({ documentId: 42 })).toBe(42);
        expect(getStrategyId({ id: 7 })).toBe(7);
    });

    it('returns primitive values as-is', () => {
        expect(getStrategyId('abc')).toBe('abc');
        expect(getStrategyId(12)).toBe(12);
    });
});
