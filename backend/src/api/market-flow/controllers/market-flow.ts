/**
 * market-flow controller
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::market-flow.market-flow', ({ strapi }) => ({
  async bulkCreate(ctx) {
    const entries = ctx.request.body;
    if (!Array.isArray(entries)) {
      ctx.throw(400, 'Request body must be an array');
    }

    strapi.log.info(`Bulk creating ${entries.length} market flow entries...`);

    const results = [];
    for (const entry of entries) {
      try {
        // Create start and end of the day for comparison
        const dayStart = new Date(entry.date);
        dayStart.setHours(0, 0, 0, 0);

        const dayEnd = new Date(entry.date);
        dayEnd.setHours(23, 59, 59, 999);

        // Check if ticker already exists for this day using date range
        const existing = await strapi.documents('api::market-flow.market-flow').findFirst({
          filters: {
            ticker: entry.ticker,
            date: {
              $gte: dayStart.toISOString(),
              $lte: dayEnd.toISOString(),
            },
          },
        });

        if (!existing) {
          const created = await strapi.documents('api::market-flow.market-flow').create({
            data: entry,
            status: 'published',
          });
          results.push({ ticker: entry.ticker, status: 'created', id: created.id });
        } else {
          results.push({ ticker: entry.ticker, status: 'skipped', reason: 'already_exists' });
        }
      } catch (err) {
        strapi.log.error(`Error processing ticker ${entry.ticker}: ${err.message}`);
        results.push({ ticker: entry.ticker, status: 'error', error: err.message });
      }
    }

    ctx.body = {
      data: {
        total: entries.length,
        created: results.filter(r => r.status === 'created').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        errors: results.filter(r => r.status === 'error').length,
        results
      }
    };
  },
  // Return all market-flow items from the last 30 days (no page limit)
  async listLast30(ctx) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    strapi.log.info(`Fetching market-flow items since ${thirtyDaysAgo}`);

    const items = await strapi.db.query('api::market-flow.market-flow').findMany({
      where: { date: { $gte: thirtyDaysAgo } },
      orderBy: { date: 'desc' },
    });

    ctx.body = { data: items };
  },
}));