'use strict';

// Bộ giả lập tối thiểu cho Strapi + Koa context, đủ để gọi thẳng các service
// của admin-ui trong test mà không cần dựng cả CMS.
const crypto = require('node:crypto');

const COOKIE_NAME = 'ha_can_admin_session';

function signSession(payload, secret = process.env.ADMIN_UI_SESSION_SECRET) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function validSessionToken(overrides = {}) {
  return signSession({
    sub: 1,
    email: 'admin@dha.vn',
    firstname: 'Quản',
    lastname: 'Trị',
    exp: Date.now() + 60_000,
    ...overrides,
  });
}

function makeCtx({
  params = {},
  query = {},
  body = {},
  files = null,
  cookie = validSessionToken(),
  origin = 'http://localhost:3000',
  referer = undefined,
  headers = {},
} = {}) {
  const cookies = new Map();
  if (cookie) cookies.set(COOKIE_NAME, cookie);

  const requestHeaders = { ...headers };
  if (origin !== undefined && origin !== null) requestHeaders.origin = origin;
  if (referer) requestHeaders.referer = referer;

  return {
    params,
    query,
    state: {},
    status: 200,
    body: undefined,
    setCookies: [],
    request: { body, files, headers: requestHeaders },
    cookies: {
      get: (name) => cookies.get(name),
      set(name, value, options) {
        this.__ctx.setCookies.push({ name, value, options });
        if (value === null) cookies.delete(name);
        else cookies.set(name, value);
      },
    },
    get __self() {
      return this;
    },
  };
}

// cookies.set cần trỏ ngược về ctx để ghi lại lời gọi.
function buildCtx(options) {
  const ctx = makeCtx(options);
  ctx.cookies.__ctx = ctx;
  return ctx;
}

// ---------------------------------------------------------------------------
// Document Service giả: đủ các toán tử lọc mà admin-ui thực sự dùng.
// ---------------------------------------------------------------------------

function matchOperator(value, operator, operand) {
  switch (operator) {
    case '$eq':
      return value === operand;
    case '$containsi':
      return String(value ?? '').toLowerCase().includes(String(operand).toLowerCase());
    case '$contains':
      return String(value ?? '').includes(String(operand));
    case '$in':
      return Array.isArray(operand) && operand.includes(value);
    case '$null':
      return operand ? value == null : value != null;
    case '$gte':
      return new Date(value) >= new Date(operand);
    default:
      throw new Error(`Toán tử lọc chưa hỗ trợ trong harness: ${operator}`);
  }
}

function matchFilters(entry, filters) {
  if (!filters) return true;
  return Object.entries(filters).every(([key, condition]) => {
    if (key === '$or') return condition.some((sub) => matchFilters(entry, sub));
    if (key === '$and') return condition.every((sub) => matchFilters(entry, sub));
    if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
      return Object.entries(condition).every(([operator, operand]) =>
        matchOperator(entry[key], operator, operand),
      );
    }
    return entry[key] === condition;
  });
}

function applySort(entries, sort) {
  if (!sort) return entries;
  const [field, direction] = Object.entries(sort)[0];
  return entries.slice().sort((a, b) => {
    const left = a[field];
    const right = b[field];
    if (left === right) return 0;
    const smaller = left < right ? -1 : 1;
    return direction === 'desc' ? -smaller : smaller;
  });
}

function pickFields(entry, fields) {
  if (!fields || !fields.length) return { ...entry };
  const picked = { id: entry.id, documentId: entry.documentId };
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(entry, field)) picked[field] = entry[field];
  }
  return picked;
}

