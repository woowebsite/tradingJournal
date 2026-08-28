export default {
  routes: [
    {
      method: 'GET',
      path: '/intraday-bsas/sync',
      handler: 'intraday-bsa.sync',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/intraday-bsas/sync',
      handler: 'intraday-bsa.sync',
      config: {
        auth: false,
      },
    },
  ],
};
