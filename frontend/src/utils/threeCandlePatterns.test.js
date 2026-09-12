import { describe, expect, it } from 'vitest';
import {
    analyzeThreeCandlePatterns,
    classifyCandleDirection,
    classifyVolumeChange,
    normalizeDailyCandles,
} from './threeCandlePatterns';

describe('normalizeDailyCandles', () => {
    it('unwraps Strapi records, sorts D1 data and keeps the last duplicate day', () => {
        const result = normalizeDailyCandles([
            { date: '2026-08-03T07:00:00.000Z', open: '103', close: '104', volume: '300' },
            { attributes: { tradingDate: '2026-08-01', open: 100, close: 101, volume: 100 } },
            { date: '2026-08-03', open: 105, close: 106, volume: 350 },
            { date: 'invalid', open: 1, close: 2, volume: 10 },
            { date: '2026-02-30', open: 1, close: 2, volume: 10 },
            { date: '2026-08-02', open: 101, close: 102, volume: -1 },
            { date: '2026-08-04', open: null, close: 102, volume: 100 },
        ]);

        expect(result).toEqual([
            { date: '2026-08-01', open: 100, close: 101, volume: 100 },
            { date: '2026-08-03', open: 105, close: 106, volume: 350 },
        ]);
    });
});

describe('pattern classifiers', () => {
    it('uses a 0.1% body threshold for doji candles', () => {
        expect(classifyCandleDirection({ open: 100, close: 100.1 })).toBe('doji');
        expect(classifyCandleDirection({ open: 100, close: 100.11 })).toBe('up');
        expect(classifyCandleDirection({ open: 100, close: 99.89 })).toBe('down');
    });

    it('uses a 5% tolerance for flat volume', () => {
        expect(classifyVolumeChange(100, 105)).toBe('flat');
        expect(classifyVolumeChange(100, 95)).toBe('flat');
        expect(classifyVolumeChange(100, 106)).toBe('up');
        expect(classifyVolumeChange(100, 94)).toBe('down');
        expect(classifyVolumeChange(0, 0)).toBe('flat');
        expect(classifyVolumeChange(0, 1)).toBe('up');
    });
});

