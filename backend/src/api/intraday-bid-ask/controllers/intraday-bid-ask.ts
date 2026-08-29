/* eslint-disable @typescript-eslint/no-explicit-any */
import { factories } from '@strapi/strapi';
import { fetchTcbs } from '../../../utils/tcbs-client';

export default factories.createCoreController('api::intraday-bid-ask.intraday-bid-ask' as any, ({ strapi }) => ({
  async sync(ctx) {
    const ticker = String(ctx.query.ticker || ctx.request.body?.ticker || '41I1G9000').trim().toUpperCase();
    const mode = String(ctx.query.mode || ctx.request.body?.mode || 'baAll');
    const symbolHistoryId = ctx.query.symbolHistoryId || ctx.request.body?.symbolHistoryId;

    const token = process.env.TCBS_TOKEN || process.env.VITE_TCBS_TOKEN || ctx.get('x-tcbs-token');

    let tcbsData: any = null;
    try {
      tcbsData = await fetchTcbs(
        `/futures-insight/v1/intraday/${encodeURIComponent(ticker)}/bid-ask`,
        { mode },
        token
      );
    } catch (error: any) {
      strapi.log.error(`[tcbs-bid-ask] ${error?.message || error}`);
      return ctx.badRequest(`Failed to fetch TCBS Bid-Ask data: ${error?.message || error}`);
    }

    const rawData = tcbsData?.data && !Array.isArray(tcbsData.data) ? tcbsData.data : tcbsData;
    const overBidAskLog = Array.isArray(rawData?.overBidAskLog)
      ? rawData.overBidAskLog
      : (Array.isArray(rawData) ? rawData : (Array.isArray(rawData?.data) ? rawData.data : []));

    const avgOBPercent = Array.isArray(rawData?.avgOBPercent) ? rawData.avgOBPercent : [];

    const avgMap = new Map();
    avgOBPercent.forEach((item: any) => {
      if (item?.t) avgMap.set(String(item.t), item);
    });

    const timeSet = new Set<string>();
    overBidAskLog.forEach((i: any) => i?.t && timeSet.add(String(i.t)));
    avgOBPercent.forEach((i: any) => i?.t && timeSet.add(String(i.t)));

    const now = new Date();
    const todayYMD = now.toISOString().split('T')[0];

    const dataList: any[] = [];
    timeSet.forEach((tStr) => {
      const obItem = overBidAskLog.find((i: any) => String(i.t) === tStr) || {};
      const avgItem = avgMap.get(tStr) || {};

      const bs = Number(obItem.bs) || 0; // Khối lượng Dư mua
      const oa = Number(obItem.oa) || 0; // Khối lượng Dư bán
      const totalVol = bs + oa;

      // obp: Tỷ lệ Dư mua hôm nay
      const obp = typeof obItem.obp === 'number'
        ? obItem.obp
        : (totalVol > 0 ? bs / totalVol : 0.5);

      // osp: Tỷ lệ Dư bán hôm nay
      const osp = typeof obItem.osp === 'number'
        ? obItem.osp
        : (totalVol > 0 ? oa / totalVol : 1 - obp);

      // aobp: Trung bình 5 ngày Dư mua
      const aobp = typeof avgItem.aobp === 'number' ? avgItem.aobp : (typeof obItem.aobp === 'number' ? obItem.aobp : 0.5);

      // sp: Spread giữa giá mua và bán
      const sp = typeof obItem.sp === 'number' ? obItem.sp : 0;

      // avsp: Trung bình spread
      const avsp = typeof avgItem.avsp === 'number' ? avgItem.avsp : (typeof obItem.avsp === 'number' ? obItem.avsp : 0);

      const [hours, minutes] = tStr.split(':').map(Number);
      const pointDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours || 0, minutes || 0, 0);
      const sTimestamp = Number(obItem.s || avgItem.s) || Math.floor(pointDate.getTime() / 1000);

      dataList.push({
        t: tStr,
        s: sTimestamp,
        bs,
        oa,
        bv: bs,
        av: oa,
        obp,
        osp,
        aobp,
        sp,
        avsp,
        raw: { ...obItem, ...avgItem },
      });
    });

    // Sort ascending by time / timestamp
    dataList.sort((a, b) => (Number(a.s) || 0) - (Number(b.s) || 0));

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

    if (!targetSymbolHistory) {
      try {
        const itemDate = todayYMD;

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
        strapi.log.error(`[intraday-bid-ask] Could not auto-resolve symbol-history: ${err}`);
      }
    }

    const historyDocId = targetSymbolHistory?.documentId;

    try {
      for (const item of dataList) {
        const sTimestamp = Number(item.s);
        const tStr = String(item.t || '');
        if (!tStr && !sTimestamp) continue;

        const existing = await strapi.db.query('api::intraday-bid-ask.intraday-bid-ask').findOne({
          where: {
            $or: [
              { ticker: targetSymbolName, t: tStr, mode },
              { ticker, t: tStr, mode },
            ],
          },
        });

        const payloadData: any = {
          ticker: targetSymbolName,
          s: sTimestamp,
          t: tStr,
          mode,
          bs: item.bs,
          oa: item.oa,
          bv: item.bv,
          av: item.av,
          obp: item.obp,
          osp: item.osp,
          aobp: item.aobp,
          sp: item.sp,
          avsp: item.avsp,
          raw: item.raw,
        };

        if (existing) {
          const updatePayload: any = { ...payloadData };
          if (historyDocId) {
            updatePayload.symbol_history = { set: [historyDocId] };
          }
          await (strapi as any).documents('api::intraday-bid-ask.intraday-bid-ask').update({
            documentId: existing.documentId || existing.id,
            data: updatePayload,
          });
        } else {
          const createPayload: any = { ...payloadData };
          if (historyDocId) {
            createPayload.symbol_history = { connect: [historyDocId] };
          }
          await (strapi as any).documents('api::intraday-bid-ask.intraday-bid-ask').create({
            data: createPayload,
          });
        }
      }
    } catch (saveError: any) {
      strapi.log.error(`[intraday-bid-ask-save] Error saving intraday Bid-Ask records: ${saveError?.message || saveError}`);
    }

    ctx.body = {
      ticker: targetSymbolName,
      symbolHistory: targetSymbolHistory,
      avgOBPercent,
      overBidAskLog,
      data: dataList,
    };
  },
}));
