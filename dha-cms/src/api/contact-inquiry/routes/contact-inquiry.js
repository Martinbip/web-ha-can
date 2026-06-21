'use strict';

const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreRouter('api::contact-inquiry.contact-inquiry', {
  config: {
    create: {
      middlewares: [
        {
          name: 'global::rate-limit',
          config: { windowMs: 15 * 60 * 1000, max: 5 },
        },
      ],
    },
  },
});
