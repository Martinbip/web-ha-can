# Đợt 1 — Đồng bộ danh mục sản phẩm và khung hotline: kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mọi danh sách danh mục trên 9 trang công khai và chữ trong khung hotline đều lấy từ admin, được ghi sẵn vào HTML lúc deploy và ngay sau mỗi lần lưu.

**Architecture:** Nguồn duy nhất là collection `product-category` và single type `site-setting` của Strapi. `scripts/prerender-site-settings.js` ghi dữ liệu vào HTML đang phục vụ (chạy từ `deploy.sh` và từ lifecycle Strapi qua `schedulePrerender()`); `app.js` dựng lại cùng một DOM khi CMS trả lời thật và giữ nguyên HTML khi CMS lỗi. Danh sách được đánh dấu bằng `data-category-list`, chữ khung hotline bằng cơ chế `data-site-text` sẵn có.

**Tech Stack:** HTML tĩnh + `app.js` thuần, Strapi 5 (`dha-cms/`), admin React (`admin/`), test bằng `node --test` + `jsdom`.

**Spec:** `docs/superpowers/specs/2026-09-14-dong-bo-danh-muc-hotline-design.md`

## Global Constraints

- 3 danh mục mặc định, đúng thứ tự: `color-metal` / Kim Loại Màu, `black-metal` / Kim Loại Đen, `rare-earth` / Đất Hiếm — phải trùng ở `data/product_categories.json`, `DEFAULT_PRODUCT_CATEGORIES` trong `app.js` và `DEFAULT_CATEGORIES` trong script prerender.
- Mẫu một mục danh sách: `<li><a href="/products?filter=MÃ">TÊN</a></li>`; mã qua `encodeURIComponent`, tên được escape.
- Quy tắc chọn danh mục: bỏ mục không có `slug` hoặc `visible === false`; không còn mục nào thì dùng 3 danh mục mặc định.
- `app.js` chỉ dựng lại khi dữ liệu đến từ CMS thật, không dùng `data/product_categories.json` để ghi đè HTML.
- Trường mới: `hotline_box_title` (string, tối đa 60, mặc định `HOTLINE TƯ VẤN`), `hotline_box_note` (text, tối đa 300).
- Không đổi tiêu đề các cột ("DANH MỤC SẢN PHẨM", "SẢN PHẨM") — việc của đợt 2.
- Nhãn giao diện và thông báo hệ thống giữ trong code.
- Chữ trong code, comment, thông báo test viết tiếng Việt có dấu, theo giọng văn sẵn có của repo.
- Mọi lệnh chạy từ gốc worktree. Chạy toàn bộ test: `npm test`.

## Bản đồ file

| File | Việc |
|---|---|
| `dha-cms/src/api/site-setting/content-types/site-setting/schema.json` | Thêm 2 trường khung hotline |
| `dha-cms/src/api/admin-ui/services/resource-config.js` | Cho phép ghi 2 trường mới |
| `admin/src/config/resources.js` | Ô nhập 2 trường mới trong form Cài đặt website |
| `scripts/prerender-site-settings.js` | Thêm ghi danh mục + tách `prerenderDirectory()` |
| `deploy/deploy.sh` | Sửa dòng thông báo |
| `dha-cms/src/api/product-category/content-types/product-category/lifecycles.js` | Gọi `schedulePrerender()` sau tạo/sửa/xoá |
| `index.html` + 8 trang còn lại | Đánh dấu `data-category-list`, danh mục mặc định, khung hotline, `?v=` |
| `styles.css` | `white-space: pre-line` cho mô tả khung hotline |
| `app.js` | `loadProductCategories()`, `initCategoryLinks()`, `resolveTabCategories()`, nút quay lại danh mục |
| `tests/hardcoded-content.test.js` (mới) | Test chống tái phát chữ viết cứng |
| `tests/prerender-site-settings.test.js` | Test prerender danh mục + so khớp với `app.js` |
| `tests/product-categories.test.js` | Test lifecycle gọi prerender |
| `package.json` | Thêm file test mới vào `npm test` |

---

### Task 1: Khung hotline lấy chữ từ Cài đặt website

**Files:**
- Create: `tests/hardcoded-content.test.js`
- Modify: `package.json` (script `test`)
- Modify: `dha-cms/src/api/site-setting/content-types/site-setting/schema.json` (trước `"admin_labels"`)
- Modify: `dha-cms/src/api/admin-ui/services/resource-config.js` (khối `'site-setting'`)
- Modify: `admin/src/config/resources.js` (khối `'site-setting'`)
- Modify: `index.html:217-219`, `styles.css:855-858`
- Test: `tests/hardcoded-content.test.js`, `tests/prerender-site-settings.test.js`

**Interfaces:**
- Produces: khoá `data-site-text="hotline_box_title"` và `data-site-text="hotline_box_note"`; file `tests/hardcoded-content.test.js` với các helper `read(file)`, `load(file)`, hằng `PAGES` mà Task 4 và 5 viết thêm vào.

- [ ] **Step 1: Viết test hỏng**

Tạo `tests/hardcoded-content.test.js`:

```js
// Chống tái phát nội dung viết cứng trong HTML (lộ trình 2026-09-14): chữ khách
// nhìn thấy phải nằm trong vùng lấy từ CMS. Mỗi đợt của lộ trình mở rộng file này.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const { getResourceConfig } = require('../dha-cms/src/api/admin-ui/services/resource-config');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function load(file) {
  return new JSDOM(read(file)).window.document;
}

// Trang công khai = trang có header thật (preview.html là trang xem trước của admin).
const PAGES = fs
  .readdirSync(root)
  .filter((file) => file.endsWith('.html'))
  .filter((file) => read(file).includes('class="site-header"'));

test('quét đủ 9 trang công khai', () => {
  assert.equal(PAGES.length, 9, `mới thấy: ${PAGES.join(', ')}`);
});

test('khung hotline không còn chữ viết cứng', () => {
  const box = load('index.html').querySelector('.widget-hotline');
  assert.ok(box, 'trang chủ có khung hotline');
  assert.equal(box.querySelector('.widget-title').dataset.siteText, 'hotline_box_title');
  assert.equal(box.querySelector('.widget-hotline-desc').dataset.siteText, 'hotline_box_note');

  box.querySelectorAll('[data-site-text], .site-hotline').forEach((el) => el.remove());
  assert.equal(box.textContent.trim(), '', 'mọi chữ trong khung đều nối CMS');
});

test('mô tả khung hotline xuống dòng bằng CSS, không bằng <br>', () => {
  assert.match(read('styles.css'), /\.widget-hotline-desc \{[^}]*white-space: pre-line;/);
  assert.equal(load('index.html').querySelector('.widget-hotline-desc br'), null);
});

test('Cài đặt website có hai trường của khung hotline và admin sửa được', () => {
  const schema = JSON.parse(read('dha-cms/src/api/site-setting/content-types/site-setting/schema.json'));
  assert.equal(schema.attributes.hotline_box_title.type, 'string');
  assert.equal(schema.attributes.hotline_box_title.maxLength, 60);
  assert.equal(schema.attributes.hotline_box_note.type, 'text');
  assert.equal(schema.attributes.hotline_box_note.maxLength, 300);

  const config = getResourceConfig('site-setting');
  assert.ok(config.editableFields.includes('hotline_box_title'));
  assert.ok(config.editableFields.includes('hotline_box_note'));

  const adminConfig = read('admin/src/config/resources.js');
  assert.match(adminConfig, /hotline_box_title: \{ label: 'Tiêu đề khung hotline'/);
  assert.match(adminConfig, /hotline_box_note: \{ label: 'Mô tả khung hotline', type: 'textarea'/);
});
```

