import { describe, expect, it } from 'vitest';
import { calculateVWAP } from './vwap';

describe('calculateVWAP', () => {
    it('calculates VWAP correctly for different anchors', () => {
        // Sample data in the same week, same month, same year
        // Day 1: close = 100, volume = 10, typical = 100 -> VWAP = 100
        // Day 2: close = 102, volume = 20, typical = 102 -> cumPriceVol = 100*10 + 102*20 = 1000 + 2040 = 3040, cumVol = 30 -> VWAP = 3040/30 = 101.33
        // Day 3: close = 105, volume = 15, typical = 105 -> cumPriceVol = 3040 + 105*15 = 3040 + 1575 = 4615, cumVol = 45 -> VWAP = 4615/45 = 102.56
        const data = [
            { date: '2026-08-17', open: 100, high: 100, low: 100, close: 100, volume: 10 }, // Monday
            { date: '2026-08-18', open: 102, high: 102, low: 102, close: 102, volume: 20 }, // Tuesday
            { date: '2026-08-19', open: 105, high: 105, low: 105, close: 105, volume: 15 }, // Wednesday
        ];

        // 1. Anchor = 'Day' should reset every single day
        const resultDay = calculateVWAP(data, 'Day');
        expect(resultDay).toHaveLength(3);
        expect(resultDay[0].value).toBe(100);
        expect(resultDay[1].value).toBe(102);
        expect(resultDay[2].value).toBe(105);

        // 2. Anchor = 'Week' should accumulate over all 3 days (same week)
        const resultWeek = calculateVWAP(data, 'Week');
        expect(resultWeek).toHaveLength(3);
        expect(resultWeek[0].value).toBe(100);
        expect(resultWeek[1].value).toBe(101.33);
        expect(resultWeek[2].value).toBe(102.56);
    });

    it('resets when crossing anchor boundaries', () => {
        // Week boundary: Monday to Sunday to next Monday
        const data = [
            { date: '2026-08-17', open: 100, high: 100, low: 100, close: 100, volume: 10 }, // Mon (Week 1)
            { date: '2026-08-23', open: 102, high: 102, low: 102, close: 102, volume: 20 }, // Sun (Week 1)
            { date: '2026-08-24', open: 105, high: 105, low: 105, close: 105, volume: 15 }, // Mon (Week 2) - should reset
        ];

        const resultWeek = calculateVWAP(data, 'Week');
        expect(resultWeek).toHaveLength(3);
        expect(resultWeek[0].value).toBe(100);
        expect(resultWeek[1].value).toBe(101.33); // accumulated
        expect(resultWeek[2].value).toBe(105); // reset!
    });

    it('resets on Month boundary', () => {
        const data = [
            { date: '2026-08-31', open: 100, high: 100, low: 100, close: 100, volume: 10 }, // Aug
            { date: '2026-09-01', open: 105, high: 105, low: 105, close: 105, volume: 15 }, // Sep - should reset
        ];

        const resultMonth = calculateVWAP(data, 'Month');
        expect(resultMonth).toHaveLength(2);
        expect(resultMonth[0].value).toBe(100);
        expect(resultMonth[1].value).toBe(105); // reset!
    });

    it('resets on Year boundary', () => {
        const data = [
            { date: '2025-12-31', open: 100, high: 100, low: 100, close: 100, volume: 10 }, // 2025
            { date: '2026-01-01', open: 105, high: 105, low: 105, close: 105, volume: 15 }, // 2026 - should reset
        ];

        const resultYear = calculateVWAP(data, 'Year');
        expect(resultYear).toHaveLength(2);
        expect(resultYear[0].value).toBe(100);
        expect(resultYear[1].value).toBe(105); // reset!
    });

    it('calculates 3 upper and lower standard deviation bands correctly', () => {
        // Day 1: close = 100, volume = 10, typical = 100.
        //   VWAP = 100, StDev = 0
        // Day 2: close = 110, volume = 10, typical = 110.
        //   VWAP = (100*10 + 110*10)/20 = 105
        //   Variance = (10*100^2 + 10*110^2)/20 - 105^2 = (100000 + 121000)/20 - 11025 = 11050 - 11025 = 25
        //   StDev = sqrt(25) = 5
        //   upper1 = 105 + 5 = 110, lower1 = 100
        //   upper2 = 105 + 10 = 115, lower2 = 95
        //   upper3 = 105 + 15 = 120, lower3 = 90
        const data = [
            { date: '2026-08-17', open: 100, high: 100, low: 100, close: 100, volume: 10 },
            { date: '2026-08-18', open: 110, high: 110, low: 110, close: 110, volume: 10 },
        ];

        const result = calculateVWAP(data, 'Week');
        expect(result).toHaveLength(2);
        
        // Day 1 checks
        expect(result[0].value).toBe(100);
        expect(result[0].upper1).toBe(100);
        expect(result[0].lower1).toBe(100);
        expect(result[0].upper2).toBe(100);
        expect(result[0].lower2).toBe(100);
        expect(result[0].upper3).toBe(100);
        expect(result[0].lower3).toBe(100);

        // Day 2 checks
        expect(result[1].value).toBe(105);
        expect(result[1].upper1).toBe(110);
        expect(result[1].lower1).toBe(100);
        expect(result[1].upper2).toBe(115);
        expect(result[1].lower2).toBe(95);
        expect(result[1].upper3).toBe(120);
        expect(result[1].lower3).toBe(90);
    });
});
