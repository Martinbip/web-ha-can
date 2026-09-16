# Đợt 3 — Nội dung từng trang và SEO: kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chữ nội dung của 7 trang và 4 ô SEO mỗi trang do quản trị sửa trong admin; prerender đọc bản mẫu trong repo rồi ghi sang thư mục phục vụ, nên ô bỏ trống quay về chữ mặc định ngay lần lưu kế tiếp.

**Architecture:** Single type `page-content` giữ hai trường JSON (`texts`, `seo`) theo mã trang. Danh sách ô khai báo ở `dha-cms/src/api/page-content/fields.js` (khoá + kiểu + độ dài) và `admin/src/config/page-content-fields.js` (nhãn + placeholder), có test giữ khớp. HTML đánh dấu `data-page` trên `<body>` và `data-page-text` / `data-page-href` / `data-page-list` / `data-page-seo` tại từng chỗ. `scripts/prerender-site-settings.js` và `app.js` áp cùng dữ liệu, ra cùng một DOM.

**Tech Stack:** HTML tĩnh + `app.js` thuần, Strapi 5 (`dha-cms/`), admin React (`admin/`), bash (`deploy/deploy.sh`), test `node --test` + `jsdom`.

**Spec:** `docs/superpowers/specs/2026-09-16-noi-dung-trang-seo-design.md`

## Global Constraints

- Bảy mã trang: `home` (index.html), `products`, `projects`, `news`, `pricing`, `estimator`, `contact`.
- Đánh dấu trong HTML: `<body data-page="MÃ">`; `data-page-text="khoá"` (thay chữ); `data-page-href="khoá"` (thay link); `data-page-list="khoá"` (thay các `<li>`, mẫu `<li>chữ</li>`); `data-page-seo="title|description|image|image_alt"`.
- Một ô SEO điền cho nhiều thẻ: `title` → `<title>` + `og:title` + `twitter:title`; `description` → `meta description` + `og:description` + `twitter:description`; `image` → `og:image` + `twitter:image`; `image_alt` → `og:image:alt`.
- Ô trống, trang lạ, khoá lạ, sai kiểu → **giữ nguyên HTML**, không xoá trắng.
- Chữ nhiều dòng (`products_title`) đổi xuống dòng thành `<br>`, như `hero_title` đang làm.
- URL (`data-page-href`, ảnh SEO) đi qua quy tắc đợt 2: nhận `/...`, `#...`, `http(s)://\S+`; chặn `//...` và `/\...`.
- `app.js` và prerender phải cho ra cùng một DOM (lệch là chớp); có test so khớp trên 9 trang.
- Độ dài tối đa: SEO `title` 70, `description` 200, `image` 500, `image_alt` 150; các ô nội dung theo khai báo trong `fields.js`.
- Nhãn giao diện và thông báo hệ thống (nhóm 6 của lộ trình) vẫn giữ trong code.
- Chữ trong code, comment, thông báo test viết tiếng Việt có dấu; `app.js` và `styles.css` thụt lề 4 dấu cách, còn lại 2.
- Mọi lệnh chạy từ gốc worktree; `npm test` chạy toàn bộ test.

## Bản đồ file

| File | Việc |
|---|---|
| `scripts/prerender-site-settings.js` | Tách nguồn/đích; ghi nội dung trang + SEO; nguồn dữ liệu thứ tư |
| `deploy/deploy.sh`, `dha-cms/src/api/site-setting/prerender.js` | Truyền thư mục nguồn |
| `dha-cms/src/api/page-content/**` (mới) | Single type, `fields.js`, lifecycle |
| `dha-cms/src/api/admin-ui/services/resource-config.js`, `dha-cms/src/index.js` | Khai báo + quyền đọc công khai |
| `admin/src/config/page-content-fields.js` (mới), `admin/src/pages/PageContentPage.jsx` (mới), `admin/src/App.jsx`, `admin/src/layout/AdminShell.jsx`, `admin/src/styles.css` | Mục "Nội dung trang" |
| 9 file HTML | `data-page` + các dấu nội dung/SEO |
| `app.js` | `applyPageContent()` |
| `tests/deploy.test.js`, `tests/prerender-site-settings.test.js`, `tests/hardcoded-content.test.js`, `tests/admin-pages-ui.test.js`, `tests/page-content.test.js` (mới), `package.json` | Test |

---

### Task 1: Prerender đọc nguồn, ghi sang đích

**Files:**
- Modify: `scripts/prerender-site-settings.js` (`prerenderDirectory`, `main`), `deploy/deploy.sh` (2 lượt prerender), `dha-cms/src/api/site-setting/prerender.js`
- Test: `tests/prerender-site-settings.test.js`, `tests/deploy.test.js`

**Interfaces:**
- Produces: `prerenderDirectory(target, { sourceDir, loadSettings, loadCategories, loadNavigation, log })` — `sourceDir` mặc định bằng `target` (giữ hành vi cũ ở máy dev); đọc `.html` từ `sourceDir`, ghi sang `target`; ném lỗi nếu `sourceDir` không tồn tại. CLI: `node scripts/prerender-site-settings.js <đích> [nguồn]`.

- [ ] **Step 1: Viết test hỏng**

Thêm vào cuối `tests/prerender-site-settings.test.js`:

```js
test('prerender đọc bản mẫu ở nguồn rồi ghi sang đích', async () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'prerender-src-'));
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'prerender-dest-'));
  const template = '<html><body><span class="site-hotline">086.725.9078</span></body></html>';
  const quiet = { warn() {} };
  const noCms = async () => {
    throw new Error('không dùng');
  };
  try {
    fs.writeFileSync(path.join(src, 'index.html'), template);
    fs.writeFileSync(path.join(dest, 'index.html'), template);
    fs.writeFileSync(path.join(dest, 'sitemap.xml'), '<urlset/>');

    await prerenderDirectory(dest, {
      sourceDir: src,
      loadSettings: async () => ({ hotline: '0912345678' }),
      loadCategories: noCms,
      loadNavigation: noCms,
      log: quiet,
    });
    assert.match(fs.readFileSync(path.join(dest, 'index.html'), 'utf8'), /0912345678/);
    assert.equal(fs.readFileSync(path.join(src, 'index.html'), 'utf8'), template, 'bản mẫu ở nguồn không bị sửa');
    assert.equal(fs.readFileSync(path.join(dest, 'sitemap.xml'), 'utf8'), '<urlset/>', 'file không phải .html không bị đụng');

    // Ô bị xoá trắng trong admin: đích phải quay về chữ mặc định của bản mẫu.
    await prerenderDirectory(dest, {
      sourceDir: src,
      loadSettings: async () => ({ hotline: '' }),
      loadCategories: noCms,
      loadNavigation: noCms,
      log: quiet,
    });
    assert.equal(fs.readFileSync(path.join(dest, 'index.html'), 'utf8'), template, 'bỏ trống thì về lại bản mẫu');
  } finally {
    fs.rmSync(src, { recursive: true, force: true });
    fs.rmSync(dest, { recursive: true, force: true });
  }
});

test('thiếu thư mục nguồn thì báo lỗi rõ, không ghi gì', async () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'prerender-dest-'));
  try {
    await assert.rejects(
      prerenderDirectory(dest, {
        sourceDir: path.join(dest, 'khong-co-that'),
        loadSettings: async () => ({ hotline: '0912345678' }),
        loadCategories: async () => [],
        loadNavigation: async () => [],
        log: { warn() {} },
      }),
      /không tìm thấy|khong-co-that/i,
    );
  } finally {
    fs.rmSync(dest, { recursive: true, force: true });
  }
});
```

Trong `tests/deploy.test.js`, sửa test thứ tự: cả hai lệnh `prerender-site-settings.js` phải truyền **hai** tham số — thư mục phục vụ `/var/www/dhakimloaimau.vn` rồi thư mục nguồn `/var/www/web-ha-can`:

```js
test('cả hai lượt prerender đều ghi từ bản mẫu trong repo sang thư mục phục vụ', () => {
  const calls = source.match(/node \/var\/www\/web-ha-can\/scripts\/prerender-site-settings\.js[^\n]*/g) || [];
  assert.equal(calls.length, 2, 'đúng hai lượt prerender');
  for (const call of calls) {
    assert.match(call, /\/var\/www\/dhakimloaimau\.vn \/var\/www\/web-ha-can/, 'truyền đích rồi nguồn');
  }
});
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test tests/prerender-site-settings.test.js tests/deploy.test.js`
Expected: FAIL — `prerenderDirectory` chưa nhận `sourceDir` (đích không đổi / không rejects), và `deploy.sh` mới truyền một tham số.

- [ ] **Step 3: Sửa `prerenderDirectory` và `main`**

Trong `scripts/prerender-site-settings.js`, thay phần khai báo và vòng lặp của `prerenderDirectory`:

```js
async function prerenderDirectory(
  target,
  {
    sourceDir = target,
    loadSettings = fetchSettings,
    loadCategories = fetchCategories,
    loadNavigation = fetchNavigation,
    log = console,
  } = {},
) {
  // Luôn dựng từ bản mẫu trong repo rồi ghi sang thư mục phục vụ: ô nào quản trị
  // xoá trắng sẽ quay về chữ mặc định ngay lần lưu kế tiếp, thay vì giữ nội dung
  // của lần ghi trước tới tận lần deploy sau.
  if (!fs.existsSync(sourceDir)) throw new Error(`không tìm thấy thư mục nguồn ${sourceDir}`);
```