Trong `package.json`, thêm ` tests/hardcoded-content.test.js` vào cuối chuỗi script `test` (sau `tests/admin-settings-login-ui.test.js`).

Trong `tests/prerender-site-settings.test.js`, thêm vào object `SETTINGS` (sau `facebook_url`):

```js
  hotline_box_title: 'GỌI KỸ SƯ',
  hotline_box_note: 'Phản hồi trong 15 phút\nHỗ trợ cả Chủ nhật',
```

và thêm test cuối file:

```js
test('mô tả khung hotline giữ nguyên chỗ xuống dòng khi prerender', () => {
  const note = 'Dòng một\nDòng hai';
  const html = applySettingsToHtml(readPage('index.html'), { hotline: '0912345678', hotline_box_note: note });
  const box = new JSDOM(html).window.document.querySelector('.widget-hotline-desc');
  assert.equal(box.textContent, note);
});
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test tests/hardcoded-content.test.js tests/prerender-site-settings.test.js`
Expected: FAIL — `khung hotline không còn chữ viết cứng` (dataset.siteText là `undefined`), `mô tả khung hotline xuống dòng bằng CSS`, `Cài đặt website có hai trường` (`schema.attributes.hotline_box_title` undefined), `mô tả khung hotline giữ nguyên chỗ xuống dòng` (không có `data-site-text` nên chữ mẫu giữ nguyên).

- [ ] **Step 3: Thêm trường vào schema**

Trong `schema.json`, chèn ngay trước dòng `    "admin_labels": {`:

```json
    "hotline_box_title": {
      "type": "string",
      "maxLength": 60,
      "default": "HOTLINE TƯ VẤN"
    },
    "hotline_box_note": {
      "type": "text",
      "maxLength": 300,
      "default": "Kỹ sư phản hồi trong 30 phút\nHỗ trợ 7:30 – 17:30 các ngày trong tuần"
    },
```

- [ ] **Step 4: Cho phép ghi ở phía CMS**

Trong `resource-config.js`, khối `'site-setting'`:
- Trong `editableFields`, chèn `'hotline_box_title',` và `'hotline_box_note',` ngay trước `'admin_labels',`.
- Trong `fields`, chèn ngay trước `admin_labels: { label: 'Nhãn form quản trị', type: 'json' },`:

```js
      hotline_box_title: { label: 'Tiêu đề khung hotline', type: 'text', maxLength: 60, default: 'HOTLINE TƯ VẤN' },
      hotline_box_note: { label: 'Mô tả khung hotline', type: 'textarea', maxLength: 300 },
```

- [ ] **Step 5: Thêm ô nhập trong admin**

Trong `admin/src/config/resources.js`, khối `'site-setting'`, chèn ngay trước `admin_labels: { label: 'Nhãn form quản trị', type: 'hidden' },`:

```js
      hotline_box_title: { label: 'Tiêu đề khung hotline', type: 'text', placeholder: 'HOTLINE TƯ VẤN', hint: 'Tiêu đề khung nền xanh bên hông trang chủ. Số điện thoại trong khung lấy từ ô Hotline.' },
      hotline_box_note: { label: 'Mô tả khung hotline', type: 'textarea', hint: 'Mỗi dòng gõ ở đây là một dòng trên website.' },
```

- [ ] **Step 6: Gắn khung hotline vào CMS**

Trong `index.html`, thay:

```html
                            <h2 class="widget-title">HOTLINE TƯ VẤN</h2>
                            <span class="widget-hotline-number site-hotline">086.725.9078</span>
                            <p class="widget-hotline-desc">Kỹ sư phản hồi trong 30 phút<br>Hỗ trợ 7:30 – 17:30 các ngày trong tuần</p>
```

bằng (dòng thứ hai của mô tả không thụt đầu dòng — ký tự xuống dòng là một phần nội dung):

```html
                            <h2 class="widget-title" data-site-text="hotline_box_title">HOTLINE TƯ VẤN</h2>
                            <span class="widget-hotline-number site-hotline">086.725.9078</span>
                            <p class="widget-hotline-desc" data-site-text="hotline_box_note">Kỹ sư phản hồi trong 30 phút
Hỗ trợ 7:30 – 17:30 các ngày trong tuần</p>
```

Trong `styles.css`, thay khối `.widget-hotline-desc` bằng:

```css
.widget-hotline-desc {
    font-size: 13px;
    color: #CCCCCC;
    /* Mô tả do quản trị gõ nhiều dòng trong admin — giữ chỗ xuống dòng của họ. */
    white-space: pre-line;
}
```

- [ ] **Step 7: Chạy test, xác nhận qua**

Run: `node --test tests/hardcoded-content.test.js tests/prerender-site-settings.test.js tests/admin-resource-fields.test.js`
Expected: PASS toàn bộ (test `admin-resource-fields` xác nhận hai trường mới có trong schema và được phép ghi).

- [ ] **Step 8: Commit**

```bash
git add tests/hardcoded-content.test.js tests/prerender-site-settings.test.js package.json dha-cms/src/api/site-setting/content-types/site-setting/schema.json dha-cms/src/api/admin-ui/services/resource-config.js admin/src/config/resources.js index.html styles.css
git commit -m "feat: chữ khung hotline sửa được trong Cài đặt website"
```

---

### Task 2: Prerender ghi danh mục vào HTML

**Files:**
- Modify: `scripts/prerender-site-settings.js` (thêm hàm sau `applySettingsToHtml`, thay `main`, sửa `module.exports`, sửa comment đầu file)
- Modify: `deploy/deploy.sh:57-63` (chỉ dòng `echo`)
- Test: `tests/prerender-site-settings.test.js`