describe('analyzeThreeCandlePatterns', () => {
    it('counts overlapping patterns and reports their share of all windows', () => {
        const result = analyzeThreeCandlePatterns([
            { date: '2026-08-01', open: 100, close: 102, volume: 100 },
            { date: '2026-08-02', open: 102, close: 100, volume: 110 },
            { date: '2026-08-03', open: 100, close: 102, volume: 90 },
            { date: '2026-08-04', open: 102, close: 100, volume: 99 },
            { date: '2026-08-05', open: 100, close: 102, volume: 80 },
        ]);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            key: 'up-down-up__up-down',
            candles: ['up', 'down', 'up'],
            volumes: ['up', 'down'],
            count: 2,
            percentage: expect.any(Number),
            lastSeen: '2026-08-05',
            occurrences: [
                {
                    dates: ['2026-08-03', '2026-08-04', '2026-08-05'],
                    startDate: '2026-08-03',
                    endDate: '2026-08-05',
                },
                {
                    dates: ['2026-08-01', '2026-08-02', '2026-08-03'],
                    startDate: '2026-08-01',
                    endDate: '2026-08-03',
                },
            ],
            prediction: {
                sampleSize: 1,
                counts: { up: 0, down: 1, doji: 0 },
                probabilities: { up: 0, down: 1, doji: 0 },
                dominantDirection: 'down',
                averageReturnPercent: expect.any(Number),
            },
        });
        expect(result[0].percentage).toBeCloseTo(200 / 3);
        expect(result[0].prediction.averageReturnPercent).toBeCloseTo(-200 / 102);
        expect(result[1]).toEqual({
            key: 'down-up-down__down-up',
            candles: ['down', 'up', 'down'],
            volumes: ['down', 'up'],
            count: 1,
            percentage: expect.any(Number),
            lastSeen: '2026-08-04',
            occurrences: [
                {
                    dates: ['2026-08-02', '2026-08-03', '2026-08-04'],
                    startDate: '2026-08-02',
                    endDate: '2026-08-04',
                },
            ],
            prediction: {
                sampleSize: 1,
                counts: { up: 1, down: 0, doji: 0 },
                probabilities: { up: 1, down: 0, doji: 0 },
                dominantDirection: 'up',
                averageReturnPercent: 2,
            },
        });
        expect(result[1].percentage).toBeCloseTo(100 / 3);
    });

    it('returns no patterns when fewer than three valid D1 candles exist', () => {
        expect(analyzeThreeCandlePatterns(null)).toEqual([]);
        expect(analyzeThreeCandlePatterns([
            { date: '2026-08-01', open: 100, close: 101, volume: 100 },
            { date: '2026-08-02', open: 101, close: 102, volume: 110 },
        ])).toEqual([]);
    });

    it('predicts the next candle from every occurrence that has a following candle', () => {
        const candle = (date, direction, volume = 100) => ({
            date,
            open: 100,
            close: direction === 'up' ? 102 : direction === 'down' ? 98 : 100.05,
            volume,
        });
        const result = analyzeThreeCandlePatterns([
            candle('2026-08-01', 'up'),
            candle('2026-08-02', 'up'),
            candle('2026-08-03', 'up'),
            candle('2026-08-04', 'down'),
            candle('2026-08-05', 'up'),
            candle('2026-08-06', 'up'),
            candle('2026-08-07', 'up'),
            candle('2026-08-08', 'doji'),
            candle('2026-08-09', 'up'),
            candle('2026-08-10', 'up'),
            candle('2026-08-11', 'up'),
            candle('2026-08-12', 'up', 200),
        ]);
        const pattern = result.find(item => item.key === 'up-up-up__flat-flat');

        expect(pattern.count).toBe(3);
        expect(pattern.prediction.sampleSize).toBe(3);
        expect(pattern.prediction.counts).toEqual({ up: 1, down: 1, doji: 1 });
        expect(pattern.prediction.probabilities.up).toBeCloseTo(1 / 3);
        expect(pattern.prediction.probabilities.down).toBeCloseTo(1 / 3);
        expect(pattern.prediction.probabilities.doji).toBeCloseTo(1 / 3);
        expect(pattern.prediction.dominantDirection).toBeNull();
        expect(pattern.prediction.averageReturnPercent).toBeCloseTo(0.05 / 3);
    });

    it('returns an empty prediction when the only occurrence is the latest window', () => {
        const [pattern] = analyzeThreeCandlePatterns([
            { date: '2026-08-01', open: 100, close: 101, volume: 100 },
            { date: '2026-08-02', open: 100, close: 99, volume: 110 },
            { date: '2026-08-03', open: 100, close: 100.05, volume: 110 },
        ]);

        expect(pattern.prediction).toEqual({
            sampleSize: 0,
            counts: { up: 0, down: 0, doji: 0 },
            probabilities: { up: 0, down: 0, doji: 0 },
            dominantDirection: null,
            averageReturnPercent: null,
        });
    });

    it('keeps a zero-open candle in direction probabilities without producing an invalid average', () => {
        const [pattern] = analyzeThreeCandlePatterns([
            { date: '2026-08-01', open: 100, close: 101, volume: 100 },
            { date: '2026-08-02', open: 100, close: 101, volume: 100 },
            { date: '2026-08-03', open: 100, close: 101, volume: 100 },
            { date: '2026-08-04', open: 0, close: 1, volume: 100 },
        ]);

        expect(pattern.prediction).toEqual({
            sampleSize: 1,
            counts: { up: 1, down: 0, doji: 0 },
            probabilities: { up: 1, down: 0, doji: 0 },
            dominantDirection: 'up',
            averageReturnPercent: null,
        });
    });
});
