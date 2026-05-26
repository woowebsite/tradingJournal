/**
 * market-analytic controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::market-analytic.market-analytic', ({ strapi }) => ({
	async listLast30(ctx) {
		const now = new Date();
		const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
		strapi.log.info(`Fetching market-analytic items since ${thirtyDaysAgo}`);

		const items = await strapi.db.query('api::market-analytic.market-analytic').findMany({
			where: { date: { $gte: thirtyDaysAgo } },
			orderBy: { date: 'desc' },
		});

		ctx.body = { data: items };
	},
}));