**Interfaces:**
- Produces (export từ `scripts/prerender-site-settings.js`):
  - `DEFAULT_CATEGORIES: Array<{slug: string, name: string}>`
  - `pickVisibleCategories(items: Array<object>|null): Array<object>`
  - `renderCategoryLinks(categories: Array<{slug, name}>): string`
  - `applyCategoriesToHtml(html: string, items: Array<object>): string`
  - `prerenderDirectory(target: string, { loadSettings?, loadCategories?, log? }): Promise<{changed: number, total: number, settings: boolean, categories: boolean}>`
- Consumes: `transformHtml`, `escapeText`, `escapeAttr`, `applySettingsToHtml`, `fetchSettings` đã có trong file.

- [ ] **Step 1: Viết test hỏng**

Trong `tests/prerender-site-settings.test.js`:

Thay dòng require script:

```js
const { applySettingsToHtml } = require('../scripts/prerender-site-settings.js');
```

bằng:

```js
const os = require('node:os');
const {
  applySettingsToHtml,
  applyCategoriesToHtml,
  renderCategoryLinks,
  pickVisibleCategories,
  prerenderDirectory,
  DEFAULT_CATEGORIES,
} = require('../scripts/prerender-site-settings.js');

// Có một mục bị ẩn và một mục mang ký tự đặc biệt để thử escape.
const CATEGORIES = [
  { slug: 'kim-loai-mau', name: 'Kim Loại Màu', visible: true, sort_order: 1 },
  { slug: 'an-di', name: 'Ẩn đi', visible: false, sort_order: 2 },
  { slug: 'quang-&-mau', name: 'Quặng <Mẫu> & "Chuẩn"', visible: true, sort_order: 3 },
];
```

Thêm vào cuối file:

```js
const LIST_HTML =
  '<footer><ul class="footer-list" data-category-list><li><a href="/products?filter=dong">Đồng</a></li></ul></footer>';

test('danh sách danh mục ghi đúng thứ tự, bỏ mục ẩn, escape tên và mã', () => {
  const html = applyCategoriesToHtml(LIST_HTML, CATEGORIES);
  const links = [...new JSDOM(html).window.document.querySelectorAll('[data-category-list] a')];

  assert.deepEqual(
    links.map((a) => a.getAttribute('href')),
    ['/products?filter=kim-loai-mau', '/products?filter=quang-%26-mau'],
  );
  assert.deepEqual(links.map((a) => a.textContent), ['Kim Loại Màu', 'Quặng <Mẫu> & "Chuẩn"']);
  assert.ok(!html.includes('<Mẫu>'), 'tên danh mục không lọt thành thẻ HTML');
  assert.ok(!html.includes('filter=dong'), 'mục cũ đã bị thay');
});

test('không còn danh mục hiển thị thì dùng 3 danh mục mặc định', () => {
  assert.deepEqual(pickVisibleCategories([{ slug: 'a', name: 'A', visible: false }]), DEFAULT_CATEGORIES);
  assert.deepEqual(pickVisibleCategories([]), DEFAULT_CATEGORIES);
  assert.deepEqual(pickVisibleCategories(null), DEFAULT_CATEGORIES);
});

test('danh mục mặc định của prerender khớp data/product_categories.json', () => {
  const fallback = JSON.parse(readPage('data/product_categories.json'));
  assert.deepEqual(DEFAULT_CATEGORIES, fallback.map(({ slug, name }) => ({ slug, name })));
});

test('thanh tab được ghi sẵn tên danh mục, nút Tất Cả luôn đứng đầu', () => {
  const html = applyCategoriesToHtml(
    '<nav id="home-filter-tabs"><button class="home-filter-btn active" data-filter="all">Tất Cả <em></em></button></nav>'
      + '<div id="product-filter-tabs"></div>',
    CATEGORIES,
  );
  const doc = new JSDOM(html).window.document;

  const home = [...doc.querySelectorAll('#home-filter-tabs button')];
  assert.deepEqual(home.map((b) => b.dataset.filter), ['all', 'kim-loai-mau', 'quang-&-mau']);
  assert.ok(home[0].classList.contains('active'));
  assert.equal(home[0].getAttribute('aria-selected'), 'true');
  assert.equal(home[1].getAttribute('aria-selected'), 'false');
  assert.ok(home[1].classList.contains('home-filter-btn'));
  assert.ok(home[1].querySelector('em'), 'chừa chỗ cho số lượng');
  assert.equal(home[2].firstChild.textContent.trim(), 'Quặng <Mẫu> & "Chuẩn"');

  const product = [...doc.querySelectorAll('#product-filter-tabs button')];
  assert.equal(product.length, 3);
  assert.ok(product[1].classList.contains('product-filter-btn'));
  assert.ok(product[1].querySelector('.filter-count'));
});

test('ghi danh mục nhiều lần cho ra cùng một kết quả', () => {
  const once = applyCategoriesToHtml(LIST_HTML, CATEGORIES);
  assert.equal(applyCategoriesToHtml(once, CATEGORIES), once);
});

test('đọc danh mục lỗi thì vẫn ghi cài đặt, và ngược lại', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prerender-'));
  const file = path.join(dir, 'a.html');
  const page = '<span class="site-hotline">000</span><ul data-category-list><li>cũ</li></ul>';
  const quiet = { warn() {} };
  const fail = async () => {
    throw new Error('CMS trả về 500');
  };

  try {
    fs.writeFileSync(file, page);
    await prerenderDirectory(dir, { loadSettings: async () => ({ hotline: '0912345678' }), loadCategories: fail, log: quiet });
    let out = fs.readFileSync(file, 'utf8');
    assert.ok(out.includes('0912345678'), 'cài đặt vẫn được ghi');
    assert.ok(out.includes('<li>cũ</li>'), 'danh mục giữ nguyên khi đọc lỗi');

    fs.writeFileSync(file, page);
    await prerenderDirectory(dir, { loadSettings: fail, loadCategories: async () => CATEGORIES, log: quiet });
    out = fs.readFileSync(file, 'utf8');
    assert.ok(out.includes('/products?filter=kim-loai-mau'), 'danh mục vẫn được ghi');
    assert.ok(out.includes('>000<'), 'cài đặt giữ nguyên khi đọc lỗi');

    await assert.rejects(prerenderDirectory(dir, { loadSettings: fail, loadCategories: fail, log: quiet }));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test tests/prerender-site-settings.test.js`
Expected: FAIL — `applyCategoriesToHtml is not a function` (và tương tự cho các export mới).

- [ ] **Step 3: Viết phần danh mục trong script**

Trong `scripts/prerender-site-settings.js`, chèn ngay sau hàm `applySettingsToHtml` (trước `async function fetchSettings()`):

