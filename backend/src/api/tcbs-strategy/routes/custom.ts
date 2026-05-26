export default {
  routes: [
    {
      method: 'GET',
      path: '/tcbs-strategies/sync-signal',
      handler: 'tcbs-strategy.syncSignal',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/tcbs-strategies/sync-detail',
      handler: 'tcbs-strategy.syncDetail',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/tcbs-strategies/get-detail',
      handler: 'tcbs-strategy.getDetail',
      config: {
        auth: false,
      },
    },
  ],
};
