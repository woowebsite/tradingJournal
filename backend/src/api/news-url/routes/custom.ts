export default {
  routes: [
    {
      method: 'POST',
      path: '/news-urls/bulk',
      handler: 'news-url.bulkCreate',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/news-urls/all',
      handler: 'news-url.listAll',
      config: {
        auth: false,
      },
    },
  ],
};
