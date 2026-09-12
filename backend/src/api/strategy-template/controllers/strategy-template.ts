/**
 * strategy-template controller
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { factories } from '@strapi/strapi';

async function resolveSymbolDocumentId(strapi: any, symbolInput: any): Promise<string | null> {
  if (!symbolInput) return null;
  if (typeof symbolInput === 'string' && !/^\d+$/.test(symbolInput)) {
    return symbolInput;
  }
  const numericId = parseInt(String(symbolInput));
  if (!isNaN(numericId)) {
    const sym = await strapi.db.query('api::symbol.symbol').findOne({
      where: { id: numericId },
      select: ['id', 'documentId']
    });
    return sym?.documentId || null;
  }
  return null;
}

async function resolveAccountDocumentId(strapi: any, accountInput: any): Promise<string | null> {
  if (!accountInput) return null;
  if (typeof accountInput === 'string' && !/^\d+$/.test(accountInput)) {
    return accountInput;
  }
  const numericId = parseInt(String(accountInput));
  if (!isNaN(numericId)) {
    const acc = await strapi.db.query('api::account.account').findOne({
      where: { id: numericId },
      select: ['id', 'documentId']
    });
    return acc?.documentId || null;
  }
  return null;
}

export default factories.createCoreController('api::strategy-template.strategy-template', ({ strapi }) => ({
  async findOne(ctx) {
    const { id } = ctx.params;
    let targetDocId = id;

    if (/^\d+$/.test(id)) {
      const entry = await strapi.db.query('api::strategy-template.strategy-template').findOne({
        where: { id: parseInt(id) },
      });
      if (!entry) return ctx.notFound('Strategy template not found');
      targetDocId = entry.documentId;
    }

    const doc = await strapi.documents('api::strategy-template.strategy-template').findOne({
      documentId: targetDocId,
      populate: '*',
    });

    if (!doc) return ctx.notFound('Strategy template not found');
    ctx.body = { data: doc };
  },

  async create(ctx) {
    const bodyData = { ...(ctx.request.body?.data || ctx.request.body || {}) };

    if (bodyData.symbol) {
      const symDocId = await resolveSymbolDocumentId(strapi, bodyData.symbol);
      if (symDocId) bodyData.symbol = symDocId;
    }
    if (bodyData.account) {
      const accDocId = await resolveAccountDocumentId(strapi, bodyData.account);
      if (accDocId) bodyData.account = accDocId;
    }

    const created = await strapi.documents('api::strategy-template.strategy-template').create({
      data: bodyData,
      populate: '*',
    });

    ctx.body = { data: created };
  },

  async update(ctx) {
    const { id } = ctx.params;
    let targetDocId = id;

    if (/^\d+$/.test(id)) {
      const entry = await strapi.db.query('api::strategy-template.strategy-template').findOne({
        where: { id: parseInt(id) },
      });
      if (!entry) return ctx.notFound('Strategy template not found');
      targetDocId = entry.documentId;
    }

    const bodyData = { ...(ctx.request.body?.data || ctx.request.body || {}) };

    if (bodyData.symbol) {
      const symDocId = await resolveSymbolDocumentId(strapi, bodyData.symbol);
      if (symDocId) bodyData.symbol = symDocId;
    }
    if (bodyData.account) {
      const accDocId = await resolveAccountDocumentId(strapi, bodyData.account);
      if (accDocId) bodyData.account = accDocId;
    }

    const updated = await strapi.documents('api::strategy-template.strategy-template').update({
      documentId: targetDocId,
      data: bodyData,
      populate: '*',
    });

    ctx.body = { data: updated };
  },

  async delete(ctx) {
    const { id } = ctx.params;
    let targetDocId = id;

    if (/^\d+$/.test(id)) {
      const entry = await strapi.db.query('api::strategy-template.strategy-template').findOne({
        where: { id: parseInt(id) },
      });
      if (!entry) return ctx.notFound('Strategy template not found');
      targetDocId = entry.documentId;
    }

    await strapi.documents('api::strategy-template.strategy-template').delete({
      documentId: targetDocId,
    });

    ctx.body = { data: { success: true } };
  },
}));