(giữ nguyên khối `Promise.allSettled` và phần cảnh báo), rồi thay vòng lặp file bằng:

```js
  const files = fs.readdirSync(sourceDir).filter((file) => file.endsWith('.html'));
  let changed = 0;
  for (const file of files) {
    const html = fs.readFileSync(path.join(sourceDir, file), 'utf8');
    let out = html;
    if (settings) out = applySettingsToHtml(out, settings);
    if (categories) out = applyCategoriesToHtml(out, categories);
    if (navigation) out = applyNavigationToHtml(out, navigation, pagePathForFile(file));

    const destFile = path.join(target, file);
    const current = fs.existsSync(destFile) ? fs.readFileSync(destFile, 'utf8') : null;
    if (out !== current) {
      fs.writeFileSync(destFile, out, 'utf8');
      changed += 1;
    }
  }
```

Trong `main()`, nhận thêm tham số nguồn:

```js
async function main() {
  const target = path.resolve(process.argv[2] || path.join(__dirname, '..'));
  const sourceDir = path.resolve(process.argv[3] || target);
  const result = await prerenderDirectory(target, { sourceDir });
```

(giữ nguyên phần in kết quả, thêm nguồn vào câu log nếu khác đích).

- [ ] **Step 4: Truyền nguồn từ deploy và từ CMS**

`deploy/deploy.sh`: cả hai lệnh `node /var/www/web-ha-can/scripts/prerender-site-settings.js /var/www/dhakimloaimau.vn` thêm ` /var/www/web-ha-can` vào cuối (trước dấu `\`).

`dha-cms/src/api/site-setting/prerender.js`: thêm nguồn mặc định và truyền vào lệnh spawn:

```js
const DEFAULT_SOURCE_DIR = process.env.PRERENDER_SOURCE_DIR || '/var/www/web-ha-can';
```

— thêm `sourceDir = DEFAULT_SOURCE_DIR` vào tham số của `createPrerenderRunner`, kiểm `exists(sourceDir)` cùng với `exists(script)`/`exists(htmlDir)` trong `run()`, và đổi lệnh chạy thành `spawn('node', [script, htmlDir, sourceDir], ...)`.

Cập nhật `tests/site-setting-prerender.test.js`: `harness` truyền `sourceDir: '/var/www/web-ha-can'`, và test đầu tiên khẳng định `args` là ba phần tử `[script, htmlDir, sourceDir]`.

- [ ] **Step 5: Chạy test, xác nhận qua**

Run: `node --test tests/prerender-site-settings.test.js tests/deploy.test.js tests/site-setting-prerender.test.js`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add scripts/prerender-site-settings.js deploy/deploy.sh dha-cms/src/api/site-setting/prerender.js tests/prerender-site-settings.test.js tests/deploy.test.js tests/site-setting-prerender.test.js
git commit -m "fix: prerender dựng từ bản mẫu trong repo rồi ghi sang thư mục phục vụ"
```

---

### Task 2: Single type "Nội dung trang" trong CMS

**Files:**
- Create: `dha-cms/src/api/page-content/content-types/page-content/schema.json`, `.../lifecycles.js`, `dha-cms/src/api/page-content/controllers/page-content.js`, `.../routes/page-content.js`, `.../services/page-content.js`, `dha-cms/src/api/page-content/fields.js`, `tests/page-content.test.js`
- Modify: `dha-cms/src/api/admin-ui/services/resource-config.js`, `dha-cms/src/index.js`, `package.json`

**Interfaces:**
- Produces: `PAGE_FIELDS`, `SEO_FIELDS`, `PAGE_CODES`, `sanitizePageContent(data)` từ `dha-cms/src/api/page-content/fields.js`; single type đọc công khai ở `GET /api/page-content` với hai trường JSON `texts`, `seo`.

- [ ] **Step 1: Viết test hỏng**

Tạo `tests/page-content.test.js`:

```js
// "Nội dung trang" giữ chữ của 7 trang dưới dạng JSON. Dữ liệu tới từ form admin
// nên phải lọc trước khi lưu: trang lạ, khoá lạ, sai kiểu, chữ quá dài.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const {
  PAGE_CODES,
  PAGE_FIELDS,
  SEO_FIELDS,
  sanitizePageContent,
} = require('../dha-cms/src/api/page-content/fields');
const { getResourceConfig } = require('../dha-cms/src/api/admin-ui/services/resource-config');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

test('nội dung trang là single type thật, hai trường JSON', () => {
  const schema = JSON.parse(read('dha-cms/src/api/page-content/content-types/page-content/schema.json'));
  assert.equal(schema.kind, 'singleType');
  assert.equal(schema.attributes.texts.type, 'json');
  assert.equal(schema.attributes.seo.type, 'json');
});

test('bảy trang, mỗi trang có khoá và giới hạn độ dài', () => {
  assert.deepEqual(PAGE_CODES, ['home', 'products', 'projects', 'news', 'pricing', 'estimator', 'contact']);
  for (const page of PAGE_CODES) {
    const fields = PAGE_FIELDS[page];
    assert.ok(fields && Object.keys(fields).length, `${page} phải có ô`);
    for (const [key, field] of Object.entries(fields)) {
      assert.ok(['text', 'textarea', 'url', 'text-list'].includes(field.type), `${page}.${key} sai kiểu`);
      assert.ok(field.max > 0, `${page}.${key} thiếu độ dài tối đa`);
    }
  }
  assert.deepEqual(Object.keys(SEO_FIELDS), ['title', 'description', 'image', 'image_alt']);
  assert.equal(SEO_FIELDS.title.max, 70);
  assert.equal(SEO_FIELDS.description.max, 200);
});

test('lọc dữ liệu trước khi lưu: bỏ trang lạ, khoá lạ, sai kiểu, cắt chữ quá dài', () => {
  const clean = sanitizePageContent({
    texts: {
      home: { services_title: '  Dịch vụ  ', khoa_la: 'x', services_description: 123 },
      trang_la: { a: 'b' },
      contact: { commitments: ['  Dòng 1  ', '', 42, 'Dòng 2'] },
    },
    seo: {
      home: { title: 'T'.repeat(100), description: 'Mô tả', anh_la: 'x' },
      trang_la: { title: 'x' },
    },
  });

  assert.deepEqual(clean.texts.home, { services_title: 'Dịch vụ' }, 'bỏ khoá lạ và giá trị sai kiểu, cắt khoảng trắng');
  assert.equal(clean.texts.trang_la, undefined);
  assert.deepEqual(clean.texts.contact.commitments, ['Dòng 1', 'Dòng 2'], 'danh sách chỉ giữ dòng chữ có nội dung');
  assert.equal(clean.seo.home.title.length, 70, 'tiêu đề SEO bị cắt theo giới hạn');
  assert.equal(clean.seo.home.anh_la, undefined);
  assert.equal(clean.seo.trang_la, undefined);
});

test('lưu nội dung trang thì ghi lại HTML tĩnh ngay', () => {
  const prerender = require('../dha-cms/src/api/site-setting/prerender');
  const original = prerender.schedulePrerender;
  let calls = 0;
  prerender.schedulePrerender = () => {
    calls += 1;
  };
  try {
    const lifecycles = require('../dha-cms/src/api/page-content/content-types/page-content/lifecycles');
    const createEvent = { params: { data: { texts: { home: { services_title: 'A' } } } } };
    lifecycles.beforeCreate(createEvent);
    assert.deepEqual(createEvent.params.data.texts.home, { services_title: 'A' }, 'lọc ngay trước khi lưu');
    lifecycles.afterCreate();
    lifecycles.afterUpdate();
    assert.equal(calls, 2);
  } finally {
    prerender.schedulePrerender = original;
  }
});

test('website đọc được nội dung trang mà không cần đăng nhập, admin sửa được', () => {
  assert.match(read('dha-cms/src/index.js'), /api::page-content\.page-content\.find'/);
  const config = getResourceConfig('page-content');
  assert.equal(config.uid, 'api::page-content.page-content');
  assert.equal(config.singleType, true);
  assert.deepEqual(config.editableFields, ['texts', 'seo']);
});
```

Thêm ` tests/page-content.test.js` vào cuối chuỗi script `test` trong `package.json`.

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test tests/page-content.test.js`
Expected: FAIL — `Cannot find module '../dha-cms/src/api/page-content/fields'`.

- [ ] **Step 3: Khai báo danh sách ô**

Tạo `dha-cms/src/api/page-content/fields.js`:

```js
'use strict';

// Danh sách ô của từng trang. Nhãn tiếng Việt nằm ở admin
// (admin/src/config/page-content-fields.js) — có test giữ hai bên khớp khoá.
const PAGE_CODES = ['home', 'products', 'projects', 'news', 'pricing', 'estimator', 'contact'];

const PAGE_FIELDS = {
  home: {
    hero_primary_label: { type: 'text', max: 60 },
    hero_primary_url: { type: 'url', max: 300 },
    hero_secondary_label: { type: 'text', max: 60 },
    hero_secondary_url: { type: 'url', max: 300 },
    prices_title: { type: 'text', max: 120 },
    prices_cta_label: { type: 'text', max: 60 },
    news_title: { type: 'text', max: 120 },
    news_link_label: { type: 'text', max: 60 },
    sidebar_categories_title: { type: 'text', max: 60 },
    products_tag: { type: 'text', max: 80 },
    products_title: { type: 'textarea', max: 120 },
    products_link_label: { type: 'text', max: 60 },
    services_tag: { type: 'text', max: 80 },
    services_title: { type: 'text', max: 120 },
    services_description: { type: 'textarea', max: 400 },
    workflow_tag: { type: 'text', max: 80 },
    workflow_title: { type: 'text', max: 120 },
    workflow_description: { type: 'textarea', max: 400 },
  },
  products: {
    title: { type: 'text', max: 120 },
    intro: { type: 'textarea', max: 400 },
    cta_title: { type: 'text', max: 120 },
    cta_call_label: { type: 'text', max: 60 },
    cta_contact_label: { type: 'text', max: 60 },
  },
  projects: {
    tag: { type: 'text', max: 80 },
    title: { type: 'text', max: 120 },
    description: { type: 'textarea', max: 400 },
  },
  news: {
    title: { type: 'text', max: 120 },
    intro: { type: 'textarea', max: 400 },
  },
  pricing: {
    title: { type: 'text', max: 120 },
    intro: { type: 'textarea', max: 400 },
    cta_label: { type: 'text', max: 60 },
    survey_title: { type: 'text', max: 120 },
    survey_description: { type: 'textarea', max: 400 },
  },
  estimator: {
    tag: { type: 'text', max: 80 },
    title: { type: 'text', max: 120 },
    intro: { type: 'textarea', max: 400 },
    note: { type: 'textarea', max: 600 },
    cta_label: { type: 'text', max: 60 },
  },
  contact: {
    title: { type: 'text', max: 120 },
    intro: { type: 'textarea', max: 400 },
    call_title: { type: 'text', max: 120 },
    commitments_title: { type: 'text', max: 80 },
    commitments: { type: 'text-list', max: 200 },
    success_title: { type: 'text', max: 120 },
    success_message: { type: 'textarea', max: 400 },
  },
};

const SEO_FIELDS = {
  title: { type: 'text', max: 70 },
  description: { type: 'textarea', max: 200 },
  image: { type: 'url', max: 500 },
  image_alt: { type: 'text', max: 150 },
};

function cleanString(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function cleanField(value, field) {
  if (field.type === 'text-list') {
    if (!Array.isArray(value)) return null;
    const lines = value.map((line) => cleanString(line, field.max)).filter(Boolean);
    return lines.length ? lines : null;
  }
  return cleanString(value, field.max);
}

function cleanGroup(raw, fields) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, field] of Object.entries(fields)) {
    const value = cleanField(raw[key], field);
    if (value !== null) out[key] = value;
  }
  return out;
}

