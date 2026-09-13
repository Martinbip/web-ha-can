'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { normalize, diffJson, compareResponses } = require('../dha-api/scripts/lib/compare');
const { PUBLIC_ENDPOINTS, ADMIN_TYPES } = require('../dha-api/scripts/lib/endpoints');
const { listResourceConfigs } = require('../dha-api/src/services/resource-config');

const root = path.join(__dirname, '..');

test('chuẩn hoá bỏ id và updatedAt ở mọi cấp, không phụ thuộc thứ tự khoá', () => {
  assert.deepEqual(
    normalize({ b: 1, id: 9, a: { updatedAt: 'x', id: 3, c: [{ id: 1, d: 2 }] } }),
    { a: { c: [{ d: 2 }] }, b: 1 },
  );
});

test('diff chỉ ra đúng đường dẫn khác nhau', () => {
  const diffs = diffJson(
    { data: [{ title: 'A', price: 1 }], meta: { total: 1 } },
    { data: [{ title: 'A', price: 2 }], meta: { total: 1 }, extra: true },
  );
  assert.deepEqual(diffs.map((d) => d.path), ['$.data[0].price', '$.extra']);
});

test('so không theo thứ tự: chỉ lệch thứ tự thì là cảnh báo, không phải lỗi', () => {
  const a = { data: [{ documentId: 'x', v: 1 }, { documentId: 'y', v: 2 }] };
  const b = { data: [{ documentId: 'y', v: 2 }, { documentId: 'x', v: 1 }] };
  assert.deepEqual(compareResponses(a, b, { unordered: true }), { differences: [], orderOnly: true });
  assert.ok(compareResponses(a, b, { unordered: false }).differences.length > 0);
  assert.ok(compareResponses(a, { data: [{ documentId: 'x', v: 9 }, b.data[0]] }, { unordered: true }).differences.length > 0);
});

test('danh sách endpoint phủ mọi lời gọi CMS của app.js và scripts/', () => {
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
  const called = new Set(['navigation']); // app.js gọi `${CMS_API}/navigation` trực tiếp
  for (const match of read('app.js').matchAll(/(?:fetchFromCMS|fetchSingleFromCMS|fetchWithSeedContent)\(\s*'([^']+)'/g)) {
    called.add(match[1]);
  }
  // Script dựng URL dạng `${CMS}/api/<đường-dẫn>` trong template string.
  for (const file of ['scripts/generate-sitemap.js', 'scripts/prerender-site-settings.js']) {
    for (const match of read(file).matchAll(/\$\{CMS\}\/api\/([^`]+)`/g)) called.add(match[1]);
  }

  const listed = new Set(PUBLIC_ENDPOINTS.map((endpoint) => endpoint.path));
  for (const endpoint of called) {
    assert.ok(listed.has(endpoint), `thiếu endpoint trong danh sách đối chiếu: ${endpoint}`);
  }
});

test('đối chiếu cả mọi module của khu quản trị', () => {
  assert.deepEqual([...ADMIN_TYPES].sort(), listResourceConfigs().map((config) => config.type).sort());
});
