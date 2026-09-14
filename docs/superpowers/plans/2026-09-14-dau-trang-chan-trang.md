# Đợt 2 — Đầu trang và chân trang dùng chung: kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chín trang công khai dùng chung một đầu trang và một chân trang; cột liên kết, tiêu đề cột, dòng bản quyền, nút đầu trang sửa trong Cài đặt website; menu đầu trang được ghi sẵn vào HTML; `deploy.sh` ghi HTML sau khi Strapi đã lên.

**Architecture:** Dữ liệu mới nằm trong single type `site-setting` (thêm 6 trường, trong đó `footer_links` là JSON). `scripts/prerender-site-settings.js` đọc thêm `/api/navigation` và ghi menu, liên kết chân trang, bản quyền, link nút đầu trang vào HTML; `app.js` áp cùng dữ liệu trong `renderSiteSettings()` (đi chung bộ nhớ đệm `localStorage` sẵn có). Admin có kiểu ô mới `link-list`.

**Tech Stack:** HTML tĩnh + `app.js` thuần, Strapi 5 (`dha-cms/`), admin React (`admin/`), bash (`deploy/deploy.sh`), test `node --test` + `jsdom`.

**Spec:** `docs/superpowers/specs/2026-09-14-dau-trang-chan-trang-design.md`

## Global Constraints

- Trường mới của `site-setting` (tên, kiểu, tối đa, mặc định):
  `header_cta_label` string 40 `Yêu Cầu Mẫu`; `header_cta_url` string 300 `/contact`; `footer_categories_title` string 60 `DANH MỤC SẢN PHẨM`; `footer_links_title` string 60 `HỖ TRỢ KHÁCH HÀNG`; `footer_links` json (không default); `copyright_text` string 200 `Kim Loại Màu DHA. Bản quyền được bảo lưu.`
- 5 liên kết chân trang mặc định, đúng thứ tự: Dự Tính Giá Đơn Hàng `/estimator`; Đơn Giá Phân Tích `/pricing`; Tin Tức Thị Trường `/news`; Quy Trình Giao Nhận `/#workflow`; Liên Hệ Báo Giá `/contact`.
- Quy tắc URL (giống `safeNavUrl()` trong `app.js`): nhận `/...`, `#...`, `http(s)://...`; mọi thứ khác bỏ.
- Liên kết chân trang: bỏ mục `visible === false`, thiếu `label`, URL sai quy tắc; không còn mục nào thì giữ HTML. Mẫu: `<li><a href="URL">CHỮ</a></li>`.
- Bản quyền: `© <năm hiện tại> <copyright_text>`; trường trống thì giữ HTML.
- Mọi ô bỏ trống thì giữ chữ sẵn có trong HTML — không xoá trắng.
- `app.js` và prerender phải cho ra cùng một DOM cho mọi vùng đã nối CMS (lệch là chớp).
- Nhãn giao diện giữ trong code: "📞", "Hotline:", "Email:", "Tìm", placeholder ô tìm kiếm, tên mạng xã hội.
- Chữ trong code, comment, thông báo test viết tiếng Việt có dấu, theo giọng văn sẵn có; `app.js` thụt lề 4 dấu cách, file khác 2.
- Mọi lệnh chạy từ gốc worktree; `npm test` chạy toàn bộ test.

## Bản đồ file

| File | Việc |
|---|---|
| `deploy/deploy.sh` | Chuyển prerender xuống sau khối Strapi, thêm vòng đợi |
| `tests/deploy.test.js` (mới) | Test thứ tự và cú pháp `deploy.sh` |
| `dha-cms/src/api/site-setting/content-types/site-setting/schema.json` | 6 trường mới |
| `dha-cms/src/api/admin-ui/services/resource-config.js` | Cho ghi 6 trường mới |
| `admin/src/config/resources.js` | 6 ô nhập mới |
| `admin/src/components/FieldRenderer.jsx`, `admin/src/styles.css` | Kiểu ô `link-list` |
| `scripts/prerender-site-settings.js` | Menu, liên kết chân trang, bản quyền, link nút đầu trang; ba nguồn độc lập |
| `dha-cms/src/api/navigation/content-types/navigation/lifecycles.js` (mới) | Lưu menu → prerender |
| 9 file HTML công khai | Thanh trên cùng, nút đầu trang, chân trang dùng chung |
| `app.js` | `renderFooterLinks()`, `applySiteChrome()` |
| `tests/hardcoded-content.test.js`, `tests/prerender-site-settings.test.js`, `tests/navigation.test.js`, `tests/admin-fields-ui.test.js` | Test |
| `package.json` | Thêm `tests/deploy.test.js` vào `npm test` |

---

### Task 1: `deploy.sh` ghi HTML sau khi Strapi đã lên

**Files:**
- Create: `tests/deploy.test.js`
- Modify: `package.json` (script `test`), `deploy/deploy.sh:57-63` và sau khối `if ... '^dha-cms/'` (~dòng 99)

**Interfaces:** không có — task độc lập.

- [ ] **Step 1: Viết test hỏng**

Tạo `tests/deploy.test.js`:

```js
// deploy.sh chạy trên VPS nên không thử thật được ở đây; test giữ đúng thứ tự
// các bước và cú pháp bash.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const SCRIPT = path.join(root, 'deploy/deploy.sh');
const source = fs.readFileSync(SCRIPT, 'utf8');

test('deploy.sh đúng cú pháp bash', () => {
  execFileSync('bash', ['-n', SCRIPT]);
});

test('prerender chạy sau khi Strapi được build và khởi động lại', () => {
  const restart = source.indexOf('pm2 restart dha-cms');
  const prerender = source.indexOf('scripts/prerender-site-settings.js');
  assert.ok(restart > 0, 'có bước khởi động lại Strapi');
  assert.ok(prerender > restart, 'prerender phải đứng sau bước khởi động lại Strapi');
  assert.equal(source.match(/scripts\/prerender-site-settings\.js/g).length, 1, 'chỉ chạy prerender một lần');
});

test('prerender đợi Strapi trả lời trước khi đọc', () => {
  const between = source.slice(source.indexOf('pm2 restart dha-cms'), source.indexOf('scripts/prerender-site-settings.js'));
  assert.match(between, /for _ in \$\(seq 1 30\)/);
  assert.match(between, /curl -sf -o \/dev\/null http:\/\/127\.0\.0\.1:1337\/api\/site-setting/);
  assert.match(between, /sleep 2/);
  assert.match(source, /Strapi chưa trả lời sau 60 giây/);
});
```

Trong `package.json`, thêm ` tests/deploy.test.js` vào cuối chuỗi script `test`.

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test tests/deploy.test.js`
Expected: FAIL — `prerender phải đứng sau bước khởi động lại Strapi` và test vòng đợi (không có `seq 1 30`).

- [ ] **Step 3: Chuyển bước prerender**

Trong `deploy/deploy.sh`, xoá khối sau (4 dòng comment + `echo` + lệnh `node` 2 dòng, ~dòng 57-63):

```bash
# HTML trong repo chứa nội dung mẫu (hotline, địa chỉ, câu chữ), nội dung thật
# nằm trong CMS. Không ghi sẵn vào HTML thì khách vào lần đầu thấy nội dung mẫu
# chớp qua trước khi app.js kịp thay. Ghi thẳng vào thư mục nginx phục vụ, không
# ghi vào repo — hệt như sitemap ở trên.
echo "▸ Ghi cài đặt website và danh mục từ CMS vào HTML tĩnh..."
node /var/www/web-ha-can/scripts/prerender-site-settings.js /var/www/dhakimloaimau.vn \
    || echo "⚠️  Không ghi được cài đặt vào HTML — trang vẫn tự áp bằng JS như trước."
```

Rồi chèn ngay sau dòng `fi` đóng khối `if git diff --name-only "$BEFORE" "$AFTER" | grep -q '^dha-cms/'; then` (dòng `fi` nằm ngay sau `echo "▸ CMS không đổi → bỏ qua build Strapi (deploy nhanh)."`), trước comment `# Cảnh báo nếu nginx config thay đổi`:

```bash

# Prerender đọc Strapi qua localhost nên phải chạy sau khi Strapi (có thể vừa
# build lại ở trên) đã lên hẳn — chạy sớm hơn thì trường mới của lần deploy này
# chưa có trong API. HTML trong repo chứa nội dung mẫu, nội dung thật nằm trong
# CMS; không ghi sẵn thì khách vào lần đầu thấy nội dung mẫu chớp qua. Ghi thẳng
# vào thư mục nginx phục vụ, không ghi vào repo — hệt như sitemap.
echo "▸ Đợi Strapi sẵn sàng..."
STRAPI_READY=0
for _ in $(seq 1 30); do
    if curl -sf -o /dev/null http://127.0.0.1:1337/api/site-setting; then
        STRAPI_READY=1
        break
    fi
    sleep 2
done
if [ "$STRAPI_READY" = 1 ]; then
    echo "▸ Ghi cài đặt website, danh mục và menu từ CMS vào HTML tĩnh..."
    node /var/www/web-ha-can/scripts/prerender-site-settings.js /var/www/dhakimloaimau.vn \
        || echo "⚠️  Không ghi được cài đặt vào HTML — trang vẫn tự áp bằng JS như trước."
else
    echo "⚠️  Strapi chưa trả lời sau 60 giây — bỏ qua prerender, HTML giữ bản cũ."
fi
```

