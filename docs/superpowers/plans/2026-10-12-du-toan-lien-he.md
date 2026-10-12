# Đợt 4: Dự toán và Nhu cầu lấy từ admin — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mọi option và con số của form Dự toán, danh sách Nhu cầu của form Liên hệ do quản trị sửa trong admin, ghi sẵn vào HTML, không chớp.

**Architecture:**
- Single type mới `form-config` giữ cấu hình. Nhóm và quặng lấy từ Danh mục và Sản phẩm.
- Prerender và `app.js` dùng cùng các hàm render để ghi `<option>` và thuộc tính `data-*`.
- Phép tính chỉ đọc DOM.

**Tech Stack:** Strapi 5 (dha-cms), JS thuần (`app.js`), Node script prerender, React + Vite (admin), `node --test` + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-12-du-toan-lien-he-design.md`

## Global Constraints

- `app.js` và `scripts/prerender-site-settings.js` phải cho ra **cùng một DOM**, cùng escape (`escapeHtml` ↔ `escapeText`/`escapeAttr`; `escapeHtml` của app.js escape cả `"` và `'`, nên **trong thuộc tính** dùng mã chỉ gồm `[a-z0-9-]` hoặc số, **trong nội dung** chỉ dùng chữ đã escape `& < >`. Kiểm `escapeHtml` trước khi viết).
- Ô trống / danh sách rỗng / số `null` trong CMS → giữ nguyên HTML mặc định.
- Mặc định trong HTML = con số đang chạy: đóng gói box 150000, bag 250000, barrel 800000; CO 500000; ngưỡng 500 kg; 5%; 6 quặng dự phòng hiện tại.
- Mã danh sách khớp `^[a-z0-9-]{1,60}$`.
- Mọi chữ comment/thông báo bằng tiếng Việt có dấu, theo giọng code xung quanh.
- Baseline: `npm test` có 2 file hỏng sẵn (`admin-ui-config`, `admin-navigation-media-edge`) vì worktree thiếu `dha-cms/node_modules`.

## Review Focus

1. Sản phẩm mang đơn vị `đ/tấn` hoặc "Giá liên hệ": không được lọt vào Dự toán (test ở Task 2).
2. CMS trả lời một phần (sản phẩm có, danh mục lỗi): nhóm/quặng giữ HTML, không trộn hai nguồn (test ở Task 4).
3. Khách đổi nhóm sang nhóm khác: chỉ thấy quặng của nhóm đó, giá tính theo quặng đang chọn (test ở Task 4).
4. Tên có ký tự `& < > "` trong danh sách: escape giống nhau hai bên (test ở Task 3 và Task 4, so khớp DOM).
5. Khách gửi form Liên hệ với mã Nhu cầu lạ hoặc rỗng: CMS lưu mã mục đầu và tên đúng (test ở Task 1).

---

### Task 1: CMS — single type `form-config` và Nhu cầu dạng chuỗi

**Files:**
- Create: `dha-cms/src/api/form-config/{content-types/form-config/schema.json, content-types/form-config/lifecycles.js, controllers/form-config.js, routes/form-config.js, services/form-config.js, fields.js}`
- Create: `dha-cms/src/api/contact-inquiry/content-types/contact-inquiry/lifecycles.js`
- Modify: `dha-cms/src/api/contact-inquiry/content-types/contact-inquiry/schema.json` (`service` → string ≤ 60, thêm `service_label` string ≤ 150)
- Modify: `dha-cms/src/index.js` (quyền public `api::form-config.form-config.find`)
- Modify: `dha-cms/src/api/admin-ui/services/resource-config.js` (khai báo `form-config`; `contact-inquiries.listFields` dùng `service_label`)
- Test: `tests/form-config.test.js` (mới, thêm vào `npm test`)

**Interfaces — Produces** (`fields.js`):
- `FORM_CONFIG_FIELDS = ['packaging','co_label','co_price','bulk_threshold_kg','bulk_discount_percent','no_analysis_label','contact_services']`
- `DEFAULT_CONTACT_SERVICES = [{code:'cung-cap-mau',label:'Cung cấp mẫu kim loại/quặng'},{code:'phan-tich-lab',label:'Phân tích & kiểm định'},{code:'khao-sat-mo',label:'Khảo sát mỏ'},{code:'tuyen-khoang',label:'Tuyển khoáng'}]`
- `sanitizeFormConfig(data) → object` chỉ chứa khoá có mặt trong `data`:
  - `packaging` → mảng `{code,name,price}`; dòng hỏng bị bỏ, mã trùng giữ dòng đầu, name ≤ 150, price nguyên ≥ 0;
  - `contact_services` → mảng `{code,label}`;
  - chữ: trim, rỗng → `null`;
  - `co_price` nguyên ≥ 0, `bulk_threshold_kg` nguyên ≥ 1, `bulk_discount_percent` số 0–100; sai → `null`.