// Dữ liệu đến từ form admin, có thể mang khoá lạ hoặc kiểu sai (dữ liệu cũ, sửa
// tay). Lọc theo đúng khai báo rồi mới lưu; phần bỏ đi thì website giữ chữ mặc
// định trong HTML.
function sanitizePageContent(data) {
  const texts = {};
  const seo = {};
  for (const page of PAGE_CODES) {
    const pageTexts = cleanGroup(data?.texts?.[page], PAGE_FIELDS[page]);
    if (Object.keys(pageTexts).length) texts[page] = pageTexts;
    const pageSeo = cleanGroup(data?.seo?.[page], SEO_FIELDS);
    if (Object.keys(pageSeo).length) seo[page] = pageSeo;
  }
  return { texts, seo };
}

module.exports = { PAGE_CODES, PAGE_FIELDS, SEO_FIELDS, sanitizePageContent };
```

- [ ] **Step 4: Tạo single type**

`dha-cms/src/api/page-content/content-types/page-content/schema.json`:

```json
{
  "kind": "singleType",
  "collectionName": "page_contents",
  "info": {
    "singularName": "page-content",
    "pluralName": "page-contents",
    "displayName": "Nội Dung Trang",
    "description": "Chữ và SEO của từng trang trên website"
  },
  "options": {
    "draftAndPublish": false
  },
  "pluginOptions": {},
  "attributes": {
    "texts": {
      "type": "json"
    },
    "seo": {
      "type": "json"
    }
  }
}
```

`controllers/page-content.js`, `routes/page-content.js`, `services/page-content.js`: chép đúng mẫu của `navigation` (dùng `factories.createCoreController/Router/Service` với uid `api::page-content.page-content`).

`content-types/page-content/lifecycles.js`:

```js
'use strict';

// Nội dung trang hiện trên 7 trang và được prerender ghi sẵn vào HTML tĩnh.
// Lọc dữ liệu trước khi lưu, và ghi lại HTML ngay sau khi lưu.
// Gọi prerender qua đối tượng module (không destructure) để test thay được.
const prerender = require('../../../site-setting/prerender');
const { sanitizePageContent } = require('../../fields');

function sanitizeEvent(event) {
  const data = event.params?.data;
  if (!data) return;
  const clean = sanitizePageContent(data);
  data.texts = clean.texts;
  data.seo = clean.seo;
}

module.exports = {
  beforeCreate(event) {
    sanitizeEvent(event);
  },

  beforeUpdate(event) {
    sanitizeEvent(event);
  },

  afterCreate() {
    prerender.schedulePrerender();
  },

  afterUpdate() {
    prerender.schedulePrerender();
  },
};
```

- [ ] **Step 5: Khai báo cho admin và mở quyền đọc**

Trong `dha-cms/src/api/admin-ui/services/resource-config.js`, thêm một khối ngay sau khối `'site-setting'`:

```js
  'page-content': {
    uid: 'api::page-content.page-content',
    label: 'Nội dung trang',
    pluralLabel: 'Nội dung trang',
    singleType: true,
    draftAndPublish: false,
    titleField: 'texts',
    editableFields: ['texts', 'seo'],
    listFields: [],
    fields: {
      texts: { label: 'Chữ trong các trang', type: 'json' },
      seo: { label: 'SEO các trang', type: 'json' },
    },
  },
```

Trong `dha-cms/src/index.js`, thêm `'api::page-content.page-content.find',` vào mảng `actions` (cạnh `'api::navigation.navigation.find'`).

- [ ] **Step 6: Chạy test, xác nhận qua**

Run: `node --test tests/page-content.test.js tests/admin-resource-fields.test.js tests/admin-ui-config.test.js`
Expected: PASS (nếu `tests/admin-ui-config.test.js` báo thiếu `dha-cms/node_modules` thì ghi nhận, đó là lỗi môi trường có sẵn).

- [ ] **Step 7: Commit**

```bash
git add dha-cms/src/api/page-content dha-cms/src/api/admin-ui/services/resource-config.js dha-cms/src/index.js tests/page-content.test.js package.json
git commit -m "feat: CMS có single type Nội dung trang cho chữ và SEO từng trang"
```

---

### Task 3: Mục "Nội dung trang" trong admin

**Files:**
- Create: `admin/src/config/page-content-fields.js`, `admin/src/pages/PageContentPage.jsx`
- Modify: `admin/src/App.jsx`, `admin/src/layout/AdminShell.jsx`, `admin/src/styles.css`
- Test: `tests/admin-pages-ui.test.js`, `tests/page-content.test.js`

**Interfaces:**
- Consumes: `getSingletonResource('page-content')` / `saveSingletonResource('page-content', id, { texts, seo })` (`admin/src/api/resources.js`); `FieldRenderer` các kiểu `text`, `textarea`, `url`, `text-list`, `cloudinary-image`.
- Produces: `PAGE_TABS` (mảng `{ code, label, fields: [{ key, label, type, placeholder }] }`) và `SEO_TAB_FIELDS` trong `admin/src/config/page-content-fields.js`.

- [ ] **Step 1: Viết test hỏng**

Thêm vào cuối `tests/page-content.test.js` (test giữ hai danh sách khớp nhau):

```js
test('danh sách ô của admin khớp khai báo phía CMS', () => {
  const source = read('admin/src/config/page-content-fields.js');
  for (const page of PAGE_CODES) {
    const block = source.match(new RegExp(`code: '${page}'[\\s\\S]*?\\n  \\},`));
    assert.ok(block, `admin thiếu tab ${page}`);
    const keys = [...block[0].matchAll(/key: '([a-z_]+)'/g)].map((m) => m[1]).sort();
    assert.deepEqual(keys, Object.keys(PAGE_FIELDS[page]).sort(), `tab ${page} lệch khoá so với CMS`);
  }
  for (const key of Object.keys(SEO_FIELDS)) {
    assert.match(source, new RegExp(`key: '${key}'`), `admin thiếu ô SEO ${key}`);
  }
});
```

Thêm vào cuối `tests/admin-pages-ui.test.js`:

```js
// --- Nội dung trang ----------------------------------------------------------

function pageContentRecord() {
  return {
    documentId: 'pc-1',
    texts: { home: { services_title: 'Dịch vụ cũ' } },
    seo: { home: { title: 'Tiêu đề cũ' } },
  };
}

async function renderPageContent(routes) {
  const calls = mockFetch(routes);
  const PageContentPage = component('admin/src/pages/PageContentPage.jsx');
  const view = await render(react().createElement(PageContentPage));
  await view.act(async () => {});
  return { view, calls };
}

test('nội dung trang: hiện đủ 7 tab và nạp sẵn chữ đang có', options, async () => {
  const { view } = await renderPageContent({
    'GET /resources/page-content': () => ({ body: { data: pageContentRecord() } }),
  });
  assert.equal(view.all('.page-tab').length, 7, 'đủ 7 tab');
  const input = view.one('[data-field="services_title"] input, [data-field="services_title"] textarea');
  assert.equal(input.value, 'Dịch vụ cũ');
  view.unmount();
});

