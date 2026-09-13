'use strict';

// Việc phải làm sau khi ghi, thay cho lifecycles của Strapi. Gọi tường minh từ
// services/resources.js thay vì móc vào tầng dữ liệu, để đọc code là thấy.
const productCategory = require('./product-category');
const siteSetting = require('./site-setting');

const HOOKS = { productCategory, siteSetting };

function hooksFor(config) {
  return Object.prototype.hasOwnProperty.call(HOOKS, config.sanityType) ? HOOKS[config.sanityType] : {};
}

async function snapshot(config, service, documentId) {
  if (!hooksFor(config).needsSnapshot || !documentId) return null;
  return service.findOne({ documentId });
}

async function afterCreate(config, created) {
  const hooks = hooksFor(config);
  if (hooks.afterCreate) await hooks.afterCreate(created);
}

async function afterUpdate(config, before, after) {
  const hooks = hooksFor(config);
  if (hooks.afterUpdate) await hooks.afterUpdate(before, after);
}

async function afterDelete(config, before) {
  const hooks = hooksFor(config);
  if (hooks.afterDelete) await hooks.afterDelete(before);
}

module.exports = { snapshot, afterCreate, afterUpdate, afterDelete };
