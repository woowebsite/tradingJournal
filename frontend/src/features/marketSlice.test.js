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

  it('requests a larger page size so the chart can load more candles', async () => {
    api.get.mockResolvedValue({ data: { data: [] } });

    const dispatch = vi.fn();
    const getState = () => ({ market: {} });

    await fetchHistories('symbol-1')(dispatch, getState, undefined);

    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('pagination[pageSize]=1000'));
  });
});
