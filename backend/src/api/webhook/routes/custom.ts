export default {
  routes: [
    {
      method: 'POST',
      path: '/webhooks/receive/:token',
      handler: 'webhook.receive',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/webhooks/screenshot',
      handler: 'webhook.captureScreenshot',
      config: {
        auth: false,
      },
    },
  ],
};
