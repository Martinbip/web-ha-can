# Admin Dashboard Quickview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm 3 khối quickview (yêu cầu cần xử lý, xu hướng 14 ngày, tình trạng nội dung) vào dashboard admin, tính toàn bộ từ dữ liệu Strapi nội bộ.

**Architecture:** Mở rộng endpoint hiện có `GET /admin-ui/dashboard` để trả thêm `pending`, `trends`, `contentHealth` cạnh `cards` cũ. Logic rủi ro (gom nhóm theo ngày, hình học SVG, lọc field nhạy cảm) tách thành hàm thuần trong file plain-JS để unit test chạy thật; phần glue Strapi/React kiểm bằng static source check theo đúng convention sẵn có của repo.

**Tech Stack:** Strapi v5 document service (`strapi.documents(uid)`), React 18 + react-router-dom v6 (Vite, ESM), `node --test` cho unit test.

## Global Constraints

- Chỉ dùng 1 endpoint `GET /admin-ui/dashboard` (Approach A) — không tạo route mới.
- KHÔNG thêm dependency npm nào (không dùng thư viện chart — tự vẽ SVG).
- Mọi nhãn hiển thị bằng tiếng Việt có dấu đầy đủ.
- Dashboard TUYỆT ĐỐI không lộ field nhạy cảm của lead (`email`, `message`, `address`, `phone`, `note`) trong danh sách recent.
- Cửa sổ xu hướng = 14 ngày. Giới hạn danh sách recent = 5 mục.
- Test chạy qua `npm test` (node --test) từ thư mục gốc repo.
- Backend là CommonJS (`require`/`module.exports`); frontend admin là ESM (`import`/`export`, `admin/package.json` có `"type": "module"`).
- Backend file mới đặt cạnh `resources.js` trong `dha-cms/src/api/admin-ui/services/`. Frontend component mới đặt trong `admin/src/components/`.

---

## File Structure

**Tạo mới:**
- `dha-cms/src/api/admin-ui/services/dashboard-metrics.js` — hàm thuần backend: `buildDateBuckets`, `countRecordsByDay`, `toContactLead`, `toOrderLead` (CommonJS).
- `admin/src/components/trend-geometry.js` — hàm thuần `buildPolylinePoints` (ESM, plain JS để test import được).
- `admin/src/components/TrendChart.jsx` — component SVG vẽ biểu đồ xu hướng.
- `tests/admin-dashboard.test.js` — unit test cho các hàm thuần + static check cho glue.

**Sửa:**
- `dha-cms/src/api/admin-ui/services/resources.js` — viết lại hàm `dashboard()` (dòng 114-124) dùng các helper mới.
- `admin/src/pages/DashboardPage.jsx` — render 3 khối mới.
- `admin/src/styles.css` — thêm CSS cho các khối dashboard.
- `package.json` (gốc) — thêm `tests/admin-dashboard.test.js` vào script `test`.

---

## Task 1: Backend pure metrics helpers

**Files:**
- Create: `dha-cms/src/api/admin-ui/services/dashboard-metrics.js`
- Create: `tests/admin-dashboard.test.js`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces:
  - `buildDateBuckets(now: Date, dayCount: number) => Array<{ key: string, label: string }>` — `key` = 'YYYY-MM-DD' (giờ local), `label` = 'dd/mm', từ cũ đến mới, độ dài = `dayCount`, phần tử cuối là ngày của `now`.
  - `countRecordsByDay(records: Array<{ createdAt }>, buckets) => number[]` — mảng đếm cùng độ dài/thứ tự với `buckets`; bỏ qua record không có `createdAt` hoặc ngoài cửa sổ.
  - `toContactLead(record) => { documentId, name, service, createdAt }` — chỉ lấy đúng 4 field này.
  - `toOrderLead(record) => { documentId, customerName, productName, quantity, createdAt }` — chỉ lấy đúng 5 field này.

- [ ] **Step 1: Thêm test file vào script test của repo gốc**

Sửa `package.json` (gốc), dòng `"test"`:

```json
"test": "node --test tests/regression.test.js tests/admin-ui-config.test.js tests/admin-app.test.js tests/admin-dashboard.test.js",
```

- [ ] **Step 2: Viết test thất bại cho các hàm thuần backend**

Tạo `tests/admin-dashboard.test.js`:

```js
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
    note: 'ghi chú riêng',
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
```

- [ ] **Step 3: Chạy test để xác nhận thất bại**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../dashboard-metrics'`.

