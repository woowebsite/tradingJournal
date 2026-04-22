import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::webhook.webhook', ({ strapi }) => ({
  async receive(ctx) {
    const { token } = ctx.params;

    // Find the webhook where WebhookUrl contains the token (handles leading slashes)
    const match = await strapi.db.query('api::webhook.webhook').findOne({
      where: {
        WebhookUrl: { $contains: token },
        webhookStatus: 'Enable'
      }
    });

    if (!match) {
      return ctx.notFound('Webhook not found or disabled');
    }

    // Process and broadcast signal via socket.io
    if ((strapi as any).io) {
      (strapi as any).io.emit('tradingview_signal', {
        webhookId: match.id,
        title: match.Title,
        app: match.App,
        payload: ctx.request.body,
        timestamp: new Date().toISOString()
      });
    }

    // Return success to TradingView
    ctx.send({ status: 'success', message: 'Signal received' });
  }
}));
