'use strict';

// Quét các trường hợp biên của phiên đăng nhập admin: cookie giả, cookie hết
// hạn, đăng nhập sai, và kiểm tra nguồn yêu cầu (chống CSRF).
process.env.ADMIN_UI_SESSION_SECRET = 'test-secret-admin-ui';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const auth = require('../dha-cms/src/api/admin-ui/services/auth');
const { buildCtx, signSession, COOKIE_NAME } = require('./helpers/admin-ui-harness');

function fakeStrapiWithUser(user, { passwordOk = true } = {}) {
  return {
    db: { query: () => ({ findOne: async ({ where }) => (user && where.email === user.email && where.isActive ? user : null) }) },
    admin: { services: { user: { validatePassword: async () => passwordOk } } },
  };
}

test.beforeEach(() => {
  global.strapi = undefined;
});

// --- phiên đăng nhập ---------------------------------------------------------

test('cookie không có thì mọi endpoint đòi phiên đều trả 401', async () => {
  const ctx = buildCtx({ cookie: null });
  assert.equal(await auth.requireSession(ctx), null);
  assert.equal(ctx.status, 401);
  assert.equal(ctx.body.error.code, 'UNAUTHENTICATED');
});

test('cookie bị sửa chữ ký hoặc sai định dạng đều bị từ chối', async () => {
  const valid = signSession({ sub: 1, email: 'a@b.vn', exp: Date.now() + 60_000 });
  const [body] = valid.split('.');

  const badTokens = [
    `${body}.chu-ky-gia`,
    body,
    `${body}.a.b`,
    '..',
    'khong-phai-token',
    `${Buffer.from('khong-phai-json').toString('base64url')}.${crypto
      .createHmac('sha256', process.env.ADMIN_UI_SESSION_SECRET)
      .update(Buffer.from('khong-phai-json').toString('base64url'))
      .digest('base64url')}`,
  ];

  for (const token of badTokens) {
    const ctx = buildCtx({ cookie: token });
    assert.equal(await auth.requireSession(ctx), null, `token phải bị từ chối: ${token}`);
    assert.equal(ctx.status, 401);
  }
});

test('cookie ký bằng khoá khác không vào được', async () => {
  const foreign = signSession({ sub: 1, exp: Date.now() + 60_000 }, 'khoa-khac');
  const ctx = buildCtx({ cookie: foreign });
  assert.equal(await auth.requireSession(ctx), null);
  assert.equal(ctx.status, 401);
});

test('phiên hết hạn hoặc không có hạn dùng đều bị từ chối', async () => {
  for (const payload of [
    { sub: 1, exp: Date.now() - 1 },
    { sub: 1 },
    { sub: 1, exp: 'mai-mai' },
    { sub: 1, exp: Number.POSITIVE_INFINITY },
  ]) {
    const ctx = buildCtx({ cookie: signSession(payload) });
    assert.equal(await auth.requireSession(ctx), null, `payload phải bị từ chối: ${JSON.stringify(payload)}`);
  }
});

test('phiên hợp lệ được gắn vào ctx.state cho các service dùng lại', async () => {
  const ctx = buildCtx();
  const payload = await auth.requireSession(ctx);
  assert.ok(payload);
  assert.equal(ctx.state.adminUiUser.email, 'admin@dha.vn');
});

test('me chỉ trả thông tin công khai, không lộ dữ liệu khác trong token', async () => {
  const ctx = buildCtx({ cookie: signSession({ sub: 7, email: 'a@b.vn', firstname: 'A', lastname: 'B', role: 'super', exp: Date.now() + 60_000 }) });
  await auth.me(ctx);
  assert.deepEqual(ctx.body.user, { id: 7, email: 'a@b.vn', firstname: 'A', lastname: 'B' });
});

// --- đăng nhập ---------------------------------------------------------------

test('đăng nhập thiếu email hoặc mật khẩu trả lỗi 400 chứ không đụng tới CSDL', async () => {
  global.strapi = fakeStrapiWithUser(null);
  for (const body of [{}, { email: 'a@b.vn' }, { password: 'x' }, { email: '', password: '' }]) {
    const ctx = buildCtx({ body, cookie: null });
    await auth.login(ctx);
    assert.equal(ctx.status, 400, `body ${JSON.stringify(body)} phải bị chặn`);
    assert.equal(ctx.body.error.code, 'VALIDATION_ERROR');
  }
});

test('đăng nhập body rỗng (không phải object) không làm sập server', async () => {
  global.strapi = fakeStrapiWithUser(null);
  const ctx = buildCtx({ body: null, cookie: null });
  await auth.login(ctx);
  assert.equal(ctx.status, 400);
});

