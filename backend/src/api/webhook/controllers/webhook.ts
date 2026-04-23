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

    const payload = ctx.request.body || {};
    
    // Auto-map action to signal if signal is missing
    const signalValue = payload.signal || payload.action || 'UNKNOWN';

    // Create a new WebHookSignal record
    const newSignal = await strapi.documents('api::webhook-signal.webhook-signal').create({
      data: {
        symbol: payload.symbol,
        signal: signalValue,
        tf: payload.tf,
        signalStatus: 'Unread',
        createdDate: new Date().toISOString(),
        webhook: match.documentId
      },
      status: 'published'
    });

    // Process and broadcast signal via socket.io
    if ((strapi as any).io) {
      (strapi as any).io.emit('tradingview_signal', {
        webhookId: match.id,
        title: match.Title,
        app: match.App,
        payload: payload,
        signalRecord: newSignal,
        timestamp: new Date().toISOString()
      });
    }


    // Return success to TradingView
    ctx.send({ status: 'success', message: 'Signal received' });
  }
}));
