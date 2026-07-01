'use strict';

const auth = require('../services/auth');
const media = require('../services/media');
const resources = require('../services/resources');

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
  async meta(ctx) {
    return resources.meta(ctx);
  },
  async dashboard(ctx) {
    return resources.dashboard(ctx);
  },
  async listResources(ctx) {
    return resources.list(ctx);
  },
  async getResource(ctx) {
    return resources.get(ctx);
  },
  async createResource(ctx) {
    return resources.create(ctx);
  },
  async updateResource(ctx) {
    return resources.update(ctx);
  },
  async deleteResource(ctx) {
    return resources.delete(ctx);
  },
  async publishResource(ctx) {
    return resources.publish(ctx);
  },
  async unpublishResource(ctx) {
    return resources.unpublish(ctx);
  },
  async listMedia(ctx) {
    return media.list(ctx);
  },
  async uploadMedia(ctx) {
    return media.upload(ctx);
  },
  async deleteMedia(ctx) {
    return media.delete(ctx);
  },
};
