import { Server } from 'socket.io';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) { },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    // Initialize Socket.IO
    const io = new Server(strapi.server.httpServer, {
      cors: {
        origin: '*', // Adjust this for production
        methods: ['GET', 'POST'],
      },
    });

    strapi.io = io; // Attach to strapi instance so we can use it in controllers

    io.on('connection', (socket) => {
      strapi.log.info(`New socket connection: ${socket.id}`);
      
      socket.on('disconnect', () => {
        strapi.log.info(`Socket disconnected: ${socket.id}`);
      });
    });

    // Grant public access to trade, account, strategy endpoints
    const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'public' },
    });

    if (publicRole) {
      const permissionsToEnable = [
        'api::trade.trade.find',
        'api::trade.trade.findOne',
        'api::trade.trade.create',
        'api::trade.trade.update',
        'api::trade.trade.delete',
        'api::account.account.find',
        'api::account.account.findOne',
        'api::account.account.create',
        'api::account.account.update',
        'api::account.account.delete',
        'api::strategy.strategy.find',
        'api::strategy.strategy.findOne',
        'api::strategy.strategy.create',
        'api::strategy.strategy.update',
        'api::strategy.strategy.delete',
        'api::symbol.symbol.find',
        'api::symbol.symbol.findOne',
        'api::symbol.symbol.create',
        'api::symbol.symbol.update',
        'api::symbol.symbol.delete',
        'api::market.market.find',
        'api::market.market.findOne',
        'api::market.market.create',
        'api::market.market.update',
        'api::market.market.delete',
        'api::webhook-signal.webhook-signal.find',
        'api::webhook-signal.webhook-signal.findOne',
        'api::webhook-signal.webhook-signal.update',
        'api::webhook-signal.webhook-signal.delete',
      ];

      // Find permission IDs
      const permissions = await strapi.db.query('plugin::users-permissions.permission').findMany({
        where: {
          action: { $in: permissionsToEnable },
          role: publicRole.id,
        },
      });

      const existingActions = permissions.map(p => p.action);
      const newActions = permissionsToEnable.filter(action => !existingActions.includes(action));

      if (newActions.length > 0) {
        await Promise.all(newActions.map(action => {
          return strapi.db.query('plugin::users-permissions.permission').create({
            data: {
              action,
              role: publicRole.id,
            },
          });
        }));
        strapi.log.info('Updated public permissions for Trading Journal API');
      }
    }
  },
};
