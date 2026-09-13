# Chuyển Strapi sang Sanity — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay Strapi (`dha-cms/`) bằng service Koa nhỏ `dha-api/` lưu nội dung trên Sanity, giữ nguyên hợp đồng HTTP để `app.js`, `admin/`, `preview.html` và `scripts/*.js` không phải sửa.

**Architecture:** `dha-api` dựng lại đúng bề mặt `strapi.documents(uid)` mà các service admin-ui đang gọi, dưới dạng `store.documents(sanityType)` chạy trên `@sanity/client`. Service admin-ui được dời sang gần như nguyên văn và lấy store qua `store-registry`. API công khai đọc cú pháp query của Strapi và trả JSON dạng Strapi 5.

**Tech Stack:** Node ≥ 20 (CommonJS), Koa 3, `@koa/router` 15, `koa-body` 8, `@sanity/client` 8, `bcryptjs` 3, `cloudinary` 2, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-13-strapi-to-sanity-design.md`

## Global Constraints

- CommonJS, mỗi file mở đầu `'use strict';`, comment tiếng Việt có dấu theo văn phong sẵn có của repo.
- Phiên bản: `koa ^3.2.1`, `@koa/router ^15.7.0`, `koa-body ^8.0.1`, `@sanity/client ^8.6.1`, `bcryptjs ^3.0.3`, `cloudinary ^2.11.0`. Không thêm dependency nào khác.
- Import đúng dạng đã kiểm: `const Koa = require('koa')`, `const Router = require('@koa/router')`, `const { koaBody } = require('koa-body')`, `const { createClient } = require('@sanity/client')`, `const bcrypt = require('bcryptjs')`, `const cloudinary = require('cloudinary').v2`.
- Sanity client: `apiVersion: '2025-02-19'`, `useCdn: false`, `perspective: 'raw'`, token chỉ ở server.
- Mọi dataset tạo bằng `--visibility private`. `adminUser` dùng `_id` dạng `adminUser.<id>`.
- Cổng 1337; `app.proxy` theo `IS_BEHIND_PROXY`, mặc định `true` khi `NODE_ENV=production`.
- API công khai: mặc định 25, trần 100 bản ghi mỗi trang; chỉ trả bản đã xuất bản; bỏ qua tham số `status`.
- Rate limit (cửa sổ 15 phút, theo IP + đường dẫn): đăng nhập 5, `contact-inquiries` 5, `order-requests` 10.
- Cookie phiên `ha_can_admin_session`, HMAC-SHA256 bằng `ADMIN_UI_SESSION_SECRET`, TTL 8 giờ — không đổi.
- Test đặt ở `tests/*.test.js` gốc và **phải** thêm vào script `test` trong `package.json` gốc (`regression.test.js` kiểm điều này). Chạy bằng `npm test` ở gốc repo.
- Không xoá test nào nếu chưa có test thay thế cho cùng hành vi. Mốc trước khi bắt đầu: 285/285 pass.
- Không sửa `app.js`, `admin/src/**`, `preview.html`, `*.html`.
- File NDJSON xuất ra chứa hash mật khẩu và dữ liệu cá nhân: chỉ ghi vào `dha-api/out/` (gitignore), không commit.

## Bản đồ file

| File | Trách nhiệm |
|---|---|
| `dha-api/package.json` | dependency, script `start`, `dev` |
| `dha-api/src/config.js` | đọc + kiểm biến môi trường |
| `dha-api/src/sanity/store-registry.js` | `setStore()` / `getStore()` |
| `dha-api/src/sanity/query-engine.js` | lọc, sắp xếp, phân trang, chọn trường (thuần) |
| `dha-api/src/sanity/types.js` | bảng sanityType → nháp/singleton/tiền tố id |
| `dha-api/src/sanity/cache.js` | cache đọc theo type, xoá khi ghi |
| `dha-api/src/sanity/store.js` | `createSanityStore({ client })` |
| `dha-api/src/sanity/client.js` | `createSanityClient()`, `assertDatasetPrivate()` |
| `dha-api/src/schemas/*.json` | schema.json của Strapi, đổi tên theo sanityType |
| `dha-api/src/defaults/*.js` | menu + danh mục mặc định (chép nguyên) |
| `dha-api/src/services/*.js` | auth, resources, resource-config, media, navigation, dashboard-metrics, errors |
| `dha-api/src/hooks/*.js` | index, product-category, site-setting, prerender |
| `dha-api/src/http/strapi-query.js` | đọc `sort`, `pagination[...]`, `filters[...]` |
| `dha-api/src/http/schema-validator.js` | validate body theo schema JSON |
| `dha-api/src/http/rate-limit.js` | middleware giới hạn tần suất |
| `dha-api/src/http/cors.js` | CORS đúng danh sách origin |
| `dha-api/src/routes/public.js` | `/api/<collection>`, singleton, 2 form |
| `dha-api/src/routes/admin-ui.js` | 17 route `/api/admin-ui/*` |
| `dha-api/src/app.js` | `createApp({ store, config })` |
| `dha-api/src/server.js` | điểm vào: config → client → store → listen |
| `dha-api/scripts/lib/*.js` | logic thuần của các script (có test) |
| `dha-api/scripts/*.js` | CLI mỏng: seed, admin-user, migrate, compare |
| `tests/helpers/admin-ui-harness.js` | `createFakeStore()` thay `createFakeStrapi()` |
| `tests/helpers/fake-sanity-client.js` | client Sanity giả trong bộ nhớ |
| `tests/helpers/document-store-contract.js` | bộ test hợp đồng dùng chung |
| `tests/helpers/http.js` | dựng app Koa trên cổng ngẫu nhiên |

---

## Giai đoạn 1 — Lõi và API

### Task 1: Khung `dha-api`

**Files:**
- Create: `dha-api/package.json`, `dha-api/.env.example`, `dha-api/src/config.js`, `dha-api/src/sanity/store-registry.js`
- Create (chép): `dha-api/src/schemas/*.json`, `dha-api/src/defaults/default-items.js`, `dha-api/src/defaults/default-categories.js`, `dha-api/src/services/errors.js`
- Modify: `.gitignore`, `package.json` (gốc)
- Test: `tests/api-config.test.js`

**Interfaces:**
- Produces: `loadConfig(env) → { port, host, isBehindProxy, frontendUrl, sanity: { projectId, dataset, token, apiVersion } }` (ném `Error` liệt kê biến thiếu); `setStore(store)`, `getStore()` (ném `Error` khi chưa set).

- [ ] **Step 1: Tạo `dha-api/package.json` và cài dependency**

```json
{
  "name": "dha-api",
  "version": "0.1.0",
  "private": true,
  "description": "API nội dung DHA trên Sanity, thay cho Strapi (dha-cms)",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch --env-file-if-exists=.env src/server.js"
  },
  "engines": { "node": ">=20" },
  "dependencies": {
    "@koa/router": "^15.7.0",
    "@sanity/client": "^8.6.1",
    "bcryptjs": "^3.0.3",
    "cloudinary": "^2.11.0",
    "koa": "^3.2.1",
    "koa-body": "^8.0.1"
  }
}
```

Run: `npm install --prefix dha-api`
Expected: tạo `dha-api/package-lock.json`, không lỗi.

- [ ] **Step 2: Chép schema, dữ liệu mặc định và `errors.js`**

```bash
S=dha-cms/src/api
D=dha-api/src/schemas
mkdir -p $D dha-api/src/defaults dha-api/src/services
cp $S/news/content-types/news/schema.json                         $D/news.json
cp $S/product/content-types/product/schema.json                   $D/product.json
cp $S/product-category/content-types/product-category/schema.json $D/productCategory.json
cp $S/project/content-types/project/schema.json                   $D/project.json
cp $S/service/content-types/service/schema.json                   $D/service.json
cp $S/hero-slide/content-types/hero-slide/schema.json             $D/heroSlide.json
cp $S/workflow-step/content-types/workflow-step/schema.json       $D/workflowStep.json
cp $S/pricing-package/content-types/pricing-package/schema.json   $D/pricingPackage.json
cp $S/pricing-analysis/content-types/pricing-analysis/schema.json $D/pricingAnalysis.json
cp $S/pricing-survey/content-types/pricing-survey/schema.json     $D/pricingSurvey.json
cp $S/ore/content-types/ore/schema.json                           $D/ore.json
cp $S/site-setting/content-types/site-setting/schema.json         $D/siteSetting.json
cp $S/navigation/content-types/navigation/schema.json             $D/navigation.json
cp $S/contact-inquiry/content-types/contact-inquiry/schema.json   $D/contactInquiry.json
cp $S/order-request/content-types/order-request/schema.json       $D/orderRequest.json
cp $S/navigation/default-items.js              dha-api/src/defaults/default-items.js
cp $S/product-category/default-categories.js   dha-api/src/defaults/default-categories.js
cp $S/admin-ui/services/errors.js              dha-api/src/services/errors.js
ls $D | wc -l
```

Expected: `15`.

- [ ] **Step 3: Viết test thất bại `tests/api-config.test.js`**

```js
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { loadConfig } = require('../dha-api/src/config');
const { setStore, getStore } = require('../dha-api/src/sanity/store-registry');

const BASE_ENV = {
  SANITY_PROJECT_ID: 'abc123',
  SANITY_DATASET: 'staging',
  SANITY_API_TOKEN: 'sk-test',
  ADMIN_UI_SESSION_SECRET: 'bi-mat',
};

test('thiếu biến bắt buộc thì báo rõ tên từng biến', () => {
  assert.throws(
    () => loadConfig({}),
    (err) => ['SANITY_PROJECT_ID', 'SANITY_DATASET', 'SANITY_API_TOKEN', 'ADMIN_UI_SESSION_SECRET']
      .every((name) => err.message.includes(name)),
  );
});

test('giá trị mặc định: cổng 1337, không tin proxy ngoài production', () => {
  const config = loadConfig(BASE_ENV);
  assert.equal(config.port, 1337);
  assert.equal(config.isBehindProxy, false);
  assert.deepEqual(config.sanity, { projectId: 'abc123', dataset: 'staging', token: 'sk-test', apiVersion: '2025-02-19' });
});

test('production tin proxy mặc định, IS_BEHIND_PROXY ghi đè được', () => {
  assert.equal(loadConfig({ ...BASE_ENV, NODE_ENV: 'production' }).isBehindProxy, true);
  assert.equal(loadConfig({ ...BASE_ENV, NODE_ENV: 'production', IS_BEHIND_PROXY: 'false' }).isBehindProxy, false);
  assert.equal(loadConfig({ ...BASE_ENV, IS_BEHIND_PROXY: 'true' }).isBehindProxy, true);
});

test('PORT không phải số thì báo lỗi thay vì nghe cổng rác', () => {
  assert.throws(() => loadConfig({ ...BASE_ENV, PORT: 'abc' }), /PORT/);
});

test('getStore báo lỗi rõ khi chưa khởi tạo, setStore(null) gỡ store', () => {
  setStore(null);
  assert.throws(() => getStore(), /setStore/);
  const fake = { documents() {} };
  setStore(fake);
  assert.equal(getStore(), fake);
  setStore(null);
});
```

Thêm `tests/api-config.test.js` vào cuối chuỗi `node --test ...` trong script `test` của `package.json` gốc.

Run: `npm test 2>&1 | tail -5`
Expected: FAIL — `Cannot find module '../dha-api/src/config'`.

- [ ] **Step 4: Viết `dha-api/src/config.js`**

```js
'use strict';

// Đọc cấu hình một lần lúc khởi động. Thiếu biến bắt buộc thì dừng ngay với
// thông báo nêu đủ tên biến, thay vì chạy được nửa chừng rồi lỗi ở request đầu.
const REQUIRED = ['SANITY_PROJECT_ID', 'SANITY_DATASET', 'SANITY_API_TOKEN', 'ADMIN_UI_SESSION_SECRET'];
const SANITY_API_VERSION = '2025-02-19';

function parseBoolean(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function loadConfig(env = process.env) {
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length) {
    throw new Error(`Thiếu biến môi trường bắt buộc: ${missing.join(', ')}`);
  }

  const port = Number(env.PORT || 1337);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT không hợp lệ: ${env.PORT}`);
  }

  return {
    port,
    host: env.HOST || '0.0.0.0',
    // nginx đứng trước ở production. Không tin proxy thì mọi khách mang IP của
    // nginx và mọi rate limit dồn chung một bucket (xem spec mục 5).
    isBehindProxy: parseBoolean(env.IS_BEHIND_PROXY, env.NODE_ENV === 'production'),
    frontendUrl: env.FRONTEND_URL || null,
    sanity: {
      projectId: env.SANITY_PROJECT_ID,
      dataset: env.SANITY_DATASET,
      token: env.SANITY_API_TOKEN,
      apiVersion: SANITY_API_VERSION,
    },
  };
}

module.exports = { loadConfig, SANITY_API_VERSION };
```

- [ ] **Step 5: Viết `dha-api/src/sanity/store-registry.js`**

```js
'use strict';

// Service admin-ui trước đây gọi `strapi.documents()` qua biến toàn cục của
// Strapi. Giờ chúng lấy store qua đây: server gắn store Sanity thật, test gắn
// store giả trong bộ nhớ.
let current = null;

function setStore(store) {
  current = store || null;
}

function getStore() {
  if (!current) {
    throw new Error('Chưa khởi tạo store dữ liệu — gọi setStore() trước.');
  }
  return current;
}

module.exports = { setStore, getStore };
```

- [ ] **Step 6: Chạy test**

Run: `npm test 2>&1 | tail -8`
Expected: toàn bộ PASS (290 test: 285 cũ + 5 mới).

- [ ] **Step 7: Thêm `.env.example`, `.gitignore`, script gốc**

`dha-api/.env.example`:

```env
# Sanity — token quyền Editor, chỉ để trên máy chủ
SANITY_PROJECT_ID=
SANITY_DATASET=development
SANITY_API_TOKEN=
# Giữ nguyên giá trị đang dùng ở Strapi để phiên đăng nhập không bị đá ra
ADMIN_UI_SESSION_SECRET=
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
FRONTEND_URL=http://localhost:3000
PORT=1337
# IS_BEHIND_PROXY=true
# PRERENDER_SCRIPT=/var/www/web-ha-can/scripts/prerender-site-settings.js
# SITE_HTML_DIR=/var/www/dhakimloaimau.vn
```

Thêm vào `.gitignore`, ngay dưới khối `dha-cms/.tmp/`:

```gitignore
dha-api/node_modules/
dha-api/out/
```

và dưới `dha-cms/.env`:

```gitignore
dha-api/.env
```

Thêm vào `scripts` của `package.json` gốc:

```json
"api:install": "npm install --prefix dha-api",
"api:dev": "npm run dev --prefix dha-api"
```

Run: `git status --short`
Expected: không thấy `dha-api/node_modules/`.

- [ ] **Step 8: Commit**

```bash
git add dha-api/package.json dha-api/package-lock.json dha-api/.env.example dha-api/src .gitignore package.json tests/api-config.test.js
git commit -m "feat(dha-api): khung service mới, cấu hình và store registry

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 2: Dời khu admin-ui sang `dha-api`, chạy trên store

Service, route và rate limit của admin-ui chuyển sang `dha-api` gần như nguyên văn. Chỉ ba chỗ thay đổi: service lấy store qua `getStore()` thay cho `strapi.documents()`; `resource-config` đổi `uid` thành `sanityType`; đăng nhập đọc document `adminUser`. Test service cũ chạy tiếp trên bản giả `createFakeStore()`.

Test còn đọc file riêng của Strapi — `schema.json` cho validate form, `src/index.js`, lifecycles, `config/middlewares.js` — **giữ nguyên trong task này**. `dha-cms/` vẫn còn trong repo; từng test đó sẽ được trỏ sang file thay thế ở task tạo ra file đó.

**Files:**
- Create (chép rồi sửa): `dha-api/src/services/{auth,resources,resource-config,media,navigation,dashboard-metrics}.js`
- Create: `dha-api/src/http/rate-limit.js`, `dha-api/src/routes/admin-ui.js`
- Modify: `tests/helpers/admin-ui-harness.js`, `tests/admin-auth-edge.test.js`, `tests/admin-resources-edge.test.js`, `tests/admin-navigation-media-edge.test.js`, `tests/admin-ui-config.test.js`, `tests/admin-resource-fields.test.js`, `tests/product-categories.test.js`, và đường dẫn require/read trong `tests/admin-app.test.js`, `tests/admin-dashboard.test.js`, `tests/navigation.test.js`, `tests/news-editor.test.js`, `tests/regression.test.js`
- Test: `tests/api-rate-limit.test.js`

**Interfaces:**
- Consumes: `getStore()` (Task 1).
- Produces:
  - `RESOURCE_CONFIG[type].sanityType` (thay `uid`).
  - `createFakeStore(seed)` trong harness, seed khoá theo sanityType; trả `{ documents(type), __store, __calls, __rows(type) }`. Mỗi entry trong `__calls` ghi `type` thay cho `uid`.
  - `createRateLimit({ windowMs, max, now }) → async (ctx, next)`.
  - `createAdminUiRouter() → Router` (prefix `/api`).
  - Store phải có `documents(type)` với `findMany`, `findOne`, `count`, `create`, `update`, `delete`, `publish`, `unpublish`, đúng ngữ nghĩa của harness.

Bảng đổi tên dùng xuyên suốt kế hoạch:

| Strapi uid | sanityType |
|---|---|
| `api::news.news` | `news` |
| `api::product.product` | `product` |
| `api::product-category.product-category` | `productCategory` |
| `api::project.project` | `project` |
| `api::service.service` | `service` |
| `api::hero-slide.hero-slide` | `heroSlide` |
| `api::workflow-step.workflow-step` | `workflowStep` |
| `api::pricing-package.pricing-package` | `pricingPackage` |
| `api::pricing-analysis.pricing-analysis` | `pricingAnalysis` |
| `api::pricing-survey.pricing-survey` | `pricingSurvey` |
| `api::ore.ore` | `ore` |
| `api::site-setting.site-setting` | `siteSetting` |
| `api::navigation.navigation` | `navigation` |
| `api::contact-inquiry.contact-inquiry` | `contactInquiry` |
| `api::order-request.order-request` | `orderRequest` |

- [ ] **Step 1: Viết test thất bại cho rate limit — `tests/api-rate-limit.test.js`**

```js
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
```

Thêm `tests/api-rate-limit.test.js` vào script `test` của `package.json` gốc.

Run: `node --test tests/api-rate-limit.test.js`
Expected: FAIL — `Cannot find module '../dha-api/src/http/rate-limit'`.

- [ ] **Step 2: Viết `dha-api/src/http/rate-limit.js`**

```js
'use strict';

// Port từ dha-cms/src/middlewares/rate-limit.js. Mỗi route tạo một bộ đếm
// riêng; khoá theo IP + đường dẫn. IP chỉ đúng khi app.proxy bật sau nginx.
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX = 10;

function createRateLimit({ windowMs = DEFAULT_WINDOW_MS, max = DEFAULT_MAX, now = Date.now } = {}) {
  const counters = new Map();

  // unref: không giữ event loop sống, nếu không `npm test` treo sau khi chạy xong.
  const sweepTimer = setInterval(() => {
    const current = now();
    for (const [key, entry] of counters) {
      if (current - entry.start > windowMs) counters.delete(key);
    }
  }, 60 * 1000);
  if (typeof sweepTimer.unref === 'function') sweepTimer.unref();

  return async function rateLimit(ctx, next) {
    const ip = ctx.request.ip || ctx.ip || 'unknown';
    const key = `${ip}:${ctx.path}`;
    const current = now();

    let entry = counters.get(key);
    if (!entry || current - entry.start > windowMs) {
      entry = { count: 0, start: current };
      counters.set(key, entry);
    }
    entry.count += 1;

    if (entry.count > max) {
      ctx.status = 429;
      ctx.body = {
        error: {
          status: 429,
          name: 'TooManyRequestsError',
          message: 'Too many requests, please try again later.',
        },
      };
      return;
    }

    await next();
  };
}

module.exports = { createRateLimit };
```

Run: `node --test tests/api-rate-limit.test.js`
Expected: PASS (3 test).

- [ ] **Step 3: Chép service sang `dha-api` và thay mọi lời gọi Strapi**

```bash
for f in auth resources resource-config media navigation dashboard-metrics; do
  cp dha-cms/src/api/admin-ui/services/$f.js dha-api/src/services/$f.js
done
python3 - <<'PY'
import re
from pathlib import Path

S = Path('dha-api/src/services')
REGISTRY = "const { getStore } = require('../sanity/store-registry');\n"

def edit(name, pairs, add_registry=True):
    p = S / name
    s = p.read_text(encoding='utf-8')
    for old, new in pairs:
        assert old in s, f'{name}: không thấy {old!r}'
        s = s.replace(old, new)
    if add_registry:
        anchor = "const { sendError } = require('./errors');\n"
        assert anchor in s, f'{name}: không thấy dòng require errors'
        s = s.replace(anchor, anchor + REGISTRY, 1)
    assert 'strapi.' not in s, f'{name}: còn gọi strapi.'
    p.write_text(s, encoding='utf-8')

# resource-config.js: uid → sanityType
UIDS = {
    'api::news.news': 'news',
    'api::product.product': 'product',
    'api::product-category.product-category': 'productCategory',
    'api::project.project': 'project',
    'api::service.service': 'service',
    'api::hero-slide.hero-slide': 'heroSlide',
    'api::workflow-step.workflow-step': 'workflowStep',
    'api::pricing-package.pricing-package': 'pricingPackage',
    'api::pricing-analysis.pricing-analysis': 'pricingAnalysis',
    'api::pricing-survey.pricing-survey': 'pricingSurvey',
    'api::site-setting.site-setting': 'siteSetting',
    'api::contact-inquiry.contact-inquiry': 'contactInquiry',
    'api::order-request.order-request': 'orderRequest',
}
edit('resource-config.js', [(f"uid: '{u}'", f"sanityType: '{t}'") for u, t in UIDS.items()], add_registry=False)

edit('resources.js', [
    ("const CONTACT_UID = 'api::contact-inquiry.contact-inquiry';", "const CONTACT_TYPE = 'contactInquiry';"),
    ("const ORDER_UID = 'api::order-request.order-request';", "const ORDER_TYPE = 'orderRequest';"),
    ("const PRODUCT_UID = 'api::product.product';", "const PRODUCT_TYPE = 'product';"),
    ("strapi.documents(config.uid)", "getStore().documents(config.sanityType)"),
    ("strapi.documents(CONTACT_UID)", "getStore().documents(CONTACT_TYPE)"),
    ("strapi.documents(ORDER_UID)", "getStore().documents(ORDER_TYPE)"),
    ("strapi.documents(PRODUCT_UID)", "getStore().documents(PRODUCT_TYPE)"),
    ("resources: listResourceConfigs().map(({ uid, ...config }) => config),",
     "resources: listResourceConfigs().map(({ sanityType, ...config }) => config),"),
])

edit('navigation.js', [
    ("require('../../navigation/default-items')", "require('../defaults/default-items')"),
    ("const NAV_UID = 'api::navigation.navigation';", "const NAV_TYPE = 'navigation';"),
    ("strapi.documents(NAV_UID)", "getStore().documents(NAV_TYPE)"),
])

edit('media.js', [("strapi.documents(config.uid)", "getStore().documents(config.sanityType)")])
PY
```

`str.replace` thay mọi lần xuất hiện. Riêng `resources.js` có 5 chỗ `strapi.documents(config.uid)` và 5 chỗ gọi theo hằng; script tự kiểm không còn `strapi.` nào sót.

Run: `grep -n "strapi\.\|config\.uid\|_UID" dha-api/src/services/*.js`
Expected: chỉ còn các dòng trong `auth.js` (sửa ở Step 4).

- [ ] **Step 4: Đổi đăng nhập sang document `adminUser`**

```bash
python3 - <<'PY'
import re
from pathlib import Path

p = Path('dha-api/src/services/auth.js')
s = p.read_text(encoding='utf-8')

anchor = "const { sendError } = require('./errors');\n"
s = s.replace(anchor, "const bcrypt = require('bcryptjs');\n" + anchor + "const { getStore } = require('../sanity/store-registry');\n", 1)

new_lookup = '''// Tài khoản quản trị là document `adminUser` (id dạng `adminUser.<id>`, không
// bao giờ đọc được khi thiếu token). Hash bcrypt chép nguyên từ bảng
// admin_users của Strapi nên mật khẩu cũ vẫn dùng được.
async function findAdminUser(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  const [user] = await getStore().documents('adminUser').findMany({
    filters: { email: { $eq: normalized }, isActive: true },
    limit: 1,
  });
  return user || null;
}

async function validateAdminPassword(user, password) {
  if (!user || !user.passwordHash) return false;
  return bcrypt.compare(String(password), user.passwordHash);
}

'''
s, count = re.subn(r"async function findAdminUser\(strapi, email\) \{.*?\n(?=async function login)", new_lookup, s, flags=re.S)
assert count == 1, 'không tìm thấy khối findAdminUser/validateAdminPassword'

for old, new in [
    ("await findAdminUser(strapi, email)", "await findAdminUser(email)"),
    ("await validateAdminPassword(strapi, user, password)", "await validateAdminPassword(user, password)"),
    ("    sub: user.id,\n", "    sub: user.documentId,\n"),
]:
    assert old in s, old
    s = s.replace(old, new)

assert 'strapi' not in s
p.write_text(s, encoding='utf-8')
PY
```

Run: `grep -n "strapi" dha-api/src/services/*.js`
Expected: không có kết quả.

- [ ] **Step 5: Viết `dha-api/src/routes/admin-ui.js`**

```js
'use strict';

const Router = require('@koa/router');

const auth = require('../services/auth');
const media = require('../services/media');
const resources = require('../services/resources');
const navigation = require('../services/navigation');
const { createRateLimit } = require('../http/rate-limit');

// Đường dẫn giữ nguyên như route Strapi cũ (dha-cms/src/api/admin-ui/routes)
// vì admin/ gọi đúng các địa chỉ này. Kiểm tra phiên và nguồn yêu cầu nằm
// trong từng service, không nằm ở router.
function createAdminUiRouter() {
  const router = new Router({ prefix: '/api' });

  router.post('/admin-ui/auth/login', createRateLimit({ windowMs: 15 * 60 * 1000, max: 5 }), auth.login);
  router.get('/admin-ui/auth/me', auth.me);
  router.post('/admin-ui/auth/logout', auth.logout);
  router.get('/admin-ui/meta', resources.meta);
  router.get('/admin-ui/dashboard', resources.dashboard);
  router.get('/admin-ui/media', media.list);
  router.post('/admin-ui/media/upload', media.upload);
  router.delete('/admin-ui/media/:publicId', media.delete);
  router.get('/admin-ui/navigation', navigation.get);
  router.put('/admin-ui/navigation', navigation.update);
  router.get('/admin-ui/resources/:type', resources.list);
  router.post('/admin-ui/resources/:type', resources.create);
  router.get('/admin-ui/resources/:type/:id', resources.get);
  router.put('/admin-ui/resources/:type/:id', resources.update);
  router.delete('/admin-ui/resources/:type/:id', resources.delete);
  router.post('/admin-ui/resources/:type/:id/publish', resources.publish);
  router.post('/admin-ui/resources/:type/:id/unpublish', resources.unpublish);

  return router;
}

module.exports = { createAdminUiRouter };
```

- [ ] **Step 6: Đổi harness sang `createFakeStore`**

```bash
python3 - <<'PY'
from pathlib import Path

p = Path('tests/helpers/admin-ui-harness.js')
s = p.read_text(encoding='utf-8')
pairs = [
    ("// Bộ giả lập tối thiểu cho Strapi + Koa context, đủ để gọi thẳng các service\n// của admin-ui trong test mà không cần dựng cả CMS.",
     "// Bộ giả lập tối thiểu cho store dữ liệu + Koa context, đủ để gọi thẳng các\n// service của admin-ui trong test mà không cần Sanity.\n//\n// createFakeStore() là bản mẫu hành vi: store Sanity thật (dha-api/src/sanity/\n// store.js) phải qua cùng bộ test hợp đồng trong document-store-contract.js."),
    ("const crypto = require('node:crypto');\n",
     "const crypto = require('node:crypto');\n\nconst { setStore } = require('../../dha-api/src/sanity/store-registry');\n"),
    ("function createFakeStrapi(seed = {}) {", "function createFakeStore(seed = {}) {"),
    ("  for (const [uid, entries] of Object.entries(seed)) {\n    store.set(\n      uid,",
     "  for (const [type, entries] of Object.entries(seed)) {\n    store.set(\n      type,"),
    ("    db: { query: () => ({ findOne: async () => null }) },\n", ""),
    ("function withStrapi(fake, run) {\n  const previous = global.strapi;\n  global.strapi = fake;\n  try {\n    return run();\n  } finally {\n    global.strapi = previous;\n  }\n}",
     "function withStore(fake, run) {\n  setStore(fake);\n  try {\n    return run();\n  } finally {\n    setStore(null);\n  }\n}"),
    ("  createFakeStrapi,\n  withStrapi,", "  createFakeStore,\n  withStore,"),
]
for old, new in pairs:
    assert old in s, old[:60]
    s = s.replace(old, new)
# Đổi tên tham số uid → type trong document service giả (rowsOf, documents, calls).
s = s.replace('rowsOf(uid)', 'rowsOf(type)').replace('function documents(uid)', 'function documents(type)')
s = s.replace('function rowsOf(uid) {\n    if (!store.has(uid)) store.set(uid, []);\n    return store.get(uid);',
              'function rowsOf(type) {\n    if (!store.has(type)) store.set(type, []);\n    return store.get(type);')
s = s.replace('calls.push({ uid,', 'calls.push({ type,')
assert 'uid' not in s.split('function createFakeStore')[1], 'còn sót uid trong createFakeStore'
p.write_text(s, encoding='utf-8')
PY
```

Run: `grep -n "strapi\|uid" tests/helpers/admin-ui-harness.js`
Expected: không có kết quả.

- [ ] **Step 7: Trỏ đường dẫn test sang `dha-api`**

```bash
python3 - <<'PY'
import re
from pathlib import Path

T = Path('tests')
REPOINT = [
    ('dha-cms/src/api/admin-ui/services/', 'dha-api/src/services/'),
    ('dha-cms/src/api/admin-ui/routes/admin-ui.js', 'dha-api/src/routes/admin-ui.js'),
]
for p in T.glob('*.test.js'):
    s = p.read_text(encoding='utf-8')
    n = s
    for old, new in REPOINT:
        n = n.replace(old, new)
    if n != s:
        p.write_text(n, encoding='utf-8')
        print('trỏ lại:', p.name)

UIDS = {
    "'api::news.news'": "'news'",
    "'api::product.product'": "'product'",
    "'api::site-setting.site-setting'": "'siteSetting'",
    "'api::order-request.order-request'": "'orderRequest'",
    "'api::navigation.navigation'": "'navigation'",
    "'api::project.project'": "'project'",
}
REGISTRY_REQUIRE = "const { setStore } = require('../dha-api/src/sanity/store-registry');\n"

for name in ['admin-resources-edge.test.js', 'admin-navigation-media-edge.test.js']:
    p = T / name
    s = p.read_text(encoding='utf-8')
    for old, new in UIDS.items():
        s = s.replace(old, new)
    s = s.replace('createFakeStrapi', 'createFakeStore')
    # Khối seed nhiều dòng (kết thúc bằng "  });") trước, rồi tới gán một dòng.
    s = re.sub(r"global\.strapi = createFakeStore\((\{.*?\n  \})\);", r"setStore(createFakeStore(\1));", s, flags=re.S)
    s = re.sub(r"global\.strapi = undefined;", "setStore(null);", s)
    s = re.sub(r"global\.strapi = (.+);", r"setStore(\1);", s)
    anchor = "require('./helpers/admin-ui-harness');\n"
    s = s.replace(anchor, anchor + REGISTRY_REQUIRE, 1)
    assert 'global.strapi' not in s, name
    p.write_text(s, encoding='utf-8')
    print('đổi store:', name)
PY
```

Run: `grep -n "global.strapi\|createFakeStrapi\|api::" tests/admin-resources-edge.test.js tests/admin-navigation-media-edge.test.js`
Expected: không có kết quả.

- [ ] **Step 8: Viết lại phần đăng nhập trong `tests/admin-auth-edge.test.js`**

```bash
python3 - <<'PY'
import re
from pathlib import Path

p = Path('tests/admin-auth-edge.test.js')
s = p.read_text(encoding='utf-8')

old_helper = re.search(r"function fakeStrapiWithUser\(.*?\n}\n", s, flags=re.S).group(0)
s = s.replace(old_helper, '''const bcrypt = require('../dha-api/node_modules/bcryptjs');
const { setStore } = require('../dha-api/src/sanity/store-registry');
const { createFakeStore } = require('./helpers/admin-ui-harness');

// Hash thật (cost 4 cho nhanh) để test đi đúng đường bcrypt.compare như production.
const ADMIN = {
  documentId: 'adminUser.u1',
  email: 'admin@dha.vn',
  passwordHash: bcrypt.hashSync('dung', 4),
  isActive: true,
  firstname: 'A',
  lastname: 'B',
};

function useAdminUsers(users) {
  const fake = createFakeStore({ adminUser: users });
  setStore(fake);
  return fake;
}
''')

s = s.replace("  global.strapi = undefined;", "  setStore(null);")
s = s.replace("  global.strapi = fakeStrapiWithUser(null);", "  useAdminUsers([]);")
s = s.replace("  global.strapi = fakeStrapiWithUser(user, { passwordOk: false });", "  useAdminUsers([ADMIN]);")
s = s.replace("  global.strapi = fakeStrapiWithUser(user);", "  useAdminUsers([ADMIN]);")
s = re.sub(r"  const user = \{ id: 1, email: 'admin@dha\.vn', password: 'hash'[^\n]*\};\n", "", s)
assert 'strapi' not in s, 'còn sót strapi'
assert 'const user =' not in s

s += '''
test('tài khoản bị khoá hoặc không có hash thì không đăng nhập được', async () => {
  for (const user of [{ ...ADMIN, isActive: false }, { ...ADMIN, passwordHash: undefined }]) {
    useAdminUsers([user]);
    const ctx = buildCtx({ body: { email: 'admin@dha.vn', password: 'dung' }, cookie: null });
    await auth.login(ctx);
    assert.equal(ctx.status, 401, JSON.stringify({ isActive: user.isActive, hasHash: Boolean(user.passwordHash) }));
  }
});

test('phiên đăng nhập mang documentId của adminUser', async () => {
  useAdminUsers([ADMIN]);
  const ctx = buildCtx({ body: { email: 'admin@dha.vn', password: 'dung' }, cookie: null });
  await auth.login(ctx);
  assert.equal(ctx.body.user.id, 'adminUser.u1');
});
'''
p.write_text(s, encoding='utf-8')
PY
```

Run: `grep -n "strapi" tests/admin-auth-edge.test.js`
Expected: không có kết quả.

- [ ] **Step 9: Sửa các assert còn nhắc tới Strapi**

```bash
python3 - <<'PY'
from pathlib import Path

def edit(path, pairs):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    for old, new in pairs:
        assert s.count(old) == 1, f'{path}: {old[:70]!r}'
        s = s.replace(old, new)
    p.write_text(s, encoding='utf-8')

edit('tests/admin-ui-config.test.js', [
    ("assert.equal(getResourceConfig('projects')?.uid, 'api::project.project');",
     "assert.equal(getResourceConfig('projects')?.sanityType, 'project');"),
    ("  assert.match(routesSource, /auth:\\s*false/, 'admin-ui routes bypass Strapi Content API auth');\n",
     "  assert.doesNotMatch(authSource, /strapi/, 'auth không còn phụ thuộc Strapi');\n"),
    ("assert.match(routesSource, /path:\\s*['\"]\\/admin-ui\\/auth\\/login['\"][\\s\\S]*name:\\s*['\"]global::rate-limit['\"]/, 'login route uses global rate-limit middleware');",
     "assert.match(routesSource, /['\"]\\/admin-ui\\/auth\\/login['\"],\\s*createRateLimit\\(/, 'login route uses the rate-limit middleware');"),
    ("assert.match(source, /strapi\\.documents\\(config\\.uid\\)/, 'resource service uses Strapi 5 document service');",
     "assert.match(source, /getStore\\(\\)\\.documents\\(config\\.sanityType\\)/, 'resource service reads through the document store');"),
    ("assert.doesNotMatch(source, /strapi\\.documents\\(ctx\\.params\\.type\\)/, 'route param is never used as a document UID');",
     "assert.doesNotMatch(source, /documents\\(ctx\\.params\\.type\\)/, 'route param is never used as a document type');"),
    ("const packageJson = JSON.parse(read('dha-cms/package.json'));",
     "const packageJson = JSON.parse(read('dha-api/package.json'));"),
])

edit('tests/admin-resource-fields.test.js', [
    ("function readSchema(uid) {\n  // uid dạng api::project.project → dha-cms/src/api/project/content-types/project\n  const [, name] = uid.split('::');\n  const [api, singular] = name.split('.');\n  const file = path.join(root, 'dha-cms/src/api', api, 'content-types', singular, 'schema.json');\n  return JSON.parse(fs.readFileSync(file, 'utf8'));\n}",
     "function readSchema(sanityType) {\n  // schema.json của Strapi được chép sang dha-api/src/schemas/<sanityType>.json\n  const file = path.join(root, 'dha-api/src/schemas', `${sanityType}.json`);\n  return JSON.parse(fs.readFileSync(file, 'utf8'));\n}"),
])
p = Path('tests/admin-resource-fields.test.js')
s = p.read_text(encoding='utf-8').replace('readSchema(config.uid)', 'readSchema(config.sanityType)').replace('${config.uid}', '${config.sanityType}')
assert 'config.uid' not in s
p.write_text(s, encoding='utf-8')

edit('tests/product-categories.test.js', [
    ("const { getResourceConfig } = require('../dha-cms/src/api/admin-ui/services/resource-config');",
     "const { getResourceConfig } = require('../dha-api/src/services/resource-config');"),
    ("assert.equal(config.uid, 'api::product-category.product-category');",
     "assert.equal(config.sanityType, 'productCategory');"),
])
PY
```

Run: `grep -rn "admin-ui/services\|config\.uid" tests/*.js`
Expected: không có kết quả. (`dha-cms/...schema.json`, `dha-cms/src/index.js`, lifecycles, `dha-cms/config/middlewares.js` vẫn còn — đúng dự kiến, các task sau sẽ trỏ lại.)

- [ ] **Step 10: Chạy toàn bộ test**

Run: `npm test 2>&1 | tail -8`
Expected: toàn bộ PASS — 285 cũ + 5 (Task 1) + 3 rate limit + 2 đăng nhập mới = 295.

Nếu một test service đỏ: lỗi nằm ở bước đổi tên (Step 3–7), không phải ở test. So file vừa sửa với bản gốc bằng `diff dha-cms/src/api/admin-ui/services/<f>.js dha-api/src/services/<f>.js` — khác biệt chỉ được là những dòng liệt kê ở Step 3–4.

- [ ] **Step 11: Commit**

```bash
git add dha-api/src tests package.json
git commit -m "refactor(dha-api): dời khu admin-ui sang dha-api, đọc ghi qua store

Service admin-ui lấy store qua getStore() thay cho strapi.documents();
resource-config đổi uid sang sanityType; đăng nhập đọc document adminUser.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 3: Query engine trong bộ nhớ

**Files:**
- Create: `dha-api/src/sanity/query-engine.js`
- Test: `tests/api-query-engine.test.js`

**Interfaces:**
- Produces:
  - `matchesFilters(entry, filters) → boolean` — hỗ trợ `$or`, `$and`, `$eq`, `$in`, `$null`, `$contains`, `$containsi`, `$gte` và giá trị trần (≡ bằng nhau); toán tử lạ ném `Error('Toán tử lọc không hỗ trợ: <op>')`.
  - `sortEntries(entries, sort) → entries[]` — `sort` là `{ field: 'asc'|'desc' }` hoặc mảng các object đó; không đổi mảng gốc; `null` đứng đầu khi tăng dần (như SQLite).
  - `pickFields(entry, fields) → object` — luôn giữ `id`, `documentId`; `fields` rỗng/thiếu thì trả bản sao đầy đủ.

- [ ] **Step 1: Viết test thất bại `tests/api-query-engine.test.js`**

```js
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
```

Thêm `tests/api-query-engine.test.js` vào script `test` của `package.json` gốc.

Run: `node --test tests/api-query-engine.test.js`
Expected: FAIL — `Cannot find module '../dha-api/src/sanity/query-engine'`.

- [ ] **Step 2: Viết `dha-api/src/sanity/query-engine.js`**

```js
'use strict';

// Lọc / sắp xếp / chọn trường trong bộ nhớ, đúng ngữ nghĩa Document Service của
// Strapi mà admin-ui và API công khai dựa vào. Không dịch sang GROQ vì GROQ
// không có phép "chứa chuỗi con, không phân biệt hoa thường" — `match` tách theo
// từ. Dữ liệu nhỏ (spec mục 4) nên lọc tại chỗ là đủ nhanh.

const OPERATORS = {
  $eq: (value, operand) => value === operand,
  $in: (value, operand) => Array.isArray(operand) && operand.includes(value),
  $null: (value, operand) => (operand ? value == null : value != null),
  $contains: (value, operand) => String(value ?? '').includes(String(operand)),
  $containsi: (value, operand) =>
    String(value ?? '').toLowerCase().includes(String(operand).toLowerCase()),
  $gte: (value, operand) => value != null && new Date(value) >= new Date(operand),
};

function isCondition(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function unsupported(operator) {
  return new Error(`Toán tử lọc không hỗ trợ: ${operator}`);
}

function matchesFilters(entry, filters) {
  if (!filters) return true;
  return Object.entries(filters).every(([key, condition]) => {
    if (key === '$or') return Array.isArray(condition) && condition.some((sub) => matchesFilters(entry, sub));
    if (key === '$and') return Array.isArray(condition) && condition.every((sub) => matchesFilters(entry, sub));
    if (key.startsWith('$')) throw unsupported(key);

    if (isCondition(condition)) {
      return Object.entries(condition).every(([operator, operand]) => {
        const check = OPERATORS[operator];
        if (!check) throw unsupported(operator);
        return check(entry[key], operand);
      });
    }
    return entry[key] === condition;
  });
}

function normalizeSort(sort) {
  if (!sort) return [];
  const list = Array.isArray(sort) ? sort : [sort];
  return list
    .flatMap((item) => Object.entries(item || {}))
    .map(([field, direction]) => [field, String(direction).toLowerCase() === 'desc' ? 'desc' : 'asc']);
}

// NULL nhỏ nhất, như SQLite mà Strapi đang chạy.
function compareValues(left, right) {
  if (left === right) return 0;
  if (left == null) return -1;
  if (right == null) return 1;
  return left < right ? -1 : 1;
}

function sortEntries(entries, sort) {
  const keys = normalizeSort(sort);
  const copy = entries.slice();
  if (!keys.length) return copy;
  return copy.sort((a, b) => {
    for (const [field, direction] of keys) {
      const result = compareValues(a[field], b[field]);
      if (result) return direction === 'desc' ? -result : result;
    }
    return 0;
  });
}

function pickFields(entry, fields) {
  if (!fields || !fields.length) return { ...entry };
  const picked = { id: entry.id, documentId: entry.documentId };
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(entry, field)) picked[field] = entry[field];
  }
  return picked;
}

module.exports = { matchesFilters, sortEntries, pickFields };
```

- [ ] **Step 3: Chạy test**

Run: `node --test tests/api-query-engine.test.js && npm test 2>&1 | tail -4`
Expected: PASS 8/8; toàn bộ `npm test` xanh.

- [ ] **Step 4: Commit**

```bash
git add dha-api/src/sanity/query-engine.js tests/api-query-engine.test.js package.json
git commit -m "feat(dha-api): query engine lọc/sắp xếp trong bộ nhớ theo ngữ nghĩa Strapi

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 4: Store Sanity — `createSanityStore()`

**Files:**
- Create: `dha-api/src/sanity/types.js`, `dha-api/src/sanity/cache.js`, `dha-api/src/sanity/store.js`
- Create: `tests/helpers/fake-sanity-client.js`, `tests/helpers/document-store-contract.js`
- Test: `tests/api-sanity-types.test.js`, `tests/api-sanity-store.test.js`

**Interfaces:**
- Consumes: `matchesFilters`, `sortEntries`, `pickFields` (Task 3); `createFakeStore` (Task 2).
- Produces:
  - `TYPES`, `getTypeOptions(type) → { drafts, singletonId?, idPrefix? }` (type lạ → ném lỗi).
  - `createTypeCache({ load, ttlMs = 300000, now }) → { get(type): Promise, invalidate() }`.
  - `createSanityStore({ client, ttlMs }) → { documents(type) }`; `documents(type)` có đủ `findMany({ fields, filters, sort, start, limit = 100, status = 'draft' })`, `findOne({ documentId, fields, status })`, `count({ filters, status })`, `create({ data })`, `update({ documentId, data })`, `delete({ documentId })`, `publish({ documentId })`, `unpublish({ documentId })`.
  - `client` chỉ cần `fetch('*[_type == $type]', { type })` và `transaction()` với `create`, `createOrReplace`, `createIfNotExists`, `delete`, `patch(id, { set })`, `commit(options)`.
  - `createFakeSanityClient(docs) → client` kèm `stats: { fetches, commits }` và getter `docs` (Map `_id → doc`).
  - `runDocumentStoreContract(label, makeStore)`, trong đó `makeStore() → store` rỗng.

**Ngữ nghĩa phải giữ (khớp harness và Strapi 5):**

| Góc nhìn | Dùng khi | Nội dung | `publishedAt` |
|---|---|---|---|
| nháp (`status: 'draft'`, mặc định) | admin đọc | bản nháp nếu có, không thì bản xuất bản | luôn `null` với type có nháp |
| xuất bản (`status: 'published'`) | web đọc | chỉ bản đã xuất bản | thời điểm xuất bản |
| trạng thái | lọc/sắp xếp/đếm ở góc nhìn nháp | nội dung như góc nhìn nháp | `publishedAt` thật, `null` nếu chưa xuất bản |

Góc nhìn "trạng thái" là lý do `count({ filters: { publishedAt: { $null: true } } })` trên dashboard đếm đúng số bài chưa xuất bản.

- [ ] **Step 1: Viết test thất bại cho bảng type — `tests/api-sanity-types.test.js`**

```js
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { TYPES, getTypeOptions } = require('../dha-api/src/sanity/types');
const { listResourceConfigs } = require('../dha-api/src/services/resource-config');

const SCHEMA_DIR = path.join(__dirname, '..', 'dha-api', 'src', 'schemas');

test('cờ nháp và singleton khớp với schema Strapi đã chép sang', () => {
  const files = fs.readdirSync(SCHEMA_DIR).filter((name) => name.endsWith('.json'));
  assert.equal(files.length, 15);
  for (const file of files) {
    const type = path.basename(file, '.json');
    const schema = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf8'));
    const options = getTypeOptions(type);
    assert.equal(options.drafts, Boolean(schema.options && schema.options.draftAndPublish), `${type}.drafts`);
    assert.equal(Boolean(options.singletonId), schema.kind === 'singleType', `${type} singleton`);
  }
});

test('mọi module admin đều có trong bảng type', () => {
  for (const config of listResourceConfigs()) {
    assert.ok(TYPES[config.sanityType], `${config.type} → ${config.sanityType}`);
  }
});

test('adminUser dùng id có dấu chấm, type lạ bị từ chối', () => {
  assert.equal(getTypeOptions('adminUser').idPrefix, 'adminUser.');
  assert.throws(() => getTypeOptions('user'), /không được khai báo/);
  assert.throws(() => getTypeOptions('__proto__'), /không được khai báo/);
});
```

Thêm `tests/api-sanity-types.test.js` vào script `test`.

Run: `node --test tests/api-sanity-types.test.js`
Expected: FAIL — `Cannot find module '../dha-api/src/sanity/types'`.

- [ ] **Step 2: Viết `dha-api/src/sanity/types.js`**

```js
'use strict';

// Loại nào có cặp nháp/xuất bản lấy từ `options.draftAndPublish` trong schema
// Strapi cũ (dha-api/src/schemas/*.json); tests/api-sanity-types.test.js canh
// hai nơi khớp nhau. `ore` không có trong resource-config nên phải khai ở đây.
const TYPES = {
  news: { drafts: true },
  project: { drafts: true },
  service: { drafts: true },
  heroSlide: { drafts: true },
  workflowStep: { drafts: true },
  pricingAnalysis: { drafts: true },
  pricingSurvey: { drafts: true },
  ore: { drafts: true },
  product: { drafts: false },
  productCategory: { drafts: false },
  pricingPackage: { drafts: false },
  contactInquiry: { drafts: false },
  orderRequest: { drafts: false },
  siteSetting: { drafts: false, singletonId: 'siteSetting' },
  navigation: { drafts: false, singletonId: 'navigation' },
  // Id có dấu chấm: Sanity không trả loại document này cho truy vấn không token,
  // kể cả khi dataset lỡ để public (spec mục 3a).
  adminUser: { drafts: false, idPrefix: 'adminUser.' },
};

function getTypeOptions(type) {
  if (!Object.prototype.hasOwnProperty.call(TYPES, type)) {
    throw new Error(`Loại document không được khai báo: ${type}`);
  }
  return TYPES[type];
}

module.exports = { TYPES, getTypeOptions };
```

Run: `node --test tests/api-sanity-types.test.js`
Expected: PASS 3/3.

- [ ] **Step 3: Viết client Sanity giả — `tests/helpers/fake-sanity-client.js`**

```js
'use strict';

// Client Sanity giả trong bộ nhớ: đủ đúng một truy vấn mà store dùng
// (`*[_type == $type]`) và các mutation trong transaction. Transaction áp dụng
// trọn gói hoặc không gì cả, như Sanity thật.
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFakeSanityClient(initialDocs = []) {
  let revision = 0;
  let docs = new Map();
  const stats = { fetches: 0, commits: 0 };

  function stamp(doc, existing) {
    revision += 1;
    const at = new Date(Date.UTC(2026, 1, 1, 0, 0, revision)).toISOString();
    return { ...doc, _createdAt: (existing && existing._createdAt) || at, _updatedAt: at, _rev: `r${revision}` };
  }

  for (const doc of initialDocs) docs.set(doc._id, stamp(clone(doc)));

  return {
    stats,
    get docs() {
      return docs;
    },

    async fetch(query, params = {}) {
      stats.fetches += 1;
      if (query !== '*[_type == $type]') {
        throw new Error(`Truy vấn chưa hỗ trợ trong client giả: ${query}`);
      }
      return [...docs.values()].filter((doc) => doc._type === params.type).map(clone);
    },

    transaction() {
      const ops = [];
      const tx = {
        create(doc) { ops.push(['create', clone(doc)]); return tx; },
        createOrReplace(doc) { ops.push(['createOrReplace', clone(doc)]); return tx; },
        createIfNotExists(doc) { ops.push(['createIfNotExists', clone(doc)]); return tx; },
        delete(id) { ops.push(['delete', id]); return tx; },
        patch(id, patch) { ops.push(['patch', id, clone(patch)]); return tx; },
        async commit() {
          const next = new Map(docs);
          for (const [op, subject, patch] of ops) {
            if (op === 'create') {
              if (next.has(subject._id)) throw new Error(`Document already exists: ${subject._id}`);
              next.set(subject._id, stamp(subject));
            } else if (op === 'createOrReplace') {
              next.set(subject._id, stamp(subject, next.get(subject._id)));
            } else if (op === 'createIfNotExists') {
              if (!next.has(subject._id)) next.set(subject._id, stamp(subject));
            } else if (op === 'delete') {
              next.delete(subject);
            } else if (op === 'patch') {
              const current = next.get(subject);
              if (!current) throw new Error(`Document not found: ${subject}`);
              next.set(subject, stamp({ ...current, ...patch.set }, current));
            }
          }
          docs = next;
          stats.commits += 1;
          return { transactionId: `tx${stats.commits}`, results: ops.map(() => ({})) };
        },
      };
      return tx;
    },
  };
}

module.exports = { createFakeSanityClient };
```

- [ ] **Step 4: Viết bộ test hợp đồng — `tests/helpers/document-store-contract.js`**

Bộ này chạy trên cả `createFakeStore()` (bản mẫu mà mọi test service đang dựa vào) lẫn store Sanity thật. Chỉ kiểm những gì hai bên đều phải làm được.

```js
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

// Hợp đồng tối thiểu mà service admin-ui dựa vào. makeStore() trả store rỗng.
function runDocumentStoreContract(label, makeStore) {
  test(`[${label}] tạo mới: góc nhìn nháp có publishedAt null, web chưa thấy`, async () => {
    const news = makeStore().documents('news');
    const created = await news.create({ data: { title: 'Giá đồng', slug: 'gia-dong' } });
    assert.ok(created.documentId);
    assert.equal(created.publishedAt, null);
    assert.equal((await news.findOne({ documentId: created.documentId })).title, 'Giá đồng');
    assert.equal(await news.findOne({ documentId: created.documentId, status: 'published' }), null);
    assert.deepEqual(await news.findMany({ status: 'published' }), []);
    assert.equal(await news.count({}), 1);
    assert.equal(await news.count({ filters: { publishedAt: { $null: true } } }), 1);
  });

  test(`[${label}] xuất bản: web thấy, góc nhìn nháp vẫn publishedAt null`, async () => {
    const news = makeStore().documents('news');
    const { documentId } = await news.create({ data: { title: 'A', slug: 'a' } });
    const published = await news.publish({ documentId });
    assert.equal(typeof published.publishedAt, 'string');

    const [row] = await news.findMany({ status: 'published' });
    assert.equal(row.documentId, documentId);
    assert.equal(row.title, 'A');
    assert.equal((await news.findOne({ documentId })).publishedAt, null);
    assert.equal(await news.count({ filters: { publishedAt: { $null: true } } }), 0);
  });

  test(`[${label}] sửa rồi xuất bản lại thì web thấy nội dung mới`, async () => {
    const news = makeStore().documents('news');
    const { documentId } = await news.create({ data: { title: 'Cũ', slug: 'a' } });
    await news.publish({ documentId });
    const updated = await news.update({ documentId, data: { title: 'Mới' } });
    assert.equal(updated.title, 'Mới');
    await news.publish({ documentId });
    assert.equal((await news.findOne({ documentId, status: 'published' })).title, 'Mới');
    assert.equal(await news.count({}), 1, 'không đếm đôi nháp + xuất bản');
  });

  test(`[${label}] gỡ xuất bản: web mất, admin còn nguyên nội dung`, async () => {
    const news = makeStore().documents('news');
    const { documentId } = await news.create({ data: { title: 'A', slug: 'a' } });
    await news.publish({ documentId });
    await news.unpublish({ documentId });
    assert.equal(await news.findOne({ documentId, status: 'published' }), null);
    assert.equal((await news.findOne({ documentId })).title, 'A');
    assert.equal(await news.count({ filters: { publishedAt: { $null: true } } }), 1);
  });

  test(`[${label}] xoá: mất ở mọi góc nhìn`, async () => {
    const news = makeStore().documents('news');
    const { documentId } = await news.create({ data: { title: 'A', slug: 'a' } });
    await news.publish({ documentId });
    await news.delete({ documentId });
    assert.equal(await news.findOne({ documentId }), null);
    assert.equal(await news.count({}), 0);
  });

  test(`[${label}] lọc, sắp xếp, phân trang, chọn trường`, async () => {
    const news = makeStore().documents('news');
    for (const title of ['Giá Đồng', 'Giá nhôm', 'Thiếc', 'Giá chì']) {
      await news.create({ data: { title, slug: title } });
    }
    const filters = { $or: [{ title: { $containsi: 'giá' } }] };
    assert.equal(await news.count({ filters }), 3);

    const rows = await news.findMany({ filters, sort: { title: 'desc' }, start: 1, limit: 1, fields: ['title'] });
    assert.equal(rows.length, 1);
    // So theo code unit như SQLite: 'Đ' (U+0110) > 'n' > 'c' → Đồng, nhôm, chì.
    assert.equal(rows[0].title, 'Giá nhôm');
    assert.deepEqual(Object.keys(rows[0]).sort(), ['documentId', 'id', 'title']);
  });

  test(`[${label}] không có bản ghi thì findOne trả null`, async () => {
    assert.equal(await makeStore().documents('news').findOne({ documentId: 'khong-co' }), null);
  });
}

module.exports = { runDocumentStoreContract };
```

- [ ] **Step 5: Viết test thất bại cho store — `tests/api-sanity-store.test.js`**

```js
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
```

Thêm `tests/api-sanity-store.test.js` vào script `test`.

Run: `node --test tests/api-sanity-store.test.js`
Expected: FAIL — `Cannot find module '../dha-api/src/sanity/store'`. (Nếu lỗi nằm ở `cache`, module đó cũng chưa có — đúng dự kiến.)

- [ ] **Step 6: Viết `dha-api/src/sanity/cache.js`**

```js
'use strict';

// Cache kết quả đọc theo type, sống trong tiến trình. Chỉ dha-api ghi vào
// dataset (pm2 instances: 1), nên xoá sạch cache mỗi lần ghi là đủ để admin sửa
// xong web đổi ngay. TTL chỉ để bắt thay đổi từ nơi khác (import, Studio) và
// giữ số request lên Sanity thấp — gói free chặn cứng khi hết hạn mức.
const DEFAULT_TTL_MS = 5 * 60 * 1000;

function createTypeCache({ load, ttlMs = DEFAULT_TTL_MS, now = Date.now }) {
  const entries = new Map();

  return {
    get(type) {
      const hit = entries.get(type);
      if (hit && now() - hit.at < ttlMs) return hit.promise;

      const promise = Promise.resolve().then(() => load(type));
      entries.set(type, { at: now(), promise });
      // Lỗi không được nằm lại trong cache: lần đọc sau phải thử lại.
      promise.catch(() => {
        if (entries.get(type)?.promise === promise) entries.delete(type);
      });
      return promise;
    },

    invalidate() {
      entries.clear();
    },
  };
}

module.exports = { createTypeCache, DEFAULT_TTL_MS };
```

- [ ] **Step 7: Viết `dha-api/src/sanity/store.js`**

```js
'use strict';

const crypto = require('node:crypto');

const { getTypeOptions } = require('./types');
const { createTypeCache } = require('./cache');
const { matchesFilters, sortEntries, pickFields } = require('./query-engine');

// Dựng lại đúng phần Document Service của Strapi 5 mà khu admin-ui gọi, trên
// Sanity. Nháp nằm ở `drafts.<id>`, bản xuất bản ở `<id>` — cùng mô hình cặp
// nháp/xuất bản của Strapi. Xem spec mục 4.

const DRAFT_PREFIX = 'drafts.';
const RELEASE_PREFIX = 'versions.';
const SYSTEM_KEYS = new Set(['_id', '_type', '_rev', '_createdAt', '_updatedAt']);
// Trường do store quản lý: người gọi không được ghi đè.
const MANAGED_KEYS = new Set(['id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt']);
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const DEFAULT_LIMIT = 100;
const LARGE_TYPE_WARNING = 5000;
const TYPE_QUERY = '*[_type == $type]';

// Cùng dạng documentId của Strapi 5: 24 ký tự a-z0-9.
function newDocumentId() {
  let id = '';
  for (const byte of crypto.randomBytes(24)) id += ID_ALPHABET[byte % ID_ALPHABET.length];
  return id;
}

function documentIdOf(sanityId) {
  return sanityId.startsWith(DRAFT_PREFIX) ? sanityId.slice(DRAFT_PREFIX.length) : sanityId;
}

function stripSystem(doc) {
  const out = {};
  for (const [key, value] of Object.entries(doc)) {
    if (!SYSTEM_KEYS.has(key)) out[key] = value;
  }
  return out;
}

function withoutPublishedAt(doc) {
  const { publishedAt, ...rest } = stripSystem(doc);
  return rest;
}

function cleanInput(data) {
  const out = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (key.startsWith('_') || MANAGED_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

// publishedAt === undefined → lấy giá trị lưu trong document.
function toEntry(doc, publishedAt) {
  const documentId = documentIdOf(doc._id);
  return {
    ...stripSystem(doc),
    id: documentId,
    documentId,
    createdAt: doc.createdAt || doc._createdAt || null,
    updatedAt: doc._updatedAt || null,
    publishedAt: publishedAt === undefined ? doc.publishedAt ?? null : publishedAt,
  };
}

function groupVersions(docs) {
  const versions = new Map();
  for (const doc of docs) {
    if (doc._id.startsWith(RELEASE_PREFIX)) continue;
    const documentId = documentIdOf(doc._id);
    const pair = versions.get(documentId) || { draft: null, published: null };
    if (doc._id.startsWith(DRAFT_PREFIX)) pair.draft = doc;
    else pair.published = doc;
    versions.set(documentId, pair);
  }
  return versions;
}

function createSanityStore({ client, ttlMs } = {}) {
  const warned = new Set();
  const cache = createTypeCache({
    ttlMs,
    load: async (type) => {
      const versions = groupVersions(await client.fetch(TYPE_QUERY, { type }));
      if (versions.size > LARGE_TYPE_WARNING && !warned.has(type)) {
        warned.add(type);
        console.warn(`[store] ${type} có ${versions.size} document — xem lại việc lọc trong bộ nhớ (spec mục 4).`);
      }
      return versions;
    },
  });

  async function commit(build) {
    const tx = client.transaction();
    build(tx);
    await tx.commit({ visibility: 'sync' });
    cache.invalidate();
  }

  function documents(type) {
    const options = getTypeOptions(type);

    const draftView = (pair) =>
      options.drafts ? toEntry(pair.draft || pair.published, null) : toEntry(pair.published || pair.draft);

    const publishedView = (pair) => {
      if (options.drafts) return pair.published ? toEntry(pair.published) : null;
      const doc = pair.published || pair.draft;
      return doc ? toEntry(doc) : null;
    };

    // Nội dung như góc nhìn nháp nhưng mang publishedAt thật — để lọc/đếm
    // "chưa xuất bản" cho đúng.
    const stateView = (pair) => {
      if (!options.drafts) return toEntry(pair.published || pair.draft);
      const publishedAt = pair.published ? pair.published.publishedAt ?? pair.published._updatedAt : null;
      return toEntry(pair.draft || pair.published, publishedAt);
    };

    async function loadPair(documentId) {
      return (await cache.get(type)).get(documentId) || null;
    }

    async function candidates(status) {
      const pairs = [...(await cache.get(type)).values()];
      if (status === 'published') {
        return pairs.map((pair) => ({ pair, view: publishedView(pair) })).filter((item) => item.view);
      }
      return pairs.map((pair) => ({ pair, view: stateView(pair) }));
    }

    function requireDrafts(action) {
      if (!options.drafts) throw new Error(`${type} không có nháp/xuất bản — không ${action} được.`);
    }

    const api = {
      async findMany({ fields, filters, sort, start = 0, limit = DEFAULT_LIMIT, status = 'draft' } = {}) {
        const matched = (await candidates(status)).filter((item) => matchesFilters(item.view, filters));
        const pairOf = new Map(matched.map((item) => [item.view, item.pair]));
        const ordered = sortEntries(matched.map((item) => item.view), sort);
        return ordered.slice(start, start + limit).map((view) =>
          pickFields(status === 'published' ? view : draftView(pairOf.get(view)), fields),
        );
      },

      async findOne({ documentId, fields, status = 'draft' } = {}) {
        const pair = await loadPair(documentId);
        if (!pair) return null;
        const view = status === 'published' ? publishedView(pair) : draftView(pair);
        return view ? pickFields(view, fields) : null;
      },

      async count({ filters, status = 'draft' } = {}) {
        return (await candidates(status)).filter((item) => matchesFilters(item.view, filters)).length;
      },

      async create({ data } = {}) {
        const documentId = options.singletonId || `${options.idPrefix || ''}${newDocumentId()}`;
        const now = new Date().toISOString();
        const doc = { ...cleanInput(data), _type: type, createdAt: now };
        if (options.drafts) {
          doc._id = DRAFT_PREFIX + documentId;
        } else {
          doc._id = documentId;
          doc.publishedAt = now;
        }
        await commit((tx) => tx.create(doc));
        return api.findOne({ documentId });
      },

      async update({ documentId, data } = {}) {
        const pair = await loadPair(documentId);
        if (!pair) throw new Error(`Không có bản ghi ${documentId}`);
        const changes = cleanInput(data);
        const hasChanges = Object.keys(changes).length > 0;
        const needsDraft = options.drafts && !pair.draft;

        if (needsDraft || hasChanges) {
          await commit((tx) => {
            if (options.drafts) {
              const draftId = DRAFT_PREFIX + documentId;
              // Document Service của Strapi chỉ ghi vào nháp; tạo nháp từ bản
              // xuất bản trước rồi mới sửa, để web giữ bản cũ tới khi xuất bản.
              if (needsDraft) tx.createIfNotExists({ ...withoutPublishedAt(pair.published), _id: draftId, _type: type });
              if (hasChanges) tx.patch(draftId, { set: changes });
            } else {
              tx.patch((pair.published || pair.draft)._id, { set: changes });
            }
          });
        }
        return api.findOne({ documentId });
      },

      async delete({ documentId } = {}) {
        await commit((tx) => {
          tx.delete(documentId);
          tx.delete(DRAFT_PREFIX + documentId);
        });
        return { documentId };
      },

      async publish({ documentId } = {}) {
        requireDrafts('xuất bản');
        const pair = await loadPair(documentId);
        if (!pair) return null;
        const source = pair.draft || pair.published;
        const publishedAt = new Date().toISOString();
        await commit((tx) => {
          tx.createOrReplace({ ...stripSystem(source), _id: documentId, _type: type, publishedAt });
          if (pair.draft) tx.delete(DRAFT_PREFIX + documentId);
        });
        return api.findOne({ documentId, status: 'published' });
      },

      async unpublish({ documentId } = {}) {
        requireDrafts('gỡ xuất bản');
        const pair = await loadPair(documentId);
        if (!pair) return null;
        if (pair.published) {
          await commit((tx) => {
            if (!pair.draft) tx.create({ ...withoutPublishedAt(pair.published), _id: DRAFT_PREFIX + documentId, _type: type });
            tx.delete(documentId);
          });
        }
        return api.findOne({ documentId });
      },
    };

    return api;
  }

  return { documents };
}

module.exports = { createSanityStore, newDocumentId, DRAFT_PREFIX };
```

- [ ] **Step 8: Chạy test**

Run: `node --test tests/api-sanity-store.test.js && npm test 2>&1 | tail -4`
Expected: PASS — 7 test hợp đồng × 2 bản cài đặt + 12 test riêng; toàn bộ `npm test` xanh.

Nếu một test hợp đồng chỉ đỏ ở `[harness]`: không sửa store để chiều harness. Chỉnh `createFakeStore()` cho đúng ngữ nghĩa ghi trong bảng ở đầu task, rồi chạy lại toàn bộ test service để chắc chắn chúng vẫn xanh.

- [ ] **Step 9: Commit**

```bash
git add dha-api/src/sanity tests/helpers/fake-sanity-client.js tests/helpers/document-store-contract.js tests/api-sanity-types.test.js tests/api-sanity-store.test.js package.json
git commit -m "feat(dha-api): store Sanity dựng lại Document Service của Strapi

Cặp drafts.<id>/<id>, cache theo type xoá khi ghi, bộ test hợp đồng chạy
chung trên harness và store thật.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 5: Hook sau khi ghi — thay lifecycles của Strapi

Hai logic đang nằm ẩn trong lifecycles của Strapi phải đi theo. Nếu thiếu, chúng mất đi mà không báo lỗi gì:
- **Đổi hoặc xoá mã danh mục** → viết lại mảng `categories` của mọi sản phẩm. Nếu không làm, sản phẩm biến khỏi mọi tab trên web.
- **Lưu cài đặt website** → chạy `prerender-site-settings.js` để HTML tĩnh có ngay hotline, địa chỉ mới.

**Files:**
- Create: `dha-api/src/hooks/index.js`, `dha-api/src/hooks/product-category.js`, `dha-api/src/hooks/site-setting.js`
- Create (chép nguyên): `dha-api/src/hooks/prerender.js` ← `dha-cms/src/api/site-setting/prerender.js`
- Modify: `dha-api/src/services/resources.js` (`create`, `update`, `remove`)
- Modify: `tests/product-categories.test.js`, `tests/site-setting-prerender.test.js`
- Test: `tests/api-hooks.test.js`

**Interfaces:**
- Consumes: `getStore()`; `resources.create/update/delete` (Task 2).
- Produces: `hooks.snapshot(config, service, documentId) → entry|null`, `hooks.afterCreate(config, created)`, `hooks.afterUpdate(config, before, after)`, `hooks.afterDelete(config, before)`; module hook theo type có thể khai `needsSnapshot`, `afterCreate`, `afterUpdate(before, after)`, `afterDelete(before)`.

- [ ] **Step 1: Viết test thất bại `tests/api-hooks.test.js`**

```js
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
```

Thêm `tests/api-hooks.test.js` vào script `test`.

Run: `node --test tests/api-hooks.test.js`
Expected: FAIL — `Cannot find module '../dha-api/src/hooks/prerender'`.

- [ ] **Step 2: Chép `prerender.js`, viết ba module hook**

```bash
mkdir -p dha-api/src/hooks
cp dha-cms/src/api/site-setting/prerender.js dha-api/src/hooks/prerender.js
```

`dha-api/src/hooks/site-setting.js`:

```js
'use strict';

// Lưu cài đặt xong là ghi luôn vào HTML tĩnh, để website không phải chờ lần
// deploy sau mới hết chớp nội dung cũ. Xem ./prerender.js. Gọi qua đối tượng
// module (không destructure) để test thay được hàm này.
const prerender = require('./prerender');

module.exports = {
  afterCreate() {
    prerender.schedulePrerender();
  },

  afterUpdate() {
    prerender.schedulePrerender();
  },
};
```

`dha-api/src/hooks/product-category.js`:

```js
'use strict';

// Sản phẩm giữ danh mục dưới dạng mảng mã (slug) chứ không phải quan hệ, nên
// đổi mã hay xoá danh mục sẽ để lại mã mồ côi trong sản phẩm — biểu hiện ra
// ngoài là sản phẩm biến mất khỏi mọi tab mà không rõ vì sao. Hai hook dưới đây
// dọn theo ngay khi danh mục thay đổi.
const { getStore } = require('../sanity/store-registry');

const PRODUCT_TYPE = 'product';
const MAX_PRODUCTS = 10000;

async function rewriteProductCategories(mapSlugs) {
  const products = getStore().documents(PRODUCT_TYPE);
  const rows = await products.findMany({ fields: ['categories'], limit: MAX_PRODUCTS });
  for (const product of rows) {
    const current = Array.isArray(product.categories) ? product.categories : [];
    if (!current.length) continue;
    const next = mapSlugs(current);
    if (next.length === current.length && next.every((slug, i) => slug === current[i])) continue;
    // eslint-disable-next-line no-await-in-loop
    await products.update({ documentId: product.documentId, data: { categories: next } });
  }
}

module.exports = {
  // Cần đọc mã cũ trước khi ghi đè thì mới biết mã nào phải thay.
  needsSnapshot: true,

  async afterUpdate(before, after) {
    const oldSlug = before && before.slug;
    const newSlug = after && after.slug;
    if (!oldSlug || !newSlug || oldSlug === newSlug) return;
    await rewriteProductCategories((slugs) =>
      [...new Set(slugs.map((slug) => (slug === oldSlug ? newSlug : slug)))],
    );
  },

  async afterDelete(before) {
    const removedSlug = before && before.slug;
    if (!removedSlug) return;
    await rewriteProductCategories((slugs) => slugs.filter((slug) => slug !== removedSlug));
  },
};
```

`dha-api/src/hooks/index.js`:

```js
'use strict';

// Việc phải làm sau khi ghi, thay cho lifecycles của Strapi. Gọi tường minh từ
// services/resources.js thay vì móc vào tầng dữ liệu, để đọc code là thấy.
const productCategory = require('./product-category');
const siteSetting = require('./site-setting');

const HOOKS = { productCategory, siteSetting };

function hooksFor(config) {
  return Object.prototype.hasOwnProperty.call(HOOKS, config.sanityType) ? HOOKS[config.sanityType] : {};
}

async function snapshot(config, service, documentId) {
  if (!hooksFor(config).needsSnapshot || !documentId) return null;
  return service.findOne({ documentId });
}

async function afterCreate(config, created) {
  const hooks = hooksFor(config);
  if (hooks.afterCreate) await hooks.afterCreate(created);
}

async function afterUpdate(config, before, after) {
  const hooks = hooksFor(config);
  if (hooks.afterUpdate) await hooks.afterUpdate(before, after);
}

async function afterDelete(config, before) {
  const hooks = hooksFor(config);
  if (hooks.afterDelete) await hooks.afterDelete(before);
}

module.exports = { snapshot, afterCreate, afterUpdate, afterDelete };
```

- [ ] **Step 3: Gọi hook từ `resources.js`**

```bash
python3 - <<'PY'
from pathlib import Path

p = Path('dha-api/src/services/resources.js')
s = p.read_text(encoding='utf-8')
pairs = [
    ("require('./dashboard-metrics');\n",
     "require('./dashboard-metrics');\nconst hooks = require('../hooks');\n"),
    # create
    ("  await publishAfterWrite(config, data?.documentId);\n  ctx.body = { data: normalizeEntry(data, config) };",
     "  await publishAfterWrite(config, data?.documentId);\n  await hooks.afterCreate(config, data);\n  ctx.body = { data: normalizeEntry(data, config) };"),
    # update
    ("  let data;\n  let wasPublished = true;\n",
     "  let data;\n  let wasPublished = true;\n  let before = null;\n  let created = false;\n"),
    ("    if (existing && existing.length > 0) {\n      wasPublished = await isPublished(config, existing[0].documentId);",
     "    if (existing && existing.length > 0) {\n      before = await hooks.snapshot(config, service, existing[0].documentId);\n      wasPublished = await isPublished(config, existing[0].documentId);"),
    ("      data = await service.create({ data: cleanData(config, ctx.request.body) });\n    }",
     "      data = await service.create({ data: cleanData(config, ctx.request.body) });\n      created = true;\n    }"),
    ("  } else {\n    wasPublished = await isPublished(config, ctx.params.id);",
     "  } else {\n    before = await hooks.snapshot(config, service, ctx.params.id);\n    wasPublished = await isPublished(config, ctx.params.id);"),
    ("  await publishAfterWrite(config, data?.documentId, { wasPublished });\n",
     "  await publishAfterWrite(config, data?.documentId, { wasPublished });\n  if (created) await hooks.afterCreate(config, data);\n  else await hooks.afterUpdate(config, before, data);\n"),
    # remove
    ("  await getService(config).delete({ documentId: ctx.params.id });\n  ctx.body = { ok: true };",
     "  const service = getService(config);\n  const before = await hooks.snapshot(config, service, ctx.params.id);\n  await service.delete({ documentId: ctx.params.id });\n  await hooks.afterDelete(config, before);\n  ctx.body = { ok: true };"),
]
for old, new in pairs:
    assert s.count(old) == 1, old[:70]
    s = s.replace(old, new)
p.write_text(s, encoding='utf-8')
PY
```

Run: `node --test tests/api-hooks.test.js`
Expected: PASS 5/5.

- [ ] **Step 4: Trỏ test cũ sang hook mới**

```bash
python3 - <<'PY'
from pathlib import Path

p = Path('tests/product-categories.test.js')
s = p.read_text(encoding='utf-8')
old_static = """  const lifecycles = read('dha-cms/src/api/product-category/content-types/product-category/lifecycles.js');
  assert.match(lifecycles, /afterUpdate/);
  assert.match(lifecycles, /afterDelete/);
  assert.match(lifecycles, /api::product\\.product/);"""
new_static = """  const hook = read('dha-api/src/hooks/product-category.js');
  assert.match(hook, /afterUpdate/);
  assert.match(hook, /afterDelete/);
  assert.match(hook, /PRODUCT_TYPE = 'product'/);"""
assert s.count(old_static) == 1
s = s.replace(old_static, new_static)

marker = '// Lifecycle chạy trong Strapi nên test dựng một `strapi` giả tối thiểu'
assert s.count(marker) == 1
s = s[: s.index(marker)] + """// Hook chạy sau khi admin sửa/xoá danh mục (dha-api/src/hooks). Test dựng store
// giả với vài sản phẩm, gọi thẳng hook rồi xem sản phẩm được viết lại ra sao.
const { setStore } = require('../dha-api/src/sanity/store-registry');
const { createFakeStore } = require('./helpers/admin-ui-harness');
const categoryHooks = require('../dha-api/src/hooks/product-category');

function useProducts(products) {
  const fake = createFakeStore({ product: products });
  setStore(fake);
  return fake;
}

test('đổi mã danh mục thì sản phẩm đã gán đi theo mã mới', async () => {
  const fake = useProducts([
    { documentId: 'p1', categories: ['color-metal'] },
    { documentId: 'p2', categories: ['color-metal', 'black-metal'] },
    { documentId: 'p3', categories: [] },
  ]);

  await categoryHooks.afterUpdate({ slug: 'color-metal' }, { slug: 'kim-loai-mau' });

  const rows = fake.__rows('product');
  assert.deepEqual(rows[0].categories, ['kim-loai-mau']);
  assert.deepEqual(rows[1].categories, ['kim-loai-mau', 'black-metal']);
  assert.equal(fake.__calls.filter((call) => call.method === 'update').length, 2, 'sản phẩm không liên quan thì không bị ghi lại');
  setStore(null);
});

test('xoá danh mục thì mã của nó được gỡ khỏi sản phẩm', async () => {
  const fake = useProducts([
    { documentId: 'p1', categories: ['color-metal', 'rare-earth'] },
    { documentId: 'p2', categories: ['black-metal'] },
  ]);

  await categoryHooks.afterDelete({ slug: 'rare-earth' });

  const rows = fake.__rows('product');
  assert.deepEqual(rows[0].categories, ['color-metal']);
  assert.deepEqual(rows[1].categories, ['black-metal']);
  setStore(null);
});
"""
assert 'global.strapi' not in s and 'lifecycles' not in s
p.write_text(s, encoding='utf-8')

p = Path('tests/site-setting-prerender.test.js')
s = p.read_text(encoding='utf-8')
for old, new in [
    ("require('../dha-cms/src/api/site-setting/prerender.js')", "require('../dha-api/src/hooks/prerender.js')"),
    ("path.join(root, 'dha-cms/src/api/site-setting/content-types/site-setting/lifecycles.js')",
     "path.join(root, 'dha-api/src/hooks/site-setting.js')"),
    ("test('lifecycle của cài đặt website gọi prerender sau khi tạo và sau khi sửa'",
     "test('hook của cài đặt website gọi prerender sau khi tạo và sau khi sửa'"),
]:
    assert s.count(old) == 1, old
    s = s.replace(old, new)
p.write_text(s, encoding='utf-8')
PY
```

Run: `grep -rn "lifecycles\|site-setting/prerender" tests/`
Expected: không có kết quả.

- [ ] **Step 5: Chạy toàn bộ test**

Run: `npm test 2>&1 | tail -4`
Expected: toàn bộ PASS.

- [ ] **Step 6: Commit**

```bash
git add dha-api/src/hooks dha-api/src/services/resources.js tests/api-hooks.test.js tests/product-categories.test.js tests/site-setting-prerender.test.js package.json
git commit -m "feat(dha-api): hook sau khi ghi thay lifecycles của Strapi

Đổi/xoá mã danh mục thì dọn categories của sản phẩm; lưu cài đặt website
thì prerender HTML tĩnh.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 6: API đọc công khai

**Files:**
- Create: `dha-api/src/http/strapi-query.js`, `dha-api/src/routes/public.js`, `tests/helpers/http.js`
- Test: `tests/api-strapi-query.test.js`, `tests/api-public-read.test.js`

**Interfaces:**
- Consumes: `getStore()`, `createSanityStore`, `createFakeSanityClient`.
- Produces:
  - `parseStrapiQuery(query) → { sort: Array<{[field]: 'asc'|'desc'}>, filters: object, pagination: { mode: 'page'|'offset', start, limit, page?, pageSize? } }`; lỗi đầu vào → `QueryError`.
  - `buildMeta(pagination, total) → { pagination: {...} }` đúng dạng Strapi 5.
  - `PUBLIC_COLLECTIONS`, `PUBLIC_SINGLES`, `createPublicRouter() → Router` (prefix `/api`); collection lạ gọi `next()` để router admin-ui phía sau xử lý.
  - `startServer(app) → Promise<{ url, close() }>`.

Dạng JSON phải khớp Strapi 5 để `app.js` không phải sửa: `{ data: [...], meta: { pagination } }` với entry phẳng. Khi không có tham số phân trang, hoặc có `page`/`pageSize`, meta ở dạng trang: `{ page, pageSize, pageCount, total }`. Có `start`/`limit` thì meta ở dạng offset: `{ start, limit, total }`.

- [ ] **Step 1: Viết test thất bại cho parser — `tests/api-strapi-query.test.js`**

```js
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

test('filters hai cấp, $in dạng mảng, $null thành boolean', () => {
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
```

Thêm `tests/api-strapi-query.test.js` vào script `test`.

Run: `node --test tests/api-strapi-query.test.js`
Expected: FAIL — `Cannot find module '../dha-api/src/http/strapi-query'`.

- [ ] **Step 2: Viết `dha-api/src/http/strapi-query.js`**

```js
'use strict';

// Đọc cú pháp query REST của Strapi 5 mà app.js, preview.html và scripts/*.js
// đang gửi. Giới hạn giống dha-cms/config/api.js: mặc định 25, trần 100.
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const FILTER_KEY = /^filters\[([^\]]+)\](?:\[(\$[a-z]+)\](?:\[(\d+)\])?)?$/;
const ALLOWED_OPERATORS = new Set(['$eq', '$in', '$null', '$contains', '$containsi', '$gte']);

class QueryError extends Error {}

function toInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function clampLimit(value) {
  const parsed = toInteger(value, DEFAULT_LIMIT);
  if (parsed === -1) return MAX_LIMIT;
  if (parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function assertField(field) {
  if (!FIELD_NAME.test(field)) throw new QueryError(`Tên trường không hợp lệ: ${field}`);
}

function parseSort(value) {
  if (value === undefined || value === '') return [];
  const parts = (Array.isArray(value) ? value : [value]).flatMap((item) => String(item).split(','));
  return parts.map((part) => {
    const [field, direction = 'asc'] = part.trim().split(':');
    assertField(field);
    const normalized = direction.toLowerCase();
    if (normalized !== 'asc' && normalized !== 'desc') throw new QueryError(`Chiều sắp xếp không hợp lệ: ${direction}`);
    return { [field]: normalized };
  });
}

function parsePagination(query) {
  const page = query['pagination[page]'];
  const pageSize = query['pagination[pageSize]'];
  const start = query['pagination[start]'];
  const limit = query['pagination[limit]'];
  const usesOffset = start !== undefined || limit !== undefined;
  const usesPage = page !== undefined || pageSize !== undefined;

  if (usesOffset && usesPage) throw new QueryError('Không dùng lẫn page/pageSize với start/limit.');

  if (usesOffset) {
    return { mode: 'offset', start: Math.max(toInteger(start, 0), 0), limit: clampLimit(limit ?? DEFAULT_LIMIT) };
  }
  const currentPage = Math.max(toInteger(page, 1), 1);
  const size = clampLimit(pageSize ?? DEFAULT_LIMIT);
  return { mode: 'page', page: currentPage, pageSize: size, start: (currentPage - 1) * size, limit: size };
}

function parseFilterValue(operator, value) {
  if (operator === '$null') return String(value).toLowerCase() === 'true';
  return String(value);
}

function parseFilters(query) {
  const filters = {};
  for (const [key, rawValue] of Object.entries(query)) {
    if (!key.startsWith('filters[')) continue;
    const match = key.match(FILTER_KEY);
    if (!match) throw new QueryError(`Bộ lọc không hợp lệ: ${key}`);
    const [, field, operator, index] = match;
    assertField(field);
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

    if (!operator) {
      filters[field] = String(value);
      continue;
    }
    if (!ALLOWED_OPERATORS.has(operator)) throw new QueryError(`Toán tử lọc không hỗ trợ: ${operator}`);

    const condition = filters[field] && typeof filters[field] === 'object' ? filters[field] : {};
    if (operator === '$in') {
      const list = condition.$in || [];
      list[index === undefined ? list.length : Number(index)] = String(value);
      condition.$in = list.filter((item) => item !== undefined);
    } else {
      condition[operator] = parseFilterValue(operator, value);
    }
    filters[field] = condition;
  }
  return filters;
}

function parseStrapiQuery(query = {}) {
  return {
    sort: parseSort(query.sort),
    filters: parseFilters(query),
    pagination: parsePagination(query),
  };
}

function buildMeta(pagination, total) {
  if (pagination.mode === 'offset') {
    return { pagination: { start: pagination.start, limit: pagination.limit, total } };
  }
  return {
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      pageCount: Math.ceil(total / pagination.pageSize),
      total,
    },
  };
}

module.exports = { parseStrapiQuery, buildMeta, QueryError, DEFAULT_LIMIT, MAX_LIMIT };
```

Run: `node --test tests/api-strapi-query.test.js`
Expected: PASS 6/6.

- [ ] **Step 3: Viết helper HTTP cho test — `tests/helpers/http.js`**

```js
'use strict';

const http = require('node:http');

// Dựng app Koa trên cổng ngẫu nhiên để test gọi bằng fetch như trình duyệt.
async function startServer(app) {
  const server = http.createServer(app.callback());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

module.exports = { startServer };
```

- [ ] **Step 4: Viết test thất bại cho route — `tests/api-public-read.test.js`**

```js
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Koa = require('../dha-api/node_modules/koa');

const { createPublicRouter } = require('../dha-api/src/routes/public');
const { createSanityStore } = require('../dha-api/src/sanity/store');
const { setStore } = require('../dha-api/src/sanity/store-registry');
const { createFakeSanityClient } = require('./helpers/fake-sanity-client');
const { startServer } = require('./helpers/http');

const DOCS = [
  { _id: 'n1', _type: 'news', title: 'Cũ', slug: 'cu', date: '2026-01-01', createdAt: '2026-01-01T00:00:00.000Z', publishedAt: '2026-01-01T01:00:00.000Z' },
  { _id: 'n2', _type: 'news', title: 'Mới', slug: 'moi', date: '2026-02-01', category: 'gia-ca', createdAt: '2026-02-01T00:00:00.000Z', publishedAt: '2026-02-01T01:00:00.000Z' },
  { _id: 'drafts.n2', _type: 'news', title: 'Mới (đang sửa)', slug: 'moi', date: '2026-02-01' },
  { _id: 'drafts.n3', _type: 'news', title: 'Chỉ là nháp', slug: 'nhap', date: '2026-03-01' },
  { _id: 'p1', _type: 'product', name: 'Đồng tấm', sort_order: 2, createdAt: '2026-01-01T00:00:00.000Z', publishedAt: '2026-01-01T00:00:00.000Z' },
  { _id: 'siteSetting', _type: 'siteSetting', hotline: '0900', createdAt: '2026-01-01T00:00:00.000Z', publishedAt: '2026-01-01T00:00:00.000Z' },
  { _id: 'c1', _type: 'contactInquiry', name: 'Khách', phone: '0900000000' },
  { _id: 'adminUser.u1', _type: 'adminUser', email: 'admin@dha.vn', passwordHash: '$2a$10$x' },
];

let server;

test.before(async () => {
  setStore(createSanityStore({ client: createFakeSanityClient(DOCS) }));
  const app = new Koa();
  app.use(createPublicRouter().routes());
  server = await startServer(app);
});

test.after(async () => {
  await server.close();
  setStore(null);
});

async function get(path) {
  const res = await fetch(`${server.url}${path}`);
  return { status: res.status, body: res.status === 404 && !res.headers.get('content-type')?.includes('json') ? null : await res.json() };
}

test('danh sách tin tức: chỉ bản đã xuất bản, đúng thứ tự, meta dạng offset', async () => {
  const { status, body } = await get('/api/news-articles?pagination[limit]=100&sort=date:desc');
  assert.equal(status, 200);
  assert.deepEqual(body.data.map((row) => row.title), ['Mới', 'Cũ'], 'bản nháp đang sửa và bài chưa xuất bản không lộ ra');
  assert.deepEqual(body.meta, { pagination: { start: 0, limit: 100, total: 2 } });
});

test('entry phẳng như Strapi 5, không lộ trường hệ thống của Sanity', async () => {
  const { body } = await get('/api/news-articles?sort=date:desc');
  const [row] = body.data;
  assert.equal(row.id, 'n2');
  assert.equal(row.documentId, 'n2');
  assert.equal(row.createdAt, '2026-02-01T00:00:00.000Z');
  assert.equal(row.publishedAt, '2026-02-01T01:00:00.000Z');
  assert.equal(typeof row.updatedAt, 'string');
  for (const key of ['_id', '_type', '_rev', '_createdAt', '_updatedAt', 'attributes']) {
    assert.ok(!(key in row), `không có ${key}`);
  }
  assert.deepEqual(body.meta, { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 2 } });
});

test('tham số status=draft bị bỏ qua — web không bao giờ thấy nháp', async () => {
  const { body } = await get('/api/news-articles?status=draft');
  assert.ok(!body.data.some((row) => /nháp|đang sửa/.test(row.title)));
});

test('bộ lọc và type không có nháp', async () => {
  assert.deepEqual((await get('/api/news-articles?filters[category][$eq]=gia-ca')).body.data.map((r) => r.slug), ['moi']);
  assert.deepEqual((await get('/api/products?sort=sort_order:asc&pagination[limit]=500')).body.data.map((r) => r.name), ['Đồng tấm']);
});

test('một bản ghi theo documentId: đã xuất bản thì trả, chỉ có nháp thì 404', async () => {
  const found = await get('/api/news-articles/n2');
  assert.equal(found.status, 200);
  assert.equal(found.body.data.title, 'Mới');

  const draftOnly = await get('/api/news-articles/n3');
  assert.equal(draftOnly.status, 404);
  assert.equal(draftOnly.body.error.name, 'NotFoundError');
});

test('singleton: có bản ghi thì trả, chưa có thì 404', async () => {
  const setting = await get('/api/site-setting');
  assert.equal(setting.status, 200);
  assert.equal(setting.body.data.hotline, '0900');
  assert.equal((await get('/api/navigation')).status, 404);
});

test('dữ liệu riêng tư không đọc được qua API công khai', async () => {
  for (const path of ['/api/contact-inquiries', '/api/order-requests', '/api/adminUser', '/api/admin-users', '/api/contact-inquiries/c1']) {
    const { status } = await get(path);
    assert.equal(status, 404, path);
  }
});

test('query sai trả 400 ValidationError', async () => {
  const { status, body } = await get('/api/news-articles?sort=title;drop');
  assert.equal(status, 400);
  assert.equal(body.error.name, 'ValidationError');
});
```

Thêm `tests/api-public-read.test.js` vào script `test`.

Run: `node --test tests/api-public-read.test.js`
Expected: FAIL — `Cannot find module '../dha-api/src/routes/public'`.

- [ ] **Step 5: Viết `dha-api/src/routes/public.js`**

```js
'use strict';

const Router = require('@koa/router');

const { getStore } = require('../sanity/store-registry');
const { parseStrapiQuery, buildMeta, QueryError } = require('../http/strapi-query');

// Đường dẫn công khai (pluralName của Strapi) → sanityType. Chỉ các type này
// đọc được không cần đăng nhập — đúng danh sách quyền `find`/`findOne` mà
// dha-cms/src/index.js cấp cho role public. contactInquiry, orderRequest và
// adminUser cố ý không có ở đây.
const PUBLIC_COLLECTIONS = {
  'news-articles': 'news',
  products: 'product',
  'product-categories': 'productCategory',
  projects: 'project',
  services: 'service',
  'hero-slides': 'heroSlide',
  'workflow-steps': 'workflowStep',
  'pricing-packages': 'pricingPackage',
  'pricing-analyses': 'pricingAnalysis',
  'pricing-surveys': 'pricingSurvey',
  ores: 'ore',
};

const PUBLIC_SINGLES = {
  'site-setting': 'siteSetting',
  navigation: 'navigation',
};

// Strapi không có sort thì trả theo id tăng dần, tức thứ tự tạo.
const DEFAULT_SORT = [{ createdAt: 'asc' }, { documentId: 'asc' }];

function own(map, key) {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
}

function strapiError(ctx, status, name, message) {
  ctx.status = status;
  ctx.body = { data: null, error: { status, name, message, details: {} } };
}

function parseOr400(ctx) {
  try {
    return parseStrapiQuery(ctx.query);
  } catch (err) {
    if (err instanceof QueryError) {
      strapiError(ctx, 400, 'ValidationError', err.message);
      return null;
    }
    throw err;
  }
}

async function listCollection(ctx, next) {
  const type = own(PUBLIC_COLLECTIONS, ctx.params.collection);
  if (!type) return next();

  const query = parseOr400(ctx);
  if (!query) return undefined;

  const service = getStore().documents(type);
  const filters = query.filters;
  const [rows, total] = await Promise.all([
    service.findMany({
      status: 'published',
      filters,
      sort: query.sort.length ? query.sort : DEFAULT_SORT,
      start: query.pagination.start,
      limit: query.pagination.limit,
    }),
    service.count({ status: 'published', filters }),
  ]);

  ctx.body = { data: rows, meta: buildMeta(query.pagination, total) };
  return undefined;
}

async function findInCollection(ctx, next) {
  const type = own(PUBLIC_COLLECTIONS, ctx.params.collection);
  if (!type) return next();

  const entry = await getStore().documents(type).findOne({ documentId: ctx.params.documentId, status: 'published' });
  if (!entry) return strapiError(ctx, 404, 'NotFoundError', 'Not Found');
  ctx.body = { data: entry, meta: {} };
  return undefined;
}

function readSingle(type) {
  return async (ctx) => {
    const [entry] = await getStore().documents(type).findMany({ status: 'published', limit: 1 });
    if (!entry) return strapiError(ctx, 404, 'NotFoundError', 'Not Found');
    ctx.body = { data: entry, meta: {} };
    return undefined;
  };
}

function createPublicRouter() {
  const router = new Router({ prefix: '/api' });
  // Singleton đăng ký trước để không bị route /:collection nuốt mất.
  for (const [path, type] of Object.entries(PUBLIC_SINGLES)) {
    router.get(`/${path}`, readSingle(type));
  }
  router.get('/:collection', listCollection);
  router.get('/:collection/:documentId', findInCollection);
  return router;
}

module.exports = { createPublicRouter, PUBLIC_COLLECTIONS, PUBLIC_SINGLES, strapiError };
```

- [ ] **Step 6: Chạy test**

Run: `node --test tests/api-public-read.test.js && npm test 2>&1 | tail -4`
Expected: PASS 8/8; toàn bộ `npm test` xanh.

- [ ] **Step 7: Commit**

```bash
git add dha-api/src/http/strapi-query.js dha-api/src/routes/public.js tests/helpers/http.js tests/api-strapi-query.test.js tests/api-public-read.test.js package.json
git commit -m "feat(dha-api): API đọc công khai giữ nguyên hợp đồng Strapi 5

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 7: Hai form công khai — liên hệ và đặt mẫu

**Files:**
- Create: `dha-api/src/http/schema-validator.js`
- Modify: `dha-api/src/routes/public.js` (thêm 2 route POST, `strapiError` nhận `details`)
- Modify: `tests/regression.test.js`, `tests/product-categories.test.js`, `tests/navigation.test.js` (trỏ `schema.json` sang `dha-api/src/schemas/`)
- Test: `tests/api-public-forms.test.js`

**Interfaces:**
- Consumes: `createRateLimit` (Task 2), `createPublicRouter`, `strapiError` (Task 6), `dha-api/src/schemas/{contactInquiry,orderRequest}.json` (Task 1).
- Produces: `validateAgainstSchema(schema, input, { forced }) → { data, errors: string[] }`. Hỗ trợ kiểu `string`, `text`, `email`, `enumeration`, `decimal`, `integer`, `float`, `boolean`; kiểu khác thì ném `Error` (lỗi lập trình).

Body `app.js` đang gửi (xem `app.js:1611` và `app.js:1663`):
- `POST /api/order-requests` → `{ data: { product_name, product_uid, customer_name, phone, email, quantity, unit, note } }`
- `POST /api/contact-inquiries` → `{ data: { name, phone, email, address, service, message } }`

Trường tuỳ chọn để trống (`''`) được coi như không gửi: `app.js` luôn gửi `email: ''` khi khách không nhập.

- [ ] **Step 1: Viết test thất bại `tests/api-public-forms.test.js`**

```js
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
```

Thêm `tests/api-public-forms.test.js` vào script `test`.

Run: `node --test tests/api-public-forms.test.js`
Expected: FAIL — `Cannot find module '../dha-api/src/http/schema-validator'`.

- [ ] **Step 2: Viết `dha-api/src/http/schema-validator.js`**

```js
'use strict';

// Validate body của form công khai theo schema.json của Strapi đã chép sang
// dha-api/src/schemas — cùng ràng buộc Strapi đang áp dụng, không viết lại lần
// hai ở chỗ khác.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEXT_TYPES = new Set(['string', 'text', 'email']);
const NUMBER_TYPES = new Set(['decimal', 'float', 'integer']);

function isBlank(value) {
  return value === undefined || value === null || value === '';
}

function checkText(name, definition, value) {
  if (typeof value !== 'string') return { error: `${name} phải là chuỗi.` };
  if (definition.minLength !== undefined && value.length < definition.minLength) {
    return { error: `${name} phải có ít nhất ${definition.minLength} ký tự.` };
  }
  if (definition.maxLength !== undefined && value.length > definition.maxLength) {
    return { error: `${name} không được quá ${definition.maxLength} ký tự.` };
  }
  if (definition.regex && !new RegExp(definition.regex).test(value)) {
    return { error: `${name} không đúng định dạng.` };
  }
  if (definition.type === 'email' && !EMAIL.test(value)) {
    return { error: `${name} không phải email hợp lệ.` };
  }
  return { value };
}

function checkNumber(name, definition, value) {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(number)) return { error: `${name} phải là số.` };
  if (definition.type === 'integer' && !Number.isInteger(number)) return { error: `${name} phải là số nguyên.` };
  if (definition.min !== undefined && number < definition.min) return { error: `${name} phải từ ${definition.min} trở lên.` };
  if (definition.max !== undefined && number > definition.max) return { error: `${name} không được quá ${definition.max}.` };
  return { value: number };
}

function checkAttribute(name, definition, value) {
  if (TEXT_TYPES.has(definition.type)) return checkText(name, definition, value);
  if (NUMBER_TYPES.has(definition.type)) return checkNumber(name, definition, value);
  if (definition.type === 'enumeration') {
    return definition.enum.includes(value) ? { value } : { error: `${name} không nằm trong danh sách cho phép.` };
  }
  if (definition.type === 'boolean') {
    return typeof value === 'boolean' ? { value } : { error: `${name} phải là true/false.` };
  }
  throw new Error(`schema-validator chưa hỗ trợ kiểu ${definition.type} (trường ${name})`);
}

// `forced`: trường do server quyết định (vd. status = 'new'), bỏ qua giá trị khách gửi.
function validateAgainstSchema(schema, input, { forced = {} } = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const data = {};
  const errors = [];

  for (const [name, definition] of Object.entries(schema.attributes)) {
    if (Object.prototype.hasOwnProperty.call(forced, name)) {
      data[name] = forced[name];
      continue;
    }
    const raw = source[name];
    if (isBlank(raw)) {
      if (definition.required) errors.push(`${name} là bắt buộc.`);
      else if (definition.default !== undefined) data[name] = definition.default;
      continue;
    }
    const result = checkAttribute(name, definition, raw);
    if (result.error) errors.push(result.error);
    else data[name] = result.value;
  }

  return { data, errors };
}

module.exports = { validateAgainstSchema };
```

- [ ] **Step 3: Thêm route POST vào `dha-api/src/routes/public.js`**

```bash
python3 - <<'PY'
from pathlib import Path

p = Path('dha-api/src/routes/public.js')
s = p.read_text(encoding='utf-8')
pairs = [
    ("const { parseStrapiQuery, buildMeta, QueryError } = require('../http/strapi-query');\n",
     "const { parseStrapiQuery, buildMeta, QueryError } = require('../http/strapi-query');\n"
     "const { validateAgainstSchema } = require('../http/schema-validator');\n"
     "const { createRateLimit } = require('../http/rate-limit');\n"
     "const contactInquirySchema = require('../schemas/contactInquiry.json');\n"
     "const orderRequestSchema = require('../schemas/orderRequest.json');\n"),
    ("function strapiError(ctx, status, name, message) {\n  ctx.status = status;\n  ctx.body = { data: null, error: { status, name, message, details: {} } };\n}",
     "function strapiError(ctx, status, name, message, details = {}) {\n  ctx.status = status;\n  ctx.body = { data: null, error: { status, name, message, details } };\n}\n\n"
     "// Hai form ghi được mà không cần đăng nhập. Giới hạn tần suất lấy đúng theo\n"
     "// route Strapi cũ (dha-cms/src/api/<type>/routes).\n"
     "const FORMS = {\n"
     "  'contact-inquiries': { type: 'contactInquiry', schema: contactInquirySchema, max: 5 },\n"
     "  'order-requests': { type: 'orderRequest', schema: orderRequestSchema, max: 10 },\n"
     "};\n\n"
     "function submitForm({ type, schema }) {\n"
     "  return async (ctx) => {\n"
     "    const body = ctx.request.body || {};\n"
     "    const input = body.data && typeof body.data === 'object' ? body.data : body;\n"
     "    const { data, errors } = validateAgainstSchema(schema, input, { forced: { status: 'new' } });\n"
     "    if (errors.length) return strapiError(ctx, 400, 'ValidationError', errors[0], { errors });\n"
     "    const created = await getStore().documents(type).create({ data });\n"
     "    ctx.body = { data: created, meta: {} };\n"
     "    return undefined;\n"
     "  };\n"
     "}"),
    ("  router.get('/:collection', listCollection);\n",
     "  for (const [path, form] of Object.entries(FORMS)) {\n"
     "    router.post(`/${path}`, createRateLimit({ windowMs: 15 * 60 * 1000, max: form.max }), submitForm(form));\n"
     "  }\n"
     "  router.get('/:collection', listCollection);\n"),
]
for old, new in pairs:
    assert s.count(old) == 1, old[:60]
    s = s.replace(old, new)
p.write_text(s, encoding='utf-8')
PY
```

Run: `node --test tests/api-public-forms.test.js`
Expected: PASS 8/8.

- [ ] **Step 4: Trỏ mọi test đọc `schema.json` sang `dha-api/src/schemas/`**

```bash
python3 - <<'PY'
import re
from pathlib import Path

def camel(kebab):
    head, *rest = kebab.split('-')
    return head + ''.join(part.capitalize() for part in rest)

pattern = re.compile(r"dha-cms/src/api/([a-z-]+)/content-types/\1/schema\.json")
for p in Path('tests').glob('*.test.js'):
    s = p.read_text(encoding='utf-8')
    n = pattern.sub(lambda m: f"dha-api/src/schemas/{camel(m.group(1))}.json", s)
    if n != s:
        p.write_text(n, encoding='utf-8')
        print('trỏ lại schema:', p.name)
PY
grep -rn "content-types" tests/ || echo "không còn test nào đọc content-types của Strapi"
```

Expected: in ra `regression.test.js`, `product-categories.test.js`, `navigation.test.js`, rồi dòng "không còn test nào đọc content-types của Strapi".

- [ ] **Step 5: Chạy toàn bộ test**

Run: `npm test 2>&1 | tail -4`
Expected: toàn bộ PASS.

- [ ] **Step 6: Commit**

```bash
git add dha-api/src/http/schema-validator.js dha-api/src/routes/public.js tests/api-public-forms.test.js tests/regression.test.js tests/product-categories.test.js tests/navigation.test.js package.json
git commit -m "feat(dha-api): nhận form liên hệ và đặt mẫu, validate theo schema cũ

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 8: Ghép app và điểm khởi động

**Files:**
- Create: `dha-api/src/http/cors.js`, `dha-api/src/app.js`, `dha-api/src/sanity/client.js`, `dha-api/src/server.js`
- Modify: `tests/regression.test.js`, `tests/admin-ui-config.test.js` (trỏ test CORS sang `cors.js`)
- Test: `tests/api-app.test.js`

**Interfaces:**
- Consumes: `createAdminUiRouter` (Task 2), `createPublicRouter`, `strapiError` (Task 6–7), `createSanityStore` (Task 4), `loadConfig` (Task 1), `setStore`.
- Produces:
  - `createCors({ frontendUrl }) → middleware`.
  - `createApp({ store, config, logger = console }) → Koa`, trong đó `config` cần `isBehindProxy` và `frontendUrl`.
  - `createSanityClient(sanityConfig) → SanityClient`.
  - `assertDatasetPrivate(sanityConfig, { makeClient }) → Promise<void>`; dataset public thì ném lỗi.
  - `main()`.

Thứ tự middleware là một phần của hợp đồng:
1. Bắt lỗi (ngoài cùng).
2. CORS.
3. Body.
4. Router admin-ui — **phải đứng trước** router công khai. Nếu không, `/api/:collection/:documentId` khớp luôn `/api/admin-ui/meta`.
5. Router công khai.
6. Fallback 404 JSON cho `/api/*`.

Upload: đã kiểm trên `koa-body` 8.0.1 — `ctx.request.files.file` là một object có `filepath`, `originalFilename`, `mimetype`, `size`, và field form là chuỗi đơn. Nhờ vậy `media.js` port nguyên văn vẫn chạy đúng.

- [ ] **Step 1: Viết test thất bại `tests/api-app.test.js`**

```js
'use strict';

process.env.ADMIN_UI_SESSION_SECRET = 'test-secret-admin-ui';

const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('../dha-api/node_modules/bcryptjs');

const { createApp } = require('../dha-api/src/app');
const { assertDatasetPrivate } = require('../dha-api/src/sanity/client');
const { createSanityStore } = require('../dha-api/src/sanity/store');
const { setStore } = require('../dha-api/src/sanity/store-registry');
const { createFakeSanityClient } = require('./helpers/fake-sanity-client');
const { startServer } = require('./helpers/http');

const ADMIN_DOC = {
  _id: 'adminUser.u1',
  _type: 'adminUser',
  email: 'admin@dha.vn',
  passwordHash: bcrypt.hashSync('mat-khau-dung', 4),
  isActive: true,
  firstname: 'Quản',
  lastname: 'Trị',
};
const SILENT = { info() {}, error() {} };

async function boot({ store, config = {} } = {}) {
  const client = createFakeSanityClient([ADMIN_DOC]);
  const app = createApp({
    store: store || createSanityStore({ client }),
    config: { isBehindProxy: false, frontendUrl: null, ...config },
    logger: SILENT,
  });
  return { client, server: await startServer(app) };
}

async function call(server, path, { method = 'GET', body, cookie, origin = 'http://localhost:3000', headers = {} } = {}) {
  const res = await fetch(`${server.url}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(origin ? { Origin: origin } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

async function login(server) {
  const res = await call(server, '/api/admin-ui/auth/login', {
    method: 'POST',
    body: { email: 'admin@dha.vn', password: 'mat-khau-dung' },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.headers.getSetCookie()[0].split(';')[0];
}

test.after(() => setStore(null));

test('luồng biên tập đầy đủ: đăng nhập → tạo → web thấy → sửa → gỡ xuất bản', async (t) => {
  const { server } = await boot();
  t.after(() => server.close());
  const cookie = await login(server);

  assert.equal((await call(server, '/api/admin-ui/auth/me', { cookie })).body.user.email, 'admin@dha.vn');

  const created = await call(server, '/api/admin-ui/resources/news', {
    method: 'POST',
    cookie,
    body: { data: { title: 'Giá đồng tăng', slug: 'gia-dong-tang', summary: 'Tóm tắt', content: '<p>x</p>', category: 'gia-ca', date: '2026-09-13' } },
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const id = created.body.data.documentId;

  const list = await call(server, '/api/news-articles?sort=date:desc&pagination[limit]=100', { origin: null });
  assert.deepEqual(list.body.data.map((row) => row.title), ['Giá đồng tăng'], 'bấm Lưu là lên web');

  await call(server, `/api/admin-ui/resources/news/${id}`, { method: 'PUT', cookie, body: { data: { title: 'Giá đồng tăng mạnh' } } });
  assert.equal((await call(server, `/api/news-articles/${id}`)).body.data.title, 'Giá đồng tăng mạnh', 'sửa xong web đổi ngay, không đợi cache');

  await call(server, `/api/admin-ui/resources/news/${id}/unpublish`, { method: 'POST', cookie });
  assert.equal((await call(server, `/api/news-articles/${id}`)).status, 404);
  assert.equal((await call(server, `/api/admin-ui/resources/news/${id}`, { cookie })).status, 200, 'admin vẫn thấy bài đã gỡ');
});

test('route admin-ui không bị route công khai /api/:collection/:id nuốt mất', async (t) => {
  const { server } = await boot();
  t.after(() => server.close());
  const res = await call(server, '/api/admin-ui/meta');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'UNAUTHENTICATED');
});

test('đường dẫn /api lạ trả 404 JSON dạng Strapi', async (t) => {
  const { server } = await boot();
  t.after(() => server.close());
  for (const path of ['/api/khong-co', '/api/admin-ui/khong-co', '/api/news-articles/a/b']) {
    const res = await call(server, path);
    assert.equal(res.status, 404, path);
    assert.equal(res.body.error.name, 'NotFoundError', path);
  }
});

test('CORS chỉ mở cho đúng origin, không bao giờ cho Origin: null', async (t) => {
  const { server } = await boot({ config: { frontendUrl: 'https://dhakimloaimau.vn' } });
  t.after(() => server.close());

  const allowed = await call(server, '/api/news-articles', { method: 'OPTIONS', origin: 'https://dhakimloaimau.vn' });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://dhakimloaimau.vn');
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');

  for (const origin of ['https://dhakimloaimau.vn.ke-gian.example', 'null', 'https://ke-gian.example']) {
    const res = await call(server, '/api/news-articles', { origin });
    assert.equal(res.headers.get('access-control-allow-origin'), null, origin);
  }
});

test('sau nginx: rate limit đăng nhập tính theo IP thật của khách', async (t) => {
  const { server } = await boot({ config: { isBehindProxy: true } });
  t.after(() => server.close());
  const attempt = (ip) => call(server, '/api/admin-ui/auth/login', {
    method: 'POST',
    body: { email: 'admin@dha.vn', password: 'sai' },
    headers: { 'X-Forwarded-For': ip },
  });

  for (let i = 0; i < 5; i += 1) assert.equal((await attempt('1.1.1.1')).status, 401);
  assert.equal((await attempt('1.1.1.1')).status, 429);
  assert.equal((await attempt('2.2.2.2')).status, 401, 'khách khác không bị khoá lây');
});

test('lỗi nội bộ trả 500 chung chung, không lộ chi tiết', async (t) => {
  const broken = { documents() { throw new Error('chi tiết bí mật nội bộ'); } };
  const { server } = await boot({ store: broken });
  t.after(() => server.close());
  const res = await call(server, '/api/news-articles');
  assert.equal(res.status, 500);
  assert.equal(res.body.error.name, 'InternalServerError');
  assert.ok(!JSON.stringify(res.body).includes('bí mật'));
});

test('body JSON quá 1MB bị chặn với 413', async (t) => {
  const { server } = await boot();
  t.after(() => server.close());
  const res = await call(server, '/api/contact-inquiries', { method: 'POST', body: { data: { message: 'x'.repeat(1024 * 1024 + 10) } } });
  assert.equal(res.status, 413);
});

test('upload multipart tới được bước kiểm tệp của media.js', async (t) => {
  const { server } = await boot();
  t.after(() => server.close());
  const cookie = await login(server);

  const form = new FormData();
  form.append('folder', 'dha/news');
  form.append('file', new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'a.svg');
  const res = await fetch(`${server.url}/api/admin-ui/media/upload`, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: 'http://localhost:3000' },
    body: form,
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'INVALID_FILE_TYPE');
});

// --- dataset private ---------------------------------------------------------

function clientReturning(result) {
  return () => ({ fetch: async () => (result instanceof Error ? Promise.reject(result) : result) });
}

test('dataset public (đọc được dữ liệu riêng tư không cần token) thì không khởi động', async () => {
  const config = { projectId: 'p', dataset: 'production', apiVersion: '2025-02-19' };
  await assert.rejects(assertDatasetPrivate(config, { makeClient: clientReturning(3) }), /public/);
  await assertDatasetPrivate(config, { makeClient: clientReturning(0) });
  await assertDatasetPrivate(config, { makeClient: clientReturning(Object.assign(new Error('Unauthorized'), { statusCode: 401 })) });
  await assert.rejects(
    assertDatasetPrivate(config, { makeClient: clientReturning(Object.assign(new Error('ECONNRESET'), { statusCode: undefined })) }),
    /ECONNRESET/,
  );
});
```

Thêm `tests/api-app.test.js` vào script `test`.

Run: `node --test tests/api-app.test.js`
Expected: FAIL — `Cannot find module '../dha-api/src/app'`.

- [ ] **Step 2: Viết `dha-api/src/http/cors.js`**

```js
'use strict';

// Port từ dha-cms/config/middlewares.js (strapi::cors). So khớp nguyên origin
// đã parse bằng new URL — không so tiền tố, và origin không parse được (kể cả
// giá trị null của trang sandbox) không bao giờ được mở, vì CORS ở đây có
// credentials.
const DEFAULT_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD';
const HEADERS = 'Content-Type,Authorization,Origin,Accept';

function toOrigin(value) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function createCors({ frontendUrl } = {}) {
  const allowed = new Set([...DEFAULT_ORIGINS, frontendUrl].map(toOrigin).filter(Boolean));

  return async function cors(ctx, next) {
    const origin = ctx.get('Origin');
    const parsed = toOrigin(origin);
    const allowedOrigin = parsed && parsed !== 'null' && allowed.has(parsed) ? origin : null;

    if (allowedOrigin) {
      ctx.set('Access-Control-Allow-Origin', allowedOrigin);
      ctx.set('Access-Control-Allow-Credentials', 'true');
      ctx.vary('Origin');
    }

    if (ctx.method === 'OPTIONS') {
      if (allowedOrigin) {
        ctx.set('Access-Control-Allow-Methods', METHODS);
        ctx.set('Access-Control-Allow-Headers', HEADERS);
      }
      ctx.status = 204;
      return;
    }

    await next();
  };
}

module.exports = { createCors };
```

- [ ] **Step 3: Viết `dha-api/src/app.js`**

```js
'use strict';

const Koa = require('koa');
const { koaBody } = require('koa-body');

const { setStore } = require('./sanity/store-registry');
const { createCors } = require('./http/cors');
const { createAdminUiRouter } = require('./routes/admin-ui');
const { createPublicRouter, strapiError } = require('./routes/public');

// media.js tự chặn ảnh > 5MB với thông báo tiếng Việt; formidable chỉ chặn
// phần vượt hẳn để không đọc tệp khổng lồ vào đĩa.
const MAX_MULTIPART_FILE_BYTES = 6 * 1024 * 1024;

function createApp({ store, config, logger = console }) {
  setStore(store);

  const app = new Koa();
  // Sau nginx phải tin X-Forwarded-For, nếu không mọi rate limit dồn về IP
  // của nginx và khoá tất cả quản trị viên cùng lúc.
  app.proxy = Boolean(config.isBehindProxy);

  app.use(async (ctx, next) => {
    const started = Date.now();
    try {
      await next();
    } catch (err) {
      const status = Number(err.status || err.statusCode) || 500;
      const expose = status < 500 && err.expose !== false;
      if (!expose) logger.error(`[dha-api] ${ctx.method} ${ctx.path}`, err);
      ctx.status = expose ? status : 500;
      ctx.body = {
        data: null,
        error: {
          status: ctx.status,
          name: expose ? err.name || 'BadRequestError' : 'InternalServerError',
          message: expose ? err.message : 'Internal Server Error',
          details: {},
        },
      };
    } finally {
      logger.info(`${ctx.method} ${ctx.path} ${ctx.status} ${Date.now() - started}ms`);
    }
  });

  app.use(createCors({ frontendUrl: config.frontendUrl }));
  app.use(koaBody({
    multipart: true,
    jsonLimit: '1mb',
    formLimit: '1mb',
    textLimit: '1mb',
    formidable: { maxFileSize: MAX_MULTIPART_FILE_BYTES },
  }));

  // admin-ui trước: route công khai /api/:collection/:documentId khớp cả
  // /api/admin-ui/meta.
  const adminUi = createAdminUiRouter();
  app.use(adminUi.routes());
  app.use(adminUi.allowedMethods());
  app.use(createPublicRouter().routes());

  app.use(async (ctx) => {
    if (ctx.path.startsWith('/api/')) strapiError(ctx, 404, 'NotFoundError', 'Not Found');
  });

  return app;
}

module.exports = { createApp };
```

- [ ] **Step 4: Viết `dha-api/src/sanity/client.js`**

```js
'use strict';

const { createClient } = require('@sanity/client');

// Token chỉ ở server. `raw` để đọc được cả nháp (drafts.*) lẫn bản xuất bản;
// không dùng CDN vì cache của CDN làm admin sửa xong mà web chưa đổi.
function createSanityClient({ projectId, dataset, token, apiVersion }) {
  return createClient({ projectId, dataset, token, apiVersion, useCdn: false, perspective: 'raw' });
}

// Dataset chứa hash mật khẩu và thông tin cá nhân của khách. Truy vấn không
// token mà đếm được document riêng tư là dataset đang public → dừng ngay
// (spec mục 3a). Dataset private trả 0 hoặc từ chối (401/403).
const PRIVATE_PROBE = 'count(*[_type in ["contactInquiry", "orderRequest", "adminUser"]])';

async function assertDatasetPrivate({ projectId, dataset, apiVersion }, { makeClient = createClient } = {}) {
  const anonymous = makeClient({ projectId, dataset, apiVersion, useCdn: false });
  let visible;
  try {
    visible = await anonymous.fetch(PRIVATE_PROBE);
  } catch (err) {
    if (err.statusCode === 401 || err.statusCode === 403) return;
    throw err;
  }
  if (visible > 0) {
    throw new Error(
      `Dataset "${dataset}" đang public: truy vấn không token đọc được ${visible} document riêng tư. `
      + `Chuyển sang private: npx sanity@latest dataset visibility set ${dataset} private`,
    );
  }
}

module.exports = { createSanityClient, assertDatasetPrivate };
```

- [ ] **Step 5: Viết `dha-api/src/server.js`**

```js
'use strict';

const { loadConfig } = require('./config');
const { createSanityClient, assertDatasetPrivate } = require('./sanity/client');
const { createSanityStore } = require('./sanity/store');
const { createApp } = require('./app');

async function main() {
  const config = loadConfig();
  await assertDatasetPrivate(config.sanity);
  const store = createSanityStore({ client: createSanityClient(config.sanity) });
  const app = createApp({ store, config });
  app.listen(config.port, config.host, () => {
    console.log(`[dha-api] nghe ${config.host}:${config.port} — dataset ${config.sanity.dataset}`);
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[dha-api] không khởi động được: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { main };
```

- [ ] **Step 6: Chạy test mới**

Run: `node --test tests/api-app.test.js`
Expected: PASS 9/9.

- [ ] **Step 7: Trỏ test CORS cũ sang `cors.js`**

```bash
python3 - <<'PY'
from pathlib import Path
for name in ['tests/regression.test.js', 'tests/admin-ui-config.test.js']:
    p = Path(name)
    s = p.read_text(encoding='utf-8')
    assert "read('dha-cms/config/middlewares.js')" in s, name
    p.write_text(s.replace("read('dha-cms/config/middlewares.js')", "read('dha-api/src/http/cors.js')"), encoding='utf-8')
PY
grep -rn "middlewares.js" tests/ || echo "không còn test nào đọc middlewares.js của Strapi"
```

- [ ] **Step 8: Chạy toàn bộ test**

Run: `npm test 2>&1 | tail -4`
Expected: toàn bộ PASS. Riêng hai test CORS cũ phải vẫn xanh: `cors.js` có `new URL`, không có `origin.startsWith`, không có chuỗi `'null'` trong dấu nháy.

- [ ] **Step 9: Chạy thử thật với dataset dev (thủ công, cần project Sanity)**

Phải có project Sanity và dataset `development` private — xem Task 14, bước 1–3. Chưa có thì bỏ qua bước này và ghi lại là chưa chạy.

```bash
cp dha-api/.env.example dha-api/.env   # rồi điền SANITY_* và ADMIN_UI_SESSION_SECRET
npm run api:dev
```

Ở terminal khác:

```bash
curl -s http://127.0.0.1:1337/api/site-setting | head -c 300
```

Expected: server in `[dha-api] nghe 0.0.0.0:1337 — dataset development`; `curl` trả JSON: `{"data":...}` khi đã seed (Task 9), hoặc 404 `NotFoundError` khi dataset rỗng.

- [ ] **Step 10: Commit**

```bash
git add dha-api/src/app.js dha-api/src/server.js dha-api/src/http/cors.js dha-api/src/sanity/client.js tests/api-app.test.js tests/regression.test.js tests/admin-ui-config.test.js package.json
git commit -m "feat(dha-api): ghép app Koa, CORS, bắt lỗi và kiểm dataset private lúc khởi động

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

## Giai đoạn 2 — Dữ liệu

### Task 9: Seed dataset từ `data/*.json`

Thay phần seed chạy lúc khởi động trong `dha-cms/src/index.js`. Seed không còn chạy khi server khởi động: dataset production có dữ liệu thật từ bước chuyển (Task 11). Seed chỉ dùng để dựng dataset `development` và `staging`.

**Files:**
- Create: `dha-api/scripts/lib/ndjson.js`, `dha-api/scripts/lib/seed-docs.js`, `dha-api/scripts/seed-from-json.js`
- Modify: `tests/regression.test.js`, `tests/navigation.test.js`, `tests/product-categories.test.js`
- Test: `tests/api-seed.test.js`

**Interfaces:**
- Consumes: `getDefaultNavItems`, `DEFAULT_CATEGORIES`, `guessCategories` (`dha-api/src/defaults`), `TYPES` (Task 4), `PUBLIC_COLLECTIONS`, `PUBLIC_SINGLES` (Task 6).
- Produces:
  - `toNdjson(docs) → string`, mỗi dòng một document, có `\n` cuối.
  - `stableId(type, key) → string` gồm 24 ký tự hex.
  - `buildSeedDocuments({ dataDir, now }) → doc[]`, tất cả là bản xuất bản (không có `drafts.`), đúng như seed cũ đặt `publishedAt: new Date()`.

- [ ] **Step 1: Viết test thất bại `tests/api-seed.test.js`**

```js
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { buildSeedDocuments, stableId } = require('../dha-api/scripts/lib/seed-docs');
const { toNdjson } = require('../dha-api/scripts/lib/ndjson');
const { TYPES } = require('../dha-api/src/sanity/types');

const DATA_DIR = path.join(__dirname, '..', 'data');
const NOW = '2026-09-13T00:00:00.000Z';
const docs = buildSeedDocuments({ dataDir: DATA_DIR, now: NOW });
const byType = (type) => docs.filter((doc) => doc._type === type);
const readData = (file) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));

test('seed đủ mọi loại nội dung mà seed cũ của Strapi dựng', () => {
  const expected = {
    pricingPackage: readData('pricing_packages.json').length,
    pricingAnalysis: readData('pricing_analysis.json').length,
    pricingSurvey: readData('pricing_survey.json').length,
    project: readData('projects.json').length,
    product: readData('products.json').length,
    news: readData('news.json').length,
    heroSlide: readData('hero_slides.json').length,
    service: readData('services.json').length,
    workflowStep: readData('workflow_steps.json').length,
    ore: readData('products.json').length,
    productCategory: 3,
    siteSetting: 1,
    navigation: 1,
  };
  for (const [type, count] of Object.entries(expected)) {
    assert.equal(byType(type).length, count, type);
  }
});

test('mọi document hợp lệ: type đã khai báo, id duy nhất, không có nháp, có mốc thời gian', () => {
  const ids = new Set();
  for (const doc of docs) {
    assert.ok(TYPES[doc._type], doc._type);
    assert.ok(!ids.has(doc._id), `trùng id ${doc._id}`);
    ids.add(doc._id);
    assert.ok(!doc._id.startsWith('drafts.'));
    assert.equal(doc.createdAt, NOW);
    assert.equal(doc.publishedAt, NOW);
  }
});

test('id cố định giữa các lần chạy để import --replace chạy lại được', () => {
  const again = buildSeedDocuments({ dataDir: DATA_DIR, now: NOW });
  assert.deepEqual(again.map((doc) => doc._id), docs.map((doc) => doc._id));
  assert.match(stableId('news', 'a'), /^[a-f0-9]{24}$/);
  assert.notEqual(stableId('product', '0'), stableId('ore', '0'), 'cùng file nguồn nhưng khác type thì khác id');
});

test('singleton dùng id cố định; menu và danh mục lấy từ code', () => {
  assert.equal(byType('siteSetting')[0]._id, 'siteSetting');
  assert.equal(byType('navigation')[0]._id, 'navigation');
  assert.equal(byType('navigation')[0].items.length, 8);
  assert.deepEqual(byType('productCategory').map((doc) => doc.slug), ['color-metal', 'black-metal', 'rare-earth']);
});

test('sản phẩm luôn có mảng danh mục; quặng được xếp nhóm và có giá như seed cũ', () => {
  // guessCategories có thể trả [] (vd. uid lạ) — seed cũ cũng vậy; chỉ đòi là mảng.
  for (const product of byType('product')) {
    assert.ok(Array.isArray(product.categories), product.uid);
  }
  for (const ore of byType('ore')) {
    assert.ok(['black-metal', 'rare-earth', 'color-metal'].includes(ore.group), ore.uid);
    assert.ok(ore.price > 0, ore.uid);
  }
  const iron = byType('ore').find((ore) => (ore.uid || '').includes('sat'));
  if (iron) assert.equal(iron.group, 'black-metal');
});

test('NDJSON: mỗi dòng một document JSON', () => {
  const lines = toNdjson(docs).trimEnd().split('\n');
  assert.equal(lines.length, docs.length);
  assert.deepEqual(JSON.parse(lines[0]), docs[0]);
});
```

Thêm `tests/api-seed.test.js` vào script `test`.

Run: `node --test tests/api-seed.test.js`
Expected: FAIL — `Cannot find module '../dha-api/scripts/lib/seed-docs'`.

- [ ] **Step 2: Viết `dha-api/scripts/lib/ndjson.js`**

```js
'use strict';

// Định dạng mà `sanity datasets import` đọc: mỗi dòng một document.
function toNdjson(docs) {
  return docs.map((doc) => JSON.stringify(doc)).join('\n') + '\n';
}

module.exports = { toNdjson };
```

- [ ] **Step 3: Viết `dha-api/scripts/lib/seed-docs.js`**

Ánh xạ trường chép nguyên từ `dha-cms/src/index.js`, gồm cả luật nhóm và giá mặc định của quặng.

```js
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { getDefaultNavItems } = require('../../src/defaults/default-items');
const { DEFAULT_CATEGORIES, guessCategories } = require('../../src/defaults/default-categories');

// id cố định theo (type, khoá) để chạy lại `import --replace` cho cùng kết quả.
function stableId(type, key) {
  return crypto.createHash('sha1').update(`${type}:${key}`).digest('hex').slice(0, 24);
}

function getOreGroup(item) {
  if (item.group === 'quang' && (item.uid || '').includes('sat')) return 'black-metal';
  if (item.group === 'rare-earth' || (item.name || '').toLowerCase().includes('đất hiếm')) return 'rare-earth';
  return 'color-metal';
}

function getOreSeedPrice(item) {
  const uid = item.uid || '';
  if (uid.includes('sat')) return 25000;
  if (uid.includes('nhom') || uid.includes('bauxite')) return 35000;
  if (uid.includes('chi')) return 65000;
  if (uid.includes('thiec')) return 120000;
  return 85000;
}

const COLLECTION_SEEDS = [
  {
    type: 'pricingPackage',
    file: 'pricing_packages.json',
    map: (item) => ({ metal: item.metal, lme_price: item.lme_price, domestic_price: item.domestic_price, unit: item.unit, change: item.change, trend: item.trend, updated: item.updated }),
  },
  {
    type: 'pricingAnalysis',
    file: 'pricing_analysis.json',
    map: (item) => ({ name: item.name, tech: item.tech, unit: item.unit, price: item.price, duration: item.duration, category: item.category }),
  },
  {
    type: 'pricingSurvey',
    file: 'pricing_survey.json',
    map: (item) => ({ name: item.name, price: item.price, description: item.description }),
  },
  {
    type: 'project',
    file: 'projects.json',
    map: (item) => ({ name: item.name, location: item.location, scale: item.scale, method: item.method, value: item.value }),
  },
  {
    type: 'product',
    file: 'products.json',
    map: (item) => ({
      uid: item.uid,
      name: item.name,
      group: item.group,
      categories: Array.isArray(item.categories) && item.categories.length ? item.categories : guessCategories(item),
      grade: item.grade,
      origin: item.origin,
      price: item.price,
      description: item.description,
      specs: item.specs,
      image: item.image,
      featured: item.featured,
      in_stock: item.in_stock,
      sort_order: item.sort_order,
    }),
  },
  {
    type: 'news',
    file: 'news.json',
    map: (item) => ({ title: item.title, slug: item.slug, summary: item.summary, content: item.content, category: item.category, date: item.date, image: item.image }),
  },
  {
    type: 'heroSlide',
    file: 'hero_slides.json',
    map: (item) => ({ subtitle: item.subtitle, title: item.title, image_url: item.image_url, image_alt: item.image_alt, sort_order: item.sort_order }),
  },
  {
    type: 'service',
    file: 'services.json',
    map: (item) => ({ title: item.title, description: item.description, features: item.features, icon_svg: item.icon_svg, link_url: item.link_url, link_text: item.link_text, sort_order: item.sort_order }),
  },
  {
    type: 'workflowStep',
    file: 'workflow_steps.json',
    map: (item) => ({ step_number: item.step_number, title: item.title, description: item.description, sort_order: item.sort_order }),
  },
  {
    type: 'ore',
    file: 'products.json',
    map: (item) => ({ uid: item.uid, name: item.name, group: getOreGroup(item), price: item.price || getOreSeedPrice(item) }),
  },
];

function readJson(dataDir, file) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
}

function buildSeedDocuments({ dataDir, now = new Date().toISOString() }) {
  const stamps = { createdAt: now, publishedAt: now };
  const docs = [];

  for (const seed of COLLECTION_SEEDS) {
    readJson(dataDir, seed.file).forEach((item, index) => {
      docs.push({ _id: stableId(seed.type, `${seed.file}#${index}`), _type: seed.type, ...seed.map(item), ...stamps });
    });
  }

  for (const category of DEFAULT_CATEGORIES) {
    docs.push({ _id: stableId('productCategory', category.slug), _type: 'productCategory', ...category, ...stamps });
  }

  docs.push({ _id: 'siteSetting', _type: 'siteSetting', ...readJson(dataDir, 'site_setting.json'), ...stamps });
  docs.push({ _id: 'navigation', _type: 'navigation', items: getDefaultNavItems(), ...stamps });

  // JSON.stringify bỏ trường undefined; làm luôn ở đây để docs trong bộ nhớ
  // giống hệt thứ được ghi ra file.
  return docs.map((doc) => JSON.parse(JSON.stringify(doc)));
}

module.exports = { buildSeedDocuments, stableId, COLLECTION_SEEDS };
```

- [ ] **Step 4: Viết CLI `dha-api/scripts/seed-from-json.js`**

```js
#!/usr/bin/env node
'use strict';

// Dựng dataset dev/staging từ data/*.json + dữ liệu mặc định trong code, thay
// phần seed chạy lúc khởi động của dha-cms/src/index.js.
//
//   node dha-api/scripts/seed-from-json.js > dha-api/out/seed.ndjson
//   SANITY_AUTH_TOKEN=... npx sanity@latest datasets import dha-api/out/seed.ndjson development \
//     --project-id "$SANITY_PROJECT_ID" --replace
const path = require('node:path');

const { buildSeedDocuments } = require('./lib/seed-docs');
const { toNdjson } = require('./lib/ndjson');

const dataDir = process.argv[2] || path.join(__dirname, '..', '..', 'data');
process.stdout.write(toNdjson(buildSeedDocuments({ dataDir })));
```

Run: `node --test tests/api-seed.test.js && mkdir -p dha-api/out && node dha-api/scripts/seed-from-json.js > dha-api/out/seed.ndjson && wc -l dha-api/out/seed.ndjson`
Expected: PASS 6/6; file NDJSON có số dòng bằng tổng các loại ở test đầu.

- [ ] **Step 5: Viết lại ba test đang đọc seed/quyền trong `dha-cms/src/index.js`**

```bash
python3 - <<'PY'
import re
from pathlib import Path

def replace_test(path, title, new_block):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    pattern = re.compile(r"test\('" + re.escape(title) + r"', \(\) => \{.*?\n\}\);\n", re.S)
    assert len(pattern.findall(s)) == 1, f'{path}: {title}'
    s = pattern.sub(lambda _m: new_block, s)
    p.write_text(s, encoding='utf-8')

replace_test('tests/regression.test.js', 'homepage CMS-managed content is seeded and publicly readable', """test('homepage CMS-managed content is seeded and publicly readable', () => {
  const seed = read('dha-api/scripts/lib/seed-docs.js');
  const { PUBLIC_COLLECTIONS } = require('../dha-api/src/routes/public');
  const expectedSeeds = [
    ['heroSlide', 'hero_slides.json'],
    ['service', 'services.json'],
    ['workflowStep', 'workflow_steps.json'],
    ['ore', 'products.json'],
  ];

  for (const [type, filename] of expectedSeeds) {
    assert.match(seed, new RegExp(`type: '${type}'`), `${type} is seeded`);
    assert.match(seed, new RegExp(filename.replace('.', '\\\\.')), `${filename} is used for seeding`);
  }

  for (const [path, type] of [['hero-slides', 'heroSlide'], ['services', 'service'], ['workflow-steps', 'workflowStep']]) {
    assert.equal(PUBLIC_COLLECTIONS[path], type, `${path} is publicly readable`);
  }
});
""")

replace_test('tests/navigation.test.js', 'thanh menu được seed và đọc công khai từ CMS', """test('thanh menu được seed và đọc công khai từ CMS', () => {
  const seed = read('dha-api/scripts/lib/seed-docs.js');
  const schema = JSON.parse(read('dha-api/src/schemas/navigation.json'));
  const { DEFAULT_NAV_ITEMS } = require('../dha-api/src/defaults/default-items');
  const { PUBLIC_SINGLES } = require('../dha-api/src/routes/public');

  assert.equal(schema.kind, 'singleType');
  assert.equal(schema.attributes.items.type, 'json');
  assert.match(seed, /getDefaultNavItems/, 'menu được seed từ code');
  assert.equal(PUBLIC_SINGLES.navigation, 'navigation', 'menu đọc được công khai');
  assert.equal(DEFAULT_NAV_ITEMS.length, 8, 'menu mặc định giữ đúng 8 mục hiện có');
});
""")

replace_test('tests/navigation.test.js', 'menu mặc định nằm trong dha-cms chứ không đọc file ngoài', """test('menu mặc định nằm trong code chứ không đọc file ngoài', () => {
  const seed = read('dha-api/scripts/lib/seed-docs.js');
  const defaults = read('dha-api/src/defaults/default-items.js');

  assert.doesNotMatch(seed, /navigation\\.json/, 'không seed menu từ data/ ở gốc repo');
  assert.ok(!fs.existsSync(path.join(root, 'data/navigation.json')), 'file seed cũ đã bị bỏ');

  for (const label of ['Trang Chủ', 'Sản Phẩm', 'Liên Hệ']) {
    assert.match(defaults, new RegExp(label), `${label} có trong menu mặc định`);
  }
});
""")
p = Path('tests/navigation.test.js')
s = p.read_text(encoding='utf-8')
old = "// Deploy chỉ rsync thư mục dha-cms/ sang máy chủ Strapi, nên seed đọc file ở\n// gốc repo sẽ luôn thất bại trên production.\n"
assert s.count(old) == 1
p.write_text(s.replace(old, "// Menu mặc định phải nằm trong code của dha-api: data/ ở gốc repo không đi\n// theo khi deploy dha-api sang máy chủ.\n"), encoding='utf-8')

replace_test('tests/product-categories.test.js', 'website đọc được danh mục mà không cần đăng nhập', """test('website đọc được danh mục mà không cần đăng nhập', () => {
  const { PUBLIC_COLLECTIONS } = require('../dha-api/src/routes/public');
  assert.equal(PUBLIC_COLLECTIONS['product-categories'], 'productCategory');
});
""")
p = Path('tests/product-categories.test.js')
s = p.read_text(encoding='utf-8')
for old, new in [
    ("require('../dha-cms/src/api/product-category/default-categories')", "require('../dha-api/src/defaults/default-categories')"),
    ("read('dha-cms/src/api/product-category/default-categories.js')", "read('dha-api/src/defaults/default-categories.js')"),
    ("  // data/ không được deploy sang máy chủ Strapi, seed đọc từ đó sẽ hỏng.\n", "  // data/ không đi theo khi deploy dha-api, seed đọc từ đó sẽ hỏng.\n"),
]:
    assert s.count(old) == 1, old
    s = s.replace(old, new)
p.write_text(s, encoding='utf-8')
PY
grep -rn "dha-cms" tests/ || echo "không còn test nào trỏ vào dha-cms"
```

Expected: `không còn test nào trỏ vào dha-cms`. Chỉ còn một ngoại lệ: `regression.test.js` kiểm `deploy/backup-strapi.sh` có chứa chuỗi `dha-cms/.tmp/data.db` — Task 13 sẽ thay test này. Nếu `grep` in đúng dòng đó thì vẫn là kết quả đúng.

- [ ] **Step 6: Chạy toàn bộ test**

Run: `npm test 2>&1 | tail -4`
Expected: toàn bộ PASS.

- [ ] **Step 7: Commit**

```bash
git add dha-api/scripts tests/api-seed.test.js tests/regression.test.js tests/navigation.test.js tests/product-categories.test.js package.json
git commit -m "feat(dha-api): script seed dataset từ data/*.json với id cố định

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 10: CLI quản lý tài khoản quản trị

Strapi có trang tạo và quản lý tài khoản quản trị; `dha-api` thì không. CLI này thay cho trang đó: tạo tài khoản, đổi mật khẩu, khoá và mở tài khoản.

**Files:**
- Create: `dha-api/scripts/lib/admin-user.js`, `dha-api/scripts/admin-user.js`
- Test: `tests/api-admin-user.test.js`

**Interfaces:**
- Consumes: `store.documents('adminUser')` (Task 4), `auth.login` (Task 2), `createSanityClient`, `createSanityStore`, `SANITY_API_VERSION`.
- Produces: `createAdminUser(store, { email, password, firstname, lastname }, { cost })`, `setPassword(store, { email, password }, { cost })`, `setActive(store, { email, isActive })`, `normalizeEmail(email)`, `MIN_PASSWORD_LENGTH = 8`.

- [ ] **Step 1: Viết test thất bại `tests/api-admin-user.test.js`**

```js
'use strict';

process.env.ADMIN_UI_SESSION_SECRET = 'test-secret-admin-ui';

const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('../dha-api/node_modules/bcryptjs');

const users = require('../dha-api/scripts/lib/admin-user');
const auth = require('../dha-api/src/services/auth');
const { createSanityStore } = require('../dha-api/src/sanity/store');
const { setStore } = require('../dha-api/src/sanity/store-registry');
const { createFakeSanityClient } = require('./helpers/fake-sanity-client');
const { buildCtx } = require('./helpers/admin-ui-harness');

const FAST = { cost: 4 };

function freshStore() {
  const client = createFakeSanityClient();
  return { client, store: createSanityStore({ client }) };
}

async function tryLogin(store, email, password) {
  setStore(store);
  const ctx = buildCtx({ body: { email, password }, cookie: null });
  await auth.login(ctx);
  setStore(null);
  return ctx.status;
}

test('tạo tài khoản: email chuẩn hoá, id có dấu chấm, hash bcrypt, đăng nhập được', async () => {
  const { client, store } = freshStore();
  const user = await users.createAdminUser(store, { email: '  Admin@DHA.vn ', password: 'mat-khau-dai', firstname: 'Quản' }, FAST);

  assert.match(user.documentId, /^adminUser\./);
  const raw = client.docs.get(user.documentId);
  assert.equal(raw.email, 'admin@dha.vn');
  assert.equal(raw.isActive, true);
  assert.ok(bcrypt.compareSync('mat-khau-dai', raw.passwordHash));
  assert.ok(!JSON.stringify(raw).includes('mat-khau-dai'), 'không lưu mật khẩu thô');
  assert.equal(await tryLogin(store, 'admin@dha.vn', 'mat-khau-dai'), 200);
});

test('không tạo trùng email, không nhận mật khẩu ngắn hay email sai', async () => {
  const { store } = freshStore();
  await users.createAdminUser(store, { email: 'a@dha.vn', password: 'mat-khau-dai' }, FAST);
  await assert.rejects(users.createAdminUser(store, { email: 'A@dha.vn', password: 'mat-khau-dai' }, FAST), /Đã có tài khoản/);
  await assert.rejects(users.createAdminUser(store, { email: 'b@dha.vn', password: 'ngan' }, FAST), /ít nhất 8/);
  await assert.rejects(users.createAdminUser(store, { email: 'khong-phai-email', password: 'mat-khau-dai' }, FAST), /Email không hợp lệ/);
});

test('đổi mật khẩu: mật khẩu cũ hết tác dụng', async () => {
  const { store } = freshStore();
  await users.createAdminUser(store, { email: 'a@dha.vn', password: 'mat-khau-cu-1' }, FAST);
  await users.setPassword(store, { email: 'a@dha.vn', password: 'mat-khau-moi-2' }, FAST);
  assert.equal(await tryLogin(store, 'a@dha.vn', 'mat-khau-cu-1'), 401);
  assert.equal(await tryLogin(store, 'a@dha.vn', 'mat-khau-moi-2'), 200);
  await assert.rejects(users.setPassword(store, { email: 'x@dha.vn', password: 'mat-khau-moi-2' }, FAST), /Không có tài khoản/);
});

test('khoá tài khoản thì không đăng nhập được; mở lại thì được', async () => {
  const { store } = freshStore();
  await users.createAdminUser(store, { email: 'a@dha.vn', password: 'mat-khau-dai' }, FAST);
  await users.setActive(store, { email: 'a@dha.vn', isActive: false });
  assert.equal(await tryLogin(store, 'a@dha.vn', 'mat-khau-dai'), 401);
  await users.setActive(store, { email: 'a@dha.vn', isActive: true });
  assert.equal(await tryLogin(store, 'a@dha.vn', 'mat-khau-dai'), 200);
});
```

Thêm `tests/api-admin-user.test.js` vào script `test`.

Run: `node --test tests/api-admin-user.test.js`
Expected: FAIL — `Cannot find module '../dha-api/scripts/lib/admin-user'`.

- [ ] **Step 2: Viết `dha-api/scripts/lib/admin-user.js`**

```js
'use strict';

const bcrypt = require('bcryptjs');

// Cùng cost với hash Strapi đang dùng ($2a$10$…) để mọi tài khoản như nhau.
const BCRYPT_COST = 10;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  if (!EMAIL.test(value)) throw new Error(`Email không hợp lệ: ${email}`);
  return value;
}

function assertPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
  }
}

async function findByEmail(store, email) {
  const [user] = await store.documents('adminUser').findMany({ filters: { email: { $eq: email } }, limit: 1 });
  return user || null;
}

async function requireUser(store, email) {
  const normalized = normalizeEmail(email);
  const user = await findByEmail(store, normalized);
  if (!user) throw new Error(`Không có tài khoản ${normalized}.`);
  return user;
}

async function createAdminUser(store, { email, password, firstname = '', lastname = '' }, { cost = BCRYPT_COST } = {}) {
  const normalized = normalizeEmail(email);
  assertPassword(password);
  if (await findByEmail(store, normalized)) throw new Error(`Đã có tài khoản ${normalized}.`);
  const passwordHash = await bcrypt.hash(password, cost);
  return store.documents('adminUser').create({
    data: { email: normalized, passwordHash, firstname, lastname, isActive: true },
  });
}

async function setPassword(store, { email, password }, { cost = BCRYPT_COST } = {}) {
  assertPassword(password);
  const user = await requireUser(store, email);
  const passwordHash = await bcrypt.hash(password, cost);
  return store.documents('adminUser').update({ documentId: user.documentId, data: { passwordHash } });
}

async function setActive(store, { email, isActive }) {
  const user = await requireUser(store, email);
  return store.documents('adminUser').update({ documentId: user.documentId, data: { isActive: Boolean(isActive) } });
}

module.exports = { createAdminUser, setPassword, setActive, normalizeEmail, MIN_PASSWORD_LENGTH };
```

Run: `node --test tests/api-admin-user.test.js`
Expected: PASS 4/4.

- [ ] **Step 3: Viết CLI `dha-api/scripts/admin-user.js`**

```js
#!/usr/bin/env node
'use strict';

// Quản lý tài khoản khu quản trị (thay trang Users của Strapi).
//
//   node --env-file=.env scripts/admin-user.js create <email> [--first=Tên] [--last=Họ]
//   node --env-file=.env scripts/admin-user.js set-password <email>
//   node --env-file=.env scripts/admin-user.js disable <email>
//   node --env-file=.env scripts/admin-user.js enable <email>
//
// Mật khẩu chỉ nhận qua bàn phím (ẩn ký tự) hoặc stdin — không bao giờ qua đối
// số dòng lệnh, vì đối số nằm lại trong lịch sử shell và danh sách tiến trình.
const readline = require('node:readline');

const { SANITY_API_VERSION } = require('../src/config');
const { createSanityClient } = require('../src/sanity/client');
const { createSanityStore } = require('../src/sanity/store');
const users = require('./lib/admin-user');

const USAGE = 'Dùng: admin-user.js <create|set-password|disable|enable> <email> [--first=..] [--last=..]';

function sanityFromEnv(env = process.env) {
  const missing = ['SANITY_PROJECT_ID', 'SANITY_DATASET', 'SANITY_API_TOKEN'].filter((name) => !env[name]);
  if (missing.length) throw new Error(`Thiếu biến môi trường: ${missing.join(', ')}`);
  return { projectId: env.SANITY_PROJECT_ID, dataset: env.SANITY_DATASET, token: env.SANITY_API_TOKEN, apiVersion: SANITY_API_VERSION };
}

function parseFlags(args) {
  return Object.fromEntries(
    args.filter((arg) => arg.startsWith('--')).map((arg) => {
      const [key, ...rest] = arg.slice(2).split('=');
      return [key, rest.join('=')];
    }),
  );
}

async function readHidden(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let muted = false;
  rl._writeToOutput = (text) => {
    if (!muted) rl.output.write(text);
  };
  const answer = await new Promise((resolve) => {
    rl.question(prompt, resolve);
    muted = true;
  });
  rl.close();
  process.stdout.write('\n');
  return answer;
}

async function readPassword() {
  if (!process.stdin.isTTY) {
    let data = '';
    for await (const chunk of process.stdin) data += chunk;
    return data.replace(/\r?\n$/, '');
  }
  const first = await readHidden('Mật khẩu: ');
  const second = await readHidden('Nhập lại: ');
  if (first !== second) throw new Error('Hai lần nhập không khớp.');
  return first;
}

async function run(argv) {
  const [command, email, ...rest] = argv;
  if (!command || !email) throw new Error(USAGE);
  const store = createSanityStore({ client: createSanityClient(sanityFromEnv()) });
  const flags = parseFlags(rest);

  switch (command) {
    case 'create': {
      const user = await users.createAdminUser(store, { email, password: await readPassword(), firstname: flags.first || '', lastname: flags.last || '' });
      return `Đã tạo ${user.email} (${user.documentId}).`;
    }
    case 'set-password':
      await users.setPassword(store, { email, password: await readPassword() });
      return `Đã đổi mật khẩu cho ${users.normalizeEmail(email)}.`;
    case 'disable':
      await users.setActive(store, { email, isActive: false });
      return `Đã khoá ${users.normalizeEmail(email)}.`;
    case 'enable':
      await users.setActive(store, { email, isActive: true });
      return `Đã mở khoá ${users.normalizeEmail(email)}.`;
    default:
      throw new Error(USAGE);
  }
}

run(process.argv.slice(2)).then(
  (message) => console.log(message),
  (err) => {
    console.error(err.message);
    process.exit(1);
  },
);
```

- [ ] **Step 4: Chạy thử CLI khi thiếu cấu hình (không cần mạng)**

Run: `node dha-api/scripts/admin-user.js; echo "exit=$?"; env -u SANITY_PROJECT_ID node dha-api/scripts/admin-user.js disable a@b.vn; echo "exit=$?"`
Expected: dòng `Dùng: admin-user.js ...` rồi `exit=1`; tiếp theo `Thiếu biến môi trường: SANITY_PROJECT_ID, SANITY_DATASET, SANITY_API_TOKEN` và `exit=1`.

- [ ] **Step 5: Chạy toàn bộ test và commit**

Run: `npm test 2>&1 | tail -4`
Expected: toàn bộ PASS.

```bash
git add dha-api/scripts/lib/admin-user.js dha-api/scripts/admin-user.js tests/api-admin-user.test.js package.json
git commit -m "feat(dha-api): CLI tạo, đổi mật khẩu, khoá tài khoản quản trị

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 11: Script chuyển dữ liệu từ Strapi

Chạy **trên VPS** lúc Strapi còn chạy; xuất NDJSON rồi nạp bằng `sanity datasets import`. Logic ánh xạ nằm trong `scripts/lib/strapi-export.js`, là hàm thuần và có test. Phần gọi mạng, đọc SQLite và upload Cloudinary nằm trong CLI mỏng.

**Files:**
- Create: `dha-api/scripts/lib/strapi-export.js`, `dha-api/scripts/migrate-from-strapi.js`
- Test: `tests/api-migrate.test.js`

**Interfaces:**
- Consumes: `getTypeOptions` (Task 4), `toNdjson` (Task 9).
- Produces:
  - `EXPORT_TYPES: Array<{ path, type }>` — 15 loại, gồm cả `contact-inquiries`, `order-requests`, `ores`.
  - `toSanityDocuments({ type, draftRows, publishedRows }) → doc[]`.
  - `adminUsersToDocs(rows) → { docs, skipped: string[] }`.
  - `planProjectImage(row) → { patch } | { upload: url } | null`.
  - `summarize(docs) → { [type]: { published, drafts } }`.

Quy tắc (spec mục 7):
- `_id` = `documentId` của Strapi. Singleton dùng id cố định. Admin user dùng `adminUser.<document_id>`.
- Type có nháp: lấy **hợp** của hai tập theo `documentId`. Bản ghi do seed cũ tạo chỉ có dòng xuất bản.
  - có bản xuất bản → document `<id>`, giữ `publishedAt` thật;
  - có nháp **khác** nội dung bản xuất bản → thêm `drafts.<id>`;
  - chỉ có nháp → chỉ `drafts.<id>`.
- Type không có nháp: một document `<id>`, `publishedAt` lấy của Strapi, thiếu thì lấy `createdAt`.
- Bỏ các trường meta của Strapi: `id`, `documentId`, `createdAt`, `updatedAt`, `publishedAt`, `locale`, `localizations`, `createdBy`, `updatedBy`. Ghi lại `createdAt` và `publishedAt` dưới dạng trường thường.
- Trường media của Strapi (object có `url` + `mime`) chỉ có ở `project.image`, và không được đưa sang Sanity. Nếu dự án chưa có `cloudinary_image_url`:
  - URL tuyệt đối → dùng thẳng URL đó, `public_id` lấy từ `provider_metadata`;
  - URL `/uploads/…` → upload lên Cloudinary thư mục `dha/legacy`.

- [ ] **Step 1: Viết test thất bại `tests/api-migrate.test.js`**

```js
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  EXPORT_TYPES,
  toSanityDocuments,
  adminUsersToDocs,
  planProjectImage,
  summarize,
} = require('../dha-api/scripts/lib/strapi-export');
const { PUBLIC_COLLECTIONS, PUBLIC_SINGLES } = require('../dha-api/src/routes/public');

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-02-01T00:00:00.000Z';

function row(documentId, fields, extra = {}) {
  return { id: 7, documentId, createdAt: T1, updatedAt: T2, publishedAt: null, locale: null, ...fields, ...extra };
}

test('xuất đủ 15 loại: mọi đường dẫn công khai + 2 form', () => {
  const paths = EXPORT_TYPES.map((item) => item.path).sort();
  const expected = [...Object.keys(PUBLIC_COLLECTIONS), ...Object.keys(PUBLIC_SINGLES), 'contact-inquiries', 'order-requests'].sort();
  assert.deepEqual(paths, expected);
});

test('bài chỉ có bản xuất bản (do seed cũ tạo): một document, giữ publishedAt thật', () => {
  const docs = toSanityDocuments({ type: 'news', draftRows: [], publishedRows: [row('abc', { title: 'A' }, { publishedAt: T2 })] });
  assert.deepEqual(docs, [{ _id: 'abc', _type: 'news', title: 'A', createdAt: T1, publishedAt: T2 }]);
});

test('nháp giống bản xuất bản thì không tạo drafts.*; khác thì có', () => {
  const published = [row('abc', { title: 'A' }, { publishedAt: T2 })];
  const same = toSanityDocuments({ type: 'news', draftRows: [row('abc', { title: 'A' }, { id: 8 })], publishedRows: published });
  assert.deepEqual(same.map((doc) => doc._id), ['abc']);

  const changed = toSanityDocuments({ type: 'news', draftRows: [row('abc', { title: 'A (đang sửa)' })], publishedRows: published });
  assert.deepEqual(changed.map((doc) => doc._id), ['abc', 'drafts.abc']);
  const draft = changed.find((doc) => doc._id === 'drafts.abc');
  assert.equal(draft.title, 'A (đang sửa)');
  assert.ok(!('publishedAt' in draft), 'nháp không mang publishedAt');
});

test('bài chưa từng xuất bản chỉ có drafts.*', () => {
  const docs = toSanityDocuments({ type: 'news', draftRows: [row('xyz', { title: 'Nháp' })], publishedRows: [] });
  assert.deepEqual(docs.map((doc) => doc._id), ['drafts.xyz']);
});

test('type không có nháp và singleton', () => {
  const [contact] = toSanityDocuments({ type: 'contactInquiry', publishedRows: [row('c1', { name: 'Khách', status: 'new' }, { publishedAt: T1 })] });
  assert.deepEqual(contact, { _id: 'c1', _type: 'contactInquiry', name: 'Khách', status: 'new', createdAt: T1, publishedAt: T1 });

  const [setting] = toSanityDocuments({ type: 'siteSetting', publishedRows: [row('s1', { hotline: '0900' })] });
  assert.equal(setting._id, 'siteSetting');
  assert.equal(setting.publishedAt, T1, 'thiếu publishedAt thì lấy createdAt');
});

test('bỏ trường meta và trường media của Strapi', () => {
  const [doc] = toSanityDocuments({
    type: 'project',
    publishedRows: [row('p1', {
      name: 'Dự án',
      createdBy: { id: 1 },
      localizations: [],
      image: { id: 3, url: '/uploads/a.jpg', mime: 'image/jpeg' },
    }, { publishedAt: T2 })],
  });
  assert.deepEqual(Object.keys(doc).sort(), ['_id', '_type', 'createdAt', 'name', 'publishedAt']);
});

test('ảnh dự án kiểu cũ: URL tuyệt đối dùng thẳng, /uploads cần upload lại, đã có Cloudinary thì bỏ qua', () => {
  const absolute = row('p1', { image: { url: 'https://res.cloudinary.com/x/image/upload/v1/dha/a.jpg', mime: 'image/jpeg', provider_metadata: { public_id: 'dha/a' } } });
  assert.deepEqual(planProjectImage(absolute), {
    patch: { cloudinary_image_url: 'https://res.cloudinary.com/x/image/upload/v1/dha/a.jpg', cloudinary_public_id: 'dha/a' },
  });
  assert.deepEqual(planProjectImage(row('p2', { image: { url: '/uploads/b.jpg', mime: 'image/jpeg' } })), { upload: '/uploads/b.jpg' });
  assert.equal(planProjectImage(row('p3', { cloudinary_image_url: 'https://x', image: { url: '/uploads/c.jpg', mime: 'image/jpeg' } })), null);
  assert.equal(planProjectImage(row('p4', {})), null);
});

test('admin user: id có dấu chấm, chép nguyên hash, khoá nếu blocked, bỏ người không có mật khẩu', () => {
  const { docs, skipped } = adminUsersToDocs([
    { document_id: 'li6gi603nnjia9695f8sogq2', email: 'Admin@DHA.vn', firstname: 'A', lastname: null, password: '$2a$10$abc', is_active: 1, blocked: 0, created_at: 1767225600000 },
    { document_id: 'u2', email: 'b@dha.vn', firstname: null, lastname: null, password: '$2a$10$def', is_active: 1, blocked: 1, created_at: '2026-01-01 00:00:00' },
    { document_id: 'u3', email: 'c@dha.vn', password: null, is_active: 1, blocked: 0, created_at: null },
  ]);
  assert.deepEqual(docs[0], {
    _id: 'adminUser.li6gi603nnjia9695f8sogq2',
    _type: 'adminUser',
    email: 'admin@dha.vn',
    passwordHash: '$2a$10$abc',
    firstname: 'A',
    lastname: '',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(docs[1].isActive, false);
  assert.deepEqual(skipped, ['c@dha.vn']);
});

test('tóm tắt đếm theo type, tách nháp và bản xuất bản', () => {
  assert.deepEqual(summarize([
    { _id: 'a', _type: 'news' },
    { _id: 'drafts.a', _type: 'news' },
    { _id: 'p', _type: 'product' },
  ]), { news: { published: 1, drafts: 1 }, product: { published: 1, drafts: 0 } });
});
```

Thêm `tests/api-migrate.test.js` vào script `test`.

Run: `node --test tests/api-migrate.test.js`
Expected: FAIL — `Cannot find module '../dha-api/scripts/lib/strapi-export'`.

- [ ] **Step 2: Viết `dha-api/scripts/lib/strapi-export.js`**

```js
'use strict';

const { getTypeOptions } = require('../../src/sanity/types');

// Chuyển dữ liệu REST của Strapi 5 thành document Sanity (spec mục 7).
const DRAFT_PREFIX = 'drafts.';
const STRAPI_META = new Set(['id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt', 'locale', 'localizations', 'createdBy', 'updatedBy']);

const EXPORT_TYPES = [
  { path: 'news-articles', type: 'news' },
  { path: 'products', type: 'product' },
  { path: 'product-categories', type: 'productCategory' },
  { path: 'projects', type: 'project' },
  { path: 'services', type: 'service' },
  { path: 'hero-slides', type: 'heroSlide' },
  { path: 'workflow-steps', type: 'workflowStep' },
  { path: 'pricing-packages', type: 'pricingPackage' },
  { path: 'pricing-analyses', type: 'pricingAnalysis' },
  { path: 'pricing-surveys', type: 'pricingSurvey' },
  { path: 'ores', type: 'ore' },
  { path: 'contact-inquiries', type: 'contactInquiry' },
  { path: 'order-requests', type: 'orderRequest' },
  { path: 'site-setting', type: 'siteSetting' },
  { path: 'navigation', type: 'navigation' },
];

function isStrapiMedia(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && typeof value.url === 'string' && 'mime' in value;
}

function fieldsOf(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (STRAPI_META.has(key) || isStrapiMedia(value)) continue;
    out[key] = value;
  }
  return out;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function sameContent(left, right) {
  return JSON.stringify(stable(fieldsOf(left))) === JSON.stringify(stable(fieldsOf(right)));
}

function toSanityDocuments({ type, draftRows = [], publishedRows = [] }) {
  const options = getTypeOptions(type);
  const drafts = new Map(draftRows.map((item) => [item.documentId, item]));
  const published = new Map(publishedRows.map((item) => [item.documentId, item]));
  const documentIds = new Set([...published.keys(), ...drafts.keys()]);
  const docs = [];

  for (const documentId of documentIds) {
    const pub = published.get(documentId);
    const draft = drafts.get(documentId);
    const id = options.singletonId || documentId;

    if (options.drafts) {
      if (pub) docs.push({ _id: id, _type: type, ...fieldsOf(pub), createdAt: pub.createdAt, publishedAt: pub.publishedAt });
      if (draft && (!pub || !sameContent(draft, pub))) {
        docs.push({ _id: DRAFT_PREFIX + id, _type: type, ...fieldsOf(draft), createdAt: draft.createdAt || (pub && pub.createdAt) });
      }
    } else {
      const source = pub || draft;
      docs.push({ _id: id, _type: type, ...fieldsOf(source), createdAt: source.createdAt, publishedAt: source.publishedAt || source.createdAt });
    }
  }
  return docs;
}

// Chỉ project còn trường media `image` từ thời trước Cloudinary (đã kiểm mọi
// schema.json). app.js ưu tiên cloudinary_image_url, nên chuyển ảnh sang đó.
function planProjectImage(row) {
  if (row.cloudinary_image_url || !isStrapiMedia(row.image)) return null;
  const { url, provider_metadata: meta } = row.image;
  if (/^https?:\/\//.test(url)) {
    return { patch: { cloudinary_image_url: url, cloudinary_public_id: (meta && meta.public_id) || null } };
  }
  return { upload: url };
}

function toIso(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : 'Z'));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// Hàng của bảng admin_users trong SQLite của Strapi. Hash bcrypt chép nguyên để
// quản trị viên đăng nhập bằng mật khẩu cũ.
function adminUsersToDocs(rows) {
  const docs = [];
  const skipped = [];
  for (const user of rows) {
    const email = String(user.email || '').trim().toLowerCase();
    if (!user.password || !email) {
      skipped.push(email || String(user.document_id));
      continue;
    }
    docs.push({
      _id: `adminUser.${user.document_id}`,
      _type: 'adminUser',
      email,
      passwordHash: user.password,
      firstname: user.firstname || '',
      lastname: user.lastname || '',
      isActive: Boolean(user.is_active) && !user.blocked,
      createdAt: toIso(user.created_at),
    });
  }
  return { docs, skipped };
}

function summarize(docs) {
  const out = {};
  for (const doc of docs) {
    const bucket = out[doc._type] || (out[doc._type] = { published: 0, drafts: 0 });
    if (doc._id.startsWith(DRAFT_PREFIX)) bucket.drafts += 1;
    else bucket.published += 1;
  }
  return out;
}

module.exports = { EXPORT_TYPES, toSanityDocuments, adminUsersToDocs, planProjectImage, summarize, fieldsOf };
```

Run: `node --test tests/api-migrate.test.js`
Expected: PASS 9/9.

- [ ] **Step 3: Viết CLI `dha-api/scripts/migrate-from-strapi.js`**

```js
#!/usr/bin/env node
'use strict';

// Chạy TRÊN VPS, lúc Strapi còn chạy (spec mục 7, runbook bước 5).
//
//   cd /var/www/dha-api
//   STRAPI_TOKEN=... node --env-file=.env scripts/migrate-from-strapi.js out/migrate.ndjson
//
// Biến môi trường: STRAPI_TOKEN (API token Full access của Strapi, bắt buộc),
// STRAPI_URL (mặc định http://127.0.0.1:1337), STRAPI_DIR (mặc định
// /var/www/dha-cms), STRAPI_DB (mặc định <STRAPI_DIR>/.tmp/data.db),
// CLOUDINARY_URL (chỉ cần khi có ảnh /uploads cũ).
//
// File ra chứa hash mật khẩu và dữ liệu khách hàng: quyền 600, không commit,
// xoá sau khi nạp xong.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const { getTypeOptions } = require('../src/sanity/types');
const { toNdjson } = require('./lib/ndjson');
const { EXPORT_TYPES, toSanityDocuments, adminUsersToDocs, planProjectImage, summarize } = require('./lib/strapi-export');

const STRAPI_URL = (process.env.STRAPI_URL || 'http://127.0.0.1:1337').replace(/\/$/, '');
const STRAPI_TOKEN = process.env.STRAPI_TOKEN;
const STRAPI_DIR = process.env.STRAPI_DIR || '/var/www/dha-cms';
const STRAPI_DB = process.env.STRAPI_DB || path.join(STRAPI_DIR, '.tmp', 'data.db');
const PAGE_SIZE = 100;

async function getJson(url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${STRAPI_TOKEN}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

async function fetchCollection(apiPath, status) {
  const rows = [];
  let page = 1;
  let pageCount = 1;
  do {
    const query = `pagination[page]=${page}&pagination[pageSize]=${PAGE_SIZE}&populate=*${status ? `&status=${status}` : ''}`;
    const json = await getJson(`${STRAPI_URL}/api/${apiPath}?${query}`);
    rows.push(...((json && json.data) || []));
    pageCount = (json && json.meta && json.meta.pagination && json.meta.pagination.pageCount) || 1;
    page += 1;
  } while (page <= pageCount);
  return rows;
}

async function fetchSingle(apiPath) {
  const json = await getJson(`${STRAPI_URL}/api/${apiPath}?populate=*`);
  return json && json.data ? [json.data] : [];
}

async function exportContent() {
  const docs = [];
  for (const { path: apiPath, type } of EXPORT_TYPES) {
    const options = getTypeOptions(type);
    let draftRows = [];
    let publishedRows;
    if (options.singletonId) {
      publishedRows = await fetchSingle(apiPath);
    } else if (options.drafts) {
      [draftRows, publishedRows] = await Promise.all([fetchCollection(apiPath, 'draft'), fetchCollection(apiPath, 'published')]);
    } else {
      publishedRows = await fetchCollection(apiPath);
    }
    if (type === 'project') await rehomeProjectImages([...draftRows, ...publishedRows]);
    docs.push(...toSanityDocuments({ type, draftRows, publishedRows }));
  }
  return docs;
}

async function rehomeProjectImages(rows) {
  const pending = rows.map((row) => ({ row, plan: planProjectImage(row) })).filter((item) => item.plan);
  if (!pending.length) return;

  const uploads = pending.filter((item) => item.plan.upload);
  let cloudinary = null;
  if (uploads.length) {
    if (!process.env.CLOUDINARY_URL) {
      throw new Error(`Có ${uploads.length} ảnh dự án nằm ở /uploads của Strapi nhưng thiếu CLOUDINARY_URL: ${uploads.map((item) => item.plan.upload).join(', ')}`);
    }
    cloudinary = require('cloudinary').v2;
    cloudinary.config({ secure: true });
  }

  for (const { row, plan } of pending) {
    let patch = plan.patch;
    if (plan.upload) {
      const result = await cloudinary.uploader.upload(`${STRAPI_URL}${plan.upload}`, {
        resource_type: 'image',
        folder: 'dha/legacy',
        overwrite: false,
        tags: ['dha-legacy'],
      });
      patch = { cloudinary_image_url: result.secure_url, cloudinary_public_id: result.public_id };
      console.error(`  ảnh cũ ${plan.upload} → ${result.public_id}`);
    }
    Object.assign(row, patch);
  }
}

function readAdminUsers() {
  const requireFromStrapi = createRequire(path.join(STRAPI_DIR, 'package.json'));
  const Database = requireFromStrapi('better-sqlite3');
  const db = new Database(STRAPI_DB, { readonly: true, fileMustExist: true });
  try {
    return db.prepare('SELECT document_id, email, firstname, lastname, password, is_active, blocked, created_at FROM admin_users').all();
  } finally {
    db.close();
  }
}

async function main() {
  const outFile = process.argv[2];
  if (!outFile) throw new Error('Dùng: migrate-from-strapi.js <file-ra.ndjson>');
  if (!STRAPI_TOKEN) throw new Error('Thiếu STRAPI_TOKEN (API token Full access của Strapi).');

  const content = await exportContent();
  const { docs: admins, skipped } = adminUsersToDocs(readAdminUsers());
  const docs = [...content, ...admins];

  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(outFile, toNdjson(docs), { mode: 0o600 });

  // Chỉ in số lượng — không in dữ liệu khách hàng ra log.
  console.log(JSON.stringify({ file: outFile, total: docs.length, byType: summarize(docs), adminUsersSkipped: skipped }, null, 2));
}

main().catch((err) => {
  console.error(`Chuyển dữ liệu thất bại: ${err.message}`);
  process.exit(1);
});
```

- [ ] **Step 4: Chạy thử với Strapi local (thủ công, không ghi gì vào Sanity)**

Việc này cần Strapi đang chạy cục bộ (`cd dha-cms && npm run develop`) và một API token Full access tạo ở `http://localhost:1337/strapi-admin` → Settings → API Tokens. Nếu không dựng được Strapi local, ghi lại là chưa chạy và để runbook (Task 14, bước 5) chạy trên VPS.

```bash
cd dha-api
STRAPI_TOKEN=<token> STRAPI_DIR=../dha-cms node scripts/migrate-from-strapi.js out/migrate-local.ndjson
```

Expected: JSON tóm tắt có `news: { published: 5, drafts: 0 }`, một `adminUser`, `adminUsersSkipped: []`; file `out/migrate-local.ndjson` có quyền `-rw-------`.

- [ ] **Step 5: Chạy toàn bộ test và commit**

Run: `npm test 2>&1 | tail -4`
Expected: toàn bộ PASS.

```bash
git add dha-api/scripts/lib/strapi-export.js dha-api/scripts/migrate-from-strapi.js tests/api-migrate.test.js package.json
git commit -m "feat(dha-api): script chuyển dữ liệu Strapi sang NDJSON cho Sanity

Lấy hợp nháp/xuất bản theo documentId, chép nguyên hash mật khẩu quản trị,
chuyển ảnh dự án kiểu cũ sang Cloudinary.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 12: Script đối chiếu hai API

Gọi cùng một danh sách endpoint trên Strapi (1337) và `dha-api` (1338), rồi so JSON sau khi chuẩn hoá. Đây là cổng chặn trước khi chuyển: kết quả phải sạch mới được đi tiếp (spec mục 8).

**Files:**
- Create: `dha-api/scripts/lib/compare.js`, `dha-api/scripts/lib/endpoints.js`, `dha-api/scripts/compare-apis.js`
- Test: `tests/api-compare.test.js`

**Interfaces:**
- Produces:
  - `normalize(value)` — bỏ khoá `id` và `updatedAt` ở mọi cấp, sắp khoá theo thứ tự chữ cái.
  - `diffJson(left, right, { limit = 20 }) → Array<{ path, left, right }>`.
  - `compareResponses(left, right, { unordered }) → { differences, orderOnly }`.
  - `PUBLIC_ENDPOINTS: Array<{ path, unordered? }>`, `DETAIL_COLLECTIONS: string[]`, `ADMIN_TYPES: string[]`.

`id` bị bỏ vì Strapi trả số nguyên còn `dha-api` trả `documentId`. `updatedAt` bị bỏ vì import làm mới `_updatedAt`. Endpoint không có `sort` (Strapi sắp theo id, `dha-api` theo `createdAt`) được so như tập hợp; nếu chỉ lệch thứ tự thì báo **cảnh báo**, không tính là lỗi.

- [ ] **Step 1: Viết test thất bại `tests/api-compare.test.js`**

```js
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
```

Thêm `tests/api-compare.test.js` vào script `test`.

Run: `node --test tests/api-compare.test.js`
Expected: FAIL — `Cannot find module '../dha-api/scripts/lib/compare'`.

- [ ] **Step 2: Viết `dha-api/scripts/lib/compare.js`**

```js
'use strict';

// Khác biệt được phép giữa Strapi và dha-api: `id` (số nguyên ↔ documentId) và
// `updatedAt` (import làm mới _updatedAt). Mọi thứ khác phải khớp.
const IGNORED_KEYS = new Set(['id', 'updatedAt']);

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => !IGNORED_KEYS.has(key))
        .sort()
        .map((key) => [key, normalize(value[key])]),
    );
  }
  return value;
}

function diffJson(left, right, { limit = 20 } = {}, pathLabel = '$', out = []) {
  if (out.length >= limit) return out;
  const bothObjects = left && right && typeof left === 'object' && typeof right === 'object';
  if (!bothObjects || Array.isArray(left) !== Array.isArray(right)) {
    if (JSON.stringify(left) !== JSON.stringify(right)) out.push({ path: pathLabel, left, right });
    return out;
  }
  if (Array.isArray(left)) {
    const length = Math.max(left.length, right.length);
    for (let i = 0; i < length; i += 1) diffJson(left[i], right[i], { limit }, `${pathLabel}[${i}]`, out);
    return out;
  }
  for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
    diffJson(left[key], right[key], { limit }, `${pathLabel}.${key}`, out);
  }
  return out;
}

function sortedByDocumentId(body) {
  if (!body || !Array.isArray(body.data)) return body;
  return { ...body, data: body.data.slice().sort((a, b) => String(a.documentId).localeCompare(String(b.documentId))) };
}

function compareResponses(left, right, { unordered = false } = {}) {
  const a = normalize(left);
  const b = normalize(right);
  const differences = diffJson(a, b);
  if (!differences.length || !unordered) return { differences, orderOnly: false };

  const asSets = diffJson(sortedByDocumentId(a), sortedByDocumentId(b));
  return asSets.length ? { differences: asSets, orderOnly: false } : { differences: [], orderOnly: true };
}

module.exports = { normalize, diffJson, compareResponses };
```

- [ ] **Step 3: Viết `dha-api/scripts/lib/endpoints.js`**

```js
'use strict';

// Mọi lời gọi CMS của app.js, preview.html và scripts/*.js — giữ nguyên chuỗi
// query để so đúng thứ trình duyệt đang xin. tests/api-compare.test.js canh
// danh sách này không bị thiếu khi app.js thêm lời gọi mới.
const PUBLIC_ENDPOINTS = [
  { path: 'site-setting' },
  { path: 'navigation' },
  { path: 'product-categories?sort=sort_order:asc&pagination[limit]=100' },
  { path: 'hero-slides?sort=sort_order:asc&pagination[limit]=100' },
  { path: 'services?sort=sort_order:asc&pagination[limit]=100' },
  { path: 'workflow-steps?sort=sort_order:asc&pagination[limit]=100' },
  { path: 'pricing-packages?pagination[limit]=100', unordered: true },
  { path: 'pricing-surveys?pagination[limit]=100', unordered: true },
  { path: 'pricing-analyses?pagination[limit]=100', unordered: true },
  { path: 'news-articles?pagination[limit]=100&sort=date:desc' },
  { path: 'news-articles?pagination[limit]=200&sort=date:desc' },
  { path: 'news-articles?pagination[pageSize]=500&sort=date:desc' },
  { path: 'products?sort=sort_order:asc&pagination[limit]=500' },
  { path: 'products?pagination[limit]=500', unordered: true },
  { path: 'ores?sort=name:asc&pagination[limit]=100' },
  { path: 'projects?sort=publishedAt:desc&pagination[limit]=100' },
];

// preview.html đọc từng bản ghi theo documentId ở các collection này. `news`
// (không phải news-articles) giữ nguyên để xác nhận lỗi 404 đã biết là như
// nhau ở hai bên (spec mục 1).
const DETAIL_COLLECTIONS = ['hero-slides', 'services', 'workflow-steps', 'products', 'projects', 'news', 'news-articles'];

const ADMIN_TYPES = [
  'news', 'products', 'product-categories', 'projects', 'services', 'hero-slides', 'workflow-steps',
  'pricing-packages', 'pricing-analyses', 'pricing-surveys', 'site-setting', 'contact-inquiries', 'order-requests',
];

module.exports = { PUBLIC_ENDPOINTS, DETAIL_COLLECTIONS, ADMIN_TYPES };
```

- [ ] **Step 4: Viết CLI `dha-api/scripts/compare-apis.js`**

```js
#!/usr/bin/env node
'use strict';

// Đối chiếu Strapi với dha-api trước khi chuyển (spec mục 8, runbook bước 8).
//
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/compare-apis.js http://127.0.0.1:1337 http://127.0.0.1:1338
//
// Không có ADMIN_EMAIL/ADMIN_PASSWORD thì chỉ so API công khai. Thoát mã 1 nếu
// có khác biệt. Log có thể chứa dữ liệu khách (danh sách liên hệ) — chỉ chạy
// trên VPS, không chép log ra ngoài.
const { compareResponses } = require('./lib/compare');
const { PUBLIC_ENDPOINTS, DETAIL_COLLECTIONS, ADMIN_TYPES } = require('./lib/endpoints');

const [baseA, baseB] = process.argv.slice(2).map((url) => url && url.replace(/\/$/, ''));
if (!baseA || !baseB) {
  console.error('Dùng: compare-apis.js <gốc-A> <gốc-B>');
  process.exit(2);
}

function short(value) {
  const text = JSON.stringify(value);
  return text && text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

async function get(base, path, cookie) {
  const res = await fetch(`${base}/api/${path}`, { headers: cookie ? { Cookie: cookie } : {} });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // giữ nguyên văn bản để so
  }
  return { status: res.status, body };
}

async function login(base) {
  const res = await fetch(`${base}/api/admin-ui/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Đăng nhập ${base} thất bại: HTTP ${res.status}`);
  return res.headers.getSetCookie()[0].split(';')[0];
}

async function detailPaths() {
  const paths = [];
  for (const collection of DETAIL_COLLECTIONS) {
    const listPath = collection === 'news' ? 'news-articles' : collection;
    const { body } = await get(baseA, `${listPath}?pagination[limit]=100`);
    for (const row of (body && body.data) || []) paths.push({ path: `${collection}/${row.documentId}` });
  }
  return paths;
}

async function adminPaths(cookie) {
  const paths = [{ path: 'admin-ui/meta' }, { path: 'admin-ui/navigation' }, { path: 'admin-ui/dashboard' }];
  for (const type of ADMIN_TYPES) {
    paths.push({ path: `admin-ui/resources/${type}?page=1&pageSize=100` });
    const { body } = await get(baseA, `admin-ui/resources/${type}?page=1&pageSize=100`, cookie);
    const rows = Array.isArray(body && body.data) ? body.data : [];
    for (const row of rows) paths.push({ path: `admin-ui/resources/${type}/${row.documentId}` });
  }
  return paths;
}

async function main() {
  const seen = new Set();
  const publicPaths = [...PUBLIC_ENDPOINTS, ...(await detailPaths())].filter((item) => !seen.has(item.path) && seen.add(item.path));

  const withAdmin = Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
  const cookies = withAdmin ? [await login(baseA), await login(baseB)] : [null, null];
  const privatePaths = withAdmin ? await adminPaths(cookies[0]) : [];

  let failures = 0;
  let warnings = 0;
  for (const { path, unordered } of [...publicPaths, ...privatePaths]) {
    const cookieA = path.startsWith('admin-ui/') ? cookies[0] : null;
    const cookieB = path.startsWith('admin-ui/') ? cookies[1] : null;
    const [a, b] = await Promise.all([get(baseA, path, cookieA), get(baseB, path, cookieB)]);

    if (a.status !== b.status) {
      failures += 1;
      console.log(`✗ ${path}: HTTP ${a.status} ≠ ${b.status}`);
      continue;
    }
    const { differences, orderOnly } = compareResponses(a.body, b.body, { unordered });
    if (orderOnly) {
      warnings += 1;
      console.log(`! ${path}: cùng dữ liệu, khác thứ tự`);
    } else if (differences.length) {
      failures += 1;
      console.log(`✗ ${path}`);
      for (const d of differences) console.log(`    ${d.path}: ${short(d.left)} ≠ ${short(d.right)}`);
    }
  }

  const total = publicPaths.length + privatePaths.length;
  console.log(`\n${total} endpoint${withAdmin ? '' : ' (chưa gồm admin-ui: thiếu ADMIN_EMAIL/ADMIN_PASSWORD)'} — ${failures} khác biệt, ${warnings} cảnh báo thứ tự.`);
  console.log(failures ? 'KHÔNG KHỚP' : 'Khớp');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(2);
});
```

- [ ] **Step 5: Chạy test và commit**

Run: `node --test tests/api-compare.test.js && npm test 2>&1 | tail -4`
Expected: PASS 5/5; toàn bộ `npm test` xanh.

```bash
git add dha-api/scripts/lib/compare.js dha-api/scripts/lib/endpoints.js dha-api/scripts/compare-apis.js tests/api-compare.test.js package.json
git commit -m "feat(dha-api): script đối chiếu Strapi và dha-api trước khi chuyển

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

## Giai đoạn 3 — Triển khai và chuyển đổi

### Task 13: Deploy, môi trường dev và tài liệu

**Files:**
- Create: `deploy/backup-sanity.sh`, `deploy/ecosystem.strapi-rollback.config.js` (nội dung cũ của `ecosystem.config.js`, dùng khi rollback)
- Modify: `deploy/ecosystem.config.js`, `deploy/deploy.sh`, `deploy/nginx.conf`, `start.sh`, `README_CMS.md`, `dha-api/.env.example`
- Test: `tests/regression.test.js`

**Interfaces:**
- Consumes: `dha-api` chạy bằng `node --env-file=.env src/server.js` (Task 8).
- Produces: app pm2 tên `dha-api`, lấy cổng từ `/var/www/dha-api/.env`; `deploy/backup-sanity.sh` đọc `ENV_FILE`, `BACKUP_DIR`, `KEEP`.

Ba điểm dễ sai:
1. **Không đặt `PORT` trong `env` của pm2.** `--env-file` không ghi đè biến đã có, nên nếu pm2 đặt `PORT=1337` thì không chạy song song ở 1338 được.
2. **Deploy không được tự khởi động `dha-api` trước ngày chuyển.** Strapi đang giữ cổng 1337. Chưa có `/var/www/dha-api/.env` thì deploy chỉ chép code.
3. **Rsync frontend đang chép gần hết repo vào thư mục web công khai.** Phải loại `dha-api/` và `docs/`: spec, plan và runbook có IP máy chủ và quy trình vận hành.

- [ ] **Step 1: Sửa test hồi quy trước (cho đỏ)**

```bash
python3 - <<'PY'
from pathlib import Path

p = Path('tests/regression.test.js')
s = p.read_text(encoding='utf-8')
pairs = [
    ("  const backup = read('deploy/backup-strapi.sh');\n", "  const backup = read('deploy/backup-sanity.sh');\n"),
    ("  assert.match(backup, /dha-cms\\/\\.tmp\\/data\\.db/, 'backup script includes Strapi sqlite database');\n  assert.match(backup, /public\\/uploads/, 'backup script includes Strapi uploads');\n",
     "  assert.match(backup, /datasets export/, 'backup script exports the Sanity dataset');\n  assert.match(backup, /chmod 700/, 'backups (password hashes, customer data) stay private');\n"),
]
for old, new in pairs:
    assert s.count(old) == 1, old[:60]
    s = s.replace(old, new)

s += """
test('deploy chạy dha-api thay cho Strapi', () => {
  const deploy = read('deploy/deploy.sh');
  const nginx = read('deploy/nginx.conf');
  const [app] = require('../deploy/ecosystem.config.js').apps;

  assert.equal(app.name, 'dha-api');
  assert.equal(app.instances, 1, 'cache xoá-khi-ghi chỉ đúng khi có đúng một tiến trình');
  assert.equal((app.env || {}).PORT, undefined, 'cổng lấy từ .env để chạy song song ở 1338 được');

  assert.match(deploy, /--exclude="dha-api\\/"/, 'không chép mã dha-api vào thư mục web công khai');
  assert.match(deploy, /--exclude="docs\\/"/, 'không công khai spec/plan/runbook');
  assert.match(deploy, /\\/var\\/www\\/dha-api\\/\\.env/, 'chưa có .env thì không khởi động dha-api');
  assert.doesNotMatch(deploy, /pm2 restart dha-cms/, 'không còn khởi động lại Strapi');

  for (const location of ['/strapi-admin', '/content-manager/', '/content-type-builder/', '/i18n/', '/users-permissions/', '/upload/', '/uploads/']) {
    assert.ok(!nginx.includes(`location ${location} `), `nginx bỏ ${location}`);
  }
  assert.match(nginx, /location \\/api\\/ \\{\\s*proxy_pass\\s+http:\\/\\/127\\.0\\.0\\.1:1337;/);
});
"""
p.write_text(s, encoding='utf-8')
PY
```

Run: `node --test tests/regression.test.js 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: FAIL — `deployment scripts avoid...` (thiếu `deploy/backup-sanity.sh`) và `deploy chạy dha-api thay cho Strapi`.

- [ ] **Step 2: Đổi cấu hình pm2**

```bash
git mv deploy/ecosystem.config.js deploy/ecosystem.strapi-rollback.config.js
```

Mở đầu `deploy/ecosystem.strapi-rollback.config.js` thêm comment:

```js
// CHỈ DÙNG KHI ROLLBACK về Strapi trong 14 ngày sau khi chuyển (xem
// docs/runbooks/2026-09-strapi-to-sanity-cutover.md). Xoá ở Task 15.
```

`deploy/ecosystem.config.js` mới:

```js
module.exports = {
  apps: [
    {
      name: 'dha-api',
      cwd: '/var/www/dha-api',
      script: 'src/server.js',
      node_args: '--env-file=.env',
      // Đúng một tiến trình: cache đọc trong dha-api được xoá tại chỗ mỗi lần
      // ghi, nhiều tiến trình sẽ phục vụ dữ liệu cũ sau khi admin sửa.
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      // Không đặt PORT ở đây: --env-file không ghi đè biến đã có, cổng phải
      // lấy từ .env để chạy song song ở 1338 trước ngày chuyển.
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/pm2/dha-api-error.log',
      out_file: '/var/log/pm2/dha-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
```

- [ ] **Step 3: Sửa `deploy/deploy.sh`**

```bash
python3 - <<'PY'
import re
from pathlib import Path

p = Path('deploy/deploy.sh')
s = p.read_text(encoding='utf-8')

new_block = '''# Chỉ đụng tới dha-api khi thư mục dha-api/ thật sự có thay đổi. Chưa có
# /var/www/dha-api/.env nghĩa là chưa tới ngày chuyển (docs/runbooks): chỉ chép
# code, không khởi động — Strapi vẫn đang giữ cổng 1337.
if git diff --name-only "$BEFORE" "$AFTER" | grep -q '^dha-api/'; then
    echo "▸ Phát hiện thay đổi API → sync dha-api..."
    mkdir -p /var/www/dha-api
    rsync -a --delete \\
        --exclude=".env" \\
        --exclude="node_modules/" \\
        --exclude="out/" \\
        /var/www/web-ha-can/dha-api/ \\
        /var/www/dha-api/

    cd /var/www/dha-api
    npm ci --omit=dev

    if [ ! -f /var/www/dha-api/.env ]; then
        echo "⚠️  Chưa có /var/www/dha-api/.env — bỏ qua khởi động dha-api (xem runbook chuyển Strapi → Sanity)."
    elif pm2 describe dha-api > /dev/null 2>&1; then
        pm2 restart dha-api
        pm2 save
    else
        pm2 start /var/www/web-ha-can/deploy/ecosystem.config.js
        pm2 save
    fi
    cd /var/www/web-ha-can
else
    echo "▸ API không đổi → bỏ qua dha-api (deploy nhanh)."
fi
'''

pattern = re.compile(r"# Chỉ đụng tới Strapi khi thư mục dha-cms/ thật sự có thay đổi\n.*?echo \"▸ CMS không đổi → bỏ qua build Strapi \(deploy nhanh\)\.\"\nfi\n", re.S)
assert len(pattern.findall(s)) == 1
s = pattern.sub(lambda _m: new_block, s)

for old, new in [
    ('CMS_DIR="/var/www/dha-cms"', 'API_DIR="/var/www/dha-api"'),
    ('    --exclude="dha-cms/" \\\n', '    --exclude="dha-cms/" \\\n    --exclude="dha-api/" \\\n    --exclude="docs/" \\\n'),
]:
    assert s.count(old) == 1, old
    s = s.replace(old, new)
p.write_text(s, encoding='utf-8')
PY
bash -n deploy/deploy.sh && echo "cú pháp bash OK"
```

Expected: `cú pháp bash OK`.

- [ ] **Step 4: Bỏ các location của Strapi trong `deploy/nginx.conf`**

```bash
python3 - <<'PY'
import re
from pathlib import Path

p = Path('deploy/nginx.conf')
s = p.read_text(encoding='utf-8')

strapi_blocks = re.compile(r"    # ── Strapi Admin Panel \(built-in, moved off /admin\) ─+\n.*?(?=    # ── Trang chi tiết tin tức)", re.S)
assert len(strapi_blocks.findall(s)) == 1
s = strapi_blocks.sub('', s)

s, n = re.subn(r"    # ── Strapi API ─+\n", "    # ── dha-api (thay Strapi từ 2026-09) ────────────────\n", s)
assert n == 1
old = "    # Giới hạn upload size (cho Strapi media)\n    client_max_body_size 50M;"
assert s.count(old) == 1
s = s.replace(old, "    # Ảnh tải lên tối đa 5MB (dha-api/src/services/media.js); chừa chỗ cho multipart\n    client_max_body_size 10M;")
p.write_text(s, encoding='utf-8')
PY
grep -n "location" deploy/nginx.conf
```

Expected: chỉ còn `/api/`, `/tin-tuc/`, `= /news-detail`, `~ ^(.+)\.html$`, `/admin`, `/`, và hai location chặn file ẩn.

- [ ] **Step 5: Viết `deploy/backup-sanity.sh`**

```bash
#!/bin/bash
# Sao lưu dataset Sanity (nội dung + tài khoản quản trị) — thay backup-strapi.sh.
# Chạy bằng cron hằng tuần trên VPS (runbook bước 16). Bản sao chứa hash mật khẩu
# và dữ liệu khách hàng: thư mục chỉ root đọc được.

set -euo pipefail

ENV_FILE="${ENV_FILE:-/var/www/dha-api/.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/dha-sanity}"
KEEP="${KEEP:-8}"

if [ ! -f "$ENV_FILE" ]; then
    echo "Thiếu file cấu hình: $ENV_FILE"
    exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
: "${SANITY_PROJECT_ID:?thiếu SANITY_PROJECT_ID}" "${SANITY_DATASET:?thiếu SANITY_DATASET}" "${SANITY_API_TOKEN:?thiếu SANITY_API_TOKEN}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date '+%Y%m%d-%H%M%S')"
ARCHIVE="$BACKUP_DIR/$SANITY_DATASET-$STAMP.tar.gz"

# Ảnh nằm ở Cloudinary, dataset không có asset nào để tải.
SANITY_AUTH_TOKEN="$SANITY_API_TOKEN" npx --yes sanity@latest datasets export \
    "$SANITY_DATASET" "$ARCHIVE" --project-id "$SANITY_PROJECT_ID" --no-assets --overwrite
chmod 600 "$ARCHIVE"

# Giữ KEEP bản mới nhất.
ls -1t "$BACKUP_DIR"/"$SANITY_DATASET"-*.tar.gz | tail -n +"$((KEEP + 1))" | xargs -r rm --

echo "Đã sao lưu: $ARCHIVE"
```

```bash
chmod +x deploy/backup-sanity.sh && bash -n deploy/backup-sanity.sh && echo "cú pháp bash OK"
```

- [ ] **Step 6: Viết lại `start.sh` cho `dha-api`**

```bash
#!/bin/bash

# ============================================
#  DHA - Development Server Startup
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$PROJECT_DIR/dha-api"
API_PORT=1337
FRONTEND_PORT=3000

# Ưu tiên Node cài qua nvm nếu có (dha-api cần Node >= 20.6 cho --env-file).
for node_dir in "$HOME"/.nvm/versions/node/v22* "$HOME"/.nvm/versions/node/v20*; do
    if [ -x "$node_dir/bin/node" ] && [ -x "$node_dir/bin/npm" ]; then
        export PATH="$node_dir/bin:$PATH"
        break
    fi
done

# Cleanup khi thoát
cleanup() {
    echo ""
    echo -e "${YELLOW}⏹  Đang dừng tất cả server...${NC}"
    if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
        kill "$API_PID" 2>/dev/null
        wait "$API_PID" 2>/dev/null
    fi
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null
        wait "$FRONTEND_PID" 2>/dev/null
    fi
    echo -e "${GREEN}✔  Đã dừng tất cả server.${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM

# Báo port đang bị chiếm; chỉ dừng tiến trình khi được cho phép rõ ràng.
free_port() {
    local port=$1
    local name=$2
    local pids=$(lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}⚠  Port $port ($name) đang bị chiếm bởi PID: $pids${NC}"
        if [ "$DHA_AUTO_FREE_PORTS" = "1" ]; then
            echo -e "${YELLOW}   DHA_AUTO_FREE_PORTS=1 → gửi tín hiệu dừng nhẹ...${NC}"
            echo "$pids" | xargs kill 2>/dev/null
            sleep 2
            if lsof -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
                echo -e "${RED}✘  Port $port vẫn đang bị chiếm. Hãy dừng process đó thủ công rồi chạy lại.${NC}"
                exit 1
            fi
            echo -e "${GREEN}  ✔  Đã giải phóng port $port.${NC}"
        else
            echo -e "${RED}✘  Hãy dừng process đang dùng port $port hoặc chạy DHA_AUTO_FREE_PORTS=1 ./start.sh${NC}"
            exit 1
        fi
    fi
}

check_api_setup() {
    if [ ! -d "$API_DIR/node_modules" ]; then
        echo -e "${YELLOW}📦 Chưa cài dependencies cho dha-api. Đang chạy npm install...${NC}"
        if ! (cd "$API_DIR" && npm install); then
            echo -e "${RED}✘  npm install thất bại!${NC}"
            exit 1
        fi
        echo -e "${GREEN}✔  Cài dependencies xong.${NC}"
    fi
    if [ ! -f "$API_DIR/.env" ]; then
        echo -e "${RED}✘  Thiếu dha-api/.env. Chép dha-api/.env.example rồi điền SANITY_* (dataset development) và ADMIN_UI_SESSION_SECRET.${NC}"
        exit 1
    fi
}

# ── Header ──
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     🪨  DHA MINERALS - Dev Server        ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}[1/4]${NC} Kiểm tra & giải phóng ports..."
free_port $API_PORT "dha-api"
free_port $FRONTEND_PORT "Frontend"
echo -e "${GREEN}  ✔  Ports $API_PORT & $FRONTEND_PORT sẵn sàng.${NC}"

echo -e "${CYAN}[2/4]${NC} Kiểm tra dha-api..."
check_api_setup

echo -e "${CYAN}[3/4]${NC} Khởi động dha-api (port $API_PORT)..."
(cd "$API_DIR" && npm run dev) &
API_PID=$!

echo -ne "       Đang chờ dha-api khởi động"
for i in $(seq 1 30); do
    if curl -s "http://localhost:$API_PORT/api/site-setting" >/dev/null 2>&1; then
        echo ""
        echo -e "${GREEN}  ✔  dha-api đã sẵn sàng!${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

echo -e "${CYAN}[4/4]${NC} Khởi động Frontend server (port $FRONTEND_PORT)..."
npx -y serve -l $FRONTEND_PORT "$PROJECT_DIR" &
FRONTEND_PID=$!
sleep 2

echo ""
echo -e "${BOLD}┌──────────────────────────────────────────┐${NC}"
echo -e "${BOLD}│${NC}  ${GREEN}✔${NC}  Tất cả server đã khởi động!           ${BOLD}│${NC}"
echo -e "${BOLD}├──────────────────────────────────────────┤${NC}"
echo -e "${BOLD}│${NC}  🌐 Frontend:  ${CYAN}http://localhost:$FRONTEND_PORT${NC}"
echo -e "${BOLD}│${NC}  ⚙️  API:       ${CYAN}http://localhost:$API_PORT/api${NC}"
echo -e "${BOLD}│${NC}  🛠️  Admin:     ${CYAN}http://localhost:5173${NC} (chạy riêng: npm run admin:dev)"
echo -e "${BOLD}│${NC}  Nhấn ${YELLOW}Ctrl+C${NC} để dừng tất cả server."
echo -e "${BOLD}└──────────────────────────────────────────┘${NC}"
echo ""

wait
```

Run: `bash -n start.sh && echo "cú pháp bash OK"`

- [ ] **Step 7: Cập nhật `README_CMS.md` và `dha-api/.env.example`**

```bash
python3 - <<'PY'
import re
from pathlib import Path

p = Path('README_CMS.md')
s = p.read_text(encoding='utf-8')

head = '''# Hướng dẫn Vận hành Headless CMS - DHA Minerals

Nội dung website nằm trên **Sanity** (Content Lake, dataset private). Máy chủ
nhỏ **`dha-api/`** (Koa) đứng giữa: phục vụ API công khai `/api/*` đúng dạng
Strapi 5 mà `app.js` đang đọc, nhận form liên hệ/đặt mẫu, và phục vụ khu quản
trị riêng `/admin`. Ảnh nằm ở Cloudinary. Thiết kế: `docs/superpowers/specs/2026-09-13-strapi-to-sanity-design.md`.

## 1. Chạy ở máy phát triển

```bash
npm run api:install
cp dha-api/.env.example dha-api/.env   # điền SANITY_* (dataset development) + ADMIN_UI_SESSION_SECRET
./start.sh                             # dha-api :1337 + frontend :3000
npm run admin:dev                      # khu quản trị :5173 (proxy /api sang :1337)
```

Dataset dev trống thì nạp dữ liệu mẫu từ `data/`:

```bash
node dha-api/scripts/seed-from-json.js > dha-api/out/seed.ndjson
SANITY_AUTH_TOKEN=... npx sanity@latest datasets import dha-api/out/seed.ndjson development \\
  --project-id "$SANITY_PROJECT_ID" --replace
```

## 2. Tài khoản quản trị

Không còn trang tạo tài khoản kiểu Strapi. Dùng CLI (mật khẩu nhập ẩn, không qua đối số):

```bash
cd dha-api
node --env-file=.env scripts/admin-user.js create ten@dhakimloaimau.vn --first=Tên --last=Họ
node --env-file=.env scripts/admin-user.js set-password ten@dhakimloaimau.vn
node --env-file=.env scripts/admin-user.js disable ten@dhakimloaimau.vn
```

## 3. Dự phòng khi API lỗi (Static Fallback)

Khi `/api` không trả lời, `app.js` tự đọc các file JSON tĩnh trong `data/`
(trừ slide trang chủ, cố ý không có bản dự phòng). Dataset Sanity gói free bị
**chặn cứng** khi hết hạn mức tháng — dha-api cache đọc 5 phút và xoá cache mỗi
lần ghi để giữ số request thấp. Hạn mức thực tế của project ghi ở đây khi tạo:
_(điền ở runbook bước 1)_.

---

## Custom Admin tại `/admin`

Admin riêng được xây bằng React/Vite trong thư mục `admin/`, gọi `/api/admin-ui/*`
của `dha-api`.

Biến môi trường của `dha-api` (xem `dha-api/.env.example`):

```env
SANITY_PROJECT_ID=...
SANITY_DATASET=production
SANITY_API_TOKEN=...          # quyền Editor, chỉ nằm trên máy chủ
ADMIN_UI_SESSION_SECRET=replace-with-random-secret
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
FRONTEND_URL=http://localhost:3000
HOST=127.0.0.1                # trên VPS: chỉ nghe nội bộ, nginx đứng trước
```

Không đưa `SANITY_API_TOKEN`, `CLOUDINARY_URL`, `CLOUDINARY_API_SECRET` vào frontend.

'''
marker = '### Hướng dẫn sử dụng ngay trong admin'
assert s.count(marker) == 1
s = head + s[s.index(marker):]

nav = re.compile(r"Dữ liệu nằm trong single type `navigation`.*?Backend chỉ\n", re.S)
assert len(nav.findall(s)) == 1
s = nav.sub(lambda _m: '''Dữ liệu nằm trong document `navigation` (`items` kiểu JSON), đọc công khai qua
`GET /api/navigation` và ghi qua `GET|PUT /api/admin-ui/navigation`. Menu mặc định
nằm trong `dha-api/src/defaults/default-items.js` chứ không nằm ở `data/`. Backend chỉ
''', s)

deploy = re.compile(r"### Triển khai \(Production\)\n.*?(?=## Test tự động)", re.S)
assert len(deploy.findall(s)) == 1
s = deploy.sub(lambda _m: '''### Triển khai (Production)

*   Nginx phục vụ `/admin` như static site (`try_files $uri $uri/ /admin/index.html;`), trỏ vào `admin/dist` đã build, được rsync vào `/var/www/dhakimloaimau.vn/admin/`.
*   Nginx proxy `/api/` sang `dha-api` (`http://127.0.0.1:1337`, pm2 app `dha-api`, cấu hình ở `/var/www/dha-api/.env`).
*   `deploy/deploy.sh` chỉ build & sync `admin/` hoặc `dha-api/` khi thư mục đó đổi. Chưa có `/var/www/dha-api/.env` thì chỉ chép code, không khởi động.
*   Sao lưu: `deploy/backup-sanity.sh` (cron hằng tuần) xuất dataset vào `/var/backups/dha-sanity`.
*   Chuyển từ Strapi và rollback: `docs/runbooks/2026-09-strapi-to-sanity-cutover.md`.

''', s)

old = 'bằng một tài khoản Strapi admin thật'
assert s.count(old) == 1
s = s.replace(old, 'bằng một tài khoản quản trị thật (tạo bằng `dha-api/scripts/admin-user.js`)')
assert 'strapi-admin' not in s
p.write_text(s, encoding='utf-8')

e = Path('dha-api/.env.example')
t = e.read_text(encoding='utf-8')
t = t.replace('PORT=1337\n', 'PORT=1337\n# Trên VPS: chỉ nghe nội bộ, nginx đứng trước\n# HOST=127.0.0.1\n')
e.write_text(t, encoding='utf-8')
PY
grep -n "Strapi" README_CMS.md
```

Expected: `grep` chỉ còn các câu nói về việc đã chuyển *từ* Strapi, không còn hướng dẫn vận hành Strapi.

- [ ] **Step 8: Chạy toàn bộ test và commit**

Run: `npm test 2>&1 | tail -4`
Expected: toàn bộ PASS, kể cả `deploy chạy dha-api thay cho Strapi` và test README/nginx cũ.

```bash
git add deploy start.sh README_CMS.md dha-api/.env.example tests/regression.test.js
git commit -m "chore(deploy): chạy dha-api thay Strapi, backup Sanity, gỡ route Strapi khỏi nginx

Rsync frontend không còn chép dha-api/ và docs/ vào thư mục web công khai.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 14: Runbook chuyển đổi và thực hiện chuyển

Phần code đã xong ở Task 1–13. Task này viết runbook rồi **người vận hành** chạy nó trên VPS, từng bước và có xác nhận. Người thực thi kế hoạch (kể cả agent) chỉ viết và commit runbook, rồi dừng lại. Mọi bước chạm tới production, dữ liệu thật hay tài khoản Sanity/Strapi phải để chủ dự án tự làm hoặc tự xác nhận trước.

**Files:**
- Create: `docs/runbooks/2026-09-strapi-to-sanity-cutover.md`

- [ ] **Step 1: Viết runbook**

Nội dung đầy đủ của `docs/runbooks/2026-09-strapi-to-sanity-cutover.md`:

````markdown
# Runbook — Chuyển Strapi sang Sanity (dhakimloaimau.vn)

Thiết kế: `docs/superpowers/specs/2026-09-13-strapi-to-sanity-design.md`.
Mỗi bước ghi **kết quả mong đợi**. Không khớp thì dừng lại, không làm tiếp.

Điều kiện: Task 1–13 đã merge vào `main`, `npm test` xanh, đã chạy
`bash deploy/deploy.sh` một lần. Lần deploy đó chép `dha-api` vào
`/var/www/dha-api` nhưng **không** khởi động (chưa có `.env`).

## A. Chuẩn bị (làm bất cứ lúc nào, web không bị ảnh hưởng)

1. **Tạo project Sanity** tại https://www.sanity.io/manage → ghi `projectId`.
   Vào *Usage*, ghi hạn mức API/CDN/băng thông của gói vào mục 3 của
   `README_CMS.md`. Admin project nhận email cảnh báo ở mức 80% và 100%.
   Kiểm tra email đó tới được hộp thư đang dùng.

2. **Tạo dataset private** (máy có Node, đã `npx sanity@latest login`):
   ```bash
   for ds in development staging production; do
     npx sanity@latest dataset create "$ds" --visibility private --project-id <projectId>
   done
   npx sanity@latest dataset list --project-id <projectId>
   ```
   Mong đợi: ba dataset, đều `private`. **Không** thêm CORS origin nào cho
   project: chỉ `dha-api` gọi Sanity, trình duyệt không bao giờ gọi.

3. **Tạo token** ở *API → Tokens*, quyền **Editor**, tên `dha-api-vps`. Trên VPS:
   ```bash
   cat /var/www/dha-cms/.env | grep -E '^(ADMIN_UI_SESSION_SECRET|ADMIN_JWT_SECRET|CLOUDINARY_URL)='
   sudo -e /var/www/dha-api/.env
   chmod 600 /var/www/dha-api/.env
   ```
   Nội dung `/var/www/dha-api/.env`:
   ```env
   SANITY_PROJECT_ID=<projectId>
   SANITY_DATASET=staging
   SANITY_API_TOKEN=<token Editor>
   ADMIN_UI_SESSION_SECRET=<chép nguyên giá trị đang dùng ở dha-cms: ADMIN_UI_SESSION_SECRET, không có thì ADMIN_JWT_SECRET>
   CLOUDINARY_URL=<chép từ dha-cms>
   FRONTEND_URL=https://dhakimloaimau.vn
   HOST=127.0.0.1
   PORT=1338
   ```
   Kiểm `node -v` ≥ 20.6 (cần cho `--env-file`).

4. **Tạo API token của Strapi** để đọc dữ liệu: `https://dhakimloaimau.vn/strapi-admin`
   → Settings → API Tokens → *Full access*, hạn 7 ngày. Không lưu vào file;
   dán trực tiếp vào lệnh ở bước 5.

## B. Chạy thử trên staging (web vẫn chạy Strapi)

5. **Xuất dữ liệu**:
   ```bash
   cd /var/www/dha-api
   read -rs STRAPI_TOKEN && export STRAPI_TOKEN
   node --env-file=.env scripts/migrate-from-strapi.js out/migrate.ndjson
   ls -l out/migrate.ndjson
   ```
   Mong đợi: JSON tóm tắt. Số lượng mỗi loại khớp với Content Manager của
   Strapi; `adminUsersSkipped` rỗng; file có quyền `-rw-------`. Nếu báo
   thiếu `CLOUDINARY_URL` kèm danh sách ảnh `/uploads`, kiểm tra `.env` rồi chạy lại.

6. **Nạp vào staging**:
   ```bash
   set -a; . ./.env; set +a
   SANITY_AUTH_TOKEN="$SANITY_API_TOKEN" npx --yes sanity@latest datasets import \
     out/migrate.ndjson staging --project-id "$SANITY_PROJECT_ID" --replace
   ```
   Mong đợi: `Done! Imported N documents`, N bằng `total` ở bước 5.

7. **Khởi động dha-api ở cổng 1338**:
   ```bash
   pm2 start /var/www/web-ha-can/deploy/ecosystem.config.js && pm2 save
   pm2 logs dha-api --lines 20 --nostream
   curl -s http://127.0.0.1:1338/api/site-setting | head -c 200
   ```
   Mong đợi: log `nghe 127.0.0.1:1338 — dataset staging`, không có lỗi
   "đang public"; `curl` trả `{"data":{...`.

8. **Đối chiếu**:
   ```bash
   read -r ADMIN_EMAIL && read -rs ADMIN_PASSWORD && export ADMIN_EMAIL ADMIN_PASSWORD
   node scripts/compare-apis.js http://127.0.0.1:1337 http://127.0.0.1:1338
   ```
   Mong đợi: dòng cuối `Khớp`. Cảnh báo `khác thứ tự` thì chấp nhận được.
   Mỗi dòng `✗` là một lỗi phải sửa trong code (quay lại Task tương ứng),
   deploy lại, rồi làm lại từ bước 5.

9. *(Tuỳ chọn)* **Thử khu quản trị trên staging** từ máy cá nhân:
   `ssh -L 1337:127.0.0.1:1338 root@<VPS>` rồi `npm run admin:dev`. Đăng nhập
   bằng tài khoản cũ, sửa thử một bài tin, xem `http://localhost:1337/api/news-articles`.

## C. Chuyển (báo trước với người biên tập; khoảng 30 phút)

10. **Đóng băng biên tập**: báo người biên tập ngừng sửa nội dung. Ghi lại
    giờ bắt đầu: `date -u +%Y-%m-%dT%H:%M:%SZ`.

11. **Xuất lại và nạp vào production**:
    ```bash
    node --env-file=.env scripts/migrate-from-strapi.js out/migrate.ndjson
    SANITY_AUTH_TOKEN="$SANITY_API_TOKEN" npx --yes sanity@latest datasets import \
      out/migrate.ndjson production --project-id "$SANITY_PROJECT_ID" --replace
    sed -i 's/^SANITY_DATASET=.*/SANITY_DATASET=production/' .env
    pm2 restart dha-api && sleep 2
    node scripts/compare-apis.js http://127.0.0.1:1337 http://127.0.0.1:1338
    ```
    Mong đợi: `Khớp`.

12. **Đổi cổng**. Mục 12–14 nên làm liền nhau; thời gian web lỗi API
    khoảng vài giây, và `app.js` tự rơi về `data/*.json` trong lúc đó.
    ```bash
    pm2 stop dha-cms
    sed -i 's/^PORT=.*/PORT=1337/' .env
    pm2 restart dha-api && pm2 save
    curl -s http://127.0.0.1:1337/api/site-setting | head -c 200
    ```
    Mong đợi: JSON như bước 7. `pm2 ls`: `dha-cms` *stopped*, `dha-api` *online*.

13. **Cập nhật nginx** (deploy.sh không tự ghi đè vì Certbot quản lý SSL):
    ```bash
    diff /var/www/web-ha-can/deploy/nginx.conf /etc/nginx/sites-available/dhakimloaimau.vn
    cp /etc/nginx/sites-available/dhakimloaimau.vn /root/nginx-dhakimloaimau.vn.truoc-chuyen
    sudo -e /etc/nginx/sites-available/dhakimloaimau.vn   # xoá các location Strapi, giữ khối SSL
    nginx -t && systemctl reload nginx
    ```

14. **Kiểm tra trên production**:
    ```bash
    curl -s https://dhakimloaimau.vn/api/news-articles?pagination[limit]=1 | head -c 200
    curl -s -o /dev/null -w '%{http_code}\n' -X POST https://dhakimloaimau.vn/api/contact-inquiries \
      -H 'Content-Type: application/json' -d '{"data":{"name":"x"}}'
    curl -s -o /dev/null -w '%{http_code}\n' https://dhakimloaimau.vn/strapi-admin
    ```
    Mong đợi lần lượt: JSON tin tức, `400` (route form sống, không ghi gì), `404`.
    Trên máy cá nhân, chạy `npm run test:e2e` (có `.env.e2e`) → xanh.
    Đăng nhập `/admin` bằng tài khoản cũ → vào được, thấy đủ dữ liệu.

15. **Mở lại biên tập**. Xoá file xuất:
    `shred -u out/migrate.ndjson 2>/dev/null || rm -f out/migrate.ndjson`.
    Thu hồi API token Strapi ở bước 4.

16. **Bật sao lưu**:
    ```bash
    /var/www/web-ha-can/deploy/backup-sanity.sh
    ls -l /var/backups/dha-sanity/
    ( crontab -l 2>/dev/null; echo '0 3 * * 0 /var/www/web-ha-can/deploy/backup-sanity.sh >> /var/log/dha-sanity-backup.log 2>&1' ) | crontab -
    ```
    Mong đợi: có file `production-<ngày>.tar.gz`, quyền `-rw-------`.

17. **Theo dõi 48 giờ**: `pm2 logs dha-api` không có lỗi 500 lặp lại; trang
    *Usage* của Sanity tăng đều, không vọt.

## D. Rollback (trong 14 ngày sau bước 12)

Mọi lượt ghi vào Sanity sau khi chuyển **không** có trong Strapi. Trước khi
rollback, xuất các yêu cầu liên hệ và đơn đặt mẫu mới để nhập tay lại:

```bash
cd /var/www/dha-api && set -a; . ./.env; set +a
SANITY_AUTH_TOKEN="$SANITY_API_TOKEN" npx --yes sanity@latest documents query \
  '*[_type in ["contactInquiry","orderRequest"] && createdAt > "<giờ ở bước 10>"]' \
  --dataset production --project-id "$SANITY_PROJECT_ID" > /root/sau-chuyen.json
