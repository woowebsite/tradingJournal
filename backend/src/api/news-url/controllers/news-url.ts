/**
 * news-url controller
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { factories } from '@strapi/strapi';

const NEWS_URL_UID = 'api::news-url.news-url' as any;

const normalizeUrlValue = (value: string) => value.trim().replace(/\s+/g, ' ');

export default factories.createCoreController(NEWS_URL_UID, ({ strapi }) => ({
  async bulkCreate(ctx) {
    const body = ctx.request.body || {};
    const type = body.type;
    const rawUrls = Array.isArray(body.urls) ? body.urls : [];

    if (!['source', 'ignore'].includes(type)) {
      ctx.throw(400, 'type must be source or ignore');
    }

    const urls = rawUrls
      .map((value: string) => normalizeUrlValue(String(value)))
      .filter(Boolean);

    if (!urls.length) {
      ctx.throw(400, 'Request body.urls must be a non-empty array');
    }

    const uniqueUrls = Array.from(new Set(urls));
    const results: Array<Record<string, any>> = [];

    for (const url of uniqueUrls) {
      const existing = await (strapi as any).documents(NEWS_URL_UID).findFirst({
        filters: {
          url,
          type,
        },
      });

      if (existing) {
        results.push({ url, type, status: 'skipped', reason: 'already_exists' });
        continue;
      }

      const saved = await (strapi as any).documents(NEWS_URL_UID).create({
        data: {
          url,
          type,
        },
        status: 'published',
      });

      results.push({ url, type, status: 'created', id: saved.id });
    }

    ctx.body = {
      data: {
        total: uniqueUrls.length,
        created: results.filter((item) => item.status === 'created').length,
        skipped: results.filter((item) => item.status === 'skipped').length,
        results,
      },
    };
  },

  async listAll(ctx) {
    const items = await strapi.db.query(NEWS_URL_UID).findMany({
      orderBy: [{ type: 'asc' }, { url: 'asc' }],
    });

    ctx.body = { data: items };
  },
}));
