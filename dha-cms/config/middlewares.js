module.exports = [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': ["'self'", 'data:', 'blob:'],
          'media-src': ["'self'", 'data:', 'blob:'],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      // Allow file:// (origin "null"), localhost for dev, and production domain
      origin: (ctx) => {
        const origin = ctx.request.headers.origin;
        const allowed = [
          'null',                       // file:// protocol
          'http://localhost',
          'http://127.0.0.1',
          process.env.FRONTEND_URL,     // production domain via env
        ].filter(Boolean);

        if (!origin || allowed.some((o) => origin.startsWith(o))) {
          return origin || '*';
        }
        return false;
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
      keepHeaderOnError: true,
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
