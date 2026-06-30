'use strict';

const auth = require('../services/auth');

module.exports = {
  async login(ctx) {
    return auth.login(ctx);
  },
  async me(ctx) {
    return auth.me(ctx);
  },
  async logout(ctx) {
    return auth.logout(ctx);
  },
};
