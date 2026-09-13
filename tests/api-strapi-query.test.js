'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { parseStrapiQuery, buildMeta, QueryError } = require('../dha-api/src/http/strapi-query');

test('mọi chuỗi query mà app.js đang gửi đều đọc được', () => {
  const cases = [
    [{ sort: 'sort_order:asc', 'pagination[limit]': '100' }, [{ sort_order: 'asc' }], { mode: 'offset', start: 0, limit: 100 }],
    [{ sort: 'date:desc', 'pagination[limit]': '100' }, [{ date: 'desc' }], { mode: 'offset', start: 0, limit: 100 }],
    [{ sort: 'publishedAt:desc', 'pagination[limit]': '100' }, [{ publishedAt: 'desc' }], { mode: 'offset', start: 0, limit: 100 }],
    [{ 'pagination[limit]': '500' }, [], { mode: 'offset', start: 0, limit: 100 }],
    [{ 'pagination[pageSize]': '500', sort: 'date:desc' }, [{ date: 'desc' }], { mode: 'page', page: 1, pageSize: 100, start: 0, limit: 100 }],
  ];
  for (const [query, sort, pagination] of cases) {
    const parsed = parseStrapiQuery(query);
    assert.deepEqual(parsed.sort, sort, JSON.stringify(query));
    assert.deepEqual(parsed.pagination, pagination, JSON.stringify(query));
    assert.deepEqual(parsed.filters, {});
  }
});

test('mặc định 25 bản ghi, trang 1; limit=-1 nghĩa là tối đa', () => {
  assert.deepEqual(parseStrapiQuery({}).pagination, { mode: 'page', page: 1, pageSize: 25, start: 0, limit: 25 });
  assert.equal(parseStrapiQuery({ 'pagination[limit]': '-1' }).pagination.limit, 100);
  assert.equal(parseStrapiQuery({ 'pagination[limit]': 'abc' }).pagination.limit, 25);
  assert.deepEqual(
    parseStrapiQuery({ 'pagination[page]': '3', 'pagination[pageSize]': '10' }).pagination,
    { mode: 'page', page: 3, pageSize: 10, start: 20, limit: 10 },
  );
  assert.equal(parseStrapiQuery({ 'pagination[page]': '-4' }).pagination.page, 1);
  assert.equal(parseStrapiQuery({ 'pagination[start]': '-4' }).pagination.start, 0);
});

test('sort nhiều khoá: phẩy trong một tham số hoặc lặp tham số', () => {
  assert.deepEqual(parseStrapiQuery({ sort: 'a:asc,b:DESC' }).sort, [{ a: 'asc' }, { b: 'desc' }]);
  assert.deepEqual(parseStrapiQuery({ sort: ['a', 'b:desc'] }).sort, [{ a: 'asc' }, { b: 'desc' }]);
});

test('filters hai cấp, $in dạng mảy, $null thành boolean', () => {
  const parsed = parseStrapiQuery({
    'filters[category][$eq]': 'gia-ca',
    'filters[slug]': 'gia-dong',
    'filters[group][$in][0]': 'dong',
    'filters[group][$in][1]': 'nhom',
    'filters[image][$null]': 'true',
  });
  assert.deepEqual(parsed.filters, {
    category: { $eq: 'gia-ca' },
    slug: 'gia-dong',
    group: { $in: ['dong', 'nhom'] },
    image: { $null: true },
  });
});

test('đầu vào sai trả QueryError thay vì chạy truy vấn lạ', () => {
  const bad = [
    { sort: 'title;drop:asc' },
    { sort: 'title:sideways' },
    { 'filters[views][$lt]': '5' },
    { 'filters[__proto__][$eq]': 'x' },
    { 'filters[a.b][$eq]': 'x' },
    { 'pagination[page]': '1', 'pagination[limit]': '10' },
  ];
  for (const query of bad) {
    assert.throws(() => parseStrapiQuery(query), QueryError, JSON.stringify(query));
  }
});

test('meta đúng dạng Strapi 5 theo từng kiểu phân trang', () => {
  assert.deepEqual(buildMeta({ mode: 'page', page: 2, pageSize: 10, start: 10, limit: 10 }, 21), {
    pagination: { page: 2, pageSize: 10, pageCount: 3, total: 21 },
  });
  assert.deepEqual(buildMeta({ mode: 'offset', start: 0, limit: 100 }, 7), {
    pagination: { start: 0, limit: 100, total: 7 },
  });
});