test('email không tồn tại và mật khẩu sai trả về cùng một thông báo', async () => {
  const user = { id: 1, email: 'admin@dha.vn', password: 'hash', firstname: 'A', lastname: 'B' };

  global.strapi = fakeStrapiWithUser(null);
  const unknown = buildCtx({ body: { email: 'lam@dha.vn', password: 'x' }, cookie: null });
  await auth.login(unknown);

  global.strapi = fakeStrapiWithUser(user, { passwordOk: false });
  const wrongPassword = buildCtx({ body: { email: 'admin@dha.vn', password: 'sai' }, cookie: null });
  await auth.login(wrongPassword);

  assert.equal(unknown.status, 401);
  assert.equal(wrongPassword.status, 401);
  assert.equal(unknown.body.error.message, wrongPassword.body.error.message);
});

test('email viết hoa hay dư khoảng trắng vẫn đăng nhập được', async () => {
  const user = { id: 1, email: 'admin@dha.vn', password: 'hash', firstname: 'A', lastname: 'B' };
  global.strapi = fakeStrapiWithUser(user);
  const ctx = buildCtx({ body: { email: '  ADMIN@DHA.VN ', password: 'dung' }, cookie: null });
  await auth.login(ctx);
  assert.equal(ctx.status, 200);
  assert.equal(ctx.body.user.email, 'admin@dha.vn');
});

test('cookie phiên là httpOnly và có hạn dùng', async () => {
  const user = { id: 1, email: 'admin@dha.vn', password: 'hash' };
  global.strapi = fakeStrapiWithUser(user);
  const ctx = buildCtx({ body: { email: 'admin@dha.vn', password: 'dung' }, cookie: null });
  await auth.login(ctx);

  const written = ctx.setCookies.find((entry) => entry.name === COOKIE_NAME);
  assert.ok(written, 'có ghi cookie phiên');
  assert.equal(written.options.httpOnly, true);
  assert.ok(written.options.maxAge > 0);
  assert.equal(written.options.path, '/');
});

test('đăng xuất xoá cookie kể cả khi phiên đã hỏng', async () => {
  const ctx = buildCtx({ cookie: 'rac' });
  await auth.logout(ctx);
  const written = ctx.setCookies.find((entry) => entry.name === COOKIE_NAME);
  assert.equal(written.value, null);
  assert.equal(written.options.maxAge, 0);
  assert.deepEqual(ctx.body, { ok: true });
});

// --- kiểm tra nguồn yêu cầu (CSRF) ------------------------------------------

test('yêu cầu ghi từ trang lạ bị chặn, kể cả khi không gửi Origin', async () => {
  for (const headers of [
    { origin: 'https://ke-tan-cong.example' },
    { origin: 'null' },
    { origin: 'http://localhost:3001' },
    { origin: undefined },
  ]) {
    const ctx = buildCtx({ origin: headers.origin === undefined ? null : headers.origin });
    assert.equal(auth.requireTrustedOrigin(ctx), false, `origin ${headers.origin} phải bị chặn`);
    assert.equal(ctx.status, 403);
    assert.equal(ctx.body.error.code, 'CSRF_ORIGIN');
  }
});

test('origin mặc định của môi trường phát triển được chấp nhận', () => {
  for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3000']) {
    const ctx = buildCtx({ origin });
    assert.equal(auth.requireTrustedOrigin(ctx), true, origin);
  }
});

test('không có Origin thì lấy Referer, và chỉ so phần gốc', () => {
  const ok = buildCtx({ origin: null, referer: 'http://localhost:3000/admin/news?x=1' });
  assert.equal(auth.requireTrustedOrigin(ok), true);

  const bad = buildCtx({ origin: null, referer: 'http://localhost:3000.ke-tan-cong.example/admin' });
  assert.equal(auth.requireTrustedOrigin(bad), false);
});

test('origin cấu hình qua biến môi trường được nhận, có hay không dấu / cuối', () => {
  const previous = process.env.ADMIN_UI_ALLOWED_ORIGINS;
  process.env.ADMIN_UI_ALLOWED_ORIGINS = 'https://dhacan.vn/, https://www.dhacan.vn';
  try {
    for (const origin of ['https://dhacan.vn', 'https://www.dhacan.vn']) {
      assert.equal(auth.requireTrustedOrigin(buildCtx({ origin })), true, origin);
    }
    assert.equal(auth.requireTrustedOrigin(buildCtx({ origin: 'https://dhacan.vn.ke-tan-cong.example' })), false);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_UI_ALLOWED_ORIGINS;
    else process.env.ADMIN_UI_ALLOWED_ORIGINS = previous;
  }
});
