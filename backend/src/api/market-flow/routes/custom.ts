export default {
  routes: [
    {
      method: 'POST',
      path: '/market-flows/bulk',
      handler: 'market-flow.bulkCreate',
      config: {
        auth: false,
      },
    },
  ],
};