```js
// Danh mục mặc định: phải trùng DEFAULT_PRODUCT_CATEGORIES trong app.js và
// data/product_categories.json — có test giữ ba nơi khớp nhau.
const DEFAULT_CATEGORIES = [
  { slug: 'color-metal', name: 'Kim Loại Màu' },
  { slug: 'black-metal', name: 'Kim Loại Đen' },
  { slug: 'rare-earth', name: 'Đất Hiếm' },
];

// Cùng quy tắc với pickVisibleCategories() trong app.js: bỏ mục ẩn, hết mục thì
// về mặc định — để tab, khối bên hông và chân trang luôn giống nhau.
function pickVisibleCategories(items) {
  const usable = (items || []).filter((item) => item && item.slug && item.visible !== false);
  return usable.length ? usable : DEFAULT_CATEGORIES;
}

// Phải cho ra cùng một DOM với renderCategoryLinks() trong app.js — lệch nhau
// là danh sách chớp khi app.js dựng lại.
function renderCategoryLinks(categories) {
  return categories
    .map((category) => {
      const href = `/products?filter=${encodeURIComponent(category.slug)}`;
      return `<li><a href="${escapeAttr(href)}">${escapeText(category.name)}</a></li>`;
    })
    .join('');
}

// Thanh tab chỉ được ghi tên; số lượng sản phẩm do app.js điền sau khi tải xong
// danh sách sản phẩm (xem renderCategoryTabs trong app.js).
const TAB_BARS = {
  'home-filter-tabs': { buttonClass: 'home-filter-btn', countHtml: '<em></em>' },
  'product-filter-tabs': { buttonClass: 'product-filter-btn', countHtml: '<span class="filter-count"></span>' },
};

function renderCategoryTabs(categories, { buttonClass, countHtml }) {
  return [{ slug: 'all', name: 'Tất Cả' }, ...categories]
    .map((tab, index) => {
      const active = index === 0;
      return `<button class="${buttonClass}${active ? ' active' : ''}" data-filter="${escapeAttr(tab.slug)}"`
        + ` role="tab" aria-selected="${active}">${escapeText(tab.name)} ${countHtml}</button>`;
    })
    .join('');
}

function applyCategoriesToHtml(html, items) {
  const categories = pickVisibleCategories(items);
  return transformHtml(html, [
    {
      match: (tagName, attrs) => 'data-category-list' in attrs,
      apply: () => ({ inner: renderCategoryLinks(categories) }),
    },
    {
      match: (tagName, attrs) => Object.hasOwn(TAB_BARS, attrs.id || ''),
      apply: ({ attrs }) => ({ inner: renderCategoryTabs(categories, TAB_BARS[attrs.id]) }),
    },
  ]);
}

async function fetchCategories() {
  const res = await fetch(`${CMS}/api/product-categories?sort=sort_order:asc&pagination[limit]=100`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`CMS trả về ${res.status} khi đọc danh mục`);
  const json = await res.json();
  return (json.data || []).map((item) => item.attributes || item);
}
```

- [ ] **Step 4: Tách `prerenderDirectory` và sửa `main`**

Thay toàn bộ hàm `main()` bằng:

```js
// Cài đặt và danh mục đọc độc lập: một bên lỗi thì vẫn ghi bên kia, vì HTML
// ghi được phần nào đỡ chớp phần đó. Chỉ bỏ cuộc khi cả hai cùng lỗi.
async function prerenderDirectory(
  target,
  { loadSettings = fetchSettings, loadCategories = fetchCategories, log = console } = {},
) {
  const [settingsResult, categoriesResult] = await Promise.allSettled([loadSettings(), loadCategories()]);
  const settings = settingsResult.status === 'fulfilled' ? settingsResult.value : null;
  const categories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : null;

  if (!settings && !categories) throw settingsResult.reason;
  if (!settings) log.warn(`⚠️  Bỏ qua cài đặt website: ${settingsResult.reason.message}`);
  if (!categories) log.warn(`⚠️  Bỏ qua danh mục: ${categoriesResult.reason.message}`);

  const files = fs.readdirSync(target).filter((file) => file.endsWith('.html'));
  let changed = 0;
  for (const file of files) {
    const full = path.join(target, file);
    const html = fs.readFileSync(full, 'utf8');
    let out = html;
    if (settings) out = applySettingsToHtml(out, settings);
    if (categories) out = applyCategoriesToHtml(out, categories);
    if (out !== html) {
      fs.writeFileSync(full, out, 'utf8');
      changed += 1;
    }
  }
  return { changed, total: files.length, settings: Boolean(settings), categories: Boolean(categories) };
}

async function main() {
  const target = path.resolve(process.argv[2] || path.join(__dirname, '..'));
  const result = await prerenderDirectory(target);
  const parts = [result.settings && 'cài đặt website', result.categories && 'danh mục']
    .filter(Boolean)
    .join(' + ');
  console.log(`✓ ${parts} đã ghi vào ${result.changed}/${result.total} trang trong ${target}`);
}
```

Thay `module.exports = { applySettingsToHtml };` bằng:

```js
module.exports = {
  applySettingsToHtml,
  applyCategoriesToHtml,
  renderCategoryLinks,
  pickVisibleCategories,
  prerenderDirectory,
  DEFAULT_CATEGORIES,
};
```

Ở comment đầu file, thay dòng `// Ghi cài đặt website của CMS thẳng vào các file HTML tĩnh.` bằng
`// Ghi cài đặt website và danh mục sản phẩm của CMS thẳng vào các file HTML tĩnh.`

Trong `deploy/deploy.sh`, thay `echo "▸ Ghi cài đặt website từ CMS vào HTML tĩnh..."` bằng
`echo "▸ Ghi cài đặt website và danh mục từ CMS vào HTML tĩnh..."`.

- [ ] **Step 5: Chạy test, xác nhận qua**

Run: `node --test tests/prerender-site-settings.test.js tests/site-setting-prerender.test.js`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add scripts/prerender-site-settings.js deploy/deploy.sh tests/prerender-site-settings.test.js
git commit -m "feat: prerender ghi danh mục sản phẩm vào HTML tĩnh"
```

---

### Task 3: Lưu danh mục là ghi lại HTML ngay

**Files:**
- Modify: `dha-cms/src/api/product-category/content-types/product-category/lifecycles.js`
- Test: `tests/product-categories.test.js`

**Interfaces:**
- Consumes: `schedulePrerender()` từ `dha-cms/src/api/site-setting/prerender.js` (đã có, không tham số, trả `boolean`).
- Produces: lifecycle `afterCreate`, `afterUpdate`, `afterDelete` đều gọi `prerender.schedulePrerender()` sau khi dọn mã sản phẩm.

- [ ] **Step 1: Viết test hỏng**

Thêm vào cuối `tests/product-categories.test.js`:

```js
// Lifecycle gọi schedulePrerender qua đối tượng module, nên test thay tạm hàm đó
// để đếm số lần gọi mà không chạy tiến trình thật.
function spyPrerender(onCall = () => {}) {
  const prerender = require('../dha-cms/src/api/site-setting/prerender');
  const original = prerender.schedulePrerender;
  let calls = 0;
  prerender.schedulePrerender = () => {
    calls += 1;
    onCall();
  };
  return {
    count: () => calls,
    restore: () => {
      prerender.schedulePrerender = original;
    },
  };
}