- [ ] **Step 4: Viết implementation tối thiểu**

Tạo `dha-cms/src/api/admin-ui/services/dashboard-metrics.js`:

```js
'use strict';

function pad2(value) {
  return String(value).padStart(2, '0');
}

function toDayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toDayLabel(date) {
  const d = new Date(date);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

function buildDateBuckets(now, dayCount) {
  const base = new Date(now);
  const buckets = [];
  for (let i = dayCount - 1; i >= 0; i -= 1) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
    buckets.push({ key: toDayKey(d), label: toDayLabel(d) });
  }
  return buckets;
}

function countRecordsByDay(records, buckets) {
  const index = new Map(buckets.map((bucket, i) => [bucket.key, i]));
  const counts = new Array(buckets.length).fill(0);
  for (const record of records || []) {
    if (!record || !record.createdAt) continue;
    const key = toDayKey(record.createdAt);
    if (index.has(key)) counts[index.get(key)] += 1;
  }
  return counts;
}

function toContactLead(record) {
  return {
    documentId: record.documentId,
    name: record.name,
    service: record.service,
    createdAt: record.createdAt,
  };
}

function toOrderLead(record) {
  return {
    documentId: record.documentId,
    customerName: record.customer_name,
    productName: record.product_name,
    quantity: record.quantity,
    createdAt: record.createdAt,
  };
}

module.exports = {
  buildDateBuckets,
  countRecordsByDay,
  toContactLead,
  toOrderLead,
};
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `npm test`
Expected: PASS — 4 test mới xanh, toàn bộ suite cũ vẫn xanh.

- [ ] **Step 6: Commit**

```bash
git add dha-cms/src/api/admin-ui/services/dashboard-metrics.js tests/admin-dashboard.test.js package.json
git commit -m "feat(admin): add pure dashboard metric helpers with unit tests"
```

---

## Task 2: Wire dashboard() endpoint

**Files:**
- Modify: `dha-cms/src/api/admin-ui/services/resources.js:114-124` (hàm `dashboard`)
- Modify: `tests/admin-dashboard.test.js` (thêm static check)

**Interfaces:**
- Consumes: `buildDateBuckets`, `countRecordsByDay`, `toContactLead`, `toOrderLead` từ Task 1; `listResourceConfigs()` từ `resource-config.js` (trả `Array<{ type, uid, pluralLabel, draftAndPublish, singleType, ... }>`).
- Produces: response body của `GET /admin-ui/dashboard`:
  ```
  {
    cards: [{ type, label, count }],
    pending: {
      contactInquiries: { count, recent: [{ documentId, name, service, createdAt }] },
      orderRequests:    { count, recent: [{ documentId, customerName, productName, quantity, createdAt }] }
    },
    trends: { days: string[], contactInquiries: number[], orderRequests: number[] },
    contentHealth: { outOfStockProducts: number, draftItems: [{ type, label, count }] }
  }
  ```

- [ ] **Step 1: Viết static check thất bại cho endpoint**

Thêm vào cuối `tests/admin-dashboard.test.js`:

```js
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
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test`
Expected: FAIL — `resources.js` chưa require dashboard-metrics, chưa có `pending:`/`trends:`/`contentHealth:`.

- [ ] **Step 3: Thêm import ở đầu resources.js**

Sửa `dha-cms/src/api/admin-ui/services/resources.js`, sau dòng `const auth = require('./auth');` (dòng 5), thêm:

```js
const { buildDateBuckets, countRecordsByDay, toContactLead, toOrderLead } = require('./dashboard-metrics');

const DASHBOARD_TREND_DAYS = 14;
const DASHBOARD_PENDING_LIMIT = 5;
const DASHBOARD_TREND_QUERY_LIMIT = 1000;
const CONTACT_UID = 'api::contact-inquiry.contact-inquiry';
const ORDER_UID = 'api::order-request.order-request';
const PRODUCT_UID = 'api::product.product';
```

- [ ] **Step 4: Thay thế hàm dashboard()**

Thay toàn bộ hàm `dashboard(ctx)` hiện tại (dòng 114-124) bằng:

```js
async function buildDashboardCards() {
  const cards = [];
  for (const config of listResourceConfigs()) {
    if (config.singleType) continue;
    const count = await strapi.documents(config.uid).count({});
    cards.push({ type: config.type, label: config.pluralLabel, count });
  }
  return cards;
}