Ghi chú: toàn bộ khối này nằm trong heredoc `<< 'REMOTE'` có dấu nháy, nên `$(seq ...)` và `$STRAPI_READY` được tính trên máy chủ — đúng ý.

- [ ] **Step 4: Chạy test, xác nhận qua**

Run: `node --test tests/deploy.test.js`
Expected: PASS 3/3.

- [ ] **Step 5: Commit**

```bash
git add tests/deploy.test.js package.json deploy/deploy.sh
git commit -m "fix: deploy ghi HTML sau khi Strapi đã khởi động lại"
```

---

### Task 2: Trường mới trong Cài đặt website và ô "Liên kết chân trang"

**Files:**
- Modify: `dha-cms/src/api/site-setting/content-types/site-setting/schema.json` (trước `"admin_labels"`)
- Modify: `dha-cms/src/api/admin-ui/services/resource-config.js` (khối `'site-setting'`)
- Modify: `admin/src/config/resources.js` (khối `'site-setting'`)
- Modify: `admin/src/components/FieldRenderer.jsx` (switch `renderInput` + component mới sau `TextListField`)
- Modify: `admin/src/styles.css` (sau khối `.text-list-row`)
- Test: `tests/hardcoded-content.test.js`, `tests/admin-fields-ui.test.js`

**Interfaces:**
- Produces: khoá `header_cta_label`, `header_cta_url`, `footer_categories_title`, `footer_links_title`, `footer_links` (mảng `{label, url, visible}`), `copyright_text` trong dữ liệu `site-setting`; kiểu ô `link-list` với lớp CSS `.link-list`, `.link-list-row`, `.link-list-warning`.

- [ ] **Step 1: Viết test hỏng**

Thêm vào cuối `tests/hardcoded-content.test.js`:

```js
// Đợt 2: trường đầu trang/chân trang trong Cài đặt website.
const CHROME_FIELDS = {
  header_cta_label: ['string', 40, 'Yêu Cầu Mẫu'],
  header_cta_url: ['string', 300, '/contact'],
  footer_categories_title: ['string', 60, 'DANH MỤC SẢN PHẨM'],
  footer_links_title: ['string', 60, 'HỖ TRỢ KHÁCH HÀNG'],
  copyright_text: ['string', 200, 'Kim Loại Màu DHA. Bản quyền được bảo lưu.'],
};

test('Cài đặt website có các trường đầu trang/chân trang và admin sửa được', () => {
  const schema = JSON.parse(read('dha-cms/src/api/site-setting/content-types/site-setting/schema.json'));
  for (const [name, [type, maxLength, fallback]] of Object.entries(CHROME_FIELDS)) {
    const attribute = schema.attributes[name];
    assert.ok(attribute, `schema thiếu ${name}`);
    assert.equal(attribute.type, type, `${name} sai kiểu`);
    assert.equal(attribute.maxLength, maxLength, `${name} sai độ dài tối đa`);
    assert.equal(attribute.default, fallback, `${name} sai mặc định`);
  }
  assert.equal(schema.attributes.footer_links.type, 'json');

  const config = getResourceConfig('site-setting');
  for (const name of [...Object.keys(CHROME_FIELDS), 'footer_links']) {
    assert.ok(config.editableFields.includes(name), `CMS chưa cho ghi ${name}`);
    assert.ok(config.fields[name], `CMS thiếu khai báo ${name}`);
  }

  const adminConfig = read('admin/src/config/resources.js');
  for (const name of Object.keys(CHROME_FIELDS)) {
    assert.match(adminConfig, new RegExp(`${name}: \\{ label: '`), `admin thiếu ô ${name}`);
  }
  assert.match(adminConfig, /footer_links: \{ label: 'Liên kết chân trang', type: 'link-list'/);
  assert.match(read('admin/src/components/FieldRenderer.jsx'), /case 'link-list':/);
});
```

Thêm vào cuối `tests/admin-fields-ui.test.js`:

```js
test('liên kết chân trang: thêm, gõ, đổi thứ tự, ẩn và xoá được', options, async () => {
  const { view, state } = await renderField({
    name: 'footer_links',
    field: { label: 'Liên kết chân trang', type: 'link-list' },
    value: [{ label: 'Tin Tức', url: '/news', visible: true }],
  });

  await view.click(view.byText('button', 'Thêm liên kết'));
  assert.equal(view.all('.link-list-row').length, 2, 'thêm được dòng mới');
  const [labelInput, urlInput] = view.all('.link-list-row')[1].querySelectorAll('input[type="text"]');
  await view.type(labelInput, 'Liên Hệ');
  await view.type(urlInput, '/contact');
  assert.deepEqual(state.value, [
    { label: 'Tin Tức', url: '/news', visible: true },
    { label: 'Liên Hệ', url: '/contact', visible: true },
  ]);

  await view.click(view.all('.link-list-row')[1].querySelector('button[aria-label="Đưa lên"]'));
  assert.deepEqual(state.value.map((item) => item.label), ['Liên Hệ', 'Tin Tức']);

  await view.check(view.all('.link-list-row')[0].querySelector('input[type="checkbox"]'), false);
  assert.equal(state.value[0].visible, false, 'tắt được công tắc hiện');

  await view.click(view.byText('.link-list-row button', 'Xóa'));
  assert.deepEqual(state.value.map((item) => item.label), ['Tin Tức'], 'xoá đúng dòng đầu');
  view.unmount();
});

test('liên kết chân trang: đường dẫn sai quy tắc hiện cảnh báo, dữ liệu hỏng không làm vỡ màn hình', options, async () => {
  const { view } = await renderField({
    name: 'footer_links',
    field: { label: 'Liên kết chân trang', type: 'link-list' },
    value: [{ label: 'Độc', url: 'javascript:alert(1)', visible: true }],
  });
  assert.match(view.one('.link-list-warning').textContent, /bắt đầu bằng/);
  view.unmount();

  for (const value of [null, 'chuoi', 42, {}, ['chu']]) {
    const { view: broken } = await renderField({
      name: 'footer_links',
      field: { label: 'Liên kết chân trang', type: 'link-list' },
      value,
    });
    assert.ok(broken.one('.link-list'), `value ${JSON.stringify(value)} vẫn dựng được danh sách`);
    broken.unmount();
  }
});
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Worktree có thể chưa cài thư viện admin — khi đó test UI bị bỏ qua với lý do "cần chạy npm run admin:install trước". Chạy `npm run admin:install` một lần (cài vào `admin/node_modules`, đã bị git bỏ qua), rồi:

Run: `node --test tests/hardcoded-content.test.js tests/admin-fields-ui.test.js`
Expected: FAIL — `schema thiếu header_cta_label`; hai test `liên kết chân trang` hỏng vì kiểu `link-list` chưa có (không có `.link-list-row` / `.link-list`).

- [ ] **Step 3: Thêm trường vào schema**

Trong `schema.json`, chèn ngay trước dòng `    "admin_labels": {`:

```json
    "header_cta_label": {
      "type": "string",
      "maxLength": 40,
      "default": "Yêu Cầu Mẫu"
    },
    "header_cta_url": {
      "type": "string",
      "maxLength": 300,
      "default": "/contact"
    },
    "footer_categories_title": {
      "type": "string",
      "maxLength": 60,
      "default": "DANH MỤC SẢN PHẨM"
    },
    "footer_links_title": {
      "type": "string",
      "maxLength": 60,
      "default": "HỖ TRỢ KHÁCH HÀNG"
    },
    "footer_links": {
      "type": "json"
    },
    "copyright_text": {
      "type": "string",
      "maxLength": 200,
      "default": "Kim Loại Màu DHA. Bản quyền được bảo lưu."
    },
```

- [ ] **Step 4: Cho phép ghi ở phía CMS**

Trong `resource-config.js`, khối `'site-setting'`:
- Trong `editableFields`, chèn trước `'admin_labels',`:

```js
      'header_cta_label',
      'header_cta_url',
      'footer_categories_title',
      'footer_links_title',
      'footer_links',
      'copyright_text',
```

- Trong `fields`, chèn trước `admin_labels: { label: 'Nhãn form quản trị', type: 'json' },`:

