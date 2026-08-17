/**
 * tcbs-strategy controller
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { factories } from '@strapi/strapi';
import { fetchTcbs } from '../../../utils/tcbs-client';

const DEFAULT_STRATEGY_KEY = 'price_volume_increase';
const DEFAULT_STRATEGY_NAME = 'Bùng nổ khối lượng';
const DEFAULT_TICKER = 'NNC';

const TCBS_ENDPOINTS: Record<string, string> = {
  'stock-history': '/stock-insight/v2/stock/bars-long-term',
  'futures-history': '/futures-insight/v2/stock/bars',
  'intraday-snapshots': '/stock-insight/v1/stock/intraday-snapshots',
  'market-flow-leader': '/stock-insight/v1/intraday/flow-market-leader',
  'technical-indicators': '/ta/v1/summary/gaugechart/:ticker',
  'ticker-overview': '/tcanalysis/v1/ticker/:ticker/overview',
  'stock-ratio': '/tcanalysis/v1/ticker/:ticker/stockratio',
  'futures-intraday-history': '/futures-insight/v1/intraday/:ticker/his/paging',
  'futures-investor': '/futures-insight/v1/intraday/:ticker/investor',
  'stock-investor': '/stock-insight/v1/intraday/:ticker/investor',
  'backtest-conclusion': '/tcbs-hfc-data/v2/digital/backtest-conclusion',
};

function normalizeSignalRows(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.Data)) return payload.Data;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

function normalizeInvestorDate(value: unknown): string | null {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  const [, day, month, year] = match;
  const fullYear = year.length === 2 ? `20${year}` : year;
  const date = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

export default factories.createCoreController('api::tcbs-strategy.tcbs-strategy' as any, ({ strapi }) => ({
  async tcbsData(ctx) {
    const resource = String(ctx.params.resource || '');
    const template = resource === 'futures-history' && String(ctx.query.resolution || '').toUpperCase() === 'D'
      ? '/futures-insight/v2/stock/bars-long-term'
      : TCBS_ENDPOINTS[resource];
    if (!template) return ctx.badRequest('Unsupported TCBS resource');

    const ticker = String(ctx.query.ticker || '').trim().toUpperCase();
    if (template.includes(':ticker') && !/^[A-Z0-9]{1,20}$/.test(ticker)) {
      return ctx.badRequest('A valid ticker is required');
    }

    const allowedParams: Record<string, string[]> = {
      'stock-history': ['ticker', 'type', 'resolution', 'to', 'countBack'],
      'futures-history': ['ticker', 'type', 'resolution', 'to', 'countBack'],
      'intraday-snapshots': ['tickers'],
      'market-flow-leader': ['exchange', 'industry', 'type'],
      'technical-indicators': ['period'],
      'ticker-overview': [],
      'stock-ratio': [],
      'futures-intraday-history': [],
      'futures-investor': ['wsize'],
      'stock-investor': ['wsize'],
      'backtest-conclusion': ['ticker'],
    };
    const params = Object.fromEntries(allowedParams[resource]
      .filter(key => ctx.query[key] !== undefined)
      .map(key => [key, String(ctx.query[key])]));
    const token = process.env.TCBS_TOKEN || process.env.VITE_TCBS_TOKEN || ctx.get('x-tcbs-token');

    try {
      ctx.body = await fetchTcbs(
        template.replace(':ticker', encodeURIComponent(ticker)),
        params,
        token
      );
    } catch (error: any) {
      strapi.log.error(`[tcbs-client] ${error?.message || error}`);
      ctx.status = 502;
      ctx.body = { error: { status: 502, message: error?.message || 'TCBS request failed' } };
    }
  },

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

    const tcbsToken = process.env.TCBS_TOKEN || process.env.VITE_TCBS_TOKEN || ctx.get('x-tcbs-token');
    const response = await fetchTcbs(
      '/tcbs-asset-allocation/v1/backtestv2/recomm/strategy-signal',
      {
        strategyKey,
        strategyName,
        ticker,
      },
      tcbsToken
    );

    const rows = normalizeSignalRows(response);
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

    const tcbsToken = process.env.TCBS_TOKEN || process.env.VITE_TCBS_TOKEN || ctx.get('x-tcbs-token');
    const response = await fetchTcbs(
      '/tcbs-asset-allocation/v1/backtestv2/recomm/strategy-detail',
      {
        strategyKey,
        strategyName,
        ticker,
      },
      tcbsToken
    );

    const body = response || {};

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

  async syncInvestor(ctx) {
    const ticker = String(ctx.query.ticker || '').trim().toUpperCase();
    const wsize = String(ctx.query.wsize || '1M');
    if (!/^[A-Z0-9]{1,20}$/.test(ticker)) return ctx.badRequest('A valid ticker is required');

    const documents = (strapi as any).documents;
    let symbol = await documents('api::symbol.symbol').findFirst({
      filters: { $or: [{ ticker }, { Name: ticker }] },
    });
    if (!symbol) {
      symbol = await documents('api::symbol.symbol').create({
        data: { Name: ticker, ticker },
      });
      if (!symbol.publishedAt) {
        try {
          await documents('api::symbol.symbol').publish({ documentId: symbol.documentId });
        } catch (error: any) {
          if (!String(error?.message || '').includes('already exists')) throw error;
        }
      }
    }
    const symbolDocumentFilter = symbol.documentId
      ? { documentId: symbol.documentId }
      : { id: symbol.id };

    const token = process.env.TCBS_TOKEN || process.env.VITE_TCBS_TOKEN || ctx.get('x-tcbs-token');
    const investorPath = /^[A-Z]+$/.test(ticker)
      ? `/stock-insight/v1/intraday/${encodeURIComponent(ticker)}/investor`
      : `/futures-insight/v1/intraday/${encodeURIComponent(ticker)}/investor`;
    const response = await fetchTcbs(
      investorPath,
      { wsize },
      token
    );
    const rows = normalizeSignalRows(response);
    const groups = [
      { investorType: 'CM', buy: 'shb', sell: 'shs', buyPercent: 'shbp', sellPercent: 'shsp' },
      { investorType: 'SG', buy: 'wob', sell: 'wos', buyPercent: 'wobp', sellPercent: 'wosp' },
      { investorType: 'CN', buy: 'skb', sell: 'sks', buyPercent: 'skbp', sellPercent: 'sksp' },
    ];
    const saved = [];
    for (const row of rows) {
      if (!row?.t) continue;
      const date = normalizeInvestorDate(row.t);
      if (!date) continue;
      for (const group of groups) {
        const data = {
          investorType: group.investorType,
          date,
          sourceDate: String(row.t),
          buyVolume: row[group.buy] ?? null,
          sellVolume: row[group.sell] ?? null,
          buyPercent: row[group.buyPercent] ?? null,
          sellPercent: row[group.sellPercent] ?? null,
          netBuy: row[group.buy] != null && row[group.sell] != null
            ? Number(row[group.buy]) - Number(row[group.sell])
            : null,
          marketNetBuy: row.nsb ?? null,
          netWeight: row.nwb ?? null,
          netShort: row.nskb ?? null,
          netBuyAmount: row.nba ?? null,
          symbol: symbol.documentId || symbol.id,
        };
        const existing = await documents('api::investor.investor').findFirst({
          filters: { symbol: symbolDocumentFilter, date, investorType: group.investorType },
        });
        const result = existing
          ? await documents('api::investor.investor').update({ documentId: existing.documentId, data })
          : await documents('api::investor.investor').create({ data });
        // A second sync can find the already-published version of a document.
        // Publishing it again makes Strapi try to create a second published
        // entry with the same documentId, so only publish draft results.
        if (!result.publishedAt) {
          try {
            await documents('api::investor.investor').publish({ documentId: result.documentId });
          } catch (error: any) {
            // Strapi can still return this race-condition error when the
            // published version was created between update and publish.
            if (!String(error?.message || '').includes('already exists')) throw error;
          }
        }
        saved.push(result);
      }
    }
    ctx.body = { data: { ticker, wsize, totalFromTcbs: rows.length, saved: saved.length, investors: saved } };
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
