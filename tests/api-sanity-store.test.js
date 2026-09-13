'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createSanityStore } = require('../dha-api/src/sanity/store');
const { createTypeCache } = require('../dha-api/src/sanity/cache');
const { createFakeSanityClient } = require('./helpers/fake-sanity-client');
const { createFakeStore } = require('./helpers/admin-ui-harness');
const { runDocumentStoreContract } = require('./helpers/document-store-contract');

runDocumentStoreContract('harness', () => createFakeStore());
runDocumentStoreContract('sanity', () => createSanityStore({ client: createFakeSanityClient() }));

function setup(docs = []) {
  const client = createFakeSanityClient(docs);
  return { client, store: createSanityStore({ client }) };
}

// --- ngữ nghĩa riêng của Sanity/Strapi mà harness (một dòng mỗi bản ghi) không mô phỏng

test('sửa bài đã xuất bản chỉ ghi vào nháp; web giữ bản cũ tới khi xuất bản lại', async () => {
  const { client, store } = setup([
    { _id: 'a1', _type: 'news', title: 'Cũ', createdAt: '2026-01-01T00:00:00.000Z', publishedAt: '2026-01-02T00:00:00.000Z' },
  ]);
  const news = store.documents('news');
  await news.update({ documentId: 'a1', data: { title: 'Mới' } });

  assert.equal(client.docs.get('drafts.a1').title, 'Mới', 'nháp được tạo từ bản xuất bản rồi sửa');
  assert.equal(client.docs.get('drafts.a1').publishedAt, undefined, 'nháp không mang publishedAt');
  assert.equal((await news.findOne({ documentId: 'a1', status: 'published' })).title, 'Cũ');
  assert.equal((await news.findOne({ documentId: 'a1' })).title, 'Mới');
});

test('xuất bản thay bản cũ và xoá nháp trong cùng một transaction', async () => {
  const { client, store } = setup([
    { _id: 'a1', _type: 'news', title: 'Cũ', publishedAt: '2026-01-02T00:00:00.000Z' },
    { _id: 'drafts.a1', _type: 'news', title: 'Mới' },
  ]);
  const commitsBefore = client.stats.commits;
  await store.documents('news').publish({ documentId: 'a1' });
  assert.equal(client.stats.commits, commitsBefore + 1);
  assert.equal(client.docs.get('a1').title, 'Mới');
  assert.ok(!client.docs.has('drafts.a1'));
});

test('type không có nháp: tạo là lên web ngay, có publishedAt', async () => {
  const { client, store } = setup();
  const products = store.documents('product');
  const created = await products.create({ data: { name: 'Đồng tấm', uid: 'dong-tam' } });
  assert.ok(client.docs.has(created.documentId), 'ghi thẳng vào id xuất bản');
  const [row] = await products.findMany({ status: 'published' });
  assert.equal(row.name, 'Đồng tấm');
  assert.equal(typeof row.publishedAt, 'string');
});

test('singleton dùng id cố định; adminUser dùng id có dấu chấm', async () => {
  const { client, store } = setup();
  await store.documents('siteSetting').create({ data: { hotline: '0900' } });
  assert.ok(client.docs.has('siteSetting'));

  const user = await store.documents('adminUser').create({ data: { email: 'a@b.vn' } });
  assert.match(user.documentId, /^adminUser\.[a-z0-9]{24}$/);
});

test('id sinh mới cùng dạng documentId của Strapi 5', async () => {
  const { store } = setup();
  const { documentId } = await store.documents('news').create({ data: { title: 'A' } });
  assert.match(documentId, /^[a-z0-9]{24}$/);
});

test('người gọi không ghi đè được trường do store quản lý', async () => {
  const { client, store } = setup();
  const created = await store.documents('news').create({
    data: { title: 'A', _id: 'hack', _type: 'adminUser', id: 'x', documentId: 'x', createdAt: '1999-01-01', publishedAt: '1999-01-01' },
  });
  const raw = client.docs.get(`drafts.${created.documentId}`);
  assert.equal(raw._type, 'news');
  assert.notEqual(raw.createdAt, '1999-01-01');
  assert.equal(raw.publishedAt, undefined);
  assert.ok(!client.docs.has('hack'));
});

test('createdAt mang theo từ dữ liệu cũ được giữ nguyên', async () => {
  const { store } = setup([{ _id: 'c1', _type: 'contactInquiry', name: 'A', createdAt: '2025-12-31T10:00:00.000Z' }]);
  assert.equal((await store.documents('contactInquiry').findOne({ documentId: 'c1' })).createdAt, '2025-12-31T10:00:00.000Z');
});

test('document của Content Releases (versions.*) bị bỏ qua', async () => {
  const { store } = setup([
    { _id: 'a1', _type: 'news', title: 'A', publishedAt: '2026-01-01T00:00:00.000Z' },
    { _id: 'versions.r1.a1', _type: 'news', title: 'Bản phát hành' },
  ]);
  assert.equal(await store.documents('news').count({}), 1);
});

test('đọc lặp lại dùng cache; mỗi lượt ghi xoá cache', async () => {
  const { client, store } = setup([{ _id: 'p1', _type: 'product', name: 'A' }]);
  const products = store.documents('product');
  await products.findMany({});
  await products.findMany({});
  await products.count({});
  assert.equal(client.stats.fetches, 1, 'ba lần đọc, một lần gọi Sanity');

  await products.update({ documentId: 'p1', data: { name: 'B' } });
  assert.equal((await products.findOne({ documentId: 'p1' })).name, 'B', 'đọc sau khi ghi thấy dữ liệu mới');
});

test('cache hết hạn theo TTL và không giữ lỗi', async () => {
  let clock = 0;
  let calls = 0;
  let fail = true;
  const cache = createTypeCache({
    ttlMs: 1000,
    now: () => clock,
    load: async () => {
      calls += 1;
      if (fail) throw new Error('mạng lỗi');
      return new Map();
    },
  });
  await assert.rejects(cache.get('news'), /mạng lỗi/);
  fail = false;
  await cache.get('news');
  assert.equal(calls, 2, 'lỗi lần trước không bị cache');
  await cache.get('news');
  assert.equal(calls, 2);
  clock = 1001;
  await cache.get('news');
  assert.equal(calls, 3);
});

test('publish/unpublish trên type không có nháp là lỗi lập trình', async () => {
  const { store } = setup([{ _id: 'p1', _type: 'product', name: 'A' }]);
  await assert.rejects(store.documents('product').publish({ documentId: 'p1' }), /không có nháp/);
  await assert.rejects(store.documents('product').unpublish({ documentId: 'p1' }), /không có nháp/);
});

test('sửa bản ghi không tồn tại thì báo lỗi', async () => {
  const { store } = setup();
  await assert.rejects(store.documents('news').update({ documentId: 'x', data: { title: 'A' } }), /Không có bản ghi x/);
});
