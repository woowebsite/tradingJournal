/**
 * news-analysis router
 */

import { factories } from '@strapi/strapi';
const NEWS_ANALYSIS_UID = 'api::news-analysis.news-analysis' as any;

export default factories.createCoreRouter(NEWS_ANALYSIS_UID);
