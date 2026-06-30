'use strict';

module.exports = {
  routes: [
    { method: 'POST', path: '/admin-ui/auth/login', handler: 'admin-ui.login', config: { auth: false } },
    { method: 'GET', path: '/admin-ui/auth/me', handler: 'admin-ui.me', config: { auth: false } },
    { method: 'POST', path: '/admin-ui/auth/logout', handler: 'admin-ui.logout', config: { auth: false } },
  ],
};
