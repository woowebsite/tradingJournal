/* eslint-disable @typescript-eslint/no-explicit-any */
import { factories } from '@strapi/strapi';
import { fetchTcbs } from '../../../utils/tcbs-client';

export default factories.createCoreController('api::intraday-bsa.intraday-bsa' as any, ({ strapi }) => ({
  async sync(ctx) {
    const ticker = String(ctx.query.ticker || ctx.request.body?.ticker || '41I1G9000').trim().toUpperCase();
    const timeWindow = String(ctx.query.timeWindow || ctx.request.body?.timeWindow || '5');
    const tWindow = String(ctx.query.tWindow || ctx.request.body?.tWindow || '60m');
    const type = String(ctx.query.type || ctx.request.body?.type || 'all');
    const symbolHistoryId = ctx.query.symbolHistoryId || ctx.request.body?.symbolHistoryId;

    const token = process.env.TCBS_TOKEN || process.env.VITE_TCBS_TOKEN || ctx.get('x-tcbs-token');

    let tcbsData: any = null;
    try {
      tcbsData = await fetchTcbs(
        `/futures-insight/v1/intraday/${encodeURIComponent(ticker)}/bsa-ext`,
        { timeWindow, tWindow, type },
        token
      );
    } catch (error: any) {
      strapi.log.error(`[tcbs-bsa-ext] ${error?.message || error}`);
      return ctx.badRequest(`Failed to fetch TCBS BSA data: ${error?.message || error}`);
    }

    const dataList: any[] = Array.isArray(tcbsData)
      ? tcbsData
      : (Array.isArray(tcbsData?.data) ? tcbsData.data : []);

    const isFuturesCode = /^41I1G\d{4}$/i.test(ticker);
    const targetSymbolName = isFuturesCode ? 'VN30F1M' : ticker;

    let targetSymbolHistory: any = null;
    if (symbolHistoryId) {
      try {
        targetSymbolHistory = await (strapi as any).documents('api::symbol-history.symbol-history').findOne({
          documentId: String(symbolHistoryId),
        });
      } catch {
        targetSymbolHistory = await strapi.db.query('api::symbol-history.symbol-history').findOne({
          where: { id: symbolHistoryId },
        });
      }
    }

    if (!targetSymbolHistory && dataList.length > 0 && dataList[0]?.s) {
      try {
        const itemDate = new Date(Number(dataList[0].s) * 1000).toISOString().split('T')[0];

        // 1. Find existing symbol history for targetSymbolName on itemDate
        let historyRecords = await (strapi as any).documents('api::symbol-history.symbol-history').findMany({
          filters: {
            symbol: { Name: { $eq: targetSymbolName } },
            date: { $gte: `${itemDate}T00:00:00.000Z`, $lte: `${itemDate}T23:59:59.999Z` },
          },
        });

        if (historyRecords && historyRecords.length > 0) {
          targetSymbolHistory = historyRecords[0];
        } else {
          // 2. Find or create symbol record
          let symbol = await (strapi as any).documents('api::symbol.symbol').findFirst({
            filters: {
              Name: { $eq: targetSymbolName },
            },
          });

          if (!symbol) {
            symbol = await (strapi as any).documents('api::symbol.symbol').create({
              data: {
                Name: targetSymbolName,
                type: isFuturesCode ? 'derivative' : 'stock',
              },
              status: 'published',
            });
          }

          // 3. Create SymbolHistory for this date
          targetSymbolHistory = await (strapi as any).documents('api::symbol-history.symbol-history').create({
            data: {
              symbol: { connect: [symbol.documentId] },
              date: `${itemDate}T00:00:00.000Z`,
              open: 0,
              high: 0,
              low: 0,
              close: 0,
              volume: 0,
            },
            status: 'published',
          });
        }
      } catch (err) {
        strapi.log.error(`[intraday-bsa] Could not auto-resolve symbol-history: ${err}`);
      }
    }

    const historyDocId = targetSymbolHistory?.documentId;

    try {
      for (const item of dataList) {
        const sTimestamp = Number(item.s);
        if (!sTimestamp) continue;

        const existing = await strapi.db.query('api::intraday-bsa.intraday-bsa').findOne({
          where: {
            $or: [
              { ticker: targetSymbolName, s: sTimestamp, timeWindow },
              { ticker, s: sTimestamp, timeWindow },
            ],
          },
        });

        const payloadData: any = {
          ticker: targetSymbolName,
          bu: Number(item.bu) || 0,
          bms: Number(item.bms) || 0,
          bup: typeof item.bup === 'number' ? item.bup : Number(item.bup) || 0,
          sd: Number(item.sd) || 0,
          sms: Number(item.sms) || 0,
          sdp: typeof item.sdp === 'number' ? item.sdp : Number(item.sdp) || 0,
          bsr: typeof item.bsr === 'number' ? item.bsr : Number(item.bsr) || 0,
          t: String(item.t || ''),
          s: sTimestamp,
          timeWindow,
          tWindow,
        };

        if (existing) {
          const updatePayload: any = { ...payloadData };
          if (historyDocId) {
            updatePayload.symbol_history = { set: [historyDocId] };
          }
          await (strapi as any).documents('api::intraday-bsa.intraday-bsa').update({
            documentId: existing.documentId || existing.id,
            data: updatePayload,
          });
        } else {
          const createPayload: any = { ...payloadData };
          if (historyDocId) {
            createPayload.symbol_history = { connect: [historyDocId] };
          }
          await (strapi as any).documents('api::intraday-bsa.intraday-bsa').create({
            data: createPayload,
          });
        }
      }
    } catch (saveError: any) {
      strapi.log.error(`[intraday-bsa-save] Error saving intraday BSA records: ${saveError?.message || saveError}`);
    }

    ctx.body = {
      ticker: targetSymbolName,
      symbolHistory: targetSymbolHistory,
      data: dataList,
    };
  },
}));
