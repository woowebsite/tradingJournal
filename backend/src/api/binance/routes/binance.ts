export default {
  routes: [
    {
      method: 'GET',
      path: '/binance/account',
      handler: 'binance.account',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/binance/order',
      handler: 'binance.order',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/binance/execute-strategy-trade',
      handler: 'binance.executeStrategyTrade',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/binance/scan-and-trade',
      handler: 'binance.scanAndTrade',
      config: {
        auth: false,
      },
    },
  ],
};