```js
      header_cta_label: { label: 'Chữ nút đầu trang', type: 'text', maxLength: 40, default: 'Yêu Cầu Mẫu' },
      header_cta_url: { label: 'Link nút đầu trang', type: 'text', maxLength: 300, default: '/contact' },
      footer_categories_title: { label: 'Tiêu đề cột danh mục (chân trang)', type: 'text', maxLength: 60, default: 'DANH MỤC SẢN PHẨM' },
      footer_links_title: { label: 'Tiêu đề cột liên kết (chân trang)', type: 'text', maxLength: 60, default: 'HỖ TRỢ KHÁCH HÀNG' },
      footer_links: { label: 'Liên kết chân trang', type: 'json' },
      copyright_text: { label: 'Dòng bản quyền', type: 'text', maxLength: 200, default: 'Kim Loại Màu DHA. Bản quyền được bảo lưu.' },
```

- [ ] **Step 5: Thêm ô nhập trong admin**

Trong `admin/src/config/resources.js`, khối `'site-setting'`, chèn trước `admin_labels: { label: 'Nhãn form quản trị', type: 'hidden' },`:

```js
      header_cta_label: { label: 'Chữ nút đầu trang', type: 'text', placeholder: 'Yêu Cầu Mẫu', hint: 'Nút nổi bật góc phải đầu trang, trên mọi trang. Bỏ trống thì website giữ chữ "Yêu Cầu Mẫu".' },
      header_cta_url: { label: 'Link nút đầu trang', type: 'text', placeholder: '/contact', hint: 'Bắt đầu bằng "/" (trang trong website), "#" hoặc "https://". Bỏ trống hoặc sai quy tắc thì nút vẫn dẫn tới /contact.' },
      footer_categories_title: { label: 'Tiêu đề cột danh mục (chân trang)', type: 'text', placeholder: 'DANH MỤC SẢN PHẨM', hint: 'Bỏ trống thì giữ "DANH MỤC SẢN PHẨM". Các dòng trong cột lấy từ trang Danh mục sản phẩm.' },
      footer_links_title: { label: 'Tiêu đề cột liên kết (chân trang)', type: 'text', placeholder: 'HỖ TRỢ KHÁCH HÀNG', hint: 'Bỏ trống thì giữ "HỖ TRỢ KHÁCH HÀNG".' },
      footer_links: { label: 'Liên kết chân trang', type: 'link-list', hint: 'Các link trong cột liên kết ở chân trang mọi trang. Không còn link nào đang hiện thì website giữ 5 link mặc định.' },
      copyright_text: { label: 'Dòng bản quyền', type: 'text', placeholder: 'Kim Loại Màu DHA. Bản quyền được bảo lưu.', hint: 'Website tự thêm "© <năm hiện tại>" đằng trước. Bỏ trống thì giữ dòng mặc định.' },
```

- [ ] **Step 6: Kiểu ô `link-list`**

Trong `admin/src/components/FieldRenderer.jsx`, trong `switch (field.type)` của `renderInput`, chèn ngay sau `case 'text-list': ... ;`:

```jsx
    case 'link-list':
      return <LinkListField id={id} value={value} onChange={onChange} />;
```

Chèn ngay sau hàm `TextListField` (trước comment `// Ô tick nhiều lựa chọn`):

```jsx
// Cùng quy tắc với menu (dha-cms/src/api/admin-ui/services/navigation.js) và
// safeNavUrl() trên website: đường dẫn nội bộ, neo trong trang, hoặc http(s).
function linkUrlWarning(item) {
  const url = String(item.url || '').trim();
  if (!url) {
    return String(item.label || '').trim() ? 'Chưa có đường dẫn — liên kết này sẽ không hiện trên website.' : '';
  }
  if (url.startsWith('/') || url.startsWith('#') || /^https?:\/\/\S+$/i.test(url)) return '';
  return 'Đường dẫn phải bắt đầu bằng "/", "#" hoặc "http(s)://" — liên kết này sẽ không hiện trên website.';
}

// Danh sách liên kết { label, url, visible } — dùng cho cột liên kết ở chân trang.
// Dòng không phải object (dữ liệu cũ hỏng) bị bỏ qua thay vì làm vỡ màn hình.
function LinkListField({ id, value, onChange }) {
  const items = Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) : [];

  function updateItem(index, patch) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function moveItem(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([...items, { label: '', url: '', visible: true }]);
  }

  return (
    <div className="link-list" id={id}>
      {items.map((item, index) => {
        const warning = linkUrlWarning(item);
        return (
          <div className="link-list-row" key={index}>
            <input
              type="text"
              aria-label="Chữ hiển thị"
              placeholder="Chữ hiển thị"
              value={item.label || ''}
              onChange={(event) => updateItem(index, { label: event.target.value })}
            />
            <input
              type="text"
              aria-label="Đường dẫn"
              placeholder="/trang hoặc https://..."
              value={item.url || ''}
              onChange={(event) => updateItem(index, { url: event.target.value })}
            />
            <label className="link-list-visible">
              <input
                type="checkbox"
                checked={item.visible !== false}
                onChange={(event) => updateItem(index, { visible: event.target.checked })}
              />
              Hiện
            </label>
            <button type="button" className="btn-secondary" aria-label="Đưa lên" disabled={index === 0} onClick={() => moveItem(index, -1)}>
              ↑
            </button>
            <button
              type="button"
              className="btn-secondary"
              aria-label="Đưa xuống"
              disabled={index === items.length - 1}
              onClick={() => moveItem(index, 1)}
            >
              ↓
            </button>
            <button type="button" className="btn-secondary" onClick={() => removeItem(index)}>
              Xóa
            </button>
            {warning ? <p className="field-hint link-list-warning">{warning}</p> : null}
          </div>
        );
      })}
      <button type="button" className="btn-secondary" onClick={addItem}>
        + Thêm liên kết
      </button>
    </div>
  );
}
```

Trong `admin/src/styles.css`, chèn ngay sau khối `.text-list-row { ... }`:

```css
.link-list {
  display: grid;
  gap: 8px;
}

.link-list-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto auto auto auto;
  gap: 8px;
  align-items: center;
}

.link-list-visible {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.link-list-warning {
  grid-column: 1 / -1;
  margin: 0;
  color: #b45309;
}

@media (max-width: 640px) {
  .link-list-row {
    grid-template-columns: 1fr 1fr;
  }
}
```

- [ ] **Step 7: Chạy test, xác nhận qua**

Run: `node --test tests/hardcoded-content.test.js tests/admin-fields-ui.test.js tests/admin-resource-fields.test.js`
Expected: PASS toàn bộ, không test nào bị bỏ qua.

- [ ] **Step 8: Commit**

```bash
git add dha-cms/src/api/site-setting/content-types/site-setting/schema.json dha-cms/src/api/admin-ui/services/resource-config.js admin/src/config/resources.js admin/src/components/FieldRenderer.jsx admin/src/styles.css tests/hardcoded-content.test.js tests/admin-fields-ui.test.js
git commit -m "feat: Cài đặt website có trường đầu trang, chân trang và ô liên kết"
```

---

### Task 3: Prerender ghi menu, liên kết chân trang, bản quyền và nút đầu trang

**Files:**
- Modify: `scripts/prerender-site-settings.js`
- Test: `tests/prerender-site-settings.test.js`

**Interfaces:**
- Consumes: `transformHtml`, `escapeText`, `escapeAttr`, `setAttr`, `text`, `classList`, `applyCategoriesToHtml`, `fetchSettings`, `fetchCategories` sẵn có.
- Produces (export thêm):
  - `safeUrl(value): string` — `''` nếu sai quy tắc
  - `renderFooterLinks(items): string` — `''` nếu không còn mục dùng được
  - `renderNavigation(items, currentPath): string` — `''` nếu không còn mục dùng được
  - `applyNavigationToHtml(html, items, currentPath): string`
  - `pagePathForFile(file): string` — `index.html` → `/`, `x.html` → `/x`
  - `applySettingsToHtml(html, settings, { year } = {})` — thêm tham số `year` (mặc định năm hiện tại)
  - `prerenderDirectory(target, { loadSettings, loadCategories, loadNavigation, log })` → `{ changed, total, settings, categories, navigation }`

- [ ] **Step 1: Viết test hỏng**

Trong `tests/prerender-site-settings.test.js`, thay khối require script (từ `const {` tới `} = require('../scripts/prerender-site-settings.js');`) bằng:

```js
const {
  applySettingsToHtml,
  applyCategoriesToHtml,
  applyNavigationToHtml,
  renderCategoryLinks,
  renderFooterLinks,
  pickVisibleCategories,
  pagePathForFile,
  prerenderDirectory,
  DEFAULT_CATEGORIES,
} = require('../scripts/prerender-site-settings.js');
```