test('nội dung trang: sửa rồi lưu gửi lên đúng chỗ trong texts và seo', options, async () => {
  let sent = null;
  const { view } = await renderPageContent({
    'GET /resources/page-content': () => ({ body: { data: pageContentRecord() } }),
    'PUT /resources/page-content/pc-1': ({ body }) => {
      sent = body;
      return { body: { data: pageContentRecord() } };
    },
  });

  const input = view.one('[data-field="services_title"] input, [data-field="services_title"] textarea');
  await view.type(input, 'Dịch vụ mới');
  await view.click(view.byText('button', 'Lưu'));

  assert.equal(sent.data.texts.home.services_title, 'Dịch vụ mới');
  assert.equal(sent.data.seo.home.title, 'Tiêu đề cũ', 'không làm mất dữ liệu của phần khác');
  view.unmount();
});

test('nội dung trang: đổi tab thì hiện ô của trang đó', options, async () => {
  const { view } = await renderPageContent({
    'GET /resources/page-content': () => ({ body: { data: pageContentRecord() } }),
  });
  await view.click(view.byText('.page-tab', 'Liên hệ'));
  assert.ok(view.one('[data-field="commitments"]'), 'tab Liên hệ có ô danh sách cam kết');
  assert.equal(view.one('[data-field="services_title"]'), null, 'ô của trang chủ không còn hiện');
  view.unmount();
});

test('nội dung trang: không tải được thì báo lỗi chứ không để màn hình trắng', options, async () => {
  const { view } = await renderPageContent({
    'GET /resources/page-content': () => ({ status: 500, body: { error: { message: 'Máy chủ đang bận.' } } }),
  });
  assert.match(view.text(), /Máy chủ đang bận|không tải được/i);
  view.unmount();
});
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Nếu test UI bị bỏ qua, chạy `npm run admin:install` một lần trước.

Run: `node --test tests/page-content.test.js tests/admin-pages-ui.test.js`
Expected: FAIL — thiếu `admin/src/config/page-content-fields.js` và `admin/src/pages/PageContentPage.jsx`.

- [ ] **Step 3: Khai báo ô cho admin**

Tạo `admin/src/config/page-content-fields.js` — mỗi tab là một trang, mỗi ô có nhãn tiếng Việt và chữ mặc định làm placeholder. Khoá phải trùng `dha-cms/src/api/page-content/fields.js` (có test giữ khớp):

```js
// Các ô của mục "Nội dung trang". Khoá phải trùng khai báo phía CMS
// (dha-cms/src/api/page-content/fields.js) — test tests/page-content.test.js giữ
// hai bên khớp nhau. Placeholder là chữ đang nằm sẵn trong HTML: bỏ trống ô thì
// website dùng lại đúng chữ đó.
export const PAGE_TABS = [
  {
    code: 'home',
    label: 'Trang chủ',
    fields: [
      { key: 'hero_primary_label', label: 'Nút chính ở đầu trang — chữ', type: 'text', placeholder: 'Xem Danh Mục Quặng' },
      { key: 'hero_primary_url', label: 'Nút chính ở đầu trang — link', type: 'url', placeholder: '/products' },
      { key: 'hero_secondary_label', label: 'Nút phụ ở đầu trang — chữ', type: 'text', placeholder: 'Tính Giá Nhanh' },
      { key: 'hero_secondary_url', label: 'Nút phụ ở đầu trang — link', type: 'url', placeholder: '/estimator' },
      { key: 'prices_title', label: 'Tiêu đề khu Giá thị trường', type: 'text', placeholder: 'Giá Kim Loại Thị Trường' },
      { key: 'prices_cta_label', label: 'Chữ nút gọi ở khu Giá thị trường', type: 'text', placeholder: 'Gọi Nhận Báo Giá' },
      { key: 'news_title', label: 'Tiêu đề khu Tin tức', type: 'text', placeholder: 'Tin Tức Thị Trường' },
      { key: 'news_link_label', label: 'Chữ link xem tất cả tin tức', type: 'text', placeholder: 'Xem tất cả tin tức →' },
      { key: 'sidebar_categories_title', label: 'Tiêu đề khối danh mục bên hông', type: 'text', placeholder: 'DANH MỤC SẢN PHẨM' },
      { key: 'products_tag', label: 'Nhãn nhỏ khu Sản phẩm', type: 'text', placeholder: 'DANH MỤC SẢN PHẨM' },
      { key: 'products_title', label: 'Tiêu đề khu Sản phẩm (xuống dòng được)', type: 'textarea', placeholder: 'QUẶNG MẪU\nTIÊU CHUẨN' },
      { key: 'products_link_label', label: 'Chữ link xem toàn bộ danh mục', type: 'text', placeholder: 'Xem toàn bộ danh mục' },
      { key: 'services_tag', label: 'Nhãn nhỏ khu Dịch vụ', type: 'text', placeholder: 'HẠNG MỤC CUNG CẤP & KHẢO SÁT' },
      { key: 'services_title', label: 'Tiêu đề khu Dịch vụ', type: 'text', placeholder: 'KHOÁNG SẢN & DỊCH VỤ ĐỊA CHẤT' },
      { key: 'services_description', label: 'Mô tả khu Dịch vụ', type: 'textarea', placeholder: 'Cung cấp mẫu quặng, phân tích hàm lượng hóa học…' },
      { key: 'workflow_tag', label: 'Nhãn nhỏ khu Quy trình', type: 'text', placeholder: 'QUY TRÌNH THỰC HIỆN' },
      { key: 'workflow_title', label: 'Tiêu đề khu Quy trình', type: 'text', placeholder: 'QUY TRÌNH THU THẬP & KIỂM ĐỊNH MẪU' },
      { key: 'workflow_description', label: 'Mô tả khu Quy trình', type: 'textarea', placeholder: 'Quy trình xử lý và đóng gói chuẩn hóa…' },
    ],
  },
  {
    code: 'products',
    label: 'Sản phẩm',
    fields: [
      { key: 'title', label: 'Tiêu đề trang', type: 'text', placeholder: 'Sản Phẩm Kim Loại Màu & Quặng' },
      { key: 'intro', label: 'Đoạn giới thiệu', type: 'textarea', placeholder: 'Cung cấp đa dạng các loại kim loại màu và quặng khoáng sản…' },
      { key: 'cta_title', label: 'Tiêu đề khung báo giá cuối trang', type: 'text', placeholder: 'CẦN BÁO GIÁ CHI TIẾT?' },
      { key: 'cta_call_label', label: 'Chữ nút gọi hotline', type: 'text', placeholder: 'Gọi Hotline Ngay' },
      { key: 'cta_contact_label', label: 'Chữ nút gửi yêu cầu', type: 'text', placeholder: 'Gửi Yêu Cầu Báo Giá' },
    ],
  },
  {
    code: 'projects',
    label: 'Dự án',
    fields: [
      { key: 'tag', label: 'Nhãn nhỏ', type: 'text', placeholder: 'DỰ ÁN TIÊU BIỂU' },
      { key: 'title', label: 'Tiêu đề trang', type: 'text', placeholder: 'CÁC DỰ ÁN KIỂM ĐỊNH VÀ KHẢO SÁT' },
      { key: 'description', label: 'Đoạn giới thiệu', type: 'textarea', placeholder: 'Thông số kỹ thuật các dự án phân tích mẫu quặng…' },
    ],
  },
  {
    code: 'news',
    label: 'Tin tức',
    fields: [
      { key: 'title', label: 'Tiêu đề trang', type: 'text', placeholder: 'Tin Tức Thị Trường' },
      { key: 'intro', label: 'Đoạn giới thiệu', type: 'textarea', placeholder: 'Cập nhật tin tức giá cả kim loại…' },
    ],
  },
  {
    code: 'pricing',
    label: 'Bảng giá',
    fields: [
      { key: 'title', label: 'Tiêu đề trang', type: 'text', placeholder: 'Bảng Giá Kim Loại' },
      { key: 'intro', label: 'Đoạn giới thiệu', type: 'textarea', placeholder: 'Giá tham khảo cập nhật theo sàn London Metal Exchange…' },
      { key: 'cta_label', label: 'Chữ nút gọi báo giá', type: 'text', placeholder: 'Gọi Nhận Báo Giá Chính Xác' },
      { key: 'survey_title', label: 'Tiêu đề khu Biểu phí khảo sát', type: 'text', placeholder: 'Biểu Phí Khảo Sát Địa Chất' },
      { key: 'survey_description', label: 'Mô tả khu Biểu phí khảo sát', type: 'textarea', placeholder: 'Đơn giá dịch vụ khảo sát thực địa và đo đạc mỏ quặng.' },
    ],
  },
  {
    code: 'estimator',
    label: 'Dự toán',
    fields: [
      { key: 'tag', label: 'Nhãn nhỏ', type: 'text', placeholder: 'HỆ THỐNG ĐỊNH GIÁ' },
      { key: 'title', label: 'Tiêu đề trang', type: 'text', placeholder: 'DỰ TÍNH CHI PHÍ MẪU' },
      { key: 'intro', label: 'Đoạn giới thiệu', type: 'textarea', placeholder: 'Nhập các thông số bên dưới để ước lượng tổng chi phí…' },
      { key: 'note', label: 'Đoạn "Lưu ý" dưới kết quả', type: 'textarea', placeholder: 'Báo giá dựa trên biểu phí cơ sở tại phòng phân tích của DHA…' },
      { key: 'cta_label', label: 'Chữ nút cuối trang', type: 'text', placeholder: 'Yêu Cầu Lấy Mẫu Thử Nghiệm' },
    ],
  },
  {
    code: 'contact',
    label: 'Liên hệ',
    fields: [
      { key: 'title', label: 'Tiêu đề trang', type: 'text', placeholder: 'Liên Hệ Báo Giá' },
      { key: 'intro', label: 'Đoạn giới thiệu', type: 'textarea', placeholder: 'Gọi hotline để nhận báo giá nhanh nhất…' },
      { key: 'call_title', label: 'Tiêu đề khối gọi ngay', type: 'text', placeholder: 'GỌI NGAY ĐỂ NHẬN BÁO GIÁ' },
      { key: 'commitments_title', label: 'Tiêu đề khối cam kết', type: 'text', placeholder: 'CAM KẾT:' },
      { key: 'commitments', label: 'Các dòng cam kết', type: 'text-list' },
      { key: 'success_title', label: 'Tiêu đề thông báo gửi thành công', type: 'text', placeholder: 'ĐÃ GỬI THÀNH CÔNG!' },
      { key: 'success_message', label: 'Nội dung thông báo gửi thành công', type: 'textarea', placeholder: 'Chúng tôi sẽ liên hệ lại qua số điện thoại bạn cung cấp trong vòng 30 phút.' },
    ],
  },
];

export const SEO_TAB_FIELDS = [
  { key: 'title', label: 'Tiêu đề trên Google', type: 'text', placeholder: 'Tối đa 70 ký tự' },
  { key: 'description', label: 'Mô tả trên Google', type: 'textarea', placeholder: 'Tối đa 200 ký tự' },
  { key: 'image', label: 'Ảnh khi chia sẻ', type: 'cloudinary-image', folder: 'dha/seo' },
  { key: 'image_alt', label: 'Mô tả ảnh chia sẻ', type: 'text', placeholder: 'Mô tả ngắn nội dung ảnh' },
];
```