test('tạo, sửa, xoá danh mục đều ghi lại HTML tĩnh', async () => {
  const lifecycles = require('../dha-cms/src/api/product-category/content-types/product-category/lifecycles');
  withFakeStrapi([{ id: 7, slug: 'color-metal' }], [{ id: 1, categories: ['color-metal'] }]);
  const spy = spyPrerender();

  try {
    await lifecycles.afterCreate({ result: { slug: 'moi' } });
    assert.equal(spy.count(), 1, 'sau khi tạo');

    await lifecycles.beforeUpdate({ params: { where: { id: 7 } } });
    await lifecycles.afterUpdate({ params: { where: { id: 7 } }, result: { slug: 'color-metal' } });
    assert.equal(spy.count(), 2, 'đổi tên hay ẩn/hiện mà không đổi mã cũng phải ghi lại');

    await lifecycles.afterDelete({ result: { slug: 'color-metal' } });
    assert.equal(spy.count(), 3, 'sau khi xoá');
  } finally {
    spy.restore();
  }
});

test('HTML được ghi lại sau khi sản phẩm đã dọn xong mã', async () => {
  const lifecycles = require('../dha-cms/src/api/product-category/content-types/product-category/lifecycles');
  const products = [{ id: 1, categories: ['rare-earth', 'color-metal'] }];
  withFakeStrapi([], products);
  let seen = null;
  const spy = spyPrerender(() => {
    seen = [...products[0].categories];
  });

  try {
    await lifecycles.afterDelete({ result: { slug: 'rare-earth' } });
  } finally {
    spy.restore();
  }
  assert.deepEqual(seen, ['color-metal']);
});
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test tests/product-categories.test.js`
Expected: FAIL — `lifecycles.afterCreate is not a function`.

- [ ] **Step 3: Sửa lifecycle**

Trong `lifecycles.js`, thêm ngay sau dòng `const CATEGORY_UID = ...;`:

```js

// Danh mục hiện ở tab lọc, khối bên hông trang chủ và chân trang mọi trang — tất
// cả được prerender ghi sẵn vào HTML tĩnh. Lưu xong là ghi lại, không đợi deploy.
// Gọi qua đối tượng module (không destructure) để test thay được hàm này.
const prerender = require('../../../site-setting/prerender');
```

Thay toàn bộ `module.exports = { ... };` bằng:

```js
module.exports = {
  afterCreate() {
    prerender.schedulePrerender();
  },

  async beforeUpdate(event) {
    const id = event.params?.where?.id;
    if (!id) return;
    const existing = await strapi.db.query(CATEGORY_UID).findOne({ where: { id } });
    if (existing?.slug) slugBeforeUpdate.set(id, existing.slug);
  },

  async afterUpdate(event) {
    const id = event.params?.where?.id;
    const oldSlug = slugBeforeUpdate.get(id);
    slugBeforeUpdate.delete(id);
    const newSlug = event.result?.slug;

    if (oldSlug && newSlug && oldSlug !== newSlug) {
      await rewriteProductCategories((slugs) =>
        [...new Set(slugs.map((slug) => (slug === oldSlug ? newSlug : slug)))],
      );
    }
    prerender.schedulePrerender();
  },

  async afterDelete(event) {
    const removedSlug = event.result?.slug;
    if (removedSlug) {
      await rewriteProductCategories((slugs) => slugs.filter((slug) => slug !== removedSlug));
    }
    prerender.schedulePrerender();
  },
};
```

- [ ] **Step 4: Chạy test, xác nhận qua**

Run: `node --test tests/product-categories.test.js`
Expected: PASS toàn bộ, kể cả hai test cũ về đổi mã / xoá danh mục (khi chạy trên máy dev, `schedulePrerender` thật tự bỏ qua vì không có script ở `/var/www`).

- [ ] **Step 5: Commit**

```bash
git add dha-cms/src/api/product-category/content-types/product-category/lifecycles.js tests/product-categories.test.js
git commit -m "feat: lưu danh mục sản phẩm là ghi lại HTML tĩnh ngay"
```

---

### Task 4: Đánh dấu danh sách danh mục trên 9 trang

**Files:**
- Modify: `index.html` (khối bên hông ~dòng 208 và chân trang ~dòng 335), `products.html:162`, `projects.html:140`, `estimator.html:252`, `news.html:135`, `news-detail.html:119`, `product-detail.html:115`, `pricing.html:179`, `contact.html:219`
- Test: `tests/hardcoded-content.test.js`

**Interfaces:**
- Consumes: `read`, `load`, `PAGES` trong `tests/hardcoded-content.test.js` (Task 1).
- Produces: mọi `<ul>` danh mục mang `data-category-list` — Task 5 (`initCategoryLinks`) và prerender (Task 2) dựa vào thuộc tính này.

- [ ] **Step 1: Viết test hỏng**

Thêm vào cuối `tests/hardcoded-content.test.js`:

```js
const DEFAULT_SLUGS = new Set(JSON.parse(read('data/product_categories.json')).map((category) => category.slug));

test('mọi link lọc danh mục nằm trong vùng lấy từ CMS và dùng mã có thật', () => {
  for (const file of PAGES) {
    for (const link of load(file).querySelectorAll('a[href*="/products?filter="]')) {
      const label = link.textContent.trim();
      assert.ok(link.closest('[data-category-list]'), `${file}: link "${label}" viết cứng ngoài [data-category-list]`);
      const slug = new URL(link.getAttribute('href'), 'https://dhakimloaimau.vn').searchParams.get('filter');
      assert.ok(DEFAULT_SLUGS.has(slug), `${file}: link "${label}" dùng mã lọc "${slug}" không có trong danh mục`);
    }
  }
});

