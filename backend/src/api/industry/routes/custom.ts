'use strict';

export default {
  routes: [
    {
      method: 'POST',
      path: '/industries/bulk',
      handler: 'industry.bulk',
      config: {
        auth: false,
      },
    },
  ],
};