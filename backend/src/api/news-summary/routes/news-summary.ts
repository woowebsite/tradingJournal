/**
 * news-summary router
 */

import { factories } from '@strapi/strapi';

const NEWS_SUMMARY_UID = 'api::news-summary.news-summary' as any;

export default factories.createCoreRouter(NEWS_SUMMARY_UID);