- `resolveContactService(code, services) → {service, service_label}`:
  - danh sách dùng = `services` nếu có dòng hợp lệ, không thì `DEFAULT_CONTACT_SERVICES`;
  - mã sai mẫu hoặc rỗng → mã mục đầu;
  - tên tra theo mã, không thấy → chính mã.

Lifecycle `contact-inquiry.beforeCreate` (async):
- đọc `strapi.db.query('api::form-config.form-config').findOne({})`, lỗi thì coi như rỗng;
- gán `data.service`, `data.service_label`;
- bỏ qua `service_label` do client gửi lên.

- [ ] Step 1: Viết test lọc/tra cứu, schema, quyền, resource-config (theo mẫu `tests/page-content.test.js`). Chạy `node --test tests/form-config.test.js` → FAIL.
- [ ] Step 2: Viết các file trên. Chạy lại → PASS.
- [ ] Step 3: Commit `feat: CMS có single type Dự toán & Liên hệ, Nhu cầu thành chuỗi`.

### Task 2: Hàm render dùng chung (prerender) + lọc quặng

**Files:**
- Modify: `scripts/prerender-site-settings.js`
- Test: `tests/estimator-form.test.js` (mới)

**Interfaces — Produces** (export từ prerender, bản sao y hệt trong `app.js` ở Task 4):
- `pickEstimatorOres(products, categories, settings) → [{slug, name, ores:[{uid,name,price}]}]`
  - nhóm theo thứ tự `categories` (đã qua `pickVisibleCategories`), bỏ nhóm rỗng;
  - sản phẩm sắp theo `sort_order` tăng dần, giữ thứ tự gốc khi bằng nhau.
- `isPerKgUnit(unit) → boolean`: `/\/kg$/i` sau khi bỏ khoảng trắng.
- `renderEstimatorGroups(groups)`: `<option value="{slug}">{name}</option>…`
- `renderEstimatorOres(groups)`: `<option value="{uid}" data-group="{slug}" data-price="{price}"{ hidden nếu không thuộc nhóm đầu}>{name}</option>`
- `renderAnalysisOptions(analyses, noAnalysisLabel)`: `<option value="raw">{label}</option>` + `<option value="{id}" data-price="{price}">{name} — {price vi-VN}đ</option>`; chỉ giữ `price > 0`.
- `renderPackagingOptions(items)`: `<option value="{code}" data-price="{price}">{name}</option>`
- `renderContactServices(items)`: `<option value="{code}">{label}</option>`
- `applyFormsToHtml(html, {categories, products, analyses, formConfig, settings})`:
  - chỉ thay vùng nào có dữ liệu;
  - đặt `data-price` cho `#est-permit`, chữ cho `[data-form-text="co_label"]`, `data-bulk-threshold`/`data-bulk-percent` cho `#calculator-form`.
- `prerenderDirectory` thêm 3 loader: `loadProducts`, `loadAnalyses`, `loadFormConfig` (404 → `{}`).

Lưu ý: `toLocaleString('vi-VN')` của Node và trình duyệt cùng cho `1.500.000`. Value của option phân tích là `a.id ?? a.name`.

- [ ] Step 1: Test `pickEstimatorOres` (đơn vị tấn bị loại; `price_on_request` loại; `price_unit` rỗng → `price_unit_default`; nhiều danh mục; danh mục ẩn; nhóm rỗng bỏ) và từng hàm render (escape, hidden). FAIL.
- [ ] Step 2: Cài đặt. PASS. Test prerender cũ vẫn PASS (cập nhật test "cả bốn nguồn cùng lỗi" nếu đổi số nguồn).
- [ ] Step 3: Commit `feat: prerender ghi option và giá của form Dự toán, Liên hệ`.

### Task 3: HTML mặc định và đánh dấu

**Files:**
- Modify: `estimator.html` (các select dùng đúng mẫu render với dữ liệu mặc định; `#est-permit data-price="500000"`; nhãn CO bọc `<span data-form-text="co_label">`; form có `data-bulk-threshold="500" data-bulk-percent="5"`)
- Modify: `contact.html` (`#contact-service` theo mẫu render, bỏ `selected`)
- Modify: `tests/hardcoded-content.test.js` (bỏ mục "đợt 4", thêm vùng `#est-group, #est-ore, #est-method, #est-pack, #contact-service, [data-form-text]` vào `PAGE_CMS`; đổi tên test)
- Test: `tests/estimator-form.test.js`: HTML mặc định đúng bằng output của các hàm render với dữ liệu mặc định; `DEFAULT_CONTACT_SERVICES` khớp `contact.html`.

