export default {
  routes: [
    {
      method: 'GET',
      path: '/tcbs-recommens/sync',
      handler: 'tcbs-recommen.sync',
      config: {
        auth: false,
      },
    },
  ],
};