test('trang nào cũng có danh sách danh mục ở chân trang, trang chủ có thêm khối bên hông', () => {
  for (const file of PAGES) {
    assert.ok(load(file).querySelector('footer [data-category-list]'), `${file} thiếu danh sách danh mục ở chân trang`);
  }
  assert.ok(load('index.html').querySelector('aside [data-category-list]'), 'trang chủ có khối danh mục bên hông');
});
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test tests/hardcoded-content.test.js`
Expected: FAIL — `index.html: link "Quặng Mẫu Đồng" viết cứng ngoài [data-category-list]` và `index.html thiếu danh sách danh mục ở chân trang`.

- [ ] **Step 3: Thay 10 danh sách bằng danh mục mặc định**

Chạy đoạn script một lần từ gốc worktree. Nó chỉ bắt `<ul class="footer-list">` / `<ul class="widget-categories">` mà mọi mục đều là link `/products?filter=`, nên cột "Hỗ trợ khách hàng", "Liên kết" không bị đụng:

```bash
node -e '
const fs = require("fs");
const PAGES = ["index", "products", "projects", "estimator", "news", "news-detail", "product-detail", "pricing", "contact"];
const DEFAULTS = JSON.parse(fs.readFileSync("data/product_categories.json", "utf8"));
const LIST = /<ul class="(footer-list|widget-categories)">(\s*)(?:<li><a href="\/products\?filter=[^"]*">[^<]*<\/a><\/li>\s*)+<\/ul>/g;
for (const page of PAGES) {
  const file = `${page}.html`;
  let count = 0;
  const out = fs.readFileSync(file, "utf8").replace(LIST, (match, cls, space) => {
    count += 1;
    const indent = space.replace(/^\n/, "");
    const items = DEFAULTS.map((c) => `\n${indent}<li><a href="/products?filter=${c.slug}">${c.name}</a></li>`).join("");
    return `<ul class="${cls}" data-category-list>${items}\n${indent.slice(4)}</ul>`;
  });
  fs.writeFileSync(file, out);
  console.log(file, count);
}'
```

Expected output: `index.html 2`, còn lại mỗi file `1`.

Kiểm tra lại bằng mắt một file, ví dụ `git diff news.html` phải ra đúng:

```html
                        <ul class="footer-list" data-category-list>
                            <li><a href="/products?filter=color-metal">Kim Loại Màu</a></li>
                            <li><a href="/products?filter=black-metal">Kim Loại Đen</a></li>
                            <li><a href="/products?filter=rare-earth">Đất Hiếm</a></li>
                        </ul>
```

- [ ] **Step 4: Chạy test, xác nhận qua**

Run: `node --test tests/hardcoded-content.test.js tests/prerender-site-settings.test.js tests/product-categories.test.js`
Expected: PASS toàn bộ.

- [ ] **Step 5: Commit**

```bash
git add index.html products.html projects.html estimator.html news.html news-detail.html product-detail.html pricing.html contact.html tests/hardcoded-content.test.js
git commit -m "fix: danh sách danh mục trên 9 trang dùng mã lọc có thật"
```

---

### Task 5: `app.js` dựng danh mục từ CMS, giữ HTML khi CMS lỗi

**Files:**
- Modify: `app.js` — khối `DANH MỤC SẢN PHẨM` (dòng ~115-146), `DOMContentLoaded` (dòng ~244), `initHomeProducts` (dòng ~1045), `initProductsPage` (dòng ~1404), `initProductDetailPage` (dòng ~1510-1535)
- Modify: 10 file `*.html` (chuỗi `?v=`)
- Test: `tests/prerender-site-settings.test.js`, `tests/hardcoded-content.test.js`

**Interfaces:**
- Consumes: `applyCategoriesToHtml`, `renderCategoryLinks`, `pickVisibleCategories`, `DEFAULT_CATEGORIES` từ script prerender (Task 2); `data-category-list` trong HTML (Task 4).
- Produces (hàm toàn cục trong `app.js`, test gọi qua `window`):
  - `pickVisibleCategories(items): Array<object>`
  - `loadProductCategories(): Promise<{categories: Array<object>, fromCMS: boolean}>` — gọi CMS một lần mỗi lượt tải trang
  - `renderCategoryLinks(categories): string`
  - `initCategoryLinks(): Promise<void>`
  - `resolveTabCategories(container: Element|null): Promise<Array<{slug, name}>>`

- [ ] **Step 1: Viết test hỏng**

Trong `tests/prerender-site-settings.test.js`:

1. Thêm `'[data-category-list]',` vào cuối mảng `DYNAMIC_SELECTORS`.
2. Thay hàm `runAppJs` bằng bản nhận thêm danh mục (không truyền thì coi như CMS lỗi phần danh mục):

```js
function runAppJs(html, settings, categories = null) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://dhakimloaimau.vn/',
    virtualConsole: new VirtualConsole(),
  });
  const { window } = dom;
  window.fetch = (url) => {
    const target = String(url);
    if (target.includes('/api/site-setting')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: settings }) });
    }
    if (categories && target.includes('/api/product-categories')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: categories }) });
    }
    return Promise.reject(new Error('network disabled in tests'));
  };
  const script = window.document.createElement('script');
  script.textContent = APP_JS;
  window.document.body.appendChild(script);
  return window;
}
```

3. Thay test trong vòng `for (const file of PAGES)` bằng:

```js
for (const file of PAGES) {
  test(`${file}: prerender xong thì app.js không phải sửa gì nữa`, async () => {
    const html = applyCategoriesToHtml(applySettingsToHtml(readPage(file), SETTINGS), CATEGORIES);
    const window = runAppJs(html, SETTINGS, CATEGORIES);

    const before = snapshot(window);
    await window.initSiteSettings();
    await window.initCategoryLinks();
    const after = snapshot(window);

    for (const [index, selector] of DYNAMIC_SELECTORS.entries()) {
      assert.equal(after[index], before[index], `${selector} bị app.js sửa lại → còn chớp`);
    }
  });
}
```

4. Thêm vào cuối file:

```js
// Bản sao sang realm của test để so sánh — mảng tạo trong jsdom mang prototype khác.
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('app.js dựng danh sách danh mục ra cùng một DOM với prerender', () => {
  const window = runAppJs(readPage('index.html'), SETTINGS);
  const visible = pickVisibleCategories(CATEGORIES);
  const fromJs = window.document.createElement('ul');
  fromJs.innerHTML = window.renderCategoryLinks(visible);
  const fromPrerender = window.document.createElement('ul');
  fromPrerender.innerHTML = renderCategoryLinks(visible);

  assert.equal(fromJs.innerHTML, fromPrerender.innerHTML);
});

test('app.js và prerender dùng chung quy tắc chọn danh mục', () => {
  const window = runAppJs(readPage('index.html'), SETTINGS);
  assert.deepEqual(plain(window.eval('DEFAULT_PRODUCT_CATEGORIES')), DEFAULT_CATEGORIES);
  for (const items of [CATEGORIES, [], [{ slug: 'x', name: 'X', visible: false }]]) {
    assert.deepEqual(plain(window.pickVisibleCategories(items)), plain(pickVisibleCategories(items)));
  }
});