chmod 600 /root/sau-chuyen.json
```

Rồi:

```bash
pm2 stop dha-api
pm2 start dha-cms            # tiến trình cũ vẫn còn trong pm2 (đã stop ở bước 12)
# nếu đã bị xoá khỏi pm2:
# pm2 start /var/www/web-ha-can/deploy/ecosystem.strapi-rollback.config.js
pm2 save
cp /root/nginx-dhakimloaimau.vn.truoc-chuyen /etc/nginx/sites-available/dhakimloaimau.vn
nginx -t && systemctl reload nginx
```

Mong đợi: `/strapi-admin` mở lại được; web đọc từ Strapi.
````

- [ ] **Step 2: Commit runbook**

```bash
git add docs/runbooks/2026-09-strapi-to-sanity-cutover.md
git commit -m "docs: runbook chuyển Strapi sang Sanity và rollback

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Giao cho chủ dự án thực hiện**

Dừng ở đây. Báo chủ dự án rằng runbook đã sẵn sàng và phần A làm được ngay mà không ảnh hưởng tới web. Không tự chạy bất kỳ bước nào của runbook.

### Task 15: Dọn dẹp sau 14 ngày ổn định

**Chỉ làm khi** đã qua ít nhất 14 ngày kể từ bước 12 của runbook, không có rollback, và chủ dự án đồng ý xoá hẳn Strapi.

