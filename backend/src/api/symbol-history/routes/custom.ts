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
  ],
};
