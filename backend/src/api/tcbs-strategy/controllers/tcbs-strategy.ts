/**
 * tcbs-strategy controller
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { factories } from '@strapi/strapi';
import axios from 'axios';

const DEFAULT_STRATEGY_KEY = 'price_volume_increase';
const DEFAULT_STRATEGY_NAME = 'Bùng nổ khối lượng';
const DEFAULT_TICKER = 'NNC';

function normalizeSignalRows(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.Data)) return payload.Data;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

export default factories.createCoreController('api::tcbs-strategy.tcbs-strategy' as any, ({ strapi }) => ({
  async syncSignal(ctx) {
    const strategyKey = String(ctx.query.strategyKey || DEFAULT_STRATEGY_KEY);
    const strategyName = String(ctx.query.strategyName || DEFAULT_STRATEGY_NAME);
    const ticker = String(ctx.query.ticker || DEFAULT_TICKER).toUpperCase();

    const documents = (strapi as any).documents;
    const strategyUid = 'api::tcbs-strategy.tcbs-strategy';
    const signalUid = 'api::tcbs-strategy-signal.tcbs-strategy-signal';

    let strategy = await documents(strategyUid).findFirst({
      filters: {
        strategyKey,
        ticker,
      },
    });

    if (!strategy) {
      strategy = await documents(strategyUid).create({
        data: {
          strategyKey,
          strategyName,
          ticker,
        },
      });
    }

    const tcbsToken = ctx.get('x-tcbs-token') || process.env.TCBS_TOKEN || process.env.VITE_TCBS_TOKEN;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    if (tcbsToken && /^[\x00-\x7F]+$/.test(tcbsToken)) {
      headers.Authorization = `Bearer ${tcbsToken}`;
    }

    const response = await axios.get('https://apiextaws.tcbs.com.vn/tcbs-asset-allocation/v1/backtestv2/recomm/strategy-signal', {
      params: {
        strategyKey,
        strategyName,
        ticker,
      },
      headers,
      timeout: 20000,
    });

    const rows = normalizeSignalRows(response.data);
    const signalRows = rows.filter(row => Number(row?.Sig) === 1);
    const staleRows = await documents(signalUid).findMany({
      filters: {
        strategyKey,
        ticker,
        Sig: {
          $ne: 1,
        },
      },
      pagination: {
        limit: -1,
      },
    });
    const results = [];

    for (const row of staleRows) {
      await documents(signalUid).delete({
        documentId: row.documentId,
      });
    }

    for (const row of signalRows) {
      if (!row?.TDate) continue;

      const existing = await documents(signalUid).findFirst({
        filters: {
          strategyKey,
          ticker,
          TDate: row.TDate,
        },
      });

      if (existing) {
        results.push({ ...existing, syncStatus: 'skipped' });
        continue;
      }

      const created = await documents(signalUid).create({
        data: {
          TDate: row.TDate,
          CPrice: row.CPrice,
          Volume: row.Volume,
          Sig: row.Sig,
          strategyKey,
          ticker,
          strategy: strategy.documentId || strategy.id,
        },
      });

      results.push({ ...created, syncStatus: 'created' });
    }

    ctx.body = {
      data: {
        strategy,
        totalFromTcbs: rows.length,
        totalSigOne: signalRows.length,
        staleRemoved: staleRows.length,
        created: results.filter(item => item.syncStatus === 'created').length,
        skipped: results.filter(item => item.syncStatus === 'skipped').length,
        signals: results,
      },
    };
  },

  async syncDetail(ctx) {
    const strategyKey = String(ctx.query.strategyKey || DEFAULT_STRATEGY_KEY);
    const strategyName = String(ctx.query.strategyName || DEFAULT_STRATEGY_NAME);
    const ticker = String(ctx.query.ticker || DEFAULT_TICKER).toUpperCase();

    const documents = (strapi as any).documents;
    const detailUid = 'api::tcbs-strategy-detail.tcbs-strategy-detail';

    const tcbsToken = ctx.get('x-tcbs-token') || process.env.TCBS_TOKEN || process.env.VITE_TCBS_TOKEN;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    if (tcbsToken && /^[\x00-\x7F]+$/.test(tcbsToken)) {
      headers.Authorization = `Bearer ${tcbsToken}`;
    }

    const response = await axios.get('https://apiextaws.tcbs.com.vn/tcbs-asset-allocation/v1/backtestv2/recomm/strategy-detail', {
      params: {
        strategyKey,
        strategyName,
        ticker,
      },
      headers,
      timeout: 20000,
    });

    const body = response.data || {};

    let existing = await documents(detailUid).findFirst({
      filters: {
        strategyKey,
        ticker,
      },
    });

    const dataToSave = {
      ticker,
      strategyKey,
      strategyName,
      volaStatistic: body.VolaStatistic || null,
      probStatistic: body.ProbStatistic || null,
      volaByPeriod: body.VolaByPeriod || null,
      probByPeriod: body.ProbByPeriod || null,
      volaPeriodDetail: body.VolaPeriodDetail || [],
      probPeriodDetail: body.ProbPeriodDetail || [],
    };

    let result;
    if (existing) {
      result = await documents(detailUid).update({
        documentId: existing.documentId,
        data: dataToSave,
      });
    } else {
      result = await documents(detailUid).create({
        data: dataToSave,
      });
    }

    ctx.body = {
      data: result,
    };
  },

  async getDetail(ctx) {
    const strategyKey = String(ctx.query.strategyKey || DEFAULT_STRATEGY_KEY);
    const ticker = String(ctx.query.ticker || DEFAULT_TICKER).toUpperCase();

    const documents = (strapi as any).documents;
    const detailUid = 'api::tcbs-strategy-detail.tcbs-strategy-detail';

    const existing = await documents(detailUid).findFirst({
      filters: {
        strategyKey,
        ticker,
      },
    });

    ctx.body = {
      data: existing || null,
    };
  }
}));
