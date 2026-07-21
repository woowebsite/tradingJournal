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

    // Grant access to trade, account, strategy endpoints
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
        'api::tcbs-strategy.tcbs-strategy.find',
        'api::tcbs-strategy.tcbs-strategy.findOne',
        'api::tcbs-strategy.tcbs-strategy.create',
        'api::tcbs-strategy.tcbs-strategy.update',
        'api::tcbs-strategy.tcbs-strategy.delete',
        'api::tcbs-strategy-signal.tcbs-strategy-signal.find',
        'api::tcbs-strategy-signal.tcbs-strategy-signal.findOne',
        'api::tcbs-strategy-signal.tcbs-strategy-signal.create',
        'api::tcbs-strategy-signal.tcbs-strategy-signal.update',
        'api::tcbs-strategy-signal.tcbs-strategy-signal.delete',
        'api::symbol.symbol.find',
        'api::symbol.symbol.findOne',
        'api::symbol.symbol.create',
        'api::symbol.symbol.update',
        'api::symbol.symbol.delete',
        'api::stock-ratio.stock-ratio.find',
        'api::stock-ratio.stock-ratio.findOne',
        'api::stock-ratio.stock-ratio.create',
        'api::stock-ratio.stock-ratio.update',
        'api::stock-ratio.stock-ratio.delete',
        'api::market.market.find',
        'api::market.market.findOne',
        'api::market.market.create',
        'api::market.market.update',
        'api::market.market.delete',
        'api::scored.scored.find',
        'api::scored.scored.findOne',
        'api::scored.scored.create',
        'api::scored.scored.update',
        'api::scored.scored.delete',
        'api::webhook-signal.webhook-signal.find',
        'api::webhook-signal.webhook-signal.findOne',
        'api::webhook-signal.webhook-signal.update',
        'api::webhook-signal.webhook-signal.delete',
        'api::market-flow.market-flow.find',
        'api::market-flow.market-flow.findOne',
        'api::market-flow.market-flow.create',
        'api::industry.industry.find',
        'api::industry.industry.findOne',
    ];

    const rolesToGrant = ['public', 'authenticated'];

    for (const roleType of rolesToGrant) {
      const role = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: roleType },
      });

      if (!role) continue;

      const permissions = await strapi.db.query('plugin::users-permissions.permission').findMany({
        where: {
          action: { $in: permissionsToEnable },
          role: role.id,
        },
      });

      const existingActions = permissions.map(p => p.action);
      const newActions = permissionsToEnable.filter(action => !existingActions.includes(action));

      if (newActions.length > 0) {
        await Promise.all(newActions.map(action => {
          return strapi.db.query('plugin::users-permissions.permission').create({
            data: {
              action,
              role: role.id,
            },
          });
        }));
        strapi.log.info(`Updated ${roleType} permissions for Trading Journal API`);
      }
    }
  },
};
