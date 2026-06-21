'use strict';

const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreRouter('api::order-request.order-request', {
  config: {
    create: {
      middlewares: [
        {
          name: 'global::rate-limit',
          config: { windowMs: 15 * 60 * 1000, max: 10 },
        },
      ],
    },
  },
});