test('CMS lỗi thì app.js giữ nguyên danh sách danh mục đã prerender', async () => {
  const html = applyCategoriesToHtml(readPage('index.html'), CATEGORIES);
  const window = runAppJs(html, SETTINGS); // không trả danh mục = CMS lỗi
  const lists = () => [...window.document.querySelectorAll('[data-category-list]')].map((el) => el.outerHTML);

  const before = lists();
  await window.initCategoryLinks();

  assert.deepEqual(lists(), before);
  assert.ok(before[0].includes('filter=kim-loai-mau'), 'vẫn là bản prerender, không phải file dự phòng');
});

test('CMS trả lời thì app.js thay danh sách mặc định bằng danh mục thật', async () => {
  const window = runAppJs(readPage('contact.html'), SETTINGS, CATEGORIES);
  await window.initCategoryLinks();

  const hrefs = [...window.document.querySelectorAll('footer [data-category-list] a')].map((a) => a.getAttribute('href'));
  assert.deepEqual(hrefs, ['/products?filter=kim-loai-mau', '/products?filter=quang-%26-mau']);
});

test('CMS lỗi thì tab lọc dùng danh mục prerender đã ghi sẵn', async () => {
  const html = applyCategoriesToHtml(readPage('products.html'), CATEGORIES);
  const window = runAppJs(html, SETTINGS);

  const tabs = await window.resolveTabCategories(window.document.getElementById('product-filter-tabs'));

  assert.deepEqual(plain(tabs), [
    { slug: 'kim-loai-mau', name: 'Kim Loại Màu' },
    { slug: 'quang-&-mau', name: 'Quặng <Mẫu> & "Chuẩn"' },
  ]);
});

test('CMS lỗi và HTML chưa prerender thì tab lọc dùng danh mục mặc định', async () => {
  const window = runAppJs(readPage('products.html'), SETTINGS);
  const tabs = await window.resolveTabCategories(window.document.getElementById('product-filter-tabs'));
  assert.deepEqual(plain(tabs).map((tab) => tab.slug), ['color-metal', 'black-metal', 'rare-earth']);
});
```

Thêm vào cuối `tests/hardcoded-content.test.js`:

```js
const APP_JS = read('app.js');

// Mở trang chi tiết sản phẩm với một sản phẩm giả, trả về href của nút quay lại.
async function backLinkFor(product) {
  const dom = new JSDOM(read('product-detail.html'), {
    runScripts: 'dangerously',
    url: `https://dhakimloaimau.vn/product-detail?id=${product.uid}`,
    virtualConsole: new VirtualConsole(),
  });
  const { window } = dom;
  window.fetch = (url) =>
    String(url).includes('/api/products')
      ? Promise.resolve({ ok: true, json: async () => ({ data: [product] }) })
      : Promise.reject(new Error('network disabled in tests'));
  const script = window.document.createElement('script');
  script.textContent = APP_JS;
  window.document.body.appendChild(script);

  await window.initProductDetailPage();
  const link = [...window.document.querySelectorAll('#product-detail-content a')]
    .find((a) => a.textContent.includes('Quay Lại Danh Mục'));
  return link.getAttribute('href');
}

test('nút "Quay Lại Danh Mục" trỏ tới danh mục đầu tiên của sản phẩm', async () => {
  const base = { uid: 'quang-dong', name: 'Quặng Đồng', group: 'dong', price: 1000 };
  assert.equal(await backLinkFor({ ...base, categories: ['black-metal', 'color-metal'] }), '/products?filter=black-metal');
  assert.equal(await backLinkFor({ ...base, categories: [] }), '/products', 'chưa có danh mục thì về trang Sản phẩm');
});

