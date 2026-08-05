/**
 * tcbs-recommen controller
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { factories } from '@strapi/strapi';
import { fetchTcbs } from '../../../utils/tcbs-client';

function normalizeRecommendationRows(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.response?.data)) return payload.response.data;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

export default factories.createCoreController('api::tcbs-recommen.tcbs-recommen' as any, ({ strapi }) => ({
  async sync(ctx) {
    const documents = (strapi as any).documents;
    const uid = 'api::tcbs-recommen.tcbs-recommen';
    const tcbsToken = process.env.TCBS_TOKEN || ctx.get('x-tcbs-token') || process.env.VITE_TCBS_TOKEN;
    const response = await fetchTcbs(
      '/tcanalysis/v1/recommend/his',
      {
        fData: '1',
        fType: 'market',
        page: '0',
        size: '100',
        fRecommend: '0',
        fTime: 'A',
      },
      tcbsToken
    );

    const rows = normalizeRecommendationRows(response);
    const results = [];

    for (const row of rows) {
      const ticker = String(row?.ticker || '').trim().toUpperCase();
      const d = row?.d;

      if (!ticker || !d) continue;

      const dataToSave = {
        d,
        ticker,
        type: row?.type ?? null,
        value: row?.value ?? null,
        reason: row?.reason || '',
        listHisBuy: row?.listHisBuy || [],
      };

      const filters: Record<string, any> = { d, ticker };
      if (row?.type !== undefined && row?.type !== null) {
        filters.type = row.type;
      }

      const existing = await documents(uid).findFirst({ filters });

      if (existing) {
        const updated = await documents(uid).update({
          documentId: existing.documentId,
          data: dataToSave,
        });
        results.push({ ...updated, syncStatus: 'updated' });
      } else {
        const created = await documents(uid).create({
          data: dataToSave,
        });
        results.push({ ...created, syncStatus: 'created' });
      }
    }

    ctx.body = {
      data: {
        totalFromTcbs: rows.length,
        created: results.filter(item => item.syncStatus === 'created').length,
        updated: results.filter(item => item.syncStatus === 'updated').length,
        recommendations: results,
      },
    };
  },
}));
