'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Koa = require('../dha-api/node_modules/koa');

const { createPublicRouter } = require('../dha-api/src/routes/public');
const { createSanityStore } = require('../dha-api/src/sanity/store');
const { setStore } = require('../dha-api/src/sanity/store-registry');
const { createFakeSanityClient } = require('./helpers/fake-sanity-client');
const { startServer } = require('./helpers/http');

const DOCS = [
  { _id: 'n1', _type: 'news', title: 'Cũ', slug: 'cu', date: '2026-01-01', createdAt: '2026-01-01T00:00:00.000Z', publishedAt: '2026-01-01T01:00:00.000Z' },
  { _id: 'n2', _type: 'news', title: 'Mới', slug: 'moi', date: '2026-02-01', category: 'gia-ca', createdAt: '2026-02-01T00:00:00.000Z', publishedAt: '2026-02-01T01:00:00.000Z' },
  { _id: 'drafts.n2', _type: 'news', title: 'Mới (đang sửa)', slug: 'moi', date: '2026-02-01' },
  { _id: 'drafts.n3', _type: 'news', title: 'Chỉ là nháp', slug: 'nhap', date: '2026-03-01' },
  { _id: 'p1', _type: 'product', name: 'Đồng tấm', sort_order: 2, createdAt: '2026-01-01T00:00:00.000Z', publishedAt: '2026-01-01T00:00:00.000Z' },
  { _id: 'siteSetting', _type: 'siteSetting', hotline: '0900', createdAt: '2026-01-01T00:00:00.000Z', publishedAt: '2026-01-01T00:00:00.000Z' },
  { _id: 'c1', _type: 'contactInquiry', name: 'Khách', phone: '0900000000' },
  { _id: 'adminUser.u1', _type: 'adminUser', email: 'admin@dha.vn', passwordHash: '$2a$10$x' },
];

let server;

test.before(async () => {
  setStore(createSanityStore({ client: createFakeSanityClient(DOCS) }));
  const app = new Koa();
  app.use(createPublicRouter().routes());
  server = await startServer(app);
});

test.after(async () => {
  await server.close();
  setStore(null);
});

async function get(path) {
  const res = await fetch(`${server.url}${path}`);
  return { status: res.status, body: res.status === 404 && !res.headers.get('content-type')?.includes('json') ? null : await res.json() };
}

test('danh sách tin tức: chỉ bản đã xuất bản, đúng thứ tự, meta dạng offset', async () => {
  const { status, body } = await get('/api/news-articles?pagination[limit]=100&sort=date:desc');
  assert.equal(status, 200);
  assert.deepEqual(body.data.map((row) => row.title), ['Mới', 'Cũ'], 'bản nháp đang sửa và bài chưa xuất bản không lộ ra');
  assert.deepEqual(body.meta, { pagination: { start: 0, limit: 100, total: 2 } });
});

test('entry phẳng như Strapi 5, không lộ trường hệ thống của Sanity', async () => {
  const { body } = await get('/api/news-articles?sort=date:desc');
  const [row] = body.data;
  assert.equal(row.id, 'n2');
  assert.equal(row.documentId, 'n2');
  assert.equal(row.createdAt, '2026-02-01T00:00:00.000Z');
  assert.equal(row.publishedAt, '2026-02-01T01:00:00.000Z');
  assert.equal(typeof row.updatedAt, 'string');
  for (const key of ['_id', '_type', '_rev', '_createdAt', '_updatedAt', 'attributes']) {
    assert.ok(!(key in row), `không có ${key}`);
  }
  assert.deepEqual(body.meta, { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 2 } });
});

test('tham số status=draft bị bỏ qua — web không bao giờ thấy nháp', async () => {
  const { body } = await get('/api/news-articles?status=draft');
  assert.ok(!body.data.some((row) => /nháp|đang sửa/.test(row.title)));
});

test('bộ lọc và type không có nháp', async () => {
  assert.deepEqual((await get('/api/news-articles?filters[category][$eq]=gia-ca')).body.data.map((r) => r.slug), ['moi']);
  assert.deepEqual((await get('/api/products?sort=sort_order:asc&pagination[limit]=500')).body.data.map((r) => r.name), ['Đồng tấm']);
});

test('một bản ghi theo documentId: đã xuất bản thì trả, chỉ có nháp thì 404', async () => {
  const found = await get('/api/news-articles/n2');
  assert.equal(found.status, 200);
  assert.equal(found.body.data.title, 'Mới');

  const draftOnly = await get('/api/news-articles/n3');
  assert.equal(draftOnly.status, 404);
  assert.equal(draftOnly.body.error.name, 'NotFoundError');
});

test('singleton: có bản ghi thì trả, chưa có thì 404', async () => {
  const setting = await get('/api/site-setting');
  assert.equal(setting.status, 200);
  assert.equal(setting.body.data.hotline, '0900');
  assert.equal((await get('/api/navigation')).status, 404);
});

test('dữ liệu riêng tư không đọc được qua API công khai', async () => {
  for (const path of ['/api/contact-inquiries', '/api/order-requests', '/api/adminUser', '/api/admin-users', '/api/contact-inquiries/c1']) {
    const { status } = await get(path);
    assert.equal(status, 404, path);
  }
});

test('query sai trả 400 ValidationError', async () => {
  const { status, body } = await get('/api/news-articles?sort=title;drop');
  assert.equal(status, 400);
  assert.equal(body.error.name, 'ValidationError');
});