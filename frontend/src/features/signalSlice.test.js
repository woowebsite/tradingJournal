import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../services/api';
import { fetchHistoryForSignalScan } from './signalSlice';

vi.mock('../services/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

describe('fetchHistoryForSignalScan', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads all Strapi pages needed for indicator warm-up', async () => {
        const newestPage = Array.from({ length: 100 }, (_, index) => ({
            id: index,
            date: `2026-01-${String(31 - (index % 30)).padStart(2, '0')}T00:00:00.000Z`,
        }));
        const olderPage = [{ id: 101, date: '2025-12-01T00:00:00.000Z' }];

        api.get
            .mockResolvedValueOnce({
                data: { data: newestPage, meta: { pagination: { page: 1, pageCount: 2 } } },
            })
            .mockResolvedValueOnce({
                data: { data: olderPage, meta: { pagination: { page: 2, pageCount: 2 } } },
            });

        const result = await fetchHistoryForSignalScan('symbol/1');

        expect(api.get).toHaveBeenCalledTimes(2);
        expect(api.get).toHaveBeenNthCalledWith(1, expect.stringContaining('pagination[page]=1&pagination[pageSize]=100'));
        expect(api.get).toHaveBeenNthCalledWith(2, expect.stringContaining('pagination[page]=2&pagination[pageSize]=100'));
        expect(api.get).toHaveBeenCalledWith(expect.stringContaining('symbol%2F1'));
        expect(result).toHaveLength(101);
        expect(new Date(result[0].date).getTime()).toBeGreaterThanOrEqual(new Date(result.at(-1).date).getTime());
    });
});