Ngay sau hằng `CATEGORIES`, thêm:

```js
// Có menu con, một mục ẩn, một mục con ẩn và một URL độc hại.
const NAV_ITEMS = [
  { id: 'home', label: 'Trang Chủ', url: '/', visible: true, children: [] },
  {
    id: 'products',
    label: 'Sản Phẩm',
    url: '/products',
    visible: true,
    children: [
      { id: 'mau', label: 'Quặng <Mẫu>', url: '/products?filter=color-metal', visible: true },
      { id: 'an', label: 'Ẩn', url: '/an', visible: false },
    ],
  },
  { id: 'news', label: 'Tin Tức', url: '/news', visible: true, children: [] },
  { id: 'evil', label: 'Độc', url: 'javascript:alert(1)', visible: true, children: [] },
  { id: 'off', label: 'Tắt', url: '/off', visible: false, children: [] },
];
```

Trong test `đọc danh mục lỗi thì vẫn ghi cài đặt, và ngược lại`, thêm `loadNavigation: fail,` vào cả ba lời gọi `prerenderDirectory(...)` (để test không chạm mạng thật).

Thêm vào cuối file:

```js
const NAV_HTML = '<nav class="main-navigation"><ul class="nav-links"><li><a href="/" class="nav-link active">Cũ</a></li></ul></nav>';

function navDoc(items, currentPath) {
  return new JSDOM(applyNavigationToHtml(NAV_HTML, items, currentPath)).window.document;
}

test('menu được ghi sẵn: bỏ mục ẩn và URL độc hại, giữ menu con', () => {
  const doc = navDoc(NAV_ITEMS, '/news');
  const top = [...doc.querySelectorAll('.nav-links > li > a.nav-link')].map((a) => [a.textContent, a.getAttribute('href')]);
  assert.deepEqual(top, [['Trang Chủ', '/'], ['Sản Phẩm', '/products'], ['Tin Tức', '/news']]);

  const sub = [...doc.querySelectorAll('.nav-submenu a')];
  assert.equal(sub.length, 1, 'mục con ẩn bị bỏ');
  assert.equal(sub[0].textContent, 'Quặng <Mẫu>');
  assert.ok(sub[0].classList.contains('nav-sublink'));
  assert.equal(doc.querySelector('.has-submenu .nav-submenu-toggle').getAttribute('aria-label'), 'Mở menu con Sản Phẩm');
  assert.ok(!doc.body.innerHTML.includes('javascript:'), 'URL độc hại không lọt vào HTML');
});

test('menu đánh dấu đúng mục đang xem theo trang', () => {
  const active = (items, currentPath) =>
    [...navDoc(items, currentPath).querySelectorAll('.nav-link.active')].map((a) => a.getAttribute('href'));

  assert.deepEqual(active(NAV_ITEMS, '/'), ['/']);
  assert.deepEqual(active(NAV_ITEMS, '/news'), ['/news']);
  assert.deepEqual(active(NAV_ITEMS, '/products'), ['/products']);
  assert.deepEqual(active(NAV_ITEMS, '/contact'), [], 'không mục nào khớp thì không đánh dấu');

  const nested = [{ label: 'Giới Thiệu', url: '/#services', children: [{ label: 'Dự Án', url: '/projects' }] }];
  assert.deepEqual(active(nested, '/projects'), ['/#services', '/projects'], 'mục con khớp thì làm sáng cả mục cha');
});

test('menu rỗng hoặc toàn mục hỏng thì giữ nguyên HTML', () => {
  assert.equal(applyNavigationToHtml(NAV_HTML, [], '/'), NAV_HTML);
  assert.equal(applyNavigationToHtml(NAV_HTML, [{ label: 'Độc', url: 'javascript:1' }], '/'), NAV_HTML);
  assert.equal(applyNavigationToHtml(NAV_HTML, null, '/'), NAV_HTML);
});

test('đường dẫn trang suy từ tên file', () => {
  assert.equal(pagePathForFile('index.html'), '/');
  assert.equal(pagePathForFile('products.html'), '/products');
  assert.equal(pagePathForFile('news-detail.html'), '/news-detail');
});

const CHROME_HTML =
  '<header><a href="/contact" class="btn-contact" data-site-text="header_cta_label">Yêu Cầu Mẫu</a></header>'
  + '<footer><h4 data-site-text="footer_links_title">HỖ TRỢ</h4>'
  + '<ul class="footer-list" data-footer-links><li><a href="/cu">Cũ</a></li></ul>'
  + '<p class="copyright" data-copyright>&copy; 2026 Cũ</p></footer>';

test('liên kết chân trang, bản quyền và nút đầu trang lấy từ cài đặt', () => {
  const html = applySettingsToHtml(
    CHROME_HTML,
    {
      header_cta_label: 'Báo Giá Ngay',
      header_cta_url: '/pricing',
      footer_links_title: 'LIÊN KẾT',
      footer_links: [
        { label: 'Tin <Mới>', url: '/news', visible: true },
        { label: 'Ẩn', url: '/x', visible: false },
        { label: 'Độc', url: 'javascript:alert(1)', visible: true },
        { label: '', url: '/y' },
        { label: 'Ngoài', url: 'https://example.com/a?b=1&c=2', visible: true },
      ],
      copyright_text: 'Công ty <DHA>.',
    },
    { year: 2031 },
  );
  const doc = new JSDOM(html).window.document;

  const cta = doc.querySelector('.btn-contact');
  assert.equal(cta.textContent, 'Báo Giá Ngay');
  assert.equal(cta.getAttribute('href'), '/pricing');
  assert.equal(doc.querySelector('[data-site-text="footer_links_title"]').textContent, 'LIÊN KẾT');
  assert.deepEqual(
    [...doc.querySelectorAll('[data-footer-links] a')].map((a) => [a.textContent, a.getAttribute('href')]),
    [['Tin <Mới>', '/news'], ['Ngoài', 'https://example.com/a?b=1&c=2']],
  );
  assert.equal(doc.querySelector('[data-copyright]').textContent, '© 2031 Công ty <DHA>.');
  assert.ok(!html.includes('javascript:'), 'URL độc hại không lọt vào HTML');
});

test('cài đặt bỏ trống hoặc hỏng thì giữ nguyên chân trang và nút đầu trang', () => {
  const out = applySettingsToHtml(CHROME_HTML, {
    footer_links: [{ label: 'Ẩn', url: '/x', visible: false }],
    header_cta_url: 'javascript:alert(1)',
  });
  assert.equal(out, CHROME_HTML);
});

test('renderFooterLinks trả chuỗi rỗng khi dữ liệu không phải mảng', () => {
  for (const value of [null, undefined, 'chuoi', { label: 'A', url: '/a' }]) {
    assert.equal(renderFooterLinks(value), '');
  }
});

test('ghi menu theo từng trang trong thư mục', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prerender-nav-'));
  const quiet = { warn() {} };
  const fail = async () => {
    throw new Error('CMS trả về 500');
  };
  try {
    fs.writeFileSync(path.join(dir, 'index.html'), NAV_HTML);
    fs.writeFileSync(path.join(dir, 'news.html'), NAV_HTML);
    const result = await prerenderDirectory(dir, {
      loadSettings: fail,
      loadCategories: fail,
      loadNavigation: async () => NAV_ITEMS,
      log: quiet,
    });
    assert.equal(result.navigation, true);
    const activeIn = (file) =>
      [...new JSDOM(fs.readFileSync(path.join(dir, file), 'utf8')).window.document.querySelectorAll('.nav-link.active')]
        .map((a) => a.getAttribute('href'));
    assert.deepEqual(activeIn('index.html'), ['/']);
    assert.deepEqual(activeIn('news.html'), ['/news']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('cả ba nguồn cùng lỗi thì báo đủ ba lý do', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prerender-fail-'));
  const reason = (label) => async () => {
    throw new Error(`hỏng ${label}`);
  };
  try {
    await assert.rejects(
      prerenderDirectory(dir, {
        loadSettings: reason('A'),
        loadCategories: reason('B'),
        loadNavigation: reason('C'),
        log: { warn() {} },
      }),
      (err) => /cài đặt website: hỏng A/.test(err.message) && /danh mục: hỏng B/.test(err.message) && /menu: hỏng C/.test(err.message),
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test tests/prerender-site-settings.test.js`
Expected: FAIL — `applyNavigationToHtml is not a function` (và các export mới khác).

- [ ] **Step 3: Viết phần menu và chân trang trong script**

Ở comment đầu file, thay dòng `// Ghi cài đặt website và danh mục sản phẩm của CMS thẳng vào các file HTML tĩnh.` bằng `// Ghi cài đặt website, danh mục sản phẩm và menu của CMS thẳng vào các file HTML tĩnh.`

Chèn ngay trên hàm `applySettingsToHtml`:

```js
// Cùng quy tắc với safeNavUrl() trong app.js: chỉ nhận đường dẫn nội bộ, neo
// trong trang hoặc http(s) — chặn javascript:, data:... do CMS gửi xuống.
function safeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/') || raw.startsWith('#')) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  return '';
}

// Phải cho ra cùng một DOM với renderFooterLinks() trong app.js.
function renderFooterLinks(items) {
  if (!Array.isArray(items)) return '';
  return items
    .filter((item) => item && item.visible !== false && item.label && safeUrl(item.url))
    .map((item) => `<li><a href="${escapeAttr(safeUrl(item.url))}">${escapeText(item.label)}</a></li>`)
    .join('');
}
```

Đổi dòng khai báo hàm `function applySettingsToHtml(html, settings) {` thành:

```js
function applySettingsToHtml(html, settings, { year = new Date().getFullYear() } = {}) {
```

Trong mảng `handlers` của `applySettingsToHtml`, chèn ba handler ngay TRƯỚC handler cuối (`match: (tagName, attrs) => 'data-site-text' in attrs`) — nút đầu trang có cả `data-site-text` lẫn class `btn-contact`, mà mỗi phần tử chỉ được handler đầu tiên nhận, nên handler của nó phải đứng trước:

```js
    {
      // Nút đầu trang: chữ qua data-site-text, link qua header_cta_url. Một
      // handler lo cả hai vì mỗi phần tử chỉ được một handler nhận.
      match: byClass('btn-contact'),
      apply: ({ attrs, rawAttrs }) => {
        const label = 'data-site-text' in attrs ? text(settings, attrs['data-site-text']) : null;
        const url = safeUrl(settings.header_cta_url);
        if (!label && !url) return null;
        return {
          ...(label ? { inner: escapeText(label) } : {}),
          ...(url ? { rawAttrs: setAttr(rawAttrs, 'href', url) } : {}),
        };
      },
    },
    {
      match: (tagName, attrs) => 'data-footer-links' in attrs,
      apply: () => {
        const links = renderFooterLinks(settings.footer_links);
        return links ? { inner: links } : null;
      },
    },
    {
      match: (tagName, attrs) => 'data-copyright' in attrs,
      apply: () => {
        const value = text(settings, 'copyright_text');
        return value ? { inner: escapeText(`© ${year} ${value}`) } : null;
      },
    },
```

Chèn ngay sau hàm `applyCategoriesToHtml`:

```js
function normalizeNavPath(value) {
  return String(value || '').replace(/\.html$/, '').replace(/\/+$/, '') || '/';
}

// Trang phục vụ ở /x (nginx thử $uri.html), trang chủ ở /.
function pagePathForFile(file) {
  const name = path.basename(file, '.html');
  return name === 'index' ? '/' : `/${name}`;
}

// Cùng thang điểm với markActiveNavLink() trong app.js. Trang tĩnh không có
// #hash nên currentHash luôn rỗng.
function navScore(href, currentPath) {
  if (/^https?:\/\//i.test(href)) return 0;
  const [rawPath, rawHash] = href.split('#');
  const linkPath = rawPath ? normalizeNavPath(rawPath) : currentPath;
  const linkHash = rawHash ? `#${rawHash}` : '';
  if (linkPath === currentPath && !linkHash) return 3;
  if (linkPath !== '/' && currentPath.startsWith(`${linkPath}/`)) return 1;
  return 0;
}

const SUBMENU_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>';

// Phải cho ra cùng một DOM với renderNavItems() + markActiveNavLink() trong
// app.js: cùng mẫu thẻ, cùng cách lọc, cùng chọn mục đang xem (mục điểm cao
// nhất, hoà thì mục đứng trước; mục con khớp thì làm sáng cả mục cha).
function renderNavigation(items, currentPath) {
  if (!Array.isArray(items)) return '';
  const usable = (item) => item && item.visible !== false && item.label && safeUrl(item.url);
  const entries = items.filter(usable).map((item) => ({
    item,
    children: (Array.isArray(item.children) ? item.children : []).filter(usable),
  }));
  if (!entries.length) return '';

  let best = null;
  let bestScore = 0;
  entries.forEach((entry, entryIndex) => {
    [entry.item, ...entry.children].forEach((link, position) => {
      const score = navScore(safeUrl(link.url), currentPath);
      if (score > bestScore) {
        best = { entryIndex, childIndex: position - 1 };
        bestScore = score;
      }
    });
  });

  return entries
    .map(({ item, children }, entryIndex) => {
      const topActive = best && best.entryIndex === entryIndex;
      const link = `<a href="${escapeAttr(safeUrl(item.url))}" class="nav-link${topActive ? ' active' : ''}">${escapeText(item.label)}</a>`;
      if (!children.length) return `<li>${link}</li>`;

      const submenu = children
        .map((child, childIndex) => {
          const childActive = topActive && best.childIndex === childIndex;
          return `<li><a href="${escapeAttr(safeUrl(child.url))}" class="nav-link nav-sublink${childActive ? ' active' : ''}">${escapeText(child.label)}</a></li>`;
        })
        .join('');

      return `<li class="has-submenu">${link}`
        + `<button type="button" class="nav-submenu-toggle" aria-expanded="false" aria-label="Mở menu con ${escapeAttr(item.label)}">`
        + `${SUBMENU_ICON}</button>`
        + `<ul class="nav-submenu">${submenu}</ul></li>`;
    })
    .join('');
}

function applyNavigationToHtml(html, items, currentPath) {
  const inner = renderNavigation(items, currentPath);
  if (!inner) return html;
  return transformHtml(html, [
    {
      match: (tagName, attrs) => tagName === 'ul' && classList(attrs).includes('nav-links'),
      apply: () => ({ inner }),
    },
  ]);
}

async function fetchNavigation() {
  const res = await fetch(`${CMS}/api/navigation`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`CMS trả về ${res.status} khi đọc menu`);
  const json = await res.json();
  const record = json.data?.attributes || json.data;
  const raw = record?.items;
  return Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
}
```

- [ ] **Step 4: Ba nguồn độc lập trong `prerenderDirectory`**

Thay toàn bộ hàm `prerenderDirectory` (kể cả comment ngay trên nó) bằng:

```js
const SOURCE_LABELS = ['cài đặt website', 'danh mục', 'menu'];

// Ba nguồn đọc độc lập: nguồn nào lỗi thì bỏ qua riêng phần đó, vì HTML ghi
// được phần nào đỡ chớp phần đó. Chỉ bỏ cuộc khi cả ba cùng lỗi — và khi đó báo
// đủ ba lý do, không nuốt mất lý do nào.
async function prerenderDirectory(
  target,
  {
    loadSettings = fetchSettings,
    loadCategories = fetchCategories,
    loadNavigation = fetchNavigation,
    log = console,
  } = {},
) {
  const results = await Promise.allSettled([loadSettings(), loadCategories(), loadNavigation()]);
  const [settings, categories, navigation] = results.map((result) => (result.status === 'fulfilled' ? result.value : null));
  const failures = results.map((result, index) =>
    result.status === 'rejected' ? `${SOURCE_LABELS[index]}: ${result.reason?.message || result.reason}` : null,
  );

  if (failures.every(Boolean)) throw new Error(`Không đọc được gì từ CMS — ${failures.join('; ')}`);
  failures.filter(Boolean).forEach((failure) => log.warn(`⚠️  Bỏ qua ${failure}`));

  const files = fs.readdirSync(target).filter((file) => file.endsWith('.html'));
  let changed = 0;
  for (const file of files) {
    const full = path.join(target, file);
    const html = fs.readFileSync(full, 'utf8');
    let out = html;
    if (settings) out = applySettingsToHtml(out, settings);
    if (categories) out = applyCategoriesToHtml(out, categories);
    if (navigation) out = applyNavigationToHtml(out, navigation, pagePathForFile(file));
    if (out !== html) {
      fs.writeFileSync(full, out, 'utf8');
      changed += 1;
    }
  }
  return {
    changed,
    total: files.length,
    settings: Boolean(settings),
    categories: Boolean(categories),
    navigation: Boolean(navigation),
  };
}
```

Trong `main()`, thay dòng tạo `parts` bằng:

```js
  const parts = [result.settings && 'cài đặt website', result.categories && 'danh mục', result.navigation && 'menu']
    .filter(Boolean)
    .join(' + ');
```

Thay `module.exports = { ... };` bằng:

```js
module.exports = {
  applySettingsToHtml,
  applyCategoriesToHtml,
  applyNavigationToHtml,
  renderCategoryLinks,
  renderFooterLinks,
  renderNavigation,
  pickVisibleCategories,
  pagePathForFile,
  prerenderDirectory,
  safeUrl,
  DEFAULT_CATEGORIES,
};
```

- [ ] **Step 5: Chạy test, xác nhận qua**

Run: `node --test tests/prerender-site-settings.test.js tests/site-setting-prerender.test.js`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add scripts/prerender-site-settings.js tests/prerender-site-settings.test.js
git commit -m "feat: prerender ghi menu, liên kết chân trang, bản quyền và nút đầu trang"
```