- [ ] Step 1: Viết test khớp mặc định. FAIL.
- [ ] Step 2: Sinh option bằng chính các hàm render (chạy node một lần), dán vào HTML. PASS cả `hardcoded-content`.
- [ ] Step 3: Commit `feat: HTML Dự toán và Liên hệ mang dữ liệu mặc định có giá`.

### Task 4: `app.js` — tính từ DOM, dựng lại từ CMS

**Files:**
- Modify: `app.js` (`initEstimator` viết lại, `initContactForm` thêm dựng option; bỏ `FALLBACK_PRICES`, bảng quặng dự phòng, `fetchFromCMS('ores'…)`)
- Test: `tests/estimator-form.test.js` (jsdom), `tests/prerender-site-settings.test.js` (vòng lặp "prerender xong thì app.js không phải sửa gì": thêm selector và dữ liệu mới)

Hành vi:
- Gắn sự kiện trước: đổi nhóm → `filterOres()` (đặt `hidden`, chọn quặng hiện đầu tiên); submit → `computeEstimate()` đọc DOM.
- Song song tải: `loadProductCategories()`, products (`products?sort=sort_order:asc&pagination[limit]=100`, không file dự phòng), `pricing-analyses`, `form-config` (`fetchSingleFromCMS`), `loadSiteSettings()`. Chỉ dựng lại vùng có dữ liệu CMS thật. Nhóm và quặng cần cả hai: `fromCMS` và products không rỗng.
- Hàm render, `pickEstimatorOres` và `isPerKgUnit` chép y hệt mẫu ở Task 2. Export lên `window` qua khai báo `function` ở top level, như các hàm khác.
- `initContactForm` dựng `#contact-service` khi `form-config.contact_services` có dòng hợp lệ.

- [ ] Step 1: Test jsdom:
  - mặc định 10 kg Quặng Đồng (85000), không phân tích, hộp, có CO → tổng 850000 + 150000 + 500000 = 1.500.000đ;
  - 600 kg → chiết khấu 5% tiền quặng;
  - đổi nhóm → quặng nhóm đó;
  - CMS đủ dữ liệu → DOM bằng prerender;
  - CMS lỗi → giữ HTML.

  FAIL.
- [ ] Step 2: Cài đặt. PASS toàn bộ `npm test` (trừ 2 file baseline).
- [ ] Step 3: Commit `feat: Dự toán tính theo cấu hình trong HTML, dựng lại từ CMS`.

### Task 5: Admin — trang "Dự toán & Liên hệ"

**Files:**
- Create: `admin/src/pages/FormConfigPage.jsx` (mẫu `SettingsPage.jsx`, hai khối Dự toán / Form Liên hệ)
- Modify: `admin/src/components/FieldRenderer.jsx` (kiểu `option-list`, cột theo `field.columns: [{key,label,type:'text'|'number',placeholder}]`, nút ↑ ↓ Xoá, "Thêm dòng")
- Modify: `admin/src/config/resources.js` (khai báo `form-config` có label/hint/placeholder mặc định; `contact-inquiries.listFields` dùng `service_label`; hint `price_unit` sản phẩm)
- Modify: `admin/src/App.jsx` (route `/form-config`), `admin/src/layout/AdminShell.jsx` (mục menu), `admin/src/tour/tourSteps.js` (tour `form-config` + ROUTE_TOURS)
- Modify: `admin/src/styles.css` nếu cần kiểu bảng (dùng lại `.link-list`)
- Test: `tests/form-config.test.js` (khoá admin khớp `FORM_CONFIG_FIELDS`; route + menu + tour), các test admin hiện có PASS.

- [ ] Step 1: Test. FAIL.
- [ ] Step 2: Cài đặt; `npm run admin:build` nếu `admin/node_modules` có sẵn. PASS.
- [ ] Step 3: Commit `feat: admin có trang Dự toán & Liên hệ`.

### Task 6: Kiểm toàn bộ, xem thật trên trình duyệt, cập nhật lộ trình

- [ ] `npm test`, chỉ còn 2 file baseline hỏng.
- [ ] Chạy server tĩnh, mở `estimator.html` và `contact.html`, bấm tính, đổi nhóm, chụp màn hình.
- [ ] Cập nhật `docs/superpowers/specs/2026-09-14-xoa-html-cung-lo-trinh.md` (đợt 4 xong) và memory.
- [ ] Commit `docs: đánh dấu xong đợt 4`.
