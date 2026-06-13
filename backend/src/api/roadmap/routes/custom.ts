export default {
  routes: [
    {
      method: 'PUT',
      path: '/roadmaps/:documentId/process',
      handler: 'roadmap.process',
      config: {
        auth: true,
      },
    },
  ],
};
