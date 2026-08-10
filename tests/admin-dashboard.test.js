const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildDateBuckets,
  countRecordsByDay,
  toContactLead,
  toOrderLead,
} = require('../dha-cms/src/api/admin-ui/services/dashboard-metrics');

test('buildDateBuckets returns dayCount buckets ending today, oldest first', () => {
  const now = new Date('2026-07-03T10:00:00');
  const buckets = buildDateBuckets(now, 14);
  assert.equal(buckets.length, 14);
  assert.deepEqual(buckets[13], { key: '2026-07-03', label: '03/07' });
  assert.deepEqual(buckets[0], { key: '2026-06-20', label: '20/06' });
});

test('countRecordsByDay aligns counts to buckets and ignores out-of-window/empty', () => {
  const now = new Date('2026-07-03T10:00:00');
  const buckets = buildDateBuckets(now, 14);
  const records = [
    { createdAt: '2026-07-03T08:00:00' },
    { createdAt: '2026-07-03T20:00:00' },
    { createdAt: '2026-06-20T00:30:00' },
    { createdAt: '2026-01-01T00:00:00' },
    {},
  ];
  const counts = countRecordsByDay(records, buckets);
  assert.equal(counts.length, 14);
  assert.equal(counts[13], 2);
  assert.equal(counts[0], 1);
  assert.equal(counts.reduce((a, b) => a + b, 0), 3);
});

test('toContactLead strips sensitive fields', () => {
  const lead = toContactLead({
    documentId: 'abc',
    name: 'Nguyễn Văn A',
    service: 'phan-tich-lab',
    createdAt: '2026-07-03T08:00:00',
    email: 'secret@example.com',
    address: '123 Đường X',
    message: 'nội dung riêng tư',
    phone: '0900000000',
  });
  assert.deepEqual(lead, {
    documentId: 'abc',
    name: 'Nguyễn Văn A',
    service: 'phan-tich-lab',
    createdAt: '2026-07-03T08:00:00',
  });
  for (const leaked of ['email', 'address', 'message', 'phone']) {
    assert.ok(!(leaked in lead), `${leaked} must not leak`);
  }
});

test('toOrderLead strips sensitive fields and maps snake_case', () => {
  const lead = toOrderLead({
    documentId: 'xyz',
    customer_name: 'Trần Thị B',
    product_name: 'Quặng Sắt',
    quantity: 5,
    createdAt: '2026-07-03T08:00:00',
    email: 'secret@example.com',
    note: 'ghi chú riêu',
    phone: '0900000000',
  });
  assert.deepEqual(lead, {
    documentId: 'xyz',
    customerName: 'Trần Thị B',
    productName: 'Quặng Sắt',
    quantity: 5,
    createdAt: '2026-07-03T08:00:00',
  });
  for (const leaked of ['email', 'note', 'phone']) {
    assert.ok(!(leaked in lead), `${leaked} must not leak`);
  }
});

const fs = require('node:fs');
const path = require('node:path');

function readSource(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

test('dashboard endpoint aggregates pending, trends and content health', () => {
  const src = readSource('dha-cms/src/api/admin-ui/services/resources.js');
  assert.match(src, /require\(['"]\.\/dashboard-metrics['"]\)/, 'imports metric helpers');
  assert.match(src, /pending:/, 'returns pending block');
  assert.match(src, /trends:/, 'returns trends block');
  assert.match(src, /contentHealth:/, 'returns contentHealth block');
  assert.match(src, /status:\s*['"]new['"]/, 'filters pending by new status');
  assert.match(src, /in_stock:\s*false/, 'counts out-of-stock products');
  assert.match(src, /publishedAt:\s*\{\s*\$null:\s*true\s*\}/, 'counts unpublished drafts');
  assert.match(src, /toContactLead/, 'shapes contact leads through helper');
  assert.match(src, /toOrderLead/, 'shapes order leads through helper');
});

test('dashboard endpoint never selects sensitive lead fields in queries', () => {
  const src = readSource('dha-cms/src/api/admin-ui/services/resources.js');
  const dashboardBody = src.slice(src.indexOf('async function dashboard'), src.indexOf('async function list'));
  assert.doesNotMatch(dashboardBody, /['"]message['"]/, 'does not query message');
  assert.doesNotMatch(dashboardBody, /['"]address['"]/, 'does not query address');
});
