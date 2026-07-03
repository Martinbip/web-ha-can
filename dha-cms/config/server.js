module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('PUBLIC_URL', 'http://localhost:1337'),
  // Strapi runs behind nginx in production (TLS terminated at the proxy).
  // Without trusting the proxy, ctx.request.ip resolves to nginx's local
  // address for every visitor, collapsing the login rate-limiter into one
  // shared bucket that locks out all admins after a handful of requests
  // from anyone. Defaults to trusting the proxy in production; still
  // overridable via IS_BEHIND_PROXY for non-standard setups.
  proxy: env.bool('IS_BEHIND_PROXY', env('NODE_ENV') === 'production'),
  app: {
    keys: env.array('APP_KEYS'),
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
});
