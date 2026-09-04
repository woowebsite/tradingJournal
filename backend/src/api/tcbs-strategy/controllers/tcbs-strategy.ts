/**
 * tcbs-strategy controller
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
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
  'futures-bsa-ext': '/futures-insight/v1/intraday/:ticker/bsa-ext',
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
  const isoDate = raw.match(/^(\d{4}-\d{2}-\d{2})(?:[ T].*)?$/)?.[1];
  if (isoDate) return isoDate;

  // TCBS appends the latest intraday update time to today's row, for example
  // "17/08/26 14:30". Historical rows contain only the date.
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (!match) return null;
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
      'futures-bsa-ext': ['timeWindow', 'tWindow', 'type'],
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
      { investorType: 'CN', buy: 'shb', sell: 'shs', buyPercent: 'shbp', sellPercent: 'shsp' },
      { investorType: 'SG', buy: 'wob', sell: 'wos', buyPercent: 'wobp', sellPercent: 'wosp' },
      { investorType: 'CM', buy: 'skb', sell: 'sks', buyPercent: 'skbp', sellPercent: 'sksp' },
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
  },

  async updateToken(ctx) {
    try {
      let rawData = ctx.request.body;
      if (typeof rawData === 'string') {
        try {
          rawData = JSON.parse(rawData);
        } catch {
          // Plain token string
        }
      }

      let authToken = '';
      let cookieObject: any = {};

      if (typeof rawData === 'string') {
        authToken = rawData.trim();
        cookieObject = { authToken };
      } else if (rawData && typeof rawData === 'object') {
        authToken = rawData.authToken || rawData.token || rawData.accessToken || rawData.jwt ||
                    rawData.userInfo?.authToken || rawData.user?.authToken || rawData.data?.authToken;
        cookieObject = { ...rawData };
        if (!cookieObject.authToken && authToken) {
          cookieObject.authToken = authToken;
        }
      }

      if (!authToken) {
        ctx.status = 400;
        ctx.body = { error: { message: "Không tìm thấy authToken trong dữ liệu gửi lên" } };
        return;
      }

      const backendRoot = process.cwd();
      const frontendRoot = path.resolve(backendRoot, '../frontend');
      const cookiePath = path.join(frontendRoot, 'tcbs-cookie.json');

      // 1. Write/Update tcbs-cookie.json
      try {
        fs.writeFileSync(cookiePath, JSON.stringify(cookieObject, null, 2), 'utf8');
      } catch (err: any) {
        strapi.log.warn(`Could not write tcbs-cookie.json: ${err.message}`);
      }

      // 2. Update frontend .env files
      if (fs.existsSync(frontendRoot)) {
        try {
          const files = fs.readdirSync(frontendRoot);
          const envFiles = files.filter(file => file === '.env' || (file.startsWith('.env.') && !file.endsWith('.example')));
          
          if (envFiles.length === 0) {
            const defaultEnvPath = path.join(frontendRoot, '.env');
            fs.writeFileSync(defaultEnvPath, `VITE_TCBS_TOKEN=${authToken}\n`, 'utf8');
          } else {
            for (const file of envFiles) {
              const filePath = path.join(frontendRoot, file);
              let envContent = fs.readFileSync(filePath, 'utf8');
              const tokenRegex = /^VITE_TCBS_TOKEN=.*$/m;
              if (tokenRegex.test(envContent)) {
                envContent = envContent.replace(tokenRegex, `VITE_TCBS_TOKEN=${authToken}`);
              } else {
                envContent = envContent.trim() + `\nVITE_TCBS_TOKEN=${authToken}\n`;
              }
              fs.writeFileSync(filePath, envContent, 'utf8');
            }
          }
        } catch (err: any) {
          strapi.log.warn(`Could not update frontend .env: ${err.message}`);
        }
      }

      // 3. Update backend/.env
      const backendEnvPath = path.join(backendRoot, '.env');
      if (fs.existsSync(backendEnvPath)) {
        try {
          let backendEnvContent = fs.readFileSync(backendEnvPath, 'utf8');
          const backendTokenRegex = /^TCBS_TOKEN=.*$/m;
          if (backendTokenRegex.test(backendEnvContent)) {
            backendEnvContent = backendEnvContent.replace(backendTokenRegex, `TCBS_TOKEN=${authToken}`);
          } else {
            backendEnvContent = backendEnvContent.trim() + `\nTCBS_TOKEN=${authToken}\n`;
          }
          fs.writeFileSync(backendEnvPath, backendEnvContent, 'utf8');
        } catch (err: any) {
          strapi.log.warn(`Could not update backend .env: ${err.message}`);
        }
      }

      // 4. Update runtime environment variables in Node.js process
      process.env.TCBS_TOKEN = authToken;
      process.env.VITE_TCBS_TOKEN = authToken;

      strapi.log.info(`[tcbs-strategy] TCBS Token updated successfully`);

      ctx.body = {
        success: true,
        message: 'Đã đồng bộ Token TCBS thành công!',
        authTokenPrefix: authToken.substring(0, 15) + '...',
        fullName: cookieObject.fullName || undefined,
        custodyId: cookieObject.custodyId || undefined,
      };
    } catch (error: any) {
      strapi.log.error(`[tcbs-strategy] Error updating token: ${error.message}`);
      ctx.status = 500;
      ctx.body = { error: { message: error.message } };
    }
  }
}));