test('HTML nạp app.js và styles.css bản mới', () => {
  for (const file of fs.readdirSync(root).filter((name) => name.endsWith('.html'))) {
    const html = read(file);
    assert.match(html, /app\.js\?v=3\.4"/, `${file} còn app.js bản cũ`);
    assert.match(html, /styles\.css\?v=1\.1\.8"/, `${file} còn styles.css bản cũ`);
  }
});
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test tests/prerender-site-settings.test.js tests/hardcoded-content.test.js`
Expected: FAIL — `window.initCategoryLinks is not a function`, `window.renderCategoryLinks is not a function`, nút quay lại ra `/products?filter=dong`, HTML còn `app.js?v=3.3`.

- [ ] **Step 3: Thay phần tải danh mục trong `app.js`**

Thay hàm `fetchProductCategories()` (ngay dưới `DEFAULT_PRODUCT_CATEGORIES`) bằng:

```js
const PRODUCT_CATEGORIES_ENDPOINT = 'product-categories?sort=sort_order:asc&pagination[limit]=100';

// Bỏ mục ẩn; không còn mục nào thì về mặc định. Cùng quy tắc với
// pickVisibleCategories() trong scripts/prerender-site-settings.js.
function pickVisibleCategories(items) {
    const usable = (items || []).filter(item => item && item.slug && item.visible !== false);
    return usable.length ? usable : DEFAULT_PRODUCT_CATEGORIES;
}

// HTML phục vụ cho khách đã được prerender ghi sẵn danh mục mới nhất, nên phải
// biết dữ liệu đến từ CMS thật hay từ file dự phòng: bản dự phòng có thể cũ hơn
// HTML, dùng nó ghi đè là kéo trang lùi về dữ liệu cũ. Mỗi lượt tải trang chỉ
// gọi CMS một lần — tab lọc và danh sách danh mục dùng chung kết quả.
let productCategoriesPromise = null;

function loadProductCategories() {
    if (!productCategoriesPromise) {
        productCategoriesPromise = (async () => {
            try {
                const res = await fetch(`${CMS_API}/${PRODUCT_CATEGORIES_ENDPOINT}`, { signal: AbortSignal.timeout(3000) });
                if (!res.ok) throw new Error(`CMS responded ${res.status}`);
                const json = await res.json();
                const items = (json.data || []).map(item => item.attributes || item);
                return { categories: pickVisibleCategories(items), fromCMS: true };
            } catch (err) {
                console.warn('[CMS] product-categories failed, keeping prerendered HTML:', err);
                try {
                    const res = await fetch('/data/product_categories.json');
                    if (!res.ok) throw new Error(`Fallback ${res.status}`);
                    return { categories: pickVisibleCategories(await res.json()), fromCMS: false };
                } catch {
                    return { categories: DEFAULT_PRODUCT_CATEGORIES, fromCMS: false };
                }
            }
        })();
    }
    return productCategoriesPromise;
}

// Phải cho ra cùng một DOM với renderCategoryLinks() trong
// scripts/prerender-site-settings.js — lệch nhau là danh sách chớp.
function renderCategoryLinks(categories) {
    return categories
        .map(category => `<li><a href="/products?filter=${encodeURIComponent(category.slug)}">${escapeHtml(category.name)}</a></li>`)
        .join('');
}

// Khối danh mục bên hông trang chủ và cột danh mục ở chân trang mọi trang.
async function initCategoryLinks() {
    const lists = document.querySelectorAll('[data-category-list]');
    if (!lists.length) return;
    const { categories, fromCMS } = await loadProductCategories();
    if (!fromCMS) return;
    const html = renderCategoryLinks(categories);
    lists.forEach(list => { list.innerHTML = html; });
}

// Tab lọc cần số lượng sản phẩm nên luôn được dựng lại. Khi CMS lỗi, lấy danh
// mục từ chính các tab prerender đã ghi sẵn (mới hơn file dự phòng); HTML chưa
// qua prerender (máy dev) thì mới dùng file dự phòng.
async function resolveTabCategories(container) {
    const { categories, fromCMS } = await loadProductCategories();
    if (fromCMS || !container) return categories;
    const prerendered = [...container.querySelectorAll('[data-filter]:not([data-filter="all"])')]
        .map(btn => ({ slug: btn.dataset.filter, name: (btn.firstChild?.textContent || '').trim() }))
        .filter(tab => tab.slug && tab.name);
    return prerendered.length ? prerendered : categories;
}
```

Trong `initHomeProducts` và `initProductsPage`, dòng `    const categories = await fetchProductCategories();` xuất hiện hai lần giống hệt nhau — thay cả hai (Edit với `replace_all`) bằng:

```js
    const categories = await resolveTabCategories(tabsContainer);
```

Sau đó `grep -n fetchProductCategories app.js` phải không còn kết quả.

Trong khối `DOMContentLoaded`, thêm `initCategoryLinks();` ngay sau `initSiteSettings();`.

- [ ] **Step 4: Sửa nút "Quay Lại Danh Mục"**

Trong `initProductDetailPage`, chèn ngay trên dòng `        contentEl.innerHTML = \`` (dòng đầu của template chi tiết sản phẩm, ~dòng 1510, ngay sau vòng dựng `specsHtml`):

```js
        // Quay về đúng danh mục đầu tiên của sản phẩm. `group` giờ chỉ lo nhãn
        // màu ở góc ảnh nên không dùng làm mã lọc được nữa.
        const [firstCategory] = getProductCategorySlugs(product);
        const backToCategoryHref = firstCategory
            ? `/products?filter=${encodeURIComponent(firstCategory)}`
            : '/products';
```

Trong template, thay `href="/products?filter=${encodeURIComponent(product.group)}"` bằng `href="${backToCategoryHref}"`.

- [ ] **Step 5: Tăng phiên bản file tĩnh**

```bash
sed -i '' 's/app\.js?v=3\.3/app.js?v=3.4/; s/styles\.css?v=1\.1\.7/styles.css?v=1.1.8/' *.html
grep -o -h 'app\.js?v=[^"]*\|styles\.css?v=[^"]*' *.html | sort | uniq -c
```

Expected: `10 app.js?v=3.4` và `10 styles.css?v=1.1.8`.

- [ ] **Step 6: Chạy test, xác nhận qua**

Run: `node --test tests/prerender-site-settings.test.js tests/hardcoded-content.test.js tests/product-categories.test.js tests/site-settings-dom.test.js`
Expected: PASS toàn bộ. Test cũ `trang chủ và trang sản phẩm dựng tab từ CMS` vẫn qua vì `app.js` còn chuỗi `product-categories?sort=sort_order:asc` và `renderCategoryTabs(tabsContainer`.

- [ ] **Step 7: Commit**

```bash
git add app.js *.html tests/prerender-site-settings.test.js tests/hardcoded-content.test.js
git commit -m "feat: app.js dựng danh mục từ CMS và giữ bản prerender khi CMS lỗi"
```

---

### Task 6: Kiểm tra toàn bộ

**Files:** không sửa file nào, trừ khi phát hiện lỗi.

- [ ] **Step 1: Chạy toàn bộ test**

Run: `npm test`
Expected: PASS toàn bộ, không test nào bị bỏ qua.

- [ ] **Step 2: Chạy thử prerender trên bản sao HTML**

```bash
TMP=$(mktemp -d) && cp *.html "$TMP" && node -e '
const { prerenderDirectory } = require("./scripts/prerender-site-settings.js");
prerenderDirectory(process.argv[1], {
  loadSettings: async () => ({ hotline: "0912345678", hotline_box_title: "GỌI KỸ SƯ", hotline_box_note: "Dòng một\nDòng hai" }),
  loadCategories: async () => [{ slug: "quang-dong", name: "Quặng Đồng", visible: true }],
}).then((r) => console.log(r));
' "$TMP" && grep -c 'filter=quang-dong' "$TMP"/*.html && rm -rf "$TMP"
```

Expected: `changed` bằng 9 (`preview.html` không có vùng nào để ghi nên giữ nguyên); mỗi trang công khai có ít nhất 1 dòng `filter=quang-dong`; `preview.html` là 0.

- [ ] **Step 3: Thử trên trình duyệt**

Chạy `./start.sh` (Strapi cổng 1337, website cổng 3000). Trong admin → Danh mục sản phẩm, thêm danh mục "Thử Nghiệm" (mã `thu-nghiem`) và gán cho một sản phẩm; trong Cài đặt website, sửa "Mô tả khung hotline" thành hai dòng. Mở `http://localhost:3000`, rồi kiểm:
- Khối bên hông trang chủ, chân trang trang chủ, chân trang `/contact`, `/news`, `/product-detail?id=<uid>` đều có "Thử Nghiệm".
- Bấm "Thử Nghiệm" → `/products?filter=thu-nghiem` hiện đúng sản phẩm đã gán, tab "Thử Nghiệm" đang chọn.
- Khung hotline hiện đúng hai dòng vừa sửa.
- Nút "← Quay Lại Danh Mục" ở trang chi tiết dẫn đúng danh mục của sản phẩm.
- Tắt Strapi rồi tải lại trang chủ: danh sách danh mục không biến mất, không hiện lỗi.

Xoá danh mục "Thử Nghiệm" sau khi kiểm.

- [ ] **Step 4: Ghi nhận kết quả**

Nếu bước 1–3 đều đạt, không cần commit thêm. Nếu phải sửa, commit bản sửa kèm test tái hiện lỗi, rồi chạy lại `npm test`.
