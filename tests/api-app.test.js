'use strict';

process.env.ADMIN_UI_SESSION_SECRET = 'test-secret-admin-ui';

const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('../dha-api/node_modules/bcryptjs');

const { createApp } = require('../dha-api/src/app');
const { assertDatasetPrivate } = require('../dha-api/src/sanity/client');
const { createSanityStore } = require('../dha-api/src/sanity/store');
const { setStore } = require('../dha-api/src/sanity/store-registry');
const { createFakeSanityClient } = require('./helpers/fake-sanity-client');
const { startServer } = require('./helpers/http');

const ADMIN_DOC = {
  _id: 'adminUser.u1',
  _type: 'adminUser',
  email: 'admin@dha.vn',
  passwordHash: bcrypt.hashSync('mat-khau-dung', 4),
  isActive: true,
  firstname: 'Quản',
  lastname: 'Trị',
};
const SILENT = { info() {}, error() {} };

async function boot({ store, config = {} } = {}) {
  const client = createFakeSanityClient([ADMIN_DOC]);
  const app = createApp({
    store: store || createSanityStore({ client }),
    config: { isBehindProxy: false, frontendUrl: null, ...config },
    logger: SILENT,
  });
  return { client, server: await startServer(app) };
}

async function call(server, path, { method = 'GET', body, cookie, origin = 'http://localhost:3000', headers = {} } = {}) {
  const res = await fetch(`${server.url}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(origin ? { Origin: origin } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

async function login(server) {
  const res = await call(server, '/api/admin-ui/auth/login', {
    method: 'POST',
    body: { email: 'admin@dha.vn', password: 'mat-khau-dung' },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.headers.getSetCookie()[0].split(';')[0];
}

test.after(() => setStore(null));

test('luồng biên tập đầy đủ: đăng nhập → tạo → web thấy → sửa → gỡ xuất bản', async (t) => {
  const { server } = await boot();
  t.after(() => server.close());
  const cookie = await login(server);

  assert.equal((await call(server, '/api/admin-ui/auth/me', { cookie })).body.user.email, 'admin@dha.vn');

  const created = await call(server, '/api/admin-ui/resources/news', {
    method: 'POST',
    cookie,
    body: { data: { title: 'Giá đồng tăng', slug: 'gia-dong-tang', summary: 'Tóm tắt', content: '<p>x</p>', category: 'gia-ca', date: '2026-09-13' } },
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const id = created.body.data.documentId;

  const list = await call(server, '/api/news-articles?sort=date:desc&pagination[limit]=100', { origin: null });
  assert.deepEqual(list.body.data.map((row) => row.title), ['Giá đồng tăng'], 'bấm Lưu là lên web');

  await call(server, `/api/admin-ui/resources/news/${id}`, { method: 'PUT', cookie, body: { data: { title: 'Giá đồng tăng mạnh' } } });
  assert.equal((await call(server, `/api/news-articles/${id}`)).body.data.title, 'Giá đồng tăng mạnh', 'sửa xong web đổi ngay, không đợi cache');

  await call(server, `/api/admin-ui/resources/news/${id}/unpublish`, { method: 'POST', cookie });
  assert.equal((await call(server, `/api/news-articles/${id}`)).status, 404);
  assert.equal((await call(server, `/api/admin-ui/resources/news/${id}`, { cookie })).status, 200, 'admin vẫn thấy bài đã gỡ');
});

test('route admin-ui không bị route công khai /api/:collection/:id nuốt mất', async (t) => {
  const { server } = await boot();
  t.after(() => server.close());
  const res = await call(server, '/api/admin-ui/meta');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'UNAUTHENTICATED');
});

test('đường dẫn /api lạ trả 404 JSON dạng Strapi', async (t) => {
  const { server } = await boot();
  t.after(() => server.close());
  for (const path of ['/api/khong-co', '/api/admin-ui/khong-co', '/api/news-articles/a/b']) {
    const res = await call(server, path);
    assert.equal(res.status, 404, path);
    assert.equal(res.body.error.name, 'NotFoundError', path);
  }
});

test('CORS chỉ mở cho đúng origin, không bao giờ cho Origin: null', async (t) => {
  const { server } = await boot({ config: { frontendUrl: 'https://dhakimloaimau.vn' } });
  t.after(() => server.close());

  const allowed = await call(server, '/api/news-articles', { method: 'OPTIONS', origin: 'https://dhakimloaimau.vn' });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://dhakimloaimau.vn');
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');

  for (const origin of ['https://dhakimloaimau.vn.ke-gian.example', 'null', 'https://ke-gian.example']) {
    const res = await call(server, '/api/news-articles', { origin });
    assert.equal(res.headers.get('access-control-allow-origin'), null, origin);
  }
});

test('sau nginx: rate limit đăng nhập tính theo IP thật của khách', async (t) => {
  const { server } = await boot({ config: { isBehindProxy: true } });
  t.after(() => server.close());
  const attempt = (ip) => call(server, '/api/admin-ui/auth/login', {
    method: 'POST',
    body: { email: 'admin@dha.vn', password: 'sai' },
    headers: { 'X-Forwarded-For': ip },
  });

  for (let i = 0; i < 5; i += 1) assert.equal((await attempt('1.1.1.1')).status, 401);
  assert.equal((await attempt('1.1.1.1')).status, 429);
  assert.equal((await attempt('2.2.2.2')).status, 401, 'khách khác không bị khoá lây');
});

test('lỗi nội bộ trả 500 chung chung, không lộ chi tiết', async (t) => {
  const broken = { documents() { throw new Error('chi tiết bí mật nội bộ'); } };
  const { server } = await boot({ store: broken });
  t.after(() => server.close());
  const res = await call(server, '/api/news-articles');
  assert.equal(res.status, 500);
  assert.equal(res.body.error.name, 'InternalServerError');
  assert.ok(!JSON.stringify(res.body).includes('bí mật'));
});

test('body JSON quá 1MB bị chặn với 413', async (t) => {
  const { server } = await boot();
  t.after(() => server.close());
  const res = await call(server, '/api/contact-inquiries', { method: 'POST', body: { data: { message: 'x'.repeat(1024 * 1024 + 10) } } });
  assert.equal(res.status, 413);
});

test('upload multipart tới được bước kiểm tệp của media.js', async (t) => {
  const { server } = await boot();
  t.after(() => server.close());
  const cookie = await login(server);

  const form = new FormData();
  form.append('folder', 'dha/news');
  form.append('file', new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'a.svg');
  const res = await fetch(`${server.url}/api/admin-ui/media/upload`, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: 'http://localhost:3000' },
    body: form,
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'INVALID_FILE_TYPE');
});

// --- dataset private ---------------------------------------------------------

function clientReturning(result) {
  return () => ({ fetch: async () => (result instanceof Error ? Promise.reject(result) : result) });
}

test('dataset public (đọc được dữ liệu riêng tư không cần token) thì không khởi động', async () => {
  const config = { projectId: 'p', dataset: 'production', apiVersion: '2025-02-19' };
  await assert.rejects(assertDatasetPrivate(config, { makeClient: clientReturning(3) }), /public/);
  await assertDatasetPrivate(config, { makeClient: clientReturning(0) });
  await assertDatasetPrivate(config, { makeClient: clientReturning(Object.assign(new Error('Unauthorized'), { statusCode: 401 })) });
  await assert.rejects(
    assertDatasetPrivate(config, { makeClient: clientReturning(Object.assign(new Error('ECONNRESET'), { statusCode: undefined })) }),
    /ECONNRESET/,
  );
});