- [ ] **Step 4: Trang "Nội dung trang"**

Tạo `admin/src/pages/PageContentPage.jsx` theo mẫu `SettingsPage.jsx` (tải bằng `getSingletonResource`, lưu bằng `saveSingletonResource`, dùng `SaveBar`), thêm phần tab:

- State: `values = { texts, seo }`, `activeTab` (mặc định `home`).
- Mỗi tab dựng từ `PAGE_TABS`: nút `<button className="page-tab">` mang nhãn trang; phần *Nội dung* lặp `fields`, phần *SEO* lặp `SEO_TAB_FIELDS`.
- Mỗi ô bọc trong `<div className="field-wrap" data-field="<key>">` rồi tới `FieldRenderer` với `field={{ label, type, placeholder, folder }}`, `value={values.texts[code]?.[key]}` (hoặc `values.seo[code]?.[key]`), `onChange` ghi vào đúng `texts[code][key]` / `seo[code][key]` mà **không đụng tới các trang khác**.
- Trên cùng có câu hướng dẫn: "Bỏ trống ô nào thì website dùng lại chữ mặc định của ô đó."
- Lưu: gửi cả `{ texts, seo }`; nút mang chữ `Lưu`.
- Lỗi tải: hiện thông báo lỗi từ máy chủ (như `SettingsPage`).

Trong `admin/src/App.jsx`, thêm route `<Route path="/page-content" element={<PageContentPage />} />` (kèm import). Trong `admin/src/layout/AdminShell.jsx`, thêm `['/page-content', 'Nội dung trang', '<icon>']` vào nhóm `pages` ngay trước `['/pricing', ...]`; chọn `<icon>` là một tên có thật trong `admin/src/components/Icon.jsx` (kiểm bằng `grep "case '" admin/src/components/Icon.jsx`) và ghi lựa chọn vào báo cáo.

Trong `admin/src/styles.css`, thêm kiểu cho thanh tab (đặt cạnh các khối trang khác):

```css
.page-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.page-tab {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}

.page-tab.is-active {
  border-color: var(--accent, #C5A059);
  font-weight: 600;
}
```

- [ ] **Step 5: Chạy test, xác nhận qua**

Run: `node --test tests/page-content.test.js tests/admin-pages-ui.test.js tests/admin-app.test.js`
Expected: PASS, không test nào bị bỏ qua.

- [ ] **Step 6: Commit**

```bash
git add admin/src/config/page-content-fields.js admin/src/pages/PageContentPage.jsx admin/src/App.jsx admin/src/layout/AdminShell.jsx admin/src/styles.css tests/page-content.test.js tests/admin-pages-ui.test.js
git commit -m "feat: admin có mục Nội dung trang với 7 tab và phần SEO"
```

---

### Task 4: Đánh dấu nội dung và SEO trong HTML

**Files:**
- Modify: `index.html`, `products.html`, `projects.html`, `news.html`, `pricing.html`, `estimator.html`, `contact.html` (nội dung + SEO + `data-page`), `product-detail.html`, `news-detail.html` (chỉ `data-page`)
- Test: `tests/hardcoded-content.test.js`

**Interfaces:**
- Produces: `<body data-page="...">` trên 9 trang; các dấu `data-page-text`, `data-page-href`, `data-page-list`, `data-page-seo` mà Task 5 và Task 6 dựa vào.

- [ ] **Step 1: Viết test hỏng**

Thêm vào cuối `tests/hardcoded-content.test.js`:

```js
const { PAGE_FIELDS, SEO_FIELDS } = require('../dha-cms/src/api/page-content/fields');

const PAGE_FILES = {
  'index.html': 'home',
  'products.html': 'products',
  'projects.html': 'projects',
  'news.html': 'news',
  'pricing.html': 'pricing',
  'estimator.html': 'estimator',
  'contact.html': 'contact',
};

test('mỗi trang khai báo mã trang trên thẻ body', () => {
  for (const [file, code] of Object.entries(PAGE_FILES)) {
    assert.equal(load(file).body.dataset.page, code, `${file} thiếu hoặc sai data-page`);
  }
  for (const file of ['product-detail.html', 'news-detail.html']) {
    assert.ok(load(file).body.dataset.page, `${file} thiếu data-page`);
  }
});

test('mọi ô khai báo trong CMS đều có chỗ tương ứng trong HTML', () => {
  for (const [file, code] of Object.entries(PAGE_FILES)) {
    const doc = load(file);
    const marked = new Set(
      [...doc.querySelectorAll('[data-page-text], [data-page-href], [data-page-list]')].map(
        (el) => el.dataset.pageText || el.dataset.pageHref || el.dataset.pageList,
      ),
    );
    for (const key of Object.keys(PAGE_FIELDS[code])) {
      assert.ok(marked.has(key), `${file} thiếu dấu cho ô "${key}"`);
    }
  }
});

test('7 trang tĩnh có đủ dấu SEO cho cả thẻ Google, Facebook và Twitter', () => {
  for (const file of Object.keys(PAGE_FILES)) {
    const doc = load(file);
    for (const key of Object.keys(SEO_FIELDS)) {
      const marked = [...doc.querySelectorAll(`[data-page-seo="${key}"]`)];
      assert.ok(marked.length >= 1, `${file} thiếu dấu SEO "${key}"`);
    }
    assert.equal(doc.querySelector('title').dataset.pageSeo, 'title', `${file}: thẻ title chưa đánh dấu`);
    assert.equal(doc.querySelectorAll('[data-page-seo="title"]').length, 3, `${file}: title phải điền cho 3 thẻ`);
    assert.equal(doc.querySelectorAll('[data-page-seo="description"]').length, 3, `${file}: description phải điền cho 3 thẻ`);
    assert.equal(doc.querySelectorAll('[data-page-seo="image"]').length, 2, `${file}: ảnh phải điền cho 2 thẻ`);
  }
});
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test tests/hardcoded-content.test.js`
Expected: FAIL — `index.html thiếu hoặc sai data-page`.

- [ ] **Step 3: Đánh dấu phần nội dung**

Thêm `data-page="<mã>"` vào thẻ `<body>` của 9 trang (`index.html` → `home`, `products.html` → `products`, …, `product-detail.html` → `product-detail`, `news-detail.html` → `news-detail`).

Rồi đánh dấu từng chỗ theo bảng dưới. Quy tắc: nếu thẻ chứa thẻ con khác (ví dụ `<svg>`), **bọc riêng phần chữ** trong `<span data-page-text="...">…</span>` thay vì đánh dấu cả thẻ.

