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
      origin: (ctx) => {
        const origin = ctx.request.headers.origin;
        const allowed = [
          'null',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          process.env.FRONTEND_URL,
        ].filter(Boolean);

        const exactOriginAllowed = (candidate) => {
          if (!candidate) return true;
          if (candidate === 'null') return allowed.includes('null');
          try {
            const candidateOrigin = new URL(candidate).origin;
            return allowed.some((allowedOrigin) => {
              if (allowedOrigin === 'null') return false;
              return candidateOrigin === new URL(allowedOrigin).origin;
            });
          } catch {
            return false;
          }
        };

        if (exactOriginAllowed(origin)) {
          return origin ? [origin] : ['*'];
        }
        return [];
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
      credentials: true,
      keepHeaderOnError: true,
    },
  },
  {
    name: 'strapi::poweredBy',
    config: {
      poweredBy: 'DHA CMS',
    },
  },
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      formLimit: '1mb',
      jsonLimit: '1mb',
      textLimit: '1mb',
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
