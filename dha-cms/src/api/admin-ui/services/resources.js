'use strict';

const { getResourceConfig, listResourceConfigs } = require('./resource-config');
const { sendError } = require('./errors');
const auth = require('./auth');

function cleanData(config, body) {
  const input = body && body.data ? body.data : body || {};
  return config.editableFields.reduce((data, field) => {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      data[field] = input[field];
    }
    return data;
  }, {});
}

function getService(config) {
  return strapi.documents(config.uid);
}

function getPagination(ctx) {
  const page = Math.max(Number(ctx.query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(ctx.query.pageSize || 20), 1), 100);
  return {
    page,
    pageSize,
    start: (page - 1) * pageSize,
    limit: pageSize,
  };
}

function getFilters(config, ctx) {
  const filters = {};
  const search = String(ctx.query.search || '').trim();
  if (search && config.searchableFields && config.searchableFields.length) {
    filters.$or = config.searchableFields.map((field) => ({ [field]: { $containsi: search } }));
  }
  if (ctx.query.status && config.fields && config.fields.status) {
    filters.status = ctx.query.status;
  }
  return filters;
}

function getSort(config, ctx) {
  if (ctx.query.sort) {
    const [field, direction = 'asc'] = String(ctx.query.sort).split(':');
    if ([config.titleField, ...config.listFields, ...config.editableFields, 'createdAt', 'updatedAt', 'publishedAt'].includes(field)) {
      return { [field]: direction.toLowerCase() === 'desc' ? 'desc' : 'asc' };
    }
  }
  return config.defaultSort || { updatedAt: 'desc' };
}

async function loadConfig(ctx) {
  const config = getResourceConfig(ctx.params.type);
  if (!config) {
    sendError(ctx, 404, 'UNKNOWN_RESOURCE', 'Không tìm thấy module quản trị.');
    return null;
  }
  const user = await auth.requireSession(ctx);
  if (!user) return null;
  return config;
}

function normalizeEntry(entry) {
  return entry;
}

async function meta(ctx) {
  const user = await auth.requireSession(ctx);
  if (!user) return;
  ctx.body = {
    resources: listResourceConfigs().map(({ uid, ...config }) => config),
  };
}

async function dashboard(ctx) {
  const user = await auth.requireSession(ctx);
  if (!user) return;
  const cards = [];
  for (const config of listResourceConfigs()) {
    if (config.singleType) continue;
    const count = await strapi.documents(config.uid).count();
    cards.push({ type: config.type, label: config.pluralLabel, count });
  }
  ctx.body = { cards };
}

async function list(ctx) {
  const config = await loadConfig(ctx);
  if (!config) return;

  if (config.singleType) {
    const entries = await getService(config).findMany({ limit: 1 });
    ctx.body = { data: entries[0] || null, meta: { page: 1, pageSize: 1, total: entries.length } };
    return;
  }

  const pagination = getPagination(ctx);
  const filters = getFilters(config, ctx);
  const sort = getSort(config, ctx);
  const service = getService(config);
  const [data, total] = await Promise.all([
    service.findMany({ filters, sort, start: pagination.start, limit: pagination.limit, publicationState: 'preview' }),
    service.count({ filters }),
  ]);

  ctx.body = {
    data: data.map(normalizeEntry),
    meta: { page: pagination.page, pageSize: pagination.pageSize, total },
  };
}

async function get(ctx) {
  const config = await loadConfig(ctx);
  if (!config) return;
  const data = await getService(config).findOne({ documentId: ctx.params.id, publicationState: 'preview' });
  if (!data) return sendError(ctx, 404, 'NOT_FOUND', 'Không tìm thấy dữ liệu.');
  ctx.body = { data: normalizeEntry(data) };
}

async function create(ctx) {
  const config = await loadConfig(ctx);
  if (!config) return;
  if (config.readOnlyCreate) return sendError(ctx, 403, 'READ_ONLY', 'Module này không cho tạo dữ liệu từ admin.');
  const data = await getService(config).create({ data: cleanData(config, ctx.request.body) });
  ctx.body = { data: normalizeEntry(data) };
}

async function update(ctx) {
  const config = await loadConfig(ctx);
  if (!config) return;
  const data = await getService(config).update({ documentId: ctx.params.id, data: cleanData(config, ctx.request.body) });
  ctx.body = { data: normalizeEntry(data) };
}

async function remove(ctx) {
  const config = await loadConfig(ctx);
  if (!config) return;
  if (config.readOnlyCreate) return sendError(ctx, 403, 'READ_ONLY', 'Module này không cho xóa dữ liệu từ admin.');
  await getService(config).delete({ documentId: ctx.params.id });
  ctx.body = { ok: true };
}

async function publish(ctx) {
  const config = await loadConfig(ctx);
  if (!config) return;
  if (!config.draftAndPublish) return sendError(ctx, 400, 'PUBLISH_UNSUPPORTED', 'Module này không hỗ trợ xuất bản.');
  const data = await getService(config).publish({ documentId: ctx.params.id });
  ctx.body = { data };
}

async function unpublish(ctx) {
  const config = await loadConfig(ctx);
  if (!config) return;
  if (!config.draftAndPublish) return sendError(ctx, 400, 'PUBLISH_UNSUPPORTED', 'Module này không hỗ trợ xuất bản.');
  const data = await getService(config).unpublish({ documentId: ctx.params.id });
  ctx.body = { data };
}

module.exports = {
  meta,
  dashboard,
  list,
  get,
  create,
  update,
  delete: remove,
  publish,
  unpublish,
};
