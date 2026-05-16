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
    const results = await (strapi.db.query('api::market-flow.market-flow') as any).createMany({
      data: entries,
    });
    ctx.body = { data: results };
  },
}));