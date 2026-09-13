'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createRateLimit } = require('../dha-api/src/http/rate-limit');

function ctxFor(ip, path = '/api/contact-inquiries') {
  return { request: { ip }, path, status: 200, body: undefined };
}

async function hit(limit, ctx) {
  let passed = false;
  await limit(ctx, async () => {
    passed = true;
  });
  return passed;
}

test('cho qua đúng max lượt rồi trả 429 theo định dạng lỗi của Strapi', async () => {
  const limit = createRateLimit({ windowMs: 1000, max: 5 });
  for (let i = 0; i < 5; i += 1) {
    assert.equal(await hit(limit, ctxFor('1.1.1.1')), true, `lượt ${i + 1} được qua`);
  }
  const blocked = ctxFor('1.1.1.1');
  assert.equal(await hit(limit, blocked), false);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error.name, 'TooManyRequestsError');
});

test('mỗi IP và mỗi đường dẫn có bộ đếm riêng', async () => {
  const limit = createRateLimit({ windowMs: 1000, max: 1 });
  assert.equal(await hit(limit, ctxFor('1.1.1.1')), true);
  assert.equal(await hit(limit, ctxFor('2.2.2.2')), true, 'IP khác không bị ảnh hưởng');
  assert.equal(await hit(limit, ctxFor('1.1.1.1', '/api/order-requests')), true, 'đường dẫn khác không bị ảnh hưởng');
  assert.equal(await hit(limit, ctxFor('1.1.1.1')), false);
});

test('hết cửa sổ thời gian thì được gửi lại', async () => {
  let clock = 0;
  const limit = createRateLimit({ windowMs: 1000, max: 1, now: () => clock });
  assert.equal(await hit(limit, ctxFor('1.1.1.1')), true);
  assert.equal(await hit(limit, ctxFor('1.1.1.1')), false);
  clock = 1001;
  assert.equal(await hit(limit, ctxFor('1.1.1.1')), true);
});