---

### Task 4: Lưu menu là ghi lại HTML ngay

**Files:**
- Create: `dha-cms/src/api/navigation/content-types/navigation/lifecycles.js`
- Test: `tests/navigation.test.js`

**Interfaces:**
- Consumes: `schedulePrerender()` từ `dha-cms/src/api/site-setting/prerender.js` (không tham số).

- [ ] **Step 1: Viết test hỏng**

Thêm vào cuối `tests/navigation.test.js`:

```js
test('lưu thanh menu thì ghi lại HTML tĩnh ngay', () => {
  const prerender = require('../dha-cms/src/api/site-setting/prerender');
  const original = prerender.schedulePrerender;
  let calls = 0;
  prerender.schedulePrerender = () => {
    calls += 1;
  };
  try {
    const lifecycles = require('../dha-cms/src/api/navigation/content-types/navigation/lifecycles');
    lifecycles.afterCreate();
    lifecycles.afterUpdate();
    assert.equal(calls, 2, 'tạo và sửa menu đều ghi lại HTML');
  } finally {
    prerender.schedulePrerender = original;
  }
});
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test tests/navigation.test.js`
Expected: FAIL — `Cannot find module '../dha-cms/src/api/navigation/content-types/navigation/lifecycles'`.

- [ ] **Step 3: Tạo lifecycle**

Tạo `dha-cms/src/api/navigation/content-types/navigation/lifecycles.js`:

```js
'use strict';

// Menu đầu trang được prerender ghi sẵn vào HTML tĩnh (xem
// scripts/prerender-site-settings.js). Lưu xong là ghi lại, không đợi deploy.
// Gọi qua đối tượng module (không destructure) để test thay được hàm này.
const prerender = require('../../../site-setting/prerender');

module.exports = {
  afterCreate() {
    prerender.schedulePrerender();
  },

  afterUpdate() {
    prerender.schedulePrerender();
  },
};
```

- [ ] **Step 4: Chạy test, xác nhận qua**

Run: `node --test tests/navigation.test.js tests/site-setting-prerender.test.js`
Expected: PASS toàn bộ.

- [ ] **Step 5: Commit**

```bash
git add dha-cms/src/api/navigation/content-types/navigation/lifecycles.js tests/navigation.test.js
git commit -m "feat: lưu thanh menu là ghi lại HTML tĩnh ngay"
```

---

### Task 5: Một đầu trang và một chân trang cho 9 trang

**Files:**
- Modify: `index.html` (thanh trên cùng, nút đầu trang, `<footer>`), rồi 8 trang còn lại qua script
- Test: `tests/hardcoded-content.test.js`

**Interfaces:**
- Produces: trong HTML — `.btn-contact[data-site-text="header_cta_label"]`, `h4[data-site-text="footer_categories_title"]`, `h4[data-site-text="footer_links_title"]`, `ul[data-footer-links]`, `p.copyright[data-copyright]`; bốn `a.social-link[aria-label]` (Facebook, YouTube, Twitter/X, Zalo) ở chân trang.

- [ ] **Step 1: Viết test hỏng**

Thêm vào cuối `tests/hardcoded-content.test.js`:

```js
// Đợt 2: đầu trang, menu và chân trang dùng chung cho 9 trang.
const CHROME_REGIONS = ['.top-header', 'header.site-header', 'nav.main-navigation', 'footer.footer'];

function chromeOf(file) {
  const doc = load(file);
  // Dấu "đang xem" của menu khác nhau theo trang là đúng — bỏ đi trước khi so.
  doc.querySelectorAll('nav.main-navigation .active').forEach((el) => el.classList.remove('active'));
  return CHROME_REGIONS.map((selector) => {
    const region = doc.querySelector(selector);
    assert.ok(region, `${file} thiếu ${selector}`);
    return region.outerHTML.replace(/\s+/g, ' ');
  });
}

test('9 trang dùng chung một đầu trang, menu và chân trang', () => {
  const reference = chromeOf('index.html');
  for (const file of PAGES) {
    chromeOf(file).forEach((html, index) => {
      assert.equal(html, reference[index], `${file}: ${CHROME_REGIONS[index]} lệch so với index.html`);
    });
  }
});

// Vùng đã nối CMS trong đầu trang/chân trang — chữ trong đó do admin quyết định.
const CHROME_CMS = [
  '.site-hotline', '.site-email', '.site-address', '.site-office-name', '.site-tax-code', '.site-brand-bio',
  '.logo-accent', '.logo-text', '[data-site-text]', '[data-category-list]', '[data-footer-links]',
  '[data-copyright]', 'ul.nav-links', 'a[aria-label]',
].join(', ');

// Nhãn giao diện được phép giữ trong code (nhóm 6 của lộ trình).
const CHROME_ALLOWED_TEXT = new Set(['📞', 'Hotline:', 'Email:', 'Tìm']);

test('đầu trang, menu và chân trang không còn chữ viết cứng ngoài nhãn giao diện', () => {
  for (const file of PAGES) {
    const doc = load(file);
    for (const selector of CHROME_REGIONS) {
      const region = doc.querySelector(selector);
      region.querySelectorAll(CHROME_CMS).forEach((el) => el.remove());
      const walker = doc.createTreeWalker(region, 4 /* SHOW_TEXT */);
      let node;
      while ((node = walker.nextNode())) {
        const value = node.textContent.trim();
        if (!value) continue;
        assert.ok(CHROME_ALLOWED_TEXT.has(value), `${file} ${selector}: "${value}" viết cứng`);
      }
    }
  }
});

test('chân trang mặc định: 5 liên kết đúng thứ tự, đủ 4 mạng xã hội, có email và bản quyền', () => {
  const footer = load('index.html').querySelector('footer.footer');
  assert.deepEqual(
    [...footer.querySelectorAll('[data-footer-links] a')].map((a) => [a.textContent, a.getAttribute('href')]),
    [
      ['Dự Tính Giá Đơn Hàng', '/estimator'],
      ['Đơn Giá Phân Tích', '/pricing'],
      ['Tin Tức Thị Trường', '/news'],
      ['Quy Trình Giao Nhận', '/#workflow'],
      ['Liên Hệ Báo Giá', '/contact'],
    ],
  );
  assert.deepEqual(
    [...footer.querySelectorAll('a.social-link')].map((a) => a.getAttribute('aria-label')),
    ['Facebook', 'YouTube', 'Twitter/X', 'Zalo'],
  );
  assert.ok(footer.querySelector('.site-email'), 'cột liên hệ có email');
  assert.equal(footer.querySelector('[data-site-text="footer_categories_title"]').textContent, 'DANH MỤC SẢN PHẨM');
  assert.equal(footer.querySelector('[data-site-text="footer_links_title"]').textContent, 'HỖ TRỢ KHÁCH HÀNG');
  assert.match(footer.querySelector('[data-copyright]').textContent, /^© \d{4} Kim Loại Màu DHA\. Bản quyền được bảo lưu\.$/);

  const cta = load('index.html').querySelector('.btn-contact');
  assert.equal(cta.dataset.siteText, 'header_cta_label');
  assert.equal(cta.textContent, 'Yêu Cầu Mẫu');
  assert.equal(cta.getAttribute('href'), '/contact');
});

test('không còn link /#about trỏ vào khu không tồn tại', () => {
  for (const file of PAGES) {
    assert.ok(!read(file).includes('/#about'), `${file} còn link /#about`);
  }
});
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test tests/hardcoded-content.test.js`
Expected: FAIL — `products.html: footer.footer lệch so với index.html`, chữ viết cứng như `"DANH MỤC SẢN PHẨM"`/`"Yêu Cầu Mẫu"`, thiếu `[data-footer-links]`, còn `/#about`.

- [ ] **Step 3: Sửa `index.html` thành bản chuẩn**

(a) Thanh trên cùng — thay dòng:

```html
                <span>📞 Hotline: <a href="tel:0867259078" class="site-hotline" id="btn-hotline">086.725.9078</a></span>
```

bằng:

```html
                <span><i>📞</i> Hotline: <a href="tel:0867259078" class="site-hotline" id="btn-hotline">086.725.9078</a></span>
```

(b) Nút đầu trang — thay `<a href="/contact" class="btn-contact">Yêu Cầu Mẫu</a>` bằng:

```html
<a href="/contact" class="btn-contact" data-site-text="header_cta_label">Yêu Cầu Mẫu</a>
```

