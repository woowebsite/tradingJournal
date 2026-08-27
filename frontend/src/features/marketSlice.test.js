import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../services/api';
import { fetchHistories, loadExternalHistory } from './marketSlice';
import { getStockHistory } from '../services/24hmoney';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../services/binance', () => ({
  getCryptoHistory: vi.fn(),
}));

vi.mock('../services/24hmoney', () => ({
  getStockHistory: vi.fn(),
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

  it('queries with tf filter when timeframe is specified', async () => {
    api.get.mockResolvedValueOnce({
      data: { data: [{ id: 1, date: '2026-08-27T09:30:00.000Z', tf: 'M5' }], meta: { pagination: { page: 1, pageCount: 1 } } },
    });

    const dispatch = vi.fn();
    const getState = () => ({ market: {} });

    const action = await fetchHistories({ symbolId: 'symbol-1', tf: 'M5', forceRefresh: true })(dispatch, getState, undefined);

    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('filters[tf][$eq]=M5'));
    expect(action.payload).toHaveLength(1);
  });
});

describe('loadExternalHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves new history records with the specified tf', async () => {
    getStockHistory.mockResolvedValueOnce([
      { open: 10, high: 12, low: 9, close: 11, volume: 100, tradingDate: '2026-08-27T10:00:00.000Z' },
    ]);
    api.get.mockResolvedValueOnce({ data: { data: [] } }); // No previous history
    api.post.mockResolvedValueOnce({ data: { data: { id: 1 } } });

    const dispatch = vi.fn();
    const getState = () => ({ market: {} });

    await loadExternalHistory({
      symbol: 'SSI',
      symbolId: 'sym-123',
      tf: 'M5',
    })(dispatch, getState, undefined);

    expect(getStockHistory).toHaveBeenCalledWith('SSI', 'M5');
    expect(api.post).toHaveBeenCalledWith('/symbol-histories', {
      data: expect.objectContaining({
        symbol: 'sym-123',
        tf: 'M5',
        open: 10,
        close: 11,
      }),
    });
  });
});

