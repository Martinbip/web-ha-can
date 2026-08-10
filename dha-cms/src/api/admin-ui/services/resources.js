'use strict';

const { getResourceConfig, listResourceConfigs } = require('./resource-config');
const { sendError } = require('./errors');
const auth = require('./auth');
const { buildDateBuckets, countRecordsByDay, toContactLead, toOrderLead } = require('./dashboard-metrics');

const DASHBOARD_TREND_DAYS = 14;
const DASHBOARD_PENDING_LIMIT = 5;
const DASHBOARD_TREND_QUERY_LIMIT = 1000;
const CONTACT_UID = 'api::contact-inquiry.contact-inquiry';
const ORDER_UID = 'api::order-request.order-request';
const PRODUCT_UID = 'api::product.product';

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

function getBoundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function getPagination(ctx) {
  const page = getBoundedInteger(ctx.query.page, 1, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = getBoundedInteger(ctx.query.pageSize, 20, 1, 100);
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
    if (getReadableFields(config).includes(field)) {
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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function getReadableFields(config) {
  return unique([
    'id',
    'documentId',
    'createdAt',
    'updatedAt',
    'publishedAt',
    config.titleField,
    ...(config.listFields || []),
    ...(config.editableFields || []),
    ...(config.readFields || []),
  ]);
}

function getDocumentFields(config) {
  return getReadableFields(config).filter((field) => !['id', 'documentId'].includes(field));
}

// Document Service trả bản draft mặc định, mà draft luôn có publishedAt = null.
// Mốc xuất bản thật nằm ở bản published cùng documentId.
function mergePublishedAt(entries, publishedEntries) {
  const publishedAtByDocument = new Map(
    (publishedEntries || []).map((entry) => [entry.documentId, entry.publishedAt || null]),
  );
  return entries.map((entry) => ({
    ...entry,
    publishedAt: publishedAtByDocument.get(entry.documentId) || null,
  }));
}

async function attachPublishedAt(config, service, entries) {
  if (!config.draftAndPublish || !entries.length) return entries;
  const published = await service.findMany({
    status: 'published',
    filters: { documentId: { $in: entries.map((entry) => entry.documentId) } },
    limit: entries.length,
  });
  return mergePublishedAt(entries, published);
}

function normalizeEntry(entry, config) {
  if (!entry) return entry;
  if (Array.isArray(entry)) return entry.map((item) => normalizeEntry(item, config));

  const readableFields = getReadableFields(config);
  return readableFields.reduce((data, field) => {
    if (Object.prototype.hasOwnProperty.call(entry, field)) {
      data[field] = entry[field];
    }
    return data;
  }, {});
}

async function meta(ctx) {
  const user = await auth.requireSession(ctx);
  if (!user) return;
  ctx.body = {
    resources: listResourceConfigs().map(({ uid, ...config }) => config),
  };
}

async function buildDashboardCards() {
  const cards = [];
  for (const config of listResourceConfigs()) {
    if (config.singleType) continue;
    const count = await strapi.documents(config.uid).count({});
    cards.push({ type: config.type, label: config.pluralLabel, count });
  }
  return cards;
}

async function dashboard(ctx) {
  const user = await auth.requireSession(ctx);
  if (!user) return;

  const now = new Date();
  const buckets = buildDateBuckets(now, DASHBOARD_TREND_DAYS);
  const trendStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - (DASHBOARD_TREND_DAYS - 1),
  );

  const draftConfigs = listResourceConfigs().filter(
    (config) => config.draftAndPublish && !config.singleType,
  );

  const [
    cards,
    contactCount,
    contactRecent,
    orderCount,
    orderRecent,
    contactTrend,
    orderTrend,
    outOfStockProducts,
    draftCounts,
  ] = await Promise.all([
    buildDashboardCards(),
    strapi.documents(CONTACT_UID).count({ filters: { status: 'new' } }),
    strapi.documents(CONTACT_UID).findMany({
      filters: { status: 'new' },
      sort: { createdAt: 'desc' },
      fields: ['name', 'service', 'createdAt'],
      limit: DASHBOARD_PENDING_LIMIT,
    }),
    strapi.documents(ORDER_UID).count({ filters: { status: 'new' } }),
    strapi.documents(ORDER_UID).findMany({
      filters: { status: 'new' },
      sort: { createdAt: 'desc' },
      fields: ['customer_name', 'product_name', 'quantity', 'createdAt'],
      limit: DASHBOARD_PENDING_LIMIT,
    }),
    strapi.documents(CONTACT_UID).findMany({
      filters: { createdAt: { $gte: trendStart } },
      fields: ['createdAt'],
      limit: DASHBOARD_TREND_QUERY_LIMIT,
    }),
    strapi.documents(ORDER_UID).findMany({
      filters: { createdAt: { $gte: trendStart } },
      fields: ['createdAt'],
      limit: DASHBOARD_TREND_QUERY_LIMIT,
    }),
    strapi.documents(PRODUCT_UID).count({ filters: { in_stock: false } }),
    Promise.all(
      draftConfigs.map((config) =>
        strapi.documents(config.uid).count({ filters: { publishedAt: { $null: true } } }),
      ),
    ),
  ]);

  const draftItems = draftConfigs
    .map((config, i) => ({ type: config.type, label: config.pluralLabel, count: draftCounts[i] }))
    .filter((item) => item.count > 0);

  ctx.body = {
    cards,
    pending: {
      contactInquiries: { count: contactCount, recent: contactRecent.map(toContactLead) },
      orderRequests: { count: orderCount, recent: orderRecent.map(toOrderLead) },
    },
    trends: {
      days: buckets.map((bucket) => bucket.label),
      contactInquiries: countRecordsByDay(contactTrend, buckets),
      orderRequests: countRecordsByDay(orderTrend, buckets),
    },
    contentHealth: { outOfStockProducts, draftItems },
  };
}

async function list(ctx) {
  const config = await loadConfig(ctx);
  if (!config) return;

  if (config.singleType) {
    const entries = await getService(config).findMany({ fields: getDocumentFields(config), limit: 1 });
    ctx.body = { data: normalizeEntry(entries[0] || null, config), meta: { page: 1, pageSize: 1, total: entries.length } };
    return;
  }

  const pagination = getPagination(ctx);
  const filters = getFilters(config, ctx);
  const sort = getSort(config, ctx);
  const service = getService(config);
  const [data, total] = await Promise.all([
    service.findMany({ fields: getDocumentFields(config), filters, sort, start: pagination.start, limit: pagination.limit }),
    service.count({ filters }),
  ]);

  const rows = await attachPublishedAt(config, service, data);

  ctx.body = {
    data: rows.map((entry) => normalizeEntry(entry, config)),
    meta: { page: pagination.page, pageSize: pagination.pageSize, total },
  };
}

async function get(ctx) {
  const config = await loadConfig(ctx);
  if (!config) return;
  const data = await getService(config).findOne({ documentId: ctx.params.id, fields: getDocumentFields(config) });
  if (!data) return sendError(ctx, 404, 'NOT_FOUND', 'Không tìm thấy dữ liệu.');
  ctx.body = { data: normalizeEntry(data, config) };
}

async function create(ctx) {
  const config = await loadConfig(ctx);
  if (!config) return;
  if (!auth.requireTrustedOrigin(ctx)) return;
  if (config.readOnlyCreate) return sendError(ctx, 403, 'READ_ONLY', 'Module này không cho tạo dữ liệu từ admin.');
  const data = await getService(config).create({ data: cleanData(config, ctx.request.body) });
  ctx.body = { data: normalizeEntry(data, config) };
}

async function update(ctx) {
  const config = await loadConfig(ctx);
  if (!config) return;
  if (!auth.requireTrustedOrigin(ctx)) return;

  const service = getService(config);
  let data;

  if (config.singleType && ctx.params.id === 'null') {
    // If it's a single type and there is no existing record, create a new one instead of update
    const existing = await service.findMany({ limit: 1 });
    if (existing && existing.length > 0) {
      data = await service.update({ documentId: existing[0].documentId, data: cleanData(config, ctx.request.body) });
    } else {
      data = await service.create({ data: cleanData(config, ctx.request.body) });
    }
  } else {
    data = await service.update({ documentId: ctx.params.id, data: cleanData(config, ctx.request.body) });
  }

  ctx.body = { data: normalizeEntry(data, config) };
}

async function remove(ctx) {
  const config = await loadConfig(ctx);
  if (!config) return;
  if (!auth.requireTrustedOrigin(ctx)) return;
  if (config.readOnlyCreate) return sendError(ctx, 403, 'READ_ONLY', 'Module này không cho xóa dữ liệu từ admin.');
  await getService(config).delete({ documentId: ctx.params.id });
  ctx.body = { ok: true };
}

async function publish(ctx) {
  const config = await loadConfig(ctx);
  if (!config) return;
  if (!auth.requireTrustedOrigin(ctx)) return;
  if (!config.draftAndPublish) return sendError(ctx, 400, 'PUBLISH_UNSUPPORTED', 'Module này không hỗ trợ xuất bản.');
  const data = await getService(config).publish({ documentId: ctx.params.id });
  ctx.body = { data: normalizeEntry(data, config) };
}

async function unpublish(ctx) {
  const config = await loadConfig(ctx);
  if (!config) return;
  if (!auth.requireTrustedOrigin(ctx)) return;
  if (!config.draftAndPublish) return sendError(ctx, 400, 'PUBLISH_UNSUPPORTED', 'Module này không hỗ trợ xuất bản.');
  const data = await getService(config).unpublish({ documentId: ctx.params.id });
  ctx.body = { data: normalizeEntry(data, config) };
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
  getReadableFields,
  normalizeEntry,
  mergePublishedAt,
};