| File:dòng (hiện tại) | Chữ hiện có | Dấu cần thêm |
|---|---|---|
| index:118 | `Xem Danh Mục Quặng` | `data-page-text="hero_primary_label" data-page-href="hero_primary_url"` |
| index:119 | `Tính Giá Nhanh` | `data-page-text="hero_secondary_label" data-page-href="hero_secondary_url"` |
| index:166 | `Giá Kim Loại Thị Trường` | `data-page-text="prices_title"` |
| index:187 | `Gọi Nhận Báo Giá` | `data-page-text="prices_cta_label"` |
| index:193 | `Tin Tức Thị Trường` | `data-page-text="news_title"` |
| index:200 | `Xem tất cả tin tức →` | `data-page-text="news_link_label"` |
| index:207 | `DANH MỤC SẢN PHẨM` (khối bên hông) | `data-page-text="sidebar_categories_title"` |
| index:230 | `DANH MỤC SẢN PHẨM` (nhãn nhỏ) | `data-page-text="products_tag"` |
| index:231 | `QUẶNG MẪU<br>TIÊU CHUẨN` | `data-page-text="products_title"` |
| index:267-268 | `Xem toàn bộ danh mục` (thẻ `a` có `svg`) | bọc `<span data-page-text="products_link_label">` |
| index:281 / 282 / 283 | nhãn nhỏ / tiêu đề / mô tả khu Dịch vụ | `services_tag` / `services_title` / `services_description` |
| index:299 / 300 / 301 | nhãn nhỏ / tiêu đề / mô tả khu Quy trình | `workflow_tag` / `workflow_title` / `workflow_description` |
| products:101 / 102 | `Sản Phẩm Kim Loại Màu & Quặng` / đoạn giới thiệu | `title` / `intro` |
| products:127 / 132 / 133 | `CẦN BÁO GIÁ CHI TIẾT?` / `Gọi Hotline Ngay` / `Gửi Yêu Cầu Báo Giá` | `cta_title` / `cta_call_label` / `cta_contact_label` |
| projects:103 / 104 / 105 | nhãn nhỏ / tiêu đề / mô tả | `tag` / `title` / `description` |
| news:100 / 101 | tiêu đề / đoạn giới thiệu | `title` / `intro` |
| pricing:101 / 102 | tiêu đề / đoạn giới thiệu | `title` / `intro` |
| pricing:127 | `Gọi Nhận Báo Giá Chính Xác` (thẻ `a` nhiều dòng) | bọc `<span data-page-text="cta_label">` nếu thẻ có `svg`, không thì đánh dấu thẳng |
| pricing:135 / 136 | `Biểu Phí Khảo Sát Địa Chất` / mô tả | `survey_title` / `survey_description` |
| estimator:103 / 104 / 105 | nhãn nhỏ / tiêu đề / đoạn giới thiệu | `tag` / `title` / `intro` |
| estimator:216 | `<strong>Lưu ý:</strong> Báo giá dựa trên…` | bọc phần chữ sau `</strong>` trong `<span data-page-text="note">` (giữ nguyên chữ "Lưu ý:") |
| estimator:219 | `Yêu Cầu Lấy Mẫu Thử Nghiệm` | `data-page-text="cta_label"` |
| contact:101 / 102 | tiêu đề / đoạn giới thiệu | `title` / `intro` |
| contact:107 | `GỌI NGAY ĐỂ NHẬN BÁO GIÁ` | `call_title` |
| contact:140 | `CAM KẾT:` | `commitments_title` |
| contact:141-146 | `<ul>` chứa 4 dòng cam kết | thêm `data-page-list="commitments"` vào thẻ `<ul>` |
| contact:267 / 268 | `ĐÃ GỬI THÀNH CÔNG!` / nội dung thông báo | `success_title` / `success_message` |

- [ ] **Step 4: Đánh dấu phần SEO**

Trên 7 trang tĩnh, thêm dấu vào các thẻ trong `<head>`:

- `<title …>` và `og:title` và `twitter:title` → `data-page-seo="title"`
- `meta name="description"`, `og:description`, `twitter:description` → `data-page-seo="description"`
- `og:image`, `twitter:image` → `data-page-seo="image"`
- `og:image:alt` → `data-page-seo="image_alt"`

`news.html` hiện **thiếu** `og:image:alt`: thêm thẻ đó ngay sau `og:image`, nội dung mặc định `Phòng thí nghiệm phân tích mẫu quặng của Kim Loại Màu DHA`.

Hai trang `product-detail.html` và `news-detail.html` **không** đánh dấu SEO (JS tự đặt theo từng sản phẩm/bài viết).

- [ ] **Step 5: Chạy test, xác nhận qua**

Run: `node --test tests/hardcoded-content.test.js tests/prerender-site-settings.test.js tests/site-settings-dom.test.js`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add index.html products.html projects.html news.html pricing.html estimator.html contact.html product-detail.html news-detail.html tests/hardcoded-content.test.js
git commit -m "feat: đánh dấu chữ nội dung và thẻ SEO của 7 trang trong HTML"
```

---

### Task 5: Prerender ghi nội dung trang và SEO

**Files:**
- Modify: `scripts/prerender-site-settings.js`
- Test: `tests/prerender-site-settings.test.js`

**Interfaces:**
- Produces: `applyPageContentToHtml(html, content, file)`, `pageCodeFromHtml(html, file)`, `renderPageList(items)`; `prerenderDirectory` nhận thêm `loadPageContent` và trả thêm `pageContent: boolean`.
- Consumes: `transformHtml`, `escapeText`, `escapeAttr`, `setAttr`, `safeUrl` sẵn có.

- [ ] **Step 1: Viết test hỏng**

Trong `tests/prerender-site-settings.test.js`, thêm `applyPageContentToHtml`, `pageCodeFromHtml` vào khối `require`, và thêm vào cuối file:

```js
const PAGE_CONTENT = {
  texts: {
    home: {
      services_title: 'Dịch vụ <mới>',
      products_title: 'QUẶNG\nCHUẨN',
      hero_primary_label: 'Xem ngay',
      hero_primary_url: '/products?filter=color-metal',
    },
    contact: { commitments: ['Nhanh & gọn', '  ', 'Đúng hẹn'] },
  },
  seo: {
    home: { title: 'Tiêu đề Google', description: 'Mô tả Google', image: 'https://dha.vn/a.png', image_alt: 'Ảnh mẫu' },
    contact: { image: 'javascript:alert(1)' },
  },
};

const PAGE_HTML = '<html><head><title data-page-seo="title">Cũ</title>'
  + '<meta name="description" data-page-seo="description" content="Cũ">'
  + '<meta property="og:title" data-page-seo="title" content="Cũ">'
  + '<meta property="og:image" data-page-seo="image" content="/cu.png">'
  + '<meta property="og:image:alt" data-page-seo="image_alt" content="Cũ"></head>'
  + '<body data-page="home"><a href="/cu" data-page-text="hero_primary_label" data-page-href="hero_primary_url">Cũ</a>'
  + '<h2 data-page-text="products_title">CŨ</h2><p data-page-text="services_title">Cũ</p>'
  + '<p data-page-text="khong_co">Giữ nguyên</p></body></html>';

test('nội dung trang và SEO được ghi theo đúng mã trang', () => {
  const doc = new JSDOM(applyPageContentToHtml(PAGE_HTML, PAGE_CONTENT, 'index.html')).window.document;

  assert.equal(doc.querySelector('[data-page-text="services_title"]').textContent, 'Dịch vụ <mới>');
  assert.equal(doc.querySelector('[data-page-text="products_title"]').innerHTML, 'QUẶNG<br>CHUẨN');
  const link = doc.querySelector('[data-page-href="hero_primary_url"]');
  assert.equal(link.textContent, 'Xem ngay');
  assert.equal(link.getAttribute('href'), '/products?filter=color-metal');
  assert.equal(doc.querySelector('[data-page-text="khong_co"]').textContent, 'Giữ nguyên', 'khoá không có dữ liệu thì giữ HTML');

  assert.equal(doc.querySelector('title').textContent, 'Tiêu đề Google');
  assert.equal(doc.querySelector('meta[name="description"]').getAttribute('content'), 'Mô tả Google');
  assert.equal(doc.querySelector('meta[property="og:title"]').getAttribute('content'), 'Tiêu đề Google');
  assert.equal(doc.querySelector('meta[property="og:image"]').getAttribute('content'), 'https://dha.vn/a.png');
  assert.equal(doc.querySelector('meta[property="og:image:alt"]').getAttribute('content'), 'Ảnh mẫu');
});

test('danh sách trong trang: bỏ dòng trống, escape, hết dòng thì giữ HTML', () => {
  const html = '<body data-page="contact"><ul data-page-list="commitments"><li>Cũ</li></ul></body>';
  const doc = new JSDOM(applyPageContentToHtml(html, PAGE_CONTENT, 'contact.html')).window.document;
  assert.deepEqual([...doc.querySelectorAll('[data-page-list] li')].map((li) => li.textContent), ['Nhanh & gọn', 'Đúng hẹn']);

  const empty = applyPageContentToHtml(html, { texts: { contact: { commitments: ['  ', 42] } } }, 'contact.html');
  assert.equal(empty, html, 'không còn dòng dùng được thì giữ nguyên');
});

test('ảnh SEO sai quy tắc URL bị bỏ, trang không có dữ liệu thì giữ HTML', () => {
  const html = '<head><meta property="og:image" data-page-seo="image" content="/cu.png"></head><body data-page="contact"></body>';
  assert.equal(applyPageContentToHtml(html, PAGE_CONTENT, 'contact.html'), html);
  assert.equal(applyPageContentToHtml(PAGE_HTML, {}, 'index.html'), PAGE_HTML);
  assert.equal(applyPageContentToHtml(PAGE_HTML, null, 'index.html'), PAGE_HTML);
});

test('mã trang đọc từ thẻ body, thiếu thì suy từ tên file', () => {
  assert.equal(pageCodeFromHtml('<body data-page="pricing">', 'bat-ky.html'), 'pricing');
  assert.equal(pageCodeFromHtml('<body>', 'index.html'), 'home');
  assert.equal(pageCodeFromHtml('<body>', 'contact.html'), 'contact');
  assert.equal(pageCodeFromHtml('<body>', 'preview.html'), null);
});

