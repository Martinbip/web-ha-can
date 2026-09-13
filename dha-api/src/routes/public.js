'use strict';

const Router = require('@koa/router');

const { getStore } = require('../sanity/store-registry');
const { parseStrapiQuery, buildMeta, QueryError } = require('../http/strapi-query');
const { validateAgainstSchema } = require('../http/schema-validator');
const { createRateLimit } = require('../http/rate-limit');
const contactInquirySchema = require('../schemas/contactInquiry.json');
const orderRequestSchema = require('../schemas/orderRequest.json');

// Đường dẫn công khai (pluralName của Strapi) → sanityType. Chỉ các type này
// đọc được không cần đăng nhập — đúng danh sách quyền `find`/`findOne` mà
// dha-cms/src/index.js cấp cho role public. contactInquiry, orderRequest và
// adminUser cố ý không có ở đây.
const PUBLIC_COLLECTIONS = {
  'news-articles': 'news',
  products: 'product',
  'product-categories': 'productCategory',
  projects: 'project',
  services: 'service',
  'hero-slides': 'heroSlide',
  'workflow-steps': 'workflowStep',
  'pricing-packages': 'pricingPackage',
  'pricing-analyses': 'pricingAnalysis',
  'pricing-surveys': 'pricingSurvey',
  ores: 'ore',
};

const PUBLIC_SINGLES = {
  'site-setting': 'siteSetting',
  navigation: 'navigation',
};

// Strapi không có sort thì trả theo id tăng dần, tức thứ tự tạo.
const DEFAULT_SORT = [{ createdAt: 'asc' }, { documentId: 'asc' }];

function own(map, key) {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
}

function strapiError(ctx, status, name, message, details = {}) {
  ctx.status = status;
  ctx.body = { data: null, error: { status, name, message, details } };
}

// Hai form ghi được mà không cần đăng nhập. Giới hạn tần suất lấy đúng theo
// route Strapi cũ (dha-cms/src/api/<type>/routes).
const FORMS = {
  'contact-inquiries': { type: 'contactInquiry', schema: contactInquirySchema, max: 5 },
  'order-requests': { type: 'orderRequest', schema: orderRequestSchema, max: 10 },
};

function submitForm({ type, schema }) {
  return async (ctx) => {
    const body = ctx.request.body || {};
    const input = body.data && typeof body.data === 'object' ? body.data : body;
    const { data, errors } = validateAgainstSchema(schema, input, { forced: { status: 'new' } });
    if (errors.length) return strapiError(ctx, 400, 'ValidationError', errors[0], { errors });
    const created = await getStore().documents(type).create({ data });
    ctx.body = { data: created, meta: {} };
    return undefined;
  };
}

function parseOr400(ctx) {
  try {
    return parseStrapiQuery(ctx.query);
  } catch (err) {
    if (err instanceof QueryError) {
      strapiError(ctx, 400, 'ValidationError', err.message);
      return null;
    }
    throw err;
  }
}

async function listCollection(ctx, next) {
  const type = own(PUBLIC_COLLECTIONS, ctx.params.collection);
  if (!type) return next();

  const query = parseOr400(ctx);
  if (!query) return undefined;

  const service = getStore().documents(type);
  const filters = query.filters;
  const [rows, total] = await Promise.all([
    service.findMany({
      status: 'published',
      filters,
      sort: query.sort.length ? query.sort : DEFAULT_SORT,
      start: query.pagination.start,
      limit: query.pagination.limit,
    }),
    service.count({ status: 'published', filters }),
  ]);

  ctx.body = { data: rows, meta: buildMeta(query.pagination, total) };
  return undefined;
}

async function findInCollection(ctx, next) {
  const type = own(PUBLIC_COLLECTIONS, ctx.params.collection);
  if (!type) return next();

  const entry = await getStore().documents(type).findOne({ documentId: ctx.params.documentId, status: 'published' });
  if (!entry) return strapiError(ctx, 404, 'NotFoundError', 'Not Found');
  ctx.body = { data: entry, meta: {} };
  return undefined;
}

function readSingle(type) {
  return async (ctx) => {
    const [entry] = await getStore().documents(type).findMany({ status: 'published', limit: 1 });
    if (!entry) return strapiError(ctx, 404, 'NotFoundError', 'Not Found');
    ctx.body = { data: entry, meta: {} };
    return undefined;
  };
}

function createPublicRouter() {
  const router = new Router({ prefix: '/api' });
  // Singleton đăng ký trước để không bị route /:collection nuốt mất.
  for (const [path, type] of Object.entries(PUBLIC_SINGLES)) {
    router.get(`/${path}`, readSingle(type));
  }
  for (const [path, form] of Object.entries(FORMS)) {
    router.post(`/${path}`, createRateLimit({ windowMs: 15 * 60 * 1000, max: form.max }), submitForm(form));
  }
  router.get('/:collection', listCollection);
  router.get('/:collection/:documentId', findInCollection);
  return router;
}

module.exports = { createPublicRouter, PUBLIC_COLLECTIONS, PUBLIC_SINGLES, strapiError };