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
    { method: 'GET', path: '/admin-ui/meta', handler: 'admin-ui.meta', config: { auth: false } },
    { method: 'GET', path: '/admin-ui/dashboard', handler: 'admin-ui.dashboard', config: { auth: false } },
    { method: 'GET', path: '/admin-ui/resources/:type', handler: 'admin-ui.listResources', config: { auth: false } },
    { method: 'POST', path: '/admin-ui/resources/:type', handler: 'admin-ui.createResource', config: { auth: false } },
    { method: 'GET', path: '/admin-ui/resources/:type/:id', handler: 'admin-ui.getResource', config: { auth: false } },
    { method: 'PUT', path: '/admin-ui/resources/:type/:id', handler: 'admin-ui.updateResource', config: { auth: false } },
    { method: 'DELETE', path: '/admin-ui/resources/:type/:id', handler: 'admin-ui.deleteResource', config: { auth: false } },
    { method: 'POST', path: '/admin-ui/resources/:type/:id/publish', handler: 'admin-ui.publishResource', config: { auth: false } },
    { method: 'POST', path: '/admin-ui/resources/:type/:id/unpublish', handler: 'admin-ui.unpublishResource', config: { auth: false } },
  ],
};