async function dashboard(ctx) {
  const user = await auth.requireSession(ctx);
  if (!user) return;

  const now = new Date();
  const buckets = buildDateBuckets(now, DASHBOARD_TREND_DAYS);
  const trendStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - (DASHBOARD_TREND_DAYS - 1),
  );

  const draftConfigs = listResourceConfigs().filter(
    (config) => config.draftAndPublish && !config.singleType,
  );

  const [
    cards,
    contactCount,
    contactRecent,
    orderCount,
    orderRecent,
    contactTrend,
    orderTrend,
    outOfStockProducts,
    draftCounts,
  ] = await Promise.all([
    buildDashboardCards(),
    strapi.documents(CONTACT_UID).count({ filters: { status: 'new' } }),
    strapi.documents(CONTACT_UID).findMany({
      filters: { status: 'new' },
      sort: { createdAt: 'desc' },
      fields: ['name', 'service', 'createdAt'],
      limit: DASHBOARD_PENDING_LIMIT,
    }),
    strapi.documents(ORDER_UID).count({ filters: { status: 'new' } }),
    strapi.documents(ORDER_UID).findMany({
      filters: { status: 'new' },
      sort: { createdAt: 'desc' },
      fields: ['customer_name', 'product_name', 'quantity', 'createdAt'],
      limit: DASHBOARD_PENDING_LIMIT,
    }),
    strapi.documents(CONTACT_UID).findMany({
      filters: { createdAt: { $gte: trendStart } },
      fields: ['createdAt'],
      limit: DASHBOARD_TREND_QUERY_LIMIT,
    }),
    strapi.documents(ORDER_UID).findMany({
      filters: { createdAt: { $gte: trendStart } },
      fields: ['createdAt'],
      limit: DASHBOARD_TREND_QUERY_LIMIT,
    }),
    strapi.documents(PRODUCT_UID).count({ filters: { in_stock: false } }),
    Promise.all(
      draftConfigs.map((config) =>
        strapi.documents(config.uid).count({ filters: { publishedAt: { $null: true } } }),
      ),
    ),
  ]);

  const draftItems = draftConfigs
    .map((config, i) => ({ type: config.type, label: config.pluralLabel, count: draftCounts[i] }))
    .filter((item) => item.count > 0);

  ctx.body = {
    cards,
    pending: {
      contactInquiries: { count: contactCount, recent: contactRecent.map(toContactLead) },
      orderRequests: { count: orderCount, recent: orderRecent.map(toOrderLead) },
    },
    trends: {
      days: buckets.map((bucket) => bucket.label),
      contactInquiries: countRecordsByDay(contactTrend, buckets),
      orderRequests: countRecordsByDay(orderTrend, buckets),
    },
    contentHealth: { outOfStockProducts, draftItems },
  };
}
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `npm test`
Expected: PASS — cả static check mới lẫn suite cũ đều xanh.

- [ ] **Step 6: Xác minh runtime với Strapi thật (nếu CMS chạy được)**

Nếu môi trường có thể khởi động Strapi: đăng nhập admin, gọi `GET /api/admin-ui/dashboard` (kèm cookie session) và xác nhận response có đủ 4 khối. Nếu không khởi động được ở môi trường hiện tại, ghi chú lại để xác minh cùng bước frontend (Task 5) qua preview.

- [ ] **Step 7: Commit**

```bash
git add dha-cms/src/api/admin-ui/services/resources.js tests/admin-dashboard.test.js
git commit -m "feat(admin): return pending, trends and content-health from dashboard endpoint"
```

---

## Task 3: Frontend SVG geometry helper

**Files:**
- Create: `admin/src/components/trend-geometry.js`
- Modify: `tests/admin-dashboard.test.js` (thêm test dynamic-import cho ESM helper)

**Interfaces:**
- Produces: `buildPolylinePoints(values: number[], width: number, height: number, max: number) => string` — chuỗi `"x,y x,y ..."` cho thuộc tính `points` của `<polyline>`. y đảo trục (0 ở đỉnh). `max < 1` được nâng lên 1 để tránh chia 0. Mảng rỗng → `''`. 1 phần tử → 1 điểm ở giữa (`width/2`). Giá trị âm coi như 0.

- [ ] **Step 1: Viết test thất bại (dynamic import ESM từ test CommonJS)**

Thêm vào cuối `tests/admin-dashboard.test.js`:

```js
test('buildPolylinePoints maps values to an inverted, scaled polyline', async () => {
  const { buildPolylinePoints } = await import('../admin/src/components/trend-geometry.js');
  assert.equal(buildPolylinePoints([0, 5, 10], 100, 50, 10), '0,50 50,25 100,0');
  assert.equal(buildPolylinePoints([], 100, 50, 10), '');
  assert.equal(buildPolylinePoints([4], 100, 50, 8), '50,25');
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test`
Expected: FAIL — không tìm thấy `admin/src/components/trend-geometry.js`.

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `admin/src/components/trend-geometry.js`:

```js
function round(value) {
  return Math.round(value * 100) / 100;
}

export function buildPolylinePoints(values, width, height, max) {
  const list = Array.isArray(values) ? values : [];
  if (list.length === 0) return '';
  const safeMax = Math.max(1, max || 0);
  if (list.length === 1) {
    const y = height - (Math.max(0, list[0]) / safeMax) * height;
    return `${round(width / 2)},${round(y)}`;
  }
  const step = width / (list.length - 1);
  return list
    .map((value, i) => {
      const x = i * step;
      const y = height - (Math.max(0, value) / safeMax) * height;
      return `${round(x)},${round(y)}`;
    })
    .join(' ');
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add admin/src/components/trend-geometry.js tests/admin-dashboard.test.js
git commit -m "feat(admin): add SVG polyline geometry helper with unit tests"
```

---

## Task 4: TrendChart component

**Files:**
- Create: `admin/src/components/TrendChart.jsx`
- Modify: `admin/src/styles.css` (thêm CSS biểu đồ)
- Modify: `tests/admin-dashboard.test.js` (static check)

**Interfaces:**
- Consumes: `buildPolylinePoints` từ Task 3.
- Produces: `export default function TrendChart({ days: string[], series: Array<{ label: string, color: string, values: number[] }> })` — render `<svg>` chứa 1 `<polyline>` mỗi series, hàng nhãn trục X, và legend.

- [ ] **Step 1: Viết static check thất bại**

Thêm vào cuối `tests/admin-dashboard.test.js`:

```js
test('TrendChart renders polylines and a legend from series props', () => {
  const chart = readSource('admin/src/components/TrendChart.jsx');
  assert.match(chart, /buildPolylinePoints/, 'uses the geometry helper');
  assert.match(chart, /<polyline/, 'draws polylines');
  assert.match(chart, /trend-legend/, 'renders a legend');
  assert.match(chart, /series\.map/, 'maps over series prop');
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test`
Expected: FAIL — không tìm thấy `admin/src/components/TrendChart.jsx`.

- [ ] **Step 3: Tạo component**

Tạo `admin/src/components/TrendChart.jsx`:

```jsx
import React from 'react';
import { buildPolylinePoints } from './trend-geometry.js';

const VIEW_W = 600;
const VIEW_H = 160;

export default function TrendChart({ days = [], series = [] }) {
  const allValues = series.flatMap((s) => s.values || []);
  const max = Math.max(1, ...allValues, 0);
  const labelStep = Math.max(1, Math.ceil((days.length || 1) / 7));

  return (
    <div className="trend-chart">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Biểu đồ xu hướng liên hệ và đơn đặt mẫu 14 ngày"
      >
        {series.map((s) => (
          <polyline
            key={s.label}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            points={buildPolylinePoints(s.values || [], VIEW_W, VIEW_H, max)}
          />
        ))}
      </svg>
      <div className="trend-x">
        {days.map((day, i) => (
          <span key={i}>{i % labelStep === 0 ? day : ''}</span>
        ))}
      </div>
      <div className="trend-legend">
        {series.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Thêm CSS cho biểu đồ**

Thêm vào cuối `admin/src/styles.css` (trước media query cuối cùng, hoặc ngay cuối file — CSS không phụ thuộc thứ tự ở đây):

```css
/* ── Dashboard trend chart ── */
.trend-chart svg {
  width: 100%;
  height: 160px;
  display: block;
}

.trend-x {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 11px;
  color: var(--muted);
}

.trend-legend {
  display: flex;
  gap: 16px;
  margin-top: 10px;
  font-size: 13px;
  color: var(--muted);
}