test('nội dung trang là nguồn thứ tư, lỗi riêng nó không chặn ba nguồn kia', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prerender-page-'));
  const quiet = { warn() {} };
  try {
    fs.writeFileSync(path.join(dir, 'index.html'), PAGE_HTML);
    const result = await prerenderDirectory(dir, {
      sourceDir: dir,
      loadSettings: async () => ({ hotline: '0912345678' }),
      loadCategories: async () => [],
      loadNavigation: async () => [],
      loadPageContent: async () => {
        throw new Error('CMS 500');
      },
      log: quiet,
    });
    assert.equal(result.pageContent, false);
    assert.match(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), /Cũ<\/title>/);

    await prerenderDirectory(dir, {
      sourceDir: dir,
      loadSettings: async () => ({ hotline: '0912345678' }),
      loadCategories: async () => [],
      loadNavigation: async () => [],
      loadPageContent: async () => PAGE_CONTENT,
      log: quiet,
    });
    assert.match(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), /Tiêu đề Google<\/title>/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
```

Sửa test `cả ba nguồn cùng lỗi thì báo đủ ba lý do`: thêm `loadPageContent` cũng lỗi, đổi tên test thành "cả bốn nguồn…" và khẳng định thông báo có thêm `nội dung trang:`.

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test tests/prerender-site-settings.test.js`
Expected: FAIL — `applyPageContentToHtml is not a function`.

- [ ] **Step 3: Viết phần nội dung trang trong script**

Chèn ngay sau `applyNavigationToHtml` trong `scripts/prerender-site-settings.js`:

```js
const PAGE_CODE_BY_FILE = {
  'index.html': 'home',
  'products.html': 'products',
  'projects.html': 'projects',
  'news.html': 'news',
  'pricing.html': 'pricing',
  'estimator.html': 'estimator',
  'contact.html': 'contact',
};

// Mã trang nằm trên thẻ body (`<body data-page="home">`); tên file chỉ là phương
// án dự phòng cho HTML chưa kịp đánh dấu.
function pageCodeFromHtml(html, file) {
  const match = String(html).match(/<body[^>]*\sdata-page="([^"]+)"/i);
  if (match) return match[1];
  return PAGE_CODE_BY_FILE[path.basename(file || '')] || null;
}

// Phải cho ra cùng một DOM với renderPageList() trong app.js.
function renderPageList(items) {
  if (!Array.isArray(items)) return '';
  return items
    .map((line) => (typeof line === 'string' ? line.trim() : ''))
    .filter(Boolean)
    .map((line) => `<li>${escapeText(line)}</li>`)
    .join('');
}

// Một ô SEO điền cho nhiều thẻ: title → <title> + og:title + twitter:title...
function applyPageContentToHtml(html, content, file) {
  const page = pageCodeFromHtml(html, file);
  if (!page) return html;
  const texts = content?.texts?.[page];
  const seo = content?.seo?.[page];
  const pageText = (key) => {
    const value = texts && typeof texts[key] === 'string' ? texts[key].trim() : '';
    return value || null;
  };

  return transformHtml(html, [
    {
      match: (tagName, attrs) => 'data-page-text' in attrs || 'data-page-href' in attrs,
      apply: ({ attrs, rawAttrs }) => {
        const label = 'data-page-text' in attrs ? pageText(attrs['data-page-text']) : null;
        const url = 'data-page-href' in attrs ? safeUrl(pageText(attrs['data-page-href'])) : '';
        if (!label && !url) return null;
        return {
          ...(label ? { inner: escapeText(label).replace(/\n/g, '<br>') } : {}),
          ...(url ? { rawAttrs: setAttr(rawAttrs, 'href', url) } : {}),
        };
      },
    },
    {
      match: (tagName, attrs) => 'data-page-list' in attrs,
      apply: ({ attrs }) => {
        const list = renderPageList(texts?.[attrs['data-page-list']]);
        return list ? { inner: list } : null;
      },
    },
    {
      match: (tagName, attrs) => 'data-page-seo' in attrs,
      apply: ({ tagName, attrs, rawAttrs }) => {
        const key = attrs['data-page-seo'];
        const raw = seo && typeof seo[key] === 'string' ? seo[key].trim() : '';
        const value = key === 'image' ? safeUrl(raw) : raw;
        if (!value) return null;
        if (tagName === 'title') return { inner: escapeText(value) };
        return { rawAttrs: setAttr(rawAttrs, 'content', value) };
      },
    },
  ]);
}

async function fetchPageContent() {
  const res = await fetch(`${CMS}/api/page-content`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`CMS trả về ${res.status} khi đọc nội dung trang`);
  const json = await res.json();
  const data = json.data;
  return data?.attributes || data || {};
}
```

- [ ] **Step 4: Thêm nguồn thứ tư**

Trong `prerenderDirectory`: thêm `loadPageContent = fetchPageContent` vào tham số, `loadPageContent()` vào `Promise.allSettled`, `pageContent` vào mảng kết quả, `'nội dung trang'` vào `SOURCE_LABELS`, dòng `if (pageContent) out = applyPageContentToHtml(out, pageContent, file);` sau dòng navigation, và `pageContent: Boolean(pageContent)` vào giá trị trả về. Trong `main()`, thêm `result.pageContent && 'nội dung trang'` vào `parts`.

Bổ sung export: `applyPageContentToHtml`, `pageCodeFromHtml`, `renderPageList`.

- [ ] **Step 5: Chạy test, xác nhận qua**

Run: `node --test tests/prerender-site-settings.test.js tests/deploy.test.js`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add scripts/prerender-site-settings.js tests/prerender-site-settings.test.js
git commit -m "feat: prerender ghi chữ nội dung và thẻ SEO của từng trang"
```

---

### Task 6: `app.js` áp nội dung trang và SEO

**Files:**
- Modify: `app.js` (hàm mới + `DOMContentLoaded`), 10 file HTML (`?v=` của `app.js`)
- Test: `tests/prerender-site-settings.test.js`

**Interfaces:**
- Produces (hàm toàn cục): `renderPageList(items): string`, `applyPageContent(content): void`, `initPageContent(): Promise<void>`.
- Consumes: `safeNavUrl`, `escapeHtml`, `fetchSingleFromCMS` sẵn có; `applyPageContentToHtml`, `PAGE_CONTENT` (Task 5) trong test.

- [ ] **Step 1: Viết test hỏng**

Trong `tests/prerender-site-settings.test.js`:

1. Thêm `'[data-page-text]', '[data-page-list]', '[data-page-seo]', '[data-page-href]',` vào cuối `DYNAMIC_SELECTORS`.
2. Trong `runAppJs`, thêm tuỳ chọn `pageContent = null` và trả lời `/api/page-content` khi có:

```js
    if (pageContent && target.includes('/api/page-content')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: pageContent }) });
    }
```

3. Trong vòng `for (const file of PAGES)`, bọc thêm `applyPageContentToHtml(..., PAGE_CONTENT, file)` vào chuỗi prerender, truyền `pageContent: PAGE_CONTENT` cho `runAppJs`, và gọi thêm `await window.initPageContent();` trước khi chụp `after`.
4. Thêm vào cuối file:

```js
test('app.js áp nội dung trang và SEO từ CMS', async () => {
  const window = runAppJs(readPage('index.html'), SETTINGS, null, {
    url: 'https://dhakimloaimau.vn/',
    pageContent: PAGE_CONTENT,
  });
  await window.initPageContent();
  const doc = window.document;

  assert.equal(doc.querySelector('[data-page-text="services_title"]').textContent, 'Dịch vụ <mới>');
  assert.equal(doc.querySelector('[data-page-text="products_title"]').innerHTML, 'QUẶNG<br>CHUẨN');
  assert.equal(doc.querySelector('[data-page-href="hero_primary_url"]').getAttribute('href'), '/products?filter=color-metal');
  assert.equal(doc.querySelector('title').textContent, 'Tiêu đề Google');
  assert.equal(doc.querySelector('meta[property="og:title"]').getAttribute('content'), 'Tiêu đề Google');
});

test('CMS lỗi hoặc ô trống thì app.js giữ nguyên nội dung trang đã có', async () => {
  const window = runAppJs(readPage('contact.html'), SETTINGS, null, { url: 'https://dhakimloaimau.vn/contact' });
  const pick = () => [...window.document.querySelectorAll('[data-page-text], [data-page-list], title')].map((el) => el.outerHTML);

  const before = pick();
  await window.initPageContent();
  assert.deepEqual(pick(), before);
});

test('app.js và prerender dựng danh sách trong trang ra cùng một DOM', () => {
  const window = runAppJs(readPage('contact.html'), SETTINGS);
  const items = ['A & "B"', '   ', '<script>'];
  const fromJs = window.document.createElement('ul');
  fromJs.innerHTML = window.renderPageList(items);
  const fromPrerender = window.document.createElement('ul');
  fromPrerender.innerHTML = renderPageList(items);

  assert.equal(fromJs.innerHTML, fromPrerender.innerHTML);
  assert.equal(fromJs.children.length, 2);
});
```

(thêm `renderPageList` vào khối `require` ở đầu file test).

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test tests/prerender-site-settings.test.js`
Expected: FAIL — `window.initPageContent is not a function`.

- [ ] **Step 3: Viết phần áp nội dung trang trong `app.js`**

Chèn ngay sau `applySiteChrome` trong `app.js`:

