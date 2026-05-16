'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::industry.industry', ({ strapi }) => ({
    async bulk(ctx) {
        const { data } = ctx.request.body;
        strapi.log.info(`Bulk industries sync received data length: ${data?.length}`);

        if (!Array.isArray(data)) {
            ctx.throw(400, 'data must be an array');
        }

        const results = await Promise.all(
            data.map(async (item) => {
                try {
                    // 1. Try to find a standard Strapi 5 Document
                    let existing = await strapi.documents('api::industry.industry').findFirst({
                        filters: { code: String(item.code) },
                    });

                    // 2. If no Document found, check for "orphan" records in the raw database
                    // This happens when migrating from strapi.db.query to strapi.documents
                    if (!existing) {
                        const rawExisting = await strapi.db.query('api::industry.industry').findOne({
                            where: { code: String(item.code) }
                        });

                        if (rawExisting) {
                            strapi.log.info(`Cleaning up legacy/orphan record for code: ${item.code}`);
                            await strapi.db.query('api::industry.industry').delete({
                                where: { id: rawExisting.id }
                            });
                        }
                    }

                    if (existing) {
                        strapi.log.info(`Updating industry: ${item.code} - ${item.name}`);
                        return strapi.documents('api::industry.industry').update({
                            documentId: existing.documentId,
                            data: { 
                                name: item.name,
                            },
                            status: 'published',
                        });
                    }

                    strapi.log.info(`Creating industry: ${item.code} - ${item.name}`);
                    return strapi.documents('api::industry.industry').create({
                        data: { 
                            code: String(item.code), 
                            name: item.name,
                        },
                        status: 'published',
                    });
                } catch (err) {
                    strapi.log.error(`Error syncing industry ${item.code}: ${err.message}`);
                    return { error: err.message, code: item.code };
                }
            })
        );

        ctx.body = { data: results };
    },
}));