.trend-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.trend-legend i {
  width: 12px;
  height: 3px;
  border-radius: 2px;
}
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add admin/src/components/TrendChart.jsx admin/src/styles.css tests/admin-dashboard.test.js
git commit -m "feat(admin): add TrendChart SVG component"
```

---

## Task 5: DashboardPage quickview sections

**Files:**
- Modify: `admin/src/pages/DashboardPage.jsx` (viết lại toàn bộ)
- Modify: `admin/src/styles.css` (thêm CSS các khối quickview)
- Modify: `tests/admin-dashboard.test.js` (static check + kiểm tra không lộ field nhạy cảm)

**Interfaces:**
- Consumes: response `GET /admin-ui/dashboard` từ Task 2; `TrendChart` từ Task 4; `apiRequest` từ `../api/client.js`; `Link` từ `react-router-dom`.

- [ ] **Step 1: Viết static check thất bại**

Thêm vào cuối `tests/admin-dashboard.test.js`:

```js
test('DashboardPage renders the three quickview sections and hides sensitive fields', () => {
  const dash = readSource('admin/src/pages/DashboardPage.jsx');
  assert.match(dash, /Cần xử lý/, 'has pending section heading');
  assert.match(dash, /Xu hướng 14 ngày/, 'has trends section heading');
  assert.match(dash, /Tình trạng nội dung/, 'has content-health section heading');
  assert.match(dash, /resources\/contact-inquiries\//, 'links to contact inquiry detail');
  assert.match(dash, /resources\/order-requests\//, 'links to order request detail');
  assert.match(dash, /resources\/products/, 'links to products list for out-of-stock');
  assert.match(dash, /<TrendChart/, 'renders the trend chart');
  assert.doesNotMatch(dash, /item\.(email|message|address|note|phone)/, 'does not render sensitive lead fields');
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test`
Expected: FAIL — DashboardPage.jsx hiện chưa có các heading và không import TrendChart.

- [ ] **Step 3: Viết lại DashboardPage.jsx**

Thay toàn bộ nội dung `admin/src/pages/DashboardPage.jsx` bằng:

```jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import TrendChart from '../components/TrendChart.jsx';

const SERVICE_LABELS = {
  'cung-cap-mau': 'Cung cấp mẫu',
  'phan-tich-lab': 'Phân tích lab',
  'khao-sat-mo': 'Khảo sát mỏ',
  'tuyen-khoang': 'Tuyển khoáng',
};

const EMPTY = {
  cards: [],
  pending: {
    contactInquiries: { count: 0, recent: [] },
    orderRequests: { count: 0, recent: [] },
  },
  trends: { days: [], contactInquiries: [], orderRequests: [] },
  contentHealth: { outOfStockProducts: 0, draftItems: [] },
};

function formatWhen(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DashboardPage() {
  const [data, setData] = useState(EMPTY);

  useEffect(() => {
    apiRequest('/dashboard')
      .then((payload) => setData({ ...EMPTY, ...payload }))
      .catch(() => setData(EMPTY));
  }, []);

  const cards = data.cards || [];
  const pending = data.pending || EMPTY.pending;
  const trends = data.trends || EMPTY.trends;
  const health = data.contentHealth || EMPTY.contentHealth;
  const contact = pending.contactInquiries || EMPTY.pending.contactInquiries;
  const order = pending.orderRequests || EMPTY.pending.orderRequests;

  return (
    <main className="page">
      <div className="page-heading">
        <h1>Dashboard</h1>
        <p>Tổng quan nội dung và yêu cầu mới.</p>
      </div>

      <section className="metric-grid">
        {cards.map((card) => (
          <article className="metric-card" key={card.type}>
            <span>{card.label}</span>
            <strong>{card.count}</strong>
          </article>
        ))}
      </section>

      <section className="dash-section">
        <h2>Cần xử lý</h2>
        <div className="card-grid">
          <article className="card pending-card">
            <h2>Liên hệ mới</h2>
            <p className="pending-count">{contact.count}</p>
            {contact.recent.length === 0 ? (
              <p className="pending-empty">Không có yêu cầu mới.</p>
            ) : (
              <ul className="pending-list">
                {contact.recent.map((item) => (
                  <li key={item.documentId}>
                    <Link to={`/resources/contact-inquiries/${item.documentId}`}>
                      <span>
                        {item.name}
                        {item.service ? ` · ${SERVICE_LABELS[item.service] || item.service}` : ''}
                      </span>
                      <span className="pending-when">{formatWhen(item.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="card pending-card">
            <h2>Đơn đặt mẫu mới</h2>
            <p className="pending-count">{order.count}</p>
            {order.recent.length === 0 ? (
              <p className="pending-empty">Không có đơn mới.</p>
            ) : (
              <ul className="pending-list">
                {order.recent.map((item) => (
                  <li key={item.documentId}>
                    <Link to={`/resources/order-requests/${item.documentId}`}>
                      <span>
                        {item.customerName} · {item.productName}
                      </span>
                      <span className="pending-when">{formatWhen(item.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </section>

      <section className="dash-section">
        <h2>Xu hướng 14 ngày</h2>
        <article className="card">
          <TrendChart
            days={trends.days}
            series={[
              { label: 'Liên hệ', color: '#176b4d', values: trends.contactInquiries },
              { label: 'Đơn đặt mẫu', color: '#d97706', values: trends.orderRequests },
            ]}
          />
        </article>
      </section>

      <section className="dash-section">
        <h2>Tình trạng nội dung</h2>
        <article className="card">
          <div className="health-row">
            <span className={`health-number${health.outOfStockProducts > 0 ? ' is-alert' : ''}`}>
              {health.outOfStockProducts}
            </span>
            <Link to="/resources/products">sản phẩm hết hàng</Link>
          </div>
          {health.draftItems.length === 0 ? (
            <p className="pending-empty">Không có nội dung nháp.</p>
          ) : (
            <div className="chip-row">
              {health.draftItems.map((item) => (
                <Link key={item.type} className="chip" to={`/resources/${item.type}`}>
                  {item.label} ({item.count})
                </Link>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Thêm CSS cho các khối quickview**

Thêm vào cuối `admin/src/styles.css`:

```css
/* ── Dashboard quickview sections ── */
.dash-section {
  margin-top: 32px;
}

.dash-section > h2 {
  margin: 0 0 12px;
  font-size: 18px;
}

.pending-card .pending-count {
  font-size: 30px;
  font-weight: 700;
  margin: 0 0 10px;
}

.pending-list {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pending-list a {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  color: var(--text);
  text-decoration: none;
}

.pending-list a:hover {
  background: var(--bg);
}

.pending-when {
  color: var(--muted);
  white-space: nowrap;
  font-size: 13px;
}

.pending-empty {
  color: var(--muted);
  margin: 4px 0 0;
}

.health-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 14px;
}

.health-number {
  font-size: 30px;
  font-weight: 700;
}

.health-number.is-alert {
  color: #b42318;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--bg);
  border: 1px solid var(--line);
  color: var(--text);
  text-decoration: none;
  font-size: 13px;
}

.chip:hover {
  border-color: var(--brand);
}
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `npm test`
Expected: PASS — toàn bộ suite xanh.

- [ ] **Step 6: Xác minh trực quan qua preview**

Khởi động admin dev server và Strapi (`admin:dev` + `strapi-cms` trong `.claude/launch.json`). Đăng nhập admin, mở Dashboard. Nếu chưa có dữ liệu liên hệ/đơn hàng thật, tạo vài bản ghi mẫu (qua form public trên frontend hoặc Strapi console) để thấy:
- Khối "Cần xử lý" hiện số đếm + danh sách, click 1 dòng nhảy đúng sang trang chi tiết.
- Biểu đồ "Xu hướng 14 ngày" vẽ 2 đường + legend.
- Khối "Tình trạng nội dung" hiện số hết hàng (đỏ nếu > 0) + chip draft.

Kiểm tra console không có lỗi. Chụp screenshot làm bằng chứng.

- [ ] **Step 7: Commit**

```bash
git add admin/src/pages/DashboardPage.jsx admin/src/styles.css tests/admin-dashboard.test.js
git commit -m "feat(admin): add quickview widgets to dashboard page"
```

---

## Self-Review Notes

- **Spec coverage:** pending (Task 2 + 5), trends (Task 1 + 2 + 3 + 4 + 5), contentHealth (Task 2 + 5), 1-endpoint architecture (Task 2), không thêm dependency (Task 4 tự vẽ SVG), GA4 ngoài phạm vi (không có task). ✔
- **Security:** không lộ field nhạy cảm được đảm bảo ở 3 lớp — query chỉ chọn field an toàn (Task 2), mapper thuần lọc field có unit test (Task 1), static check trên cả backend endpoint và DashboardPage (Task 2 + 5). ✔
- **Type consistency:** `documentId/name/service/createdAt` và `documentId/customerName/productName/quantity/createdAt` khớp giữa `toContactLead`/`toOrderLead` (Task 1) và render (Task 5); `buildPolylinePoints(values,width,height,max)` khớp giữa Task 3 và Task 4; `{ days, series:[{label,color,values}] }` khớp giữa TrendChart (Task 4) và DashboardPage (Task 5). ✔