(c) Chân trang — thay toàn bộ khối từ `    <footer class="footer">` tới `    </footer>` bằng (giữ nguyên thụt lề 4 dấu cách của thẻ `<footer>`):

```html
    <footer class="footer">
        <div class="footer-widgets">
            <div class="container">
                <div class="footer-grid">
                    <div class="footer-brand">
                        <a href="/" class="logo">
                            <span class="logo-accent">DHA</span><span class="logo-text text-white">MINERALS</span>
                        </a>
                        <p class="brand-bio site-brand-bio">
                            Công ty Cổ phần Kim Loại Màu DHA cung cấp mẫu quặng tiêu chuẩn phục vụ phân tích hóa học và khảo nghiệm luyện kim công nghiệp tại Việt Nam.
                        </p>
                        <div class="footer-socials">
                            <a href="https://facebook.com/kimloaimaudha" class="social-link" aria-label="Facebook" target="_blank" rel="noopener">
                                <svg fill="currentColor" viewBox="0 0 24 24"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/></svg>
                            </a>
                            <a href="https://youtube.com/@kimloaimaudha" class="social-link" aria-label="YouTube" target="_blank" rel="noopener">
                                <svg fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.163a3.003 3.003 0 00-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.507a3.003 3.003 0 00-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 002.11 2.11c1.87.507 9.388.507 9.388.507s7.518 0 9.388-.507a3.003 3.003 0 002.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                            </a>
                            <a href="https://x.com/kimloaimaudha" class="social-link" aria-label="Twitter/X" target="_blank" rel="noopener">
                                <svg fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                            </a>
                            <a href="https://zalo.me/0867259078" class="social-link" aria-label="Zalo" target="_blank" rel="noopener">
                                <svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
                            </a>
                        </div>
                    </div>

                    <div class="footer-links">
                        <h4 class="footer-title font-accent" data-site-text="footer_categories_title">DANH MỤC SẢN PHẨM</h4>
                        <ul class="footer-list" data-category-list>
                            <li><a href="/products?filter=color-metal">Kim Loại Màu</a></li>
                            <li><a href="/products?filter=black-metal">Kim Loại Đen</a></li>
                            <li><a href="/products?filter=rare-earth">Đất Hiếm</a></li>
                        </ul>
                    </div>

                    <div class="footer-links">
                        <h4 class="footer-title font-accent" data-site-text="footer_links_title">HỖ TRỢ KHÁCH HÀNG</h4>
                        <ul class="footer-list" data-footer-links>
                            <li><a href="/estimator">Dự Tính Giá Đơn Hàng</a></li>
                            <li><a href="/pricing">Đơn Giá Phân Tích</a></li>
                            <li><a href="/news">Tin Tức Thị Trường</a></li>
                            <li><a href="/#workflow">Quy Trình Giao Nhận</a></li>
                            <li><a href="/contact">Liên Hệ Báo Giá</a></li>
                        </ul>
                    </div>

                    <div class="footer-info">
                        <h4 class="footer-title font-accent site-office-name">VĂN PHÒNG HÀ NỘI</h4>
                        <p class="footer-info-text site-address">Số 42+44, ngõ 178, Phố Thái Hà, Phường Đống Đa, Thành Phố Hà Nội</p>
                        <p class="footer-info-text">Hotline: <a href="tel:0867259078" class="site-hotline hover-underline">086.725.9078</a></p>
                        <p class="footer-info-text">Email: <a href="mailto:daihoaian1256@gmail.com" class="site-email hover-underline">daihoaian1256@gmail.com</a></p>
                        <p class="footer-info-text site-tax-code">MST: 0109637580 do Sở KH&ĐT TP. Hà Nội cấp.</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="site-info">
            <div class="container">
                <p class="copyright" data-copyright>&copy; 2026 Kim Loại Màu DHA. Bản quyền được bảo lưu.</p>
            </div>
        </div>
    </footer>
```

Các path SVG ở trên là nguyên văn: Facebook và Zalo từ chân trang `index.html` hiện tại, YouTube và X từ chân trang `projects.html`. Bản chuẩn bỏ thuộc tính `xmlns` trên `<svg>` (trang chủ vốn không có) để 4 nút cùng một kiểu.

- [ ] **Step 4: Chép bản chuẩn sang 8 trang còn lại**

Chạy một lần từ gốc worktree. Script lấy thanh trên cùng, nút đầu trang và `<footer>` từ `index.html`, chép đè sang 8 trang; báo lỗi và dừng nếu trang nào không có đúng một khối:

```bash
node -e '
const fs = require("fs");
const PAGES = ["products", "projects", "estimator", "news", "news-detail", "product-detail", "pricing", "contact"];
const BLOCKS = [
  /    <div class="top-header">[\s\S]*?\n    <\/div>\n/,
  /<a href="\/contact" class="btn-contact"[^>]*>[^<]*<\/a>/,
  /    <footer class="footer">[\s\S]*?<\/footer>/,
];
const source = fs.readFileSync("index.html", "utf8");
const canonical = BLOCKS.map((re) => {
  const found = source.match(new RegExp(re.source, "g")) || [];
  if (found.length !== 1) throw new Error(`index.html có ${found.length} khối ${re}`);
  return found[0];
});
for (const page of PAGES) {
  const file = `${page}.html`;
  let html = fs.readFileSync(file, "utf8");
  BLOCKS.forEach((re, i) => {
    const found = html.match(new RegExp(re.source, "g")) || [];
    if (found.length !== 1) throw new Error(`${file} có ${found.length} khối ${re}`);
    html = html.replace(re, () => canonical[i]);
  });
  fs.writeFileSync(file, html);
  console.log(file, "ok");
}'
```

Expected: 8 dòng `<tên file> ok`.

- [ ] **Step 5: Chạy test, xác nhận qua**

Run: `node --test tests/hardcoded-content.test.js tests/prerender-site-settings.test.js tests/site-settings-dom.test.js tests/navigation.test.js`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add index.html products.html projects.html estimator.html news.html news-detail.html product-detail.html pricing.html contact.html tests/hardcoded-content.test.js
git commit -m "feat: 9 trang dùng chung một đầu trang và một chân trang"
```

---

### Task 6: `app.js` áp liên kết chân trang, bản quyền và link nút đầu trang

**Files:**
- Modify: `app.js` (`renderSiteSettings`, thêm hàm ngay sau `applySiteTexts`)
- Modify: 10 file `*.html` (chuỗi `?v=` của `app.js`)
- Test: `tests/prerender-site-settings.test.js`

**Interfaces:**
- Consumes: `safeNavUrl`, `escapeHtml`, `applySiteTexts`, `initNavigationMenu` sẵn có trong `app.js`; `applyNavigationToHtml`, `renderFooterLinks`, `pagePathForFile`, `NAV_ITEMS` (Task 3); HTML của Task 5.
- Produces (hàm toàn cục trong `app.js`): `renderFooterLinks(items): string`, `applySiteChrome(settings): void`.

- [ ] **Step 1: Viết test hỏng**

Trong `tests/prerender-site-settings.test.js`:

1. Thêm vào object `SETTINGS` (sau `hotline_box_note`):

```js
  header_cta_label: 'Báo Giá Ngay',
  header_cta_url: '/pricing',
  footer_categories_title: 'DANH MỤC',
  footer_links_title: 'LIÊN KẾT NHANH',
  footer_links: [
    { label: 'Tin Tức', url: '/news', visible: true },
    { label: 'A & "B"', url: '/contact?x=1&y=2', visible: true },
  ],
  copyright_text: 'Công ty DHA.',
