export default {
  routes: [
    {
      method: 'GET',
      path: '/python-strategies',
      handler: 'python-strategy.list',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/python-strategies/scan',
      handler: 'python-strategy.scan',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/python-strategies/optimize',
      handler: 'python-strategy.optimize',
      config: {
        auth: false,
      },
    },
  ],
};
