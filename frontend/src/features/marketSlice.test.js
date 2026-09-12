import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../services/api';
import { fetchHistories } from './marketSlice';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../services/binance', () => ({
  getCryptoHistory: vi.fn(),
}));

vi.mock('../services/tcbs', () => ({
  getStockHistory: vi.fn(),
  getFuturesHistory: vi.fn(),
  getIntradaySnapshots: vi.fn(),
  getTechnicalIndicators: vi.fn(),
  updateMarketInfo: vi.fn(),
}));

describe('fetchHistories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads multiple backend pages so chart indicators use enough candles', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: index,
      date: `2026-01-${String(31 - (index % 30)).padStart(2, '0')}T00:00:00.000Z`,
    }));
    api.get
      .mockResolvedValueOnce({
        data: { data: firstPage, meta: { pagination: { page: 1, pageCount: 2 } } },
      })
      .mockResolvedValueOnce({
        data: { data: [{ id: 101, date: '2025-12-01T00:00:00.000Z' }], meta: { pagination: { page: 2, pageCount: 2 } } },
      });

    const dispatch = vi.fn();
    const getState = () => ({ market: {} });

    const action = await fetchHistories('symbol-1')(dispatch, getState, undefined);

    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get).toHaveBeenNthCalledWith(1, expect.stringContaining('pagination[page]=1&pagination[pageSize]=100'));
    expect(api.get).toHaveBeenNthCalledWith(2, expect.stringContaining('pagination[page]=2&pagination[pageSize]=100'));
    expect(action.payload).toHaveLength(101);
  });
});
