export default {
  routes: [
    {
      method: 'POST',
      path: '/symbol-histories/clear',
      handler: 'symbol-history.clearHistory',
      config: {
        auth: false,
      },
    },
    {
      method: 'DELETE',
      path: '/symbol-histories/clear',
      handler: 'symbol-history.clearHistory',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/symbol-histories/bulk',
      handler: 'symbol-history.bulkCreate',
      config: {
        auth: false,
      },
    },
  ],
};

