'use strict';

process.env.ADMIN_UI_SESSION_SECRET = 'test-secret-admin-ui';

const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('../dha-api/node_modules/bcryptjs');

const users = require('../dha-api/scripts/lib/admin-user');
const auth = require('../dha-api/src/services/auth');
const { createSanityStore } = require('../dha-api/src/sanity/store');
const { setStore } = require('../dha-api/src/sanity/store-registry');
const { createFakeSanityClient } = require('./helpers/fake-sanity-client');
const { buildCtx } = require('./helpers/admin-ui-harness');

const FAST = { cost: 4 };

function freshStore() {
  const client = createFakeSanityClient();
  return { client, store: createSanityStore({ client }) };
}

async function tryLogin(store, email, password) {
  setStore(store);
  const ctx = buildCtx({ body: { email, password }, cookie: null });
  await auth.login(ctx);
  setStore(null);
  return ctx.status;
}

test('tạo tài khoản: email chuẩn hoá, id có dấu chấm, hash bcrypt, đăng nhập được', async () => {
  const { client, store } = freshStore();
  const user = await users.createAdminUser(store, { email: '  Admin@DHA.vn ', password: 'mat-khau-dai', firstname: 'Quản' }, FAST);

  assert.match(user.documentId, /^adminUser\./);
  const raw = client.docs.get(user.documentId);
  assert.equal(raw.email, 'admin@dha.vn');
  assert.equal(raw.isActive, true);
  assert.ok(bcrypt.compareSync('mat-khau-dai', raw.passwordHash));
  assert.ok(!JSON.stringify(raw).includes('mat-khau-dai'), 'không lưu mật khẩu thô');
  assert.equal(await tryLogin(store, 'admin@dha.vn', 'mat-khau-dai'), 200);
});

test('không tạo trùng email, không nhận mật khẩu ngắn hay email sai', async () => {
  const { store } = freshStore();
  await users.createAdminUser(store, { email: 'a@dha.vn', password: 'mat-khau-dai' }, FAST);
  await assert.rejects(users.createAdminUser(store, { email: 'A@dha.vn', password: 'mat-khau-dai' }, FAST), /Đã có tài khoản/);
  await assert.rejects(users.createAdminUser(store, { email: 'b@dha.vn', password: 'ngan' }, FAST), /ít nhất 8/);
  await assert.rejects(users.createAdminUser(store, { email: 'khong-phai-email', password: 'mat-khau-dai' }, FAST), /Email không hợp lệ/);
});

test('đổi mật khẩu: mật khẩu cũ hết tác dụng', async () => {
  const { store } = freshStore();
  await users.createAdminUser(store, { email: 'a@dha.vn', password: 'mat-khau-cu-1' }, FAST);
  await users.setPassword(store, { email: 'a@dha.vn', password: 'mat-khau-moi-2' }, FAST);
  assert.equal(await tryLogin(store, 'a@dha.vn', 'mat-khau-cu-1'), 401);
  assert.equal(await tryLogin(store, 'a@dha.vn', 'mat-khau-moi-2'), 200);
  await assert.rejects(users.setPassword(store, { email: 'x@dha.vn', password: 'mat-khau-moi-2' }, FAST), /Không có tài khoản/);
});

test('khoá tài khoản thì không đăng nhập được; mở lại thì được', async () => {
  const { store } = freshStore();
  await users.createAdminUser(store, { email: 'a@dha.vn', password: 'mat-khau-dai' }, FAST);
  await users.setActive(store, { email: 'a@dha.vn', isActive: false });
  assert.equal(await tryLogin(store, 'a@dha.vn', 'mat-khau-dai'), 401);
  await users.setActive(store, { email: 'a@dha.vn', isActive: true });
  assert.equal(await tryLogin(store, 'a@dha.vn', 'mat-khau-dai'), 200);
});
