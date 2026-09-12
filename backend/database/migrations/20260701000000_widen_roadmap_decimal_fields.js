'use strict';

const TABLE_NAME = 'roadmaps';
const MONEY_COLUMNS = [
  'starting_balance',
  'target_balance',
  'profit_target'
];
const PERCENT_COLUMNS = [
  'target_growth_percent',
  'risk_percent',
  'reward_multiple',
  'max_draw_down_percent',
  'win_rate_estimate'
];

async function alterDecimalColumns(knex, precision, scale) {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (!hasTable) return;

  await knex.schema.alterTable(TABLE_NAME, (table) => {
    MONEY_COLUMNS.forEach((column) => {
      table.decimal(column, precision, scale).alter();
    });
    PERCENT_COLUMNS.forEach((column) => {
      table.decimal(column, precision, scale).alter();
    });
  });
}

module.exports = {
  async up(knex) {
    await alterDecimalColumns(knex, 20, 4);
  },

  async down(knex) {
    await alterDecimalColumns(knex, 10, 2);
  },
};
