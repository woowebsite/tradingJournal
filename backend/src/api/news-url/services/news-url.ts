/**
 * news-url service
 */

import { factories } from '@strapi/strapi';

const NEWS_URL_UID = 'api::news-url.news-url' as any;

export default factories.createCoreService(NEWS_URL_UID);
