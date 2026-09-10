/**
 * symbol-history controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::symbol-history.symbol-history', ({ strapi }) => ({
  /**
   * Fast SQL-based Symbol History Bulk Deletion
   * Deletes all candles for a given symbol in 1 single fast query instead of thousands of HTTP requests
   */
  async clearHistory(ctx) {
    try {
      const body = ctx.request.body || {};
      const query = ctx.query || {};
      const rawSymbol =
        body.symbolId ||
        body.symbol ||
        body.symbolName ||
        body.ticker ||
        query.symbolId ||
        query.symbol ||
        query.symbolName ||
        query.ticker;
      const timeframe = body.timeframe || query.timeframe;

      if (!rawSymbol) {
        return ctx.badRequest('symbolId or symbol is required in request body or query params');
      }

      const rawSymbolStr = String(rawSymbol).trim();
      const isNumeric = !isNaN(Number(rawSymbolStr)) && Number.isInteger(Number(rawSymbolStr));

      // 1. Tìm Symbol trong database
      const symbol = await strapi.db.query('api::symbol.symbol').findOne({
        where: {
          $or: [
            { documentId: rawSymbolStr },
            ...(isNumeric ? [{ id: Number(rawSymbolStr) }] : []),
            { Name: rawSymbolStr.toUpperCase() },
          ],
        },
      });

      if (!symbol) {
        return ctx.send({
          data: {
            success: true,
            count: 0,
            message: `Symbol '${rawSymbolStr}' not found in database.`,
          },
        });
      }

      const knex = strapi.db.connection;
      let totalDeleted = 0;

      // 2. Tìm danh sách history IDs liên quan đến Symbol
      const hasLnkTable = await knex.schema.hasTable('symbol_histories_symbol_lnk');
      const hasDirectCol = await knex.schema.hasColumn('symbol_histories', 'symbol_id');

      let historyIds: number[] = [];

      if (hasLnkTable) {
        const rows = await knex('symbol_histories_symbol_lnk')
          .where('symbol_id', symbol.id)
          .select('symbol_history_id');
        historyIds = rows.map((r: any) => r.symbol_history_id).filter(Boolean);
      } else if (hasDirectCol) {
        const rows = await knex('symbol_histories')
          .where('symbol_id', symbol.id)
          .select('id');
        historyIds = rows.map((r: any) => r.id).filter(Boolean);
      }

      // 3. Thực hiện SQL Delete
      if (historyIds.length > 0) {
        if (timeframe) {
          const tfRows = await knex('symbol_histories')
            .whereIn('id', historyIds)
            .andWhere('timeframe', String(timeframe).trim().toUpperCase())
            .select('id');
          historyIds = tfRows.map((r: any) => r.id);
        }

        if (historyIds.length > 0) {
          // Xóa quan hệ link phụ nếu có
          if (await knex.schema.hasTable('intraday_bsas_symbol_history_lnk')) {
            await knex('intraday_bsas_symbol_history_lnk')
              .whereIn('symbol_history_id', historyIds)
              .delete();
          }
          if (await knex.schema.hasTable('intraday_bid_asks_symbol_history_lnk')) {
            await knex('intraday_bid_asks_symbol_history_lnk')
              .whereIn('symbol_history_id', historyIds)
              .delete();
          }

          if (hasLnkTable) {
            await knex('symbol_histories_symbol_lnk')
              .whereIn('symbol_history_id', historyIds)
              .delete();
          }

          // Xóa các bản ghi nến lịch sử trong bảng chính
          totalDeleted = await knex('symbol_histories')
            .whereIn('id', historyIds)
            .delete();
        }
      } else {
        // Fallback dùng strapi query engine deleteMany
        const whereClause: any = {
          symbol: symbol.id,
        };
        if (timeframe) {
          whereClause.timeframe = String(timeframe).trim().toUpperCase();
        }
        const res = await strapi.db.query('api::symbol-history.symbol-history').deleteMany({
          where: whereClause,
        });
        totalDeleted = res?.count ?? 0;
      }

      strapi.log.info(`[clearHistory] Successfully deleted ${totalDeleted} candles for symbol '${symbol.Name}' (TF: ${timeframe || 'ALL'}) in a single SQL operation.`);

      return ctx.send({
        data: {
          success: true,
          count: totalDeleted,
          symbol: symbol.Name,
          timeframe: timeframe || 'ALL',
        },
      });
    } catch (error: any) {
      strapi.log.error('Clear symbol history error:', error);
      return ctx.badRequest(`Clear symbol history failed: ${error.message || String(error)}`);
    }
  },
}));