// Mỗi documentId có tối đa 2 bản: draft (luôn publishedAt = null) và published.
function createFakeStrapi(seed = {}) {
  const store = new Map();
  const calls = [];
  let autoId = 0;

  for (const [uid, entries] of Object.entries(seed)) {
    store.set(
      uid,
      entries.map((entry) => {
        autoId += 1;
        return {
          id: entry.id ?? autoId,
          documentId: entry.documentId ?? `doc-${autoId}`,
          createdAt: entry.createdAt ?? '2026-01-01T00:00:00.000Z',
          updatedAt: entry.updatedAt ?? '2026-01-01T00:00:00.000Z',
          publishedAt: entry.publishedAt ?? null,
          ...entry,
        };
      }),
    );
  }

  function rowsOf(uid) {
    if (!store.has(uid)) store.set(uid, []);
    return store.get(uid);
  }

  function documents(uid) {
    return {
      async findMany({ fields, filters, sort, start = 0, limit = 100, status = 'draft' } = {}) {
        calls.push({ uid, method: 'findMany', fields, filters, sort, start, limit, status });
        const scoped = rowsOf(uid).filter((entry) =>
          status === 'published' ? entry.publishedAt != null : true,
        );
        const filtered = scoped.filter((entry) => matchFilters(entry, filters));
        return applySort(filtered, sort)
          .slice(start, start + limit)
          .map((entry) => pickFields(status === 'published' ? entry : { ...entry, publishedAt: null }, fields));
      },
      async findOne({ documentId, fields, status = 'draft' } = {}) {
        calls.push({ uid, method: 'findOne', documentId, fields, status });
        const entry = rowsOf(uid).find((row) => row.documentId === documentId);
        if (!entry) return null;
        if (status === 'published' && entry.publishedAt == null) return null;
        return pickFields(status === 'published' ? entry : { ...entry, publishedAt: null }, fields);
      },
      async count({ filters } = {}) {
        calls.push({ uid, method: 'count', filters });
        return rowsOf(uid).filter((entry) => matchFilters(entry, filters)).length;
      },
      async create({ data } = {}) {
        calls.push({ uid, method: 'create', data });
        autoId += 1;
        const entry = {
          id: autoId,
          documentId: `doc-${autoId}`,
          createdAt: '2026-02-01T00:00:00.000Z',
          updatedAt: '2026-02-01T00:00:00.000Z',
          publishedAt: null,
          ...data,
        };
        rowsOf(uid).push(entry);
        return { ...entry };
      },
      async update({ documentId, data } = {}) {
        calls.push({ uid, method: 'update', documentId, data });
        const entry = rowsOf(uid).find((row) => row.documentId === documentId);
        if (!entry) throw new Error(`Không có bản ghi ${documentId}`);
        Object.assign(entry, data, { updatedAt: '2026-02-02T00:00:00.000Z' });
        return { ...entry };
      },
      async delete({ documentId } = {}) {
        calls.push({ uid, method: 'delete', documentId });
        const rows = rowsOf(uid);
        const index = rows.findIndex((row) => row.documentId === documentId);
        if (index >= 0) rows.splice(index, 1);
        return { documentId };
      },
      async publish({ documentId } = {}) {
        calls.push({ uid, method: 'publish', documentId });
        const entry = rowsOf(uid).find((row) => row.documentId === documentId);
        if (entry) entry.publishedAt = '2026-02-03T00:00:00.000Z';
        return entry ? { ...entry } : null;
      },
      async unpublish({ documentId } = {}) {
        calls.push({ uid, method: 'unpublish', documentId });
        const entry = rowsOf(uid).find((row) => row.documentId === documentId);
        if (entry) entry.publishedAt = null;
        return entry ? { ...entry } : null;
      },
    };
  }

  return {
    documents,
    db: { query: () => ({ findOne: async () => null }) },
    __store: store,
    __calls: calls,
    __rows: rowsOf,
  };
}

function withStrapi(fake, run) {
  const previous = global.strapi;
  global.strapi = fake;
  try {
    return run();
  } finally {
    global.strapi = previous;
  }
}

module.exports = {
  COOKIE_NAME,
  buildCtx,
  signSession,
  validSessionToken,
  createFakeStrapi,
  withStrapi,
};
