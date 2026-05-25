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
    {
      method: 'GET',
      path: '/market-flows/all-last-30',
      handler: 'market-flow.listLast30',
      config: {
        auth: false,
      },
    },
  ],
};