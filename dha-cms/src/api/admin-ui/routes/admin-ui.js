'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/admin-ui/auth/login',
      handler: 'admin-ui.login',
      config: {
        auth: false,
        middlewares: [
          {
            name: 'global::rate-limit',
            config: { windowMs: 15 * 60 * 1000, max: 5 },
          },
        ],
      },
    },
    { method: 'GET', path: '/admin-ui/auth/me', handler: 'admin-ui.me', config: { auth: false } },
    { method: 'POST', path: '/admin-ui/auth/logout', handler: 'admin-ui.logout', config: { auth: false } },
  ],
};
