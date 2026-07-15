/**
 * news-analysis service
 */

import { factories } from '@strapi/strapi';
const NEWS_ANALYSIS_UID = 'api::news-analysis.news-analysis' as any;

export default factories.createCoreService(NEWS_ANALYSIS_UID);
