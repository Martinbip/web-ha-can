'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { matchesFilters, sortEntries, pickFields } = require('../dha-api/src/sanity/query-engine');

const ROW = { title: 'Giá ĐỒNG tăng mạnh', category: 'gia-ca', views: 10, image: null, createdAt: '2026-03-05T00:00:00.000Z' };

test('giá trị trần và $eq so bằng tuyệt đối', () => {
  assert.equal(matchesFilters(ROW, { category: 'gia-ca' }), true);
  assert.equal(matchesFilters(ROW, { category: { $eq: 'gia-ca' } }), true);
  assert.equal(matchesFilters(ROW, { views: { $eq: '10' } }), false, 'không ép kiểu');
});

test('$containsi không phân biệt hoa thường, kể cả chữ tiếng Việt có dấu', () => {
  assert.equal(matchesFilters(ROW, { title: { $containsi: 'giá đồng' } }), true);
  assert.equal(matchesFilters(ROW, { title: { $containsi: 'nhôm' } }), false);
  assert.equal(matchesFilters(ROW, { image: { $containsi: 'x' } }), false, 'null coi như chuỗi rỗng');
});

test('$contains phân biệt hoa thường', () => {
  assert.equal(matchesFilters(ROW, { title: { $contains: 'ĐỒNG' } }), true);
  assert.equal(matchesFilters(ROW, { title: { $contains: 'đồng' } }), false);
});

test('$in, $null, $gte', () => {
  assert.equal(matchesFilters(ROW, { category: { $in: ['quoc-te', 'gia-ca'] } }), true);
  assert.equal(matchesFilters(ROW, { category: { $in: 'gia-ca' } }), false, '$in cần mảng');
  assert.equal(matchesFilters(ROW, { image: { $null: true } }), true);
  assert.equal(matchesFilters(ROW, { title: { $null: true } }), false);
  assert.equal(matchesFilters(ROW, { image: { $null: false } }), false);
  assert.equal(matchesFilters(ROW, { createdAt: { $gte: new Date('2026-03-01') } }), true, 'nhận cả Date');
  assert.equal(matchesFilters(ROW, { createdAt: { $gte: '2026-04-01' } }), false);
  assert.equal(matchesFilters(ROW, { image: { $gte: '2020-01-01' } }), false, 'null không lớn hơn gì');
});

test('$or / $and lồng nhau; $or rỗng không khớp gì', () => {
  assert.equal(matchesFilters(ROW, { $or: [{ category: 'quoc-te' }, { title: { $containsi: 'đồng' } }] }), true);
  assert.equal(matchesFilters(ROW, { $and: [{ category: 'gia-ca' }, { views: 11 }] }), false);
  assert.equal(matchesFilters(ROW, { $or: [] }), false);
  assert.equal(matchesFilters(ROW, {}), true);
  assert.equal(matchesFilters(ROW, undefined), true);
});

test('toán tử lạ là lỗi lập trình, không được lặng lẽ bỏ qua', () => {
  assert.throws(() => matchesFilters(ROW, { views: { $lt: 5 } }), /Toán tử lọc không hỗ trợ: \$lt/);
  assert.throws(() => matchesFilters(ROW, { $not: {} }), /Toán tử lọc không hỗ trợ: \$not/);
});

test('sắp xếp nhiều khoá, null đứng đầu khi tăng dần, không đổi mảng gốc', () => {
  const rows = [
    { name: 'B', order: 2 },
    { name: 'A', order: 2 },
    { name: 'C', order: null },
    { name: 'D', order: 1 },
  ];
  const copy = rows.slice();
  assert.deepEqual(sortEntries(rows, [{ order: 'asc' }, { name: 'asc' }]).map((r) => r.name), ['C', 'D', 'A', 'B']);
  assert.deepEqual(sortEntries(rows, { order: 'desc' }).map((r) => r.name), ['B', 'A', 'D', 'C'], 'ổn định khi bằng nhau');
  assert.deepEqual(sortEntries(rows, undefined).map((r) => r.name), ['B', 'A', 'C', 'D']);
  assert.deepEqual(rows, copy);
});

test('pickFields luôn giữ id + documentId', () => {
  const entry = { id: 'x', documentId: 'x', title: 'T', secret: 's' };
  assert.deepEqual(pickFields(entry, ['title']), { id: 'x', documentId: 'x', title: 'T' });
  assert.deepEqual(pickFields(entry, []), entry);
  assert.notEqual(pickFields(entry), entry, 'trả bản sao');
});
