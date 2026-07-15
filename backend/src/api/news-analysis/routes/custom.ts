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
  ],
};
