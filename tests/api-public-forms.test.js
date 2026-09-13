'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Koa = require('../dha-api/node_modules/koa');
const { koaBody } = require('../dha-api/node_modules/koa-body');

const { validateAgainstSchema } = require('../dha-api/src/http/schema-validator');
const { createPublicRouter } = require('../dha-api/src/routes/public');
const { createSanityStore } = require('../dha-api/src/sanity/store');
const { setStore } = require('../dha-api/src/sanity/store-registry');
const contactSchema = require('../dha-api/src/schemas/contactInquiry.json');
const orderSchema = require('../dha-api/src/schemas/orderRequest.json');
const { createFakeSanityClient } = require('./helpers/fake-sanity-client');
const { startServer } = require('./helpers/http');

const CONTACT = { name: 'Nguyễn Văn A', phone: '0901 234 567', email: '', address: '12 Lê Lợi, Huế', service: 'phan-tich-lab', message: 'Cần báo giá' };
const ORDER = { product_name: 'Quặng đồng', product_uid: 'quang-dong', customer_name: 'Trần B', phone: '+84901234567', email: 'b@vi-du.vn', quantity: '2.5', unit: 'tan', note: '' };

// --- validate --------------------------------------------------------------

test('form liên hệ hợp lệ: bỏ email rỗng, ép trạng thái new', () => {
  const { data, errors } = validateAgainstSchema(contactSchema, { ...CONTACT, status: 'completed', hack: 1 }, { forced: { status: 'new' } });
  assert.deepEqual(errors, []);
  assert.equal(data.status, 'new', 'khách không tự đặt trạng thái được');
  assert.ok(!('email' in data), 'email rỗng không lưu');
  assert.ok(!('hack' in data), 'trường lạ bị bỏ');
  assert.equal(data.service, 'phan-tich-lab');
});

test('dịch vụ không gửi thì lấy mặc định của schema', () => {
  const { data } = validateAgainstSchema(contactSchema, { ...CONTACT, service: undefined }, { forced: { status: 'new' } });
  assert.equal(data.service, 'cung-cap-mau');
});

test('lỗi của form liên hệ theo đúng ràng buộc schema', () => {
  const cases = [
    [{ name: undefined }, /name/],
    [{ name: 'A' }, /name/],
    [{ phone: '123' }, /phone/],
    [{ phone: '0901-abc-567' }, /phone/],
    [{ email: 'khong-phai-email' }, /email/],
    [{ address: 'Huế' }, /address/],
    [{ service: 'hack' }, /service/],
    [{ message: 'x'.repeat(2001) }, /message/],
    [{ name: { $ne: '' } }, /name/],
  ];
  for (const [patch, pattern] of cases) {
    const { errors } = validateAgainstSchema(contactSchema, { ...CONTACT, ...patch }, { forced: { status: 'new' } });
    assert.ok(errors.some((error) => pattern.test(error)), `${JSON.stringify(patch)} → ${errors}`);
  }
});

test('đơn đặt mẫu: số lượng nhận chuỗi số, phải lớn hơn 0; đơn vị theo danh sách', () => {
  const ok = validateAgainstSchema(orderSchema, ORDER, { forced: { status: 'new' } });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.data.quantity, 2.5);
  assert.equal(ok.data.unit, 'tan');

  for (const patch of [{ quantity: 0 }, { quantity: 'nhiều' }, { quantity: '' }, { unit: 'thung' }]) {
    assert.ok(validateAgainstSchema(orderSchema, { ...ORDER, ...patch }, { forced: { status: 'new' } }).errors.length, JSON.stringify(patch));
  }
});

// --- HTTP ------------------------------------------------------------------

async function startApp() {
  const client = createFakeSanityClient();
  setStore(createSanityStore({ client }));
  const app = new Koa();
  app.use(koaBody());
  app.use(createPublicRouter().routes());
  const server = await startServer(app);
  return { client, server };
}

async function post(server, path, body) {
  const res = await fetch(`${server.url}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('gửi form liên hệ đúng dạng app.js thì lưu thành contactInquiry', async (t) => {
  const { client, server } = await startApp();
  t.after(() => server.close());

  const { status, body } = await post(server, '/api/contact-inquiries', { data: CONTACT });
  assert.equal(status, 200);
  assert.equal(body.data.status, 'new');

  const saved = [...client.docs.values()].filter((doc) => doc._type === 'contactInquiry');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].name, 'Nguyễn Văn A');
  assert.ok(!saved[0]._id.startsWith('drafts.'), 'không có nháp');
  assert.equal(typeof saved[0].createdAt, 'string', 'dashboard đếm theo createdAt');
});

test('gửi đơn đặt mẫu đúng dạng app.js thì lưu thành orderRequest', async (t) => {
  const { client, server } = await startApp();
  t.after(() => server.close());
  const { status } = await post(server, '/api/order-requests', { data: ORDER });
  assert.equal(status, 200);
  assert.equal([...client.docs.values()].filter((doc) => doc._type === 'orderRequest').length, 1);
});

test('dữ liệu sai trả 400 ValidationError và không ghi gì', async (t) => {
  const { client, server } = await startApp();
  t.after(() => server.close());
  const { status, body } = await post(server, '/api/contact-inquiries', { data: { ...CONTACT, phone: 'abc' } });
  assert.equal(status, 400);
  assert.equal(body.error.name, 'ValidationError');
  assert.ok(Array.isArray(body.error.details.errors));
  assert.equal(client.stats.commits, 0);
});

test('giới hạn tần suất: liên hệ 5 lượt, đặt mẫu 10 lượt mỗi 15 phút', async (t) => {
  const { server } = await startApp();
  t.after(() => server.close());

  for (let i = 0; i < 5; i += 1) assert.equal((await post(server, '/api/contact-inquiries', { data: CONTACT })).status, 200);
  assert.equal((await post(server, '/api/contact-inquiries', { data: CONTACT })).status, 429);

  for (let i = 0; i < 10; i += 1) assert.equal((await post(server, '/api/order-requests', { data: ORDER })).status, 200);
  assert.equal((await post(server, '/api/order-requests', { data: ORDER })).status, 429);
});

test.after(() => setStore(null));