```js
// ======================================================
// NỘI DUNG TỪNG TRANG
// ======================================================
// Chữ và thẻ SEO của mỗi trang do quản trị đặt (mục "Nội dung trang" trong
// admin). Prerender đã ghi sẵn vào HTML; đoạn này áp lại khi CMS trả lời, ra
// đúng cùng một DOM (xem scripts/prerender-site-settings.js).
function renderPageList(items) {
    if (!Array.isArray(items)) return '';
    return items
        .map(line => (typeof line === 'string' ? line.trim() : ''))
        .filter(Boolean)
        .map(line => `<li>${escapeHtml(line)}</li>`)
        .join('');
}

function applyPageContent(content) {
    const page = document.body?.dataset?.page;
    if (!page) return;
    const texts = content?.texts?.[page];
    const seo = content?.seo?.[page];
    const pageText = key => {
        const value = texts && typeof texts[key] === 'string' ? texts[key].trim() : '';
        return value || '';
    };

    document.querySelectorAll('[data-page-text]').forEach(el => {
        const value = pageText(el.dataset.pageText);
        if (value) el.innerHTML = escapeHtml(value).replace(/\n/g, '<br>');
    });

    document.querySelectorAll('[data-page-href]').forEach(el => {
        const url = safeNavUrl(pageText(el.dataset.pageHref));
        if (url) el.setAttribute('href', url);
    });

    document.querySelectorAll('[data-page-list]').forEach(el => {
        const html = renderPageList(texts?.[el.dataset.pageList]);
        if (html) el.innerHTML = html;
    });

    document.querySelectorAll('[data-page-seo]').forEach(el => {
        const key = el.dataset.pageSeo;
        const raw = seo && typeof seo[key] === 'string' ? seo[key].trim() : '';
        const value = key === 'image' ? safeNavUrl(raw) : raw;
        if (!value) return;
        if (el.tagName === 'TITLE') el.textContent = value;
        else el.setAttribute('content', value);
    });
}

async function initPageContent() {
    if (!document.body?.dataset?.page) return;
    const content = await fetchSingleFromCMS('page-content');
    if (content && Object.keys(content).length) applyPageContent(content);
}
```

Trong khối `DOMContentLoaded`, thêm `initPageContent();` ngay sau `initSiteSettings();`.

- [ ] **Step 4: Tăng phiên bản `app.js`**

```bash
sed -i '' 's/app\.js?v=3\.5/app.js?v=3.6/' *.html
grep -o -h 'app\.js?v=[^"]*' *.html | sort | uniq -c
```

Expected: `10 app.js?v=3.6`.

- [ ] **Step 5: Chạy test, xác nhận qua**

Run: `node --test tests/prerender-site-settings.test.js tests/hardcoded-content.test.js tests/site-settings-dom.test.js tests/navigation.test.js`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add app.js *.html tests/prerender-site-settings.test.js
git commit -m "feat: app.js áp chữ nội dung và thẻ SEO của từng trang"
```

---

### Task 7: Chốt danh sách chữ được phép nằm trong code và kiểm tra tổng

**Files:**
- Modify: `tests/hardcoded-content.test.js`
- Modify (nếu lộ ra chỗ sót): các file HTML

**Interfaces:** không tạo interface mới.

- [ ] **Step 1: Viết test hỏng**

Thêm vào cuối `tests/hardcoded-content.test.js` một test quét toàn trang (ngoài phần đầu/chân trang đã có test riêng). Danh sách cho phép chỉ gồm nhãn giao diện, thông báo hệ thống và các mục để dành cho đợt 4:

```js
// Sau đợt 3, chữ khách nhìn thấy chỉ còn được nằm trong code nếu là nhãn giao
// diện / thông báo hệ thống (nhóm 6 của lộ trình) hoặc thuộc đợt 4 (form Dự
// toán, form Liên hệ). Mọi chữ nội dung khác phải nối CMS.
const PAGE_CMS = [
  '[data-page-text]', '[data-page-list]', '[data-page-href]', '[data-site-text]',
  '[data-category-list]', '[data-footer-links]', '[data-copyright]',
  '.site-hotline', '.site-email', '.site-address', '.site-office-name', '.site-tax-code',
  '.site-brand-bio', '.logo-accent', '.logo-text', '.hero-title', '.hero-tagline',
  '.hero-description', '.spec-badge-label', '.spec-badge-value', '.stat-number', '.stat-label',
  'ul.nav-links', 'a[aria-label]', '.top-header', 'header.site-header', 'nav.main-navigation',
  'footer.footer', '#home-filter-tabs', '#product-filter-tabs', '#products-container',
  '#home-products-grid', '#home-news-grid', '#news-full-grid', '#projects-container',
  '.services-grid', '.workflow-timeline', '#market-price-body', '#pricing-table-body',
  '#survey-pricing-table-body', '#hero-carousel', 'script', 'style', 'noscript', 'svg', 'title',
].join(', ');

test('trong thân trang chỉ còn nhãn giao diện và phần để dành đợt 4 là viết cứng', () => {
  const leftovers = new Map();
  for (const file of Object.keys(PAGE_FILES)) {
    const doc = load(file);
    doc.querySelectorAll(PAGE_CMS).forEach((el) => el.remove());
    const walker = doc.createTreeWalker(doc.body, 4 /* SHOW_TEXT */);
    let node;
    while ((node = walker.nextNode())) {
      const value = node.textContent.replace(/\s+/g, ' ').trim();
      if (!value) continue;
      if (!leftovers.has(value)) leftovers.set(value, file);
    }
  }

  const unexpected = [...leftovers].filter(([value]) => !ALLOWED_UI_TEXT.has(value));
  assert.deepEqual(unexpected, [], `chữ viết cứng chưa nối CMS: ${unexpected.map(([v, f]) => `${f}: "${v}"`).join('; ')}`);
});
```

Khai báo `ALLOWED_UI_TEXT` ngay trên test: dựng từ chính kết quả chạy lần đầu, mỗi dòng ghi rõ vì sao được phép — nhãn ô nhập ("Họ và Tên", "Số Điện Thoại", "Email", "Địa Chỉ", "Nhu Cầu", "Nội Dung Yêu Cầu", "Khối Lượng Mẫu (kg)"…), tiêu đề cột bảng ("Kim Loại", "Giá LME (USD/tấn)", "Giá Nội Địa", "Biến Động", "Cập Nhật", "Tên Dịch Vụ", "Đơn Giá", "Mô Tả"), thông báo hệ thống ("Đang tải...", "0đ", "0 kg", "0 đ/kg", "Không tìm thấy sản phẩm phù hợp.", "Không có sản phẩm nào trong danh mục này."), nhãn cố định ("Hotline:", "Email:", "Văn phòng:", "Lưu ý:", "*", "›", "Tìm", "📞", "Đóng", "Gửi Yêu Cầu Báo Giá", "Tính Toán Báo Giá", "KẾT QUẢ DỰ TOÁN MẪU", các dòng nhãn kết quả dự toán), và **phần để dành đợt 4** (các `option` của form Dự toán và form Liên hệ).

- [ ] **Step 2: Chạy test, xem danh sách còn sót**

Run: `node --test tests/hardcoded-content.test.js`
Expected: FAIL lần đầu, in ra danh sách chữ chưa nối CMS. Đối chiếu từng dòng:
- nếu là nhãn giao diện / thông báo hệ thống / mục đợt 4 → thêm vào `ALLOWED_UI_TEXT` kèm ghi chú;
- nếu là chữ nội dung bị sót → quay lại đánh dấu trong HTML (và thêm ô vào `fields.js` + `page-content-fields.js` nếu thiếu), **không** nhét vào danh sách cho phép.

- [ ] **Step 3: Chạy lại, xác nhận qua**

Run: `npm test`
Expected: PASS, trừ các test cần `dha-cms/node_modules` nếu worktree chưa cài (ghi rõ trong báo cáo).

- [ ] **Step 4: Chạy thử prerender trên bản sao HTML**

```bash
SRC=$(mktemp -d) && DEST=$(mktemp -d) && cp *.html "$SRC" && cp *.html "$DEST" && node -e '
const { prerenderDirectory } = require("./scripts/prerender-site-settings.js");
prerenderDirectory(process.argv[2], {
  sourceDir: process.argv[1],
  loadSettings: async () => ({ hotline: "0912345678" }),
  loadCategories: async () => [{ slug: "quang-dong", name: "Quặng Đồng", visible: true }],
  loadNavigation: async () => [{ label: "Trang Chủ", url: "/" }],
  loadPageContent: async () => ({
    texts: { home: { services_title: "DỊCH VỤ MỚI" }, contact: { commitments: ["Cam kết mới"] } },
    seo: { home: { title: "Tiêu đề thử" } },
  }),
}).then((r) => console.log(r));
' "$SRC" "$DEST" && grep -c 'DỊCH VỤ MỚI' "$DEST"/index.html && grep -o '<title[^>]*>[^<]*' "$DEST"/index.html && grep -o '<li>Cam kết mới</li>' "$DEST"/contact.html && grep -c 'DỊCH VỤ MỚI' "$SRC"/index.html; rm -rf "$SRC" "$DEST"
```

Expected: `pageContent: true`; đích có "DỊCH VỤ MỚI", tiêu đề "Tiêu đề thử", dòng cam kết mới; nguồn vẫn `0` (không bị sửa).

- [ ] **Step 5: Thử trên trình duyệt**

Mở website bằng cấu hình `frontend` (cổng 3000), CMS tắt: 7 trang phải giữ nguyên chữ mặc định, không trống chỗ nào, không lỗi console mới. Nếu có Strapi và admin: sửa vài ô trong mục "Nội dung trang" rồi tải lại trang để kiểm.

- [ ] **Step 6: Commit (nếu có sửa)**

```bash
git add tests/hardcoded-content.test.js
git commit -m "test: chốt danh sách chữ được phép nằm trong code sau đợt 3"
```
