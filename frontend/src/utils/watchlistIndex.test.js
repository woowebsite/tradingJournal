import { describe, expect, it } from 'vitest';
import { buildEqualWeightIndex, normalizeChartHistory } from './watchlistIndex';

describe('buildEqualWeightIndex', () => {
    it('normalizes constituents to 100 and averages their OHLC values', () => {
        const result = buildEqualWeightIndex([
            [
                { date: '2026-01-01', open: 10, high: 11, low: 9, close: 10, volume: 100 },
                { date: '2026-01-02', open: 11, high: 13, low: 10, close: 12, volume: 120 },
            ],
            [
                { date: '2026-01-01', open: 20, high: 22, low: 18, close: 20, volume: 200 },
                { date: '2026-01-02', open: 18, high: 21, low: 17, close: 20, volume: 220 },
            ],
        ]);

        expect(result).toHaveLength(2);
        expect(result[0].close).toBe(100);
        expect(result[1].close).toBe(110);
        expect(result[1].open).toBe(100);
        expect(result[1].volume).toBe(340);
    });

    it('uses only dates shared by every constituent', () => {
        const result = buildEqualWeightIndex([
            [{ date: '2026-01-01', open: 10, high: 10, low: 10, close: 10 }],
            [{ date: '2026-01-02', open: 20, high: 20, low: 20, close: 20 }],
        ]);

        expect(result).toEqual([]);
    });
});

describe('normalizeChartHistory', () => {
    it('maps TCBS tradingDate bars to TradingViewChart candles', () => {
        const result = normalizeChartHistory([{
            tradingDate: '2026-07-20T00:00:00.000Z',
            open: '1950.1',
            high: '1960.2',
            low: '1940.3',
            close: '1955.4',
            volume: '123456',
        }]);

        expect(result).toEqual([expect.objectContaining({
            date: '2026-07-20T00:00:00.000Z',
            close: 1955.4,
            volume: 123456,
        })]);
    });
});
