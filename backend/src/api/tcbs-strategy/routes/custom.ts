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
  ],
};
