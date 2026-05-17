'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::industry.industry', {
    only: ['find', 'findOne', 'create', 'update', 'delete'],
    config: {
        find: { method: 'GET', path: '/' },
        findOne: { method: 'GET', path: '/:id' },
        create: { method: 'POST', path: '/' },
        update: { method: 'PUT', path: '/:id' },
        delete: { method: 'DELETE', path: '/:id' },
    },
});