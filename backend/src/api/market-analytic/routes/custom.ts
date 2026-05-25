export default {
  routes: [
    {
      method: 'GET',
      path: '/market-analytics/all-last-30',
      handler: 'market-analytic.listLast30',
      config: {
        auth: false,
      },
    },
  ],
};
