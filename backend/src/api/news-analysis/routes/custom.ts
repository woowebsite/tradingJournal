export default {
  routes: [
    {
      method: 'POST',
      path: '/news-analyses/refresh',
      handler: 'news-analysis.refresh',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/news-analyses/all-last-30',
      handler: 'news-analysis.listLast30',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/news-analyses/ai/analyze',
      handler: 'news-analysis.analyze',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/news-analyses/ai/save',
      handler: 'news-analysis.saveAnalysis',
      config: {
        auth: false,
      },
    },
  ],
};