```

2. Thêm vào cuối mảng `DYNAMIC_SELECTORS`: `'.nav-links', '[data-footer-links]', '[data-copyright]', '.btn-contact',`.

3. Thay hàm `runAppJs` bằng bản nhận thêm URL trang và menu:

```js
function runAppJs(html, settings, categories = null, { url = 'https://dhakimloaimau.vn/', navigation = null } = {}) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url,
    virtualConsole: new VirtualConsole(),
  });
  const { window } = dom;
  window.fetch = (input) => {
    const target = String(input);
    if (target.includes('/api/site-setting')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: settings }) });
    }
    if (categories && target.includes('/api/product-categories')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: categories }) });
    }
    if (navigation && target.includes('/api/navigation')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: { items: navigation } }) });
    }
    return Promise.reject(new Error('network disabled in tests'));
  };
  const script = window.document.createElement('script');
  script.textContent = APP_JS;
  window.document.body.appendChild(script);
  return window;
}
```

4. Thay test trong vòng `for (const file of PAGES)` bằng:

```js
for (const file of PAGES) {
  test(`${file}: prerender xong thì app.js không phải sửa gì nữa`, async () => {
    const pagePath = pagePathForFile(file);
    const html = applyNavigationToHtml(
      applyCategoriesToHtml(applySettingsToHtml(readPage(file), SETTINGS), CATEGORIES),
      NAV_ITEMS,
      pagePath,
    );
    const window = runAppJs(html, SETTINGS, CATEGORIES, {
      url: `https://dhakimloaimau.vn${pagePath}`,
      navigation: NAV_ITEMS,
    });

    const before = snapshot(window);
    await window.initSiteSettings();
    await window.initCategoryLinks();
    await window.initNavigationMenu();
    const after = snapshot(window);

    for (const [index, selector] of DYNAMIC_SELECTORS.entries()) {
      assert.equal(after[index], before[index], `${selector} bị app.js sửa lại → còn chớp`);
    }
  });
}
```

5. Thêm vào cuối file:

```js
test('app.js dựng liên kết chân trang ra cùng một DOM với prerender', () => {
  const window = runAppJs(readPage('index.html'), SETTINGS);
  const items = [
    { label: 'A & "B" <c>', url: '/a?x=1&y=2', visible: true },
    { label: 'Ẩn', url: '/x', visible: false },
    { label: 'Độc', url: 'javascript:alert(1)', visible: true },
  ];
  const fromJs = window.document.createElement('ul');
  fromJs.innerHTML = window.renderFooterLinks(items);
  const fromPrerender = window.document.createElement('ul');
  fromPrerender.innerHTML = renderFooterLinks(items);

  assert.equal(fromJs.innerHTML, fromPrerender.innerHTML);
  assert.equal(fromJs.children.length, 1);
});

test('app.js áp liên kết chân trang, bản quyền và link nút đầu trang từ cài đặt', async () => {
  const window = runAppJs(readPage('contact.html'), SETTINGS, null, { url: 'https://dhakimloaimau.vn/contact' });
  await window.initSiteSettings();
  const doc = window.document;

  assert.deepEqual(
    [...doc.querySelectorAll('[data-footer-links] a')].map((a) => [a.textContent, a.getAttribute('href')]),
    [['Tin Tức', '/news'], ['A & "B"', '/contact?x=1&y=2']],
  );
  assert.equal(doc.querySelector('[data-copyright]').textContent, `© ${new Date().getFullYear()} Công ty DHA.`);
  assert.equal(doc.querySelector('.btn-contact').getAttribute('href'), '/pricing');
  assert.equal(doc.querySelector('.btn-contact').textContent, 'Báo Giá Ngay');
});

test('cài đặt bỏ trống thì app.js giữ nguyên chân trang và nút đầu trang', async () => {
  const partial = { hotline: '0912345678', header_cta_url: 'javascript:alert(1)', footer_links: [] };
  const window = runAppJs(readPage('news.html'), partial, null, { url: 'https://dhakimloaimau.vn/news' });
  const pick = () => ['[data-footer-links]', '[data-copyright]', '.btn-contact'].map((s) => window.document.querySelector(s).outerHTML);

  const before = pick();
  await window.initSiteSettings();
  assert.deepEqual(pick(), before);
});

test('CMS lỗi thì app.js giữ menu đã prerender', async () => {
  const html = applyNavigationToHtml(readPage('news.html'), NAV_ITEMS, '/news');
  const window = runAppJs(html, SETTINGS, null, { url: 'https://dhakimloaimau.vn/news' }); // không trả menu = CMS lỗi
  const before = window.document.querySelector('.nav-links').outerHTML;

  await window.initNavigationMenu();

  assert.equal(window.document.querySelector('.nav-links').outerHTML, before);
  assert.ok(before.includes('Quặng &lt;Mẫu&gt;'), 'vẫn là menu prerender, không phải menu tĩnh');
});
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test tests/prerender-site-settings.test.js`
Expected: FAIL — `window.renderFooterLinks is not a function`; test "app.js áp liên kết chân trang, bản quyền và link nút đầu trang từ cài đặt" thấy 5 liên kết mặc định thay vì 2 liên kết từ cài đặt, và `href` của nút đầu trang vẫn là `/contact`.

- [ ] **Step 3: Viết phần áp dữ liệu trong `app.js`**

Chèn ngay sau hàm `applySiteTexts` (trước khối comment `// HERO — Dynamic content from site settings`):

```js
// Liên kết chân trang — cùng quy tắc với renderFooterLinks() trong
// scripts/prerender-site-settings.js; lệch nhau là chân trang chớp.
function renderFooterLinks(items) {
    if (!Array.isArray(items)) return '';
    return items
        .filter(item => item && item.visible !== false && item.label && safeNavUrl(item.url))
        .map(item => `<li><a href="${escapeHtml(safeNavUrl(item.url))}">${escapeHtml(item.label)}</a></li>`)
        .join('');
}

// Phần đầu trang/chân trang không đi qua data-site-text: danh sách liên kết,
// dòng bản quyền (tự ghép năm) và link của nút đầu trang. Ô nào bỏ trống hoặc
// sai quy tắc thì giữ nguyên HTML — khớp với bản đã prerender.
function applySiteChrome(settings) {
    const footerLinks = renderFooterLinks(settings.footer_links);
    if (footerLinks) {
        document.querySelectorAll('[data-footer-links]').forEach(list => { list.innerHTML = footerLinks; });
    }

    const copyright = String(settings.copyright_text ?? '').trim();
    if (copyright) {
        const line = `© ${new Date().getFullYear()} ${copyright}`;
        document.querySelectorAll('[data-copyright]').forEach(el => { el.textContent = line; });
    }

    const ctaUrl = safeNavUrl(settings.header_cta_url);
    if (ctaUrl) {
        document.querySelectorAll('.btn-contact').forEach(el => { el.setAttribute('href', ctaUrl); });
    }
}
```

Trong `renderSiteSettings`, thêm `applySiteChrome(settings);` ngay sau dòng `applySiteTexts(settings);`.

- [ ] **Step 4: Tăng phiên bản `app.js`**

```bash
sed -i '' 's/app\.js?v=3\.4/app.js?v=3.5/' *.html
grep -o -h 'app\.js?v=[^"]*' *.html | sort | uniq -c
```

Expected: `10 app.js?v=3.5`.

- [ ] **Step 5: Chạy test, xác nhận qua**

Run: `node --test tests/prerender-site-settings.test.js tests/hardcoded-content.test.js tests/site-settings-dom.test.js tests/navigation.test.js`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add app.js *.html tests/prerender-site-settings.test.js
git commit -m "feat: app.js áp liên kết chân trang, bản quyền và nút đầu trang từ cài đặt"
```

---

### Task 7: Kiểm tra toàn bộ

**Files:** không sửa, trừ khi phát hiện lỗi.

- [ ] **Step 1: Chạy toàn bộ test**

Run: `npm test`
Expected: PASS toàn bộ trừ các test cần `dha-cms/node_modules` nếu worktree chưa cài (ghi rõ trong báo cáo).

- [ ] **Step 2: Chạy thử prerender trên bản sao HTML**

```bash
TMP=$(mktemp -d) && cp *.html "$TMP" && node -e '
const { prerenderDirectory } = require("./scripts/prerender-site-settings.js");
prerenderDirectory(process.argv[1], {
  loadSettings: async () => ({
    hotline: "0912345678",
    header_cta_label: "Báo Giá Ngay", header_cta_url: "/pricing",
    footer_links_title: "LIÊN KẾT", footer_links: [{ label: "Tin Tức", url: "/news", visible: true }],
    copyright_text: "Công ty DHA.",
  }),
  loadCategories: async () => [{ slug: "quang-dong", name: "Quặng Đồng", visible: true }],
  loadNavigation: async () => [{ label: "Trang Chủ", url: "/" }, { label: "Sản Phẩm", url: "/products" }],
}).then((r) => console.log(r));
' "$TMP" && grep -c 'data-footer-links><li><a href="/news">Tin Tức' "$TMP"/*.html && grep -o 'class="nav-link active">[^<]*' "$TMP"/products.html "$TMP"/index.html && rm -rf "$TMP"
```

Expected: `changed: 9`, `navigation: true`; mỗi trang công khai có 1 dòng liên kết chân trang mới, `preview.html` là 0; `products.html` đánh dấu "Sản Phẩm", `index.html` đánh dấu "Trang Chủ".

- [ ] **Step 3: Thử trên trình duyệt**

Mở website bằng cấu hình `frontend` (cổng 3000). Với CMS tắt, kiểm trên cả 9 trang: thanh trên cùng, nút đầu trang, menu, chân trang giống nhau; bấm từng link chân trang ra đúng trang; không còn link "Giới Thiệu"; 4 nút mạng xã hội hiện (link mẫu). Có Strapi và admin thì thêm: sửa "Liên kết chân trang" và "Chữ nút đầu trang" trong Cài đặt website, sửa một mục Menu — sau khoảng 2 giây, tải lại trang thấy thay đổi, không chớp.