**Files:**
- Delete: `dha-cms/` (toàn bộ), `deploy/backup-strapi.sh`, `deploy/ecosystem.strapi-rollback.config.js`
- Modify: `.gitignore`, `deploy/deploy.sh`, `README_CMS.md`

- [ ] **Step 1: Kiểm tra không còn gì phụ thuộc `dha-cms`**

Run: `grep -rn "dha-cms" --include=*.js --include=*.jsx --include=*.json --include=*.sh --include=*.md . | grep -v node_modules | grep -v "^./dha-cms/" | grep -v "^./docs/"`
Expected: chỉ còn các dòng trong `.gitignore`, `deploy/deploy.sh` (`--exclude="dha-cms/"`), `deploy/ecosystem.strapi-rollback.config.js`, `deploy/backup-strapi.sh`, và README (nếu có). Không có dòng nào trong `tests/`, `dha-api/`, `app.js`, `admin/`.

- [ ] **Step 2: Xoá khỏi repo**

```bash
git rm -r -q dha-cms deploy/backup-strapi.sh deploy/ecosystem.strapi-rollback.config.js
python3 - <<'PY'
from pathlib import Path
g = Path('.gitignore')
s = g.read_text(encoding='utf-8')
for line in ['dha-cms/node_modules/\n', 'dha-cms/.cache/\n', 'dha-cms/build/\n', 'dha-cms/.tmp/\n', 'dha-cms/.env\n']:
    assert line in s, line
    s = s.replace(line, '')
g.write_text(s, encoding='utf-8')
d = Path('deploy/deploy.sh')
t = d.read_text(encoding='utf-8')
assert '    --exclude="dha-cms/" \\\n' in t
d.write_text(t.replace('    --exclude="dha-cms/" \\\n', ''), encoding='utf-8')
PY
```

Rồi xoá hoặc sửa mọi câu còn nhắc tới Strapi như một thứ đang chạy trong `README_CMS.md`; giữ lại câu lịch sử "chuyển từ Strapi".

- [ ] **Step 3: Chạy test**

Run: `npm test 2>&1 | tail -4 && grep -rn "dha-cms" tests/ dha-api/src || echo "sạch"`
Expected: toàn bộ PASS; `sạch`.

- [ ] **Step 4: Commit**

```bash
git add -A .gitignore deploy README_CMS.md
git commit -m "chore: gỡ Strapi (dha-cms) sau 14 ngày chạy ổn định trên Sanity

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Việc trên VPS (chủ dự án tự làm)**

```bash
pm2 delete dha-cms && pm2 save
tar -czf /var/backups/dha-cms-final-$(date +%Y%m%d).tar.gz -C /var/www dha-cms/.tmp/data.db dha-cms/.env
chmod 600 /var/backups/dha-cms-final-*.tar.gz
# Sau khi chắc chắn bản nén trên đọc được:
# rm -rf /var/www/dha-cms
```
