export default {
  routes: [
    {
      method: 'GET',
      path: '/intraday-bid-asks/sync',
      handler: 'intraday-bid-ask.sync',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/intraday-bid-asks/sync',
      handler: 'intraday-bid-ask.sync',
      config: {
        auth: false,
      },
    },
  ],
};
