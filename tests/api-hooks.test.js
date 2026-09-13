'use strict';

process.env.ADMIN_UI_SESSION_SECRET = 'test-secret-admin-ui';

const assert = require('node:assert/strict');
const test = require('node:test');

const resources = require('../dha-api/src/services/resources');
const prerender = require('../dha-api/src/hooks/prerender');
const { setStore } = require('../dha-api/src/sanity/store-registry');
const { buildCtx, createFakeStore } = require('./helpers/admin-ui-harness');

test.afterEach(() => setStore(null));

function use(seed) {
  const fake = createFakeStore(seed);
  setStore(fake);
  return fake;
}

test('admin đổi mã danh mục thì sản phẩm đi theo mã mới', async () => {
  const fake = use({
    productCategory: [{ documentId: 'cat-1', name: 'Kim loại màu', slug: 'color-metal' }],
    product: [
      { documentId: 'p1', name: 'Đồng', categories: ['color-metal', 'rare-earth'] },
      { documentId: 'p2', name: 'Sắt', categories: ['black-metal'] },
    ],
  });
  const ctx = buildCtx({ params: { type: 'product-categories', id: 'cat-1' }, body: { data: { slug: 'kim-loai-mau' } } });
  await resources.update(ctx);

  assert.equal(ctx.status, 200);
  assert.deepEqual(fake.__rows('product')[0].categories, ['kim-loai-mau', 'rare-earth']);
  assert.deepEqual(fake.__rows('product')[1].categories, ['black-metal']);
});

test('admin xoá danh mục thì mã của nó được gỡ khỏi sản phẩm', async () => {
  const fake = use({
    productCategory: [{ documentId: 'cat-1', name: 'Đất hiếm', slug: 'rare-earth' }],
    product: [{ documentId: 'p1', name: 'Đồng', categories: ['color-metal', 'rare-earth'] }],
  });
  const ctx = buildCtx({ params: { type: 'product-categories', id: 'cat-1' } });
  await resources.delete(ctx);

  assert.deepEqual(ctx.body, { ok: true });
  assert.deepEqual(fake.__rows('product')[0].categories, ['color-metal']);
});

test('sửa danh mục mà không đổi mã thì không đụng tới sản phẩm', async () => {
  const fake = use({
    productCategory: [{ documentId: 'cat-1', name: 'A', slug: 'color-metal' }],
    product: [{ documentId: 'p1', name: 'Đồng', categories: ['color-metal'] }],
  });
  await resources.update(buildCtx({ params: { type: 'product-categories', id: 'cat-1' }, body: { data: { name: 'B' } } }));
  assert.ok(!fake.__calls.some((call) => call.type === 'product' && call.method === 'update'));
});

test('lưu cài đặt website — lần đầu tạo hay các lần sửa — đều chạy prerender', async (t) => {
  const calls = t.mock.method(prerender, 'schedulePrerender', () => true);
  use({ siteSetting: [] });

  await resources.update(buildCtx({ params: { type: 'site-setting', id: 'null' }, body: { data: { hotline: '0900' } } }));
  assert.equal(calls.mock.callCount(), 1, 'tạo bản ghi đầu tiên');

  await resources.update(buildCtx({ params: { type: 'site-setting', id: 'null' }, body: { data: { hotline: '0911' } } }));
  assert.equal(calls.mock.callCount(), 2, 'sửa bản ghi đã có');
});

test('module khác không kích hoạt hook nào', async (t) => {
  const calls = t.mock.method(prerender, 'schedulePrerender', () => true);
  use({ news: [] });
  await resources.create(buildCtx({ params: { type: 'news' }, body: { data: { title: 'A', slug: 'a' } } }));
  assert.equal(calls.mock.callCount(), 0);
});
