'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { normalize, diffJson, compareResponses } = require('../dha-api/scripts/lib/compare');
const { PUBLIC_ENDPOINTS, ADMIN_TYPES } = require('../dha-api/scripts/lib/endpoints');
const { listResourceConfigs } = require('../dha-api/src/services/resource-config');

const root = path.join(__dirname, '..');

test('chuẩn hoá chỉ bỏ id và updatedAt của bản ghi, không phụ thuộc thứ tự khoá', () => {
  // Bản ghi có documentId: bỏ id, updatedAt
  assert.deepEqual(
    normalize({ data: { documentId: 'n1', id: 7, updatedAt: 'x', title: 'A', b: 1 } }),
    { data: { b: 1, documentId: 'n1', title: 'A' } },
  );
  // Bản ghi có documentId và items lồng với id content (giữ lại id của items)
  assert.deepEqual(
    normalize({ data: { documentId: 'navigation', id: 3, items: [{ id: 'gioi-thieu', label: 'Giới thiệu' }] } }),
    { data: { documentId: 'navigation', items: [{ id: 'gioi-thieu', label: 'Giới thiệu' }] } },
  );
});

test('diff chỉ ra đúng đường dẫn khác nhau', () => {
  const diffs = diffJson(
    { data: [{ title: 'A', price: 1 }], meta: { total: 1 } },
    { data: [{ title: 'A', price: 2 }], meta: { total: 1 }, extra: true },
  );
  assert.deepEqual(diffs.map((d) => d.path), ['$.data[0].price', '$.extra']);
});

test('lệch id của mục menu thì báo khác, không phải Khớp', () => {
  const a = { data: { documentId: 'navigation', items: [{ id: 'gioi-thieu', label: 'Giới thiệu' }] } };
  const b = { data: { documentId: 'navigation', items: [{ id: 'gioi-thieu-2', label: 'Giới thiệu' }] } };
  const result = compareResponses(a, b);
  assert.ok(result.differences.length > 0, 'phải phát hiện lệch id của item');
  const idDiff = result.differences.find((d) => d.path === '$.data.items[0].id');
  assert.ok(idDiff, 'phải có khác biệt ở $.data.items[0].id');
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
