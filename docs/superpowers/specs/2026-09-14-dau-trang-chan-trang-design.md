# Đợt 2: Đầu trang và chân trang dùng chung, lấy từ admin

Ngày 14/09/2026. Thuộc lộ trình `2026-09-14-xoa-html-cung-lo-trinh.md`. Đợt 1
(`2026-09-14-dong-bo-danh-muc-hotline-design.md`) đã đưa danh sách danh mục vào
CMS và mở rộng prerender.

## Vấn đề

**Chân trang có 4 phiên bản** trên 9 trang công khai:

| Phiên bản | Trang | Khác biệt |
|---|---|---|
| A1 | Trang chủ | Khung `container footer-grid` + `footer-bottom`; cột "HỖ TRỢ KHÁCH HÀNG"; không có email |
| A2 | Sản phẩm | Như A1 nhưng khung `footer-widgets` + `site-info` |
| A3 | Dự án, Dự toán | Như A2 nhưng mạng xã hội là Facebook/YouTube/X thay vì Facebook/Zalo |
| B | Tin tức, Chi tiết tin, Chi tiết sản phẩm, Bảng giá, Liên hệ | Cột "LIÊN KẾT" (có "Giới Thiệu" → `/#about` không tồn tại), cột "LIÊN HỆ" có email, bản quyền ký "DHA Minerals" |

Cột liên kết, tiêu đề các cột và dòng bản quyền đều viết cứng.

**Đầu trang:** nút góc phải lúc "Yêu Cầu Mẫu", lúc "Liên Hệ Báo Giá", viết cứng.

**Menu điều hướng** đã sửa được ở admin → Menu, nhưng prerender chưa ghi menu vào
HTML: HTML giữ 8 mục tĩnh, `initNavigationMenu()` thay bằng dữ liệu CMS sau khi
tải — quản trị đổi menu thì khách thấy menu cũ chớp qua. Lưu menu cũng không
kích hoạt prerender (`navigation` chưa có lifecycle).

**`deploy/deploy.sh`** chạy prerender (đọc Strapi) *trước* khi build và khởi
động lại Strapi, nên trường CMS mới của một lần deploy chỉ vào HTML ở lần lưu
admin kế tiếp.

## Giải pháp

### 1. Thứ tự trong `deploy.sh`

Bước prerender chuyển xuống sau khối build/khởi động lại Strapi. Trước khi chạy,
đợi Strapi trả lời `GET http://127.0.0.1:1337/api/site-setting` (thử lại mỗi 2
giây, tối đa 30 lần). Hết thời gian thì in cảnh báo và bỏ qua prerender — HTML
giữ bản cũ, `app.js` vẫn tự áp dữ liệu như hiện nay.

### 2. Trường mới trong Cài đặt website (`site-setting`)

| Trường | Kiểu | Mặc định | Nhãn trong admin |
|---|---|---|---|
| `header_cta_label` | string, tối đa 40 | `Yêu Cầu Mẫu` | Chữ nút đầu trang |
| `header_cta_url` | string, tối đa 300 | `/contact` | Link nút đầu trang |
| `footer_categories_title` | string, tối đa 60 | `DANH MỤC SẢN PHẨM` | Tiêu đề cột danh mục (chân trang) |
| `footer_links_title` | string, tối đa 60 | `HỖ TRỢ KHÁCH HÀNG` | Tiêu đề cột liên kết (chân trang) |
| `footer_links` | json | (không đặt default trong schema) | Liên kết chân trang |
| `copyright_text` | string, tối đa 200 | `Kim Loại Màu DHA. Bản quyền được bảo lưu.` | Dòng bản quyền |

`footer_links` là mảng `{ label, url, visible }`. Năm liên kết mặc định (nằm sẵn
trong HTML của repo):

| Chữ | Đường dẫn |
|---|---|
| Dự Tính Giá Đơn Hàng | `/estimator` |
| Đơn Giá Phân Tích | `/pricing` |
| Tin Tức Thị Trường | `/news` |
| Quy Trình Giao Nhận | `/#workflow` |
| Liên Hệ Báo Giá | `/contact` |

Bỏ "Giới Thiệu" (`/#about` không tồn tại), "Đăng Ký Khảo Sát Mỏ" và "Quy Chuẩn
Bảo Quản" (cả hai chỉ dẫn về `/contact`). Quản trị thêm lại được trong admin.

Tiêu đề cột liên hệ dùng trường sẵn có `office_name` (class `site-office-name`).

Dòng bản quyền hiện `© <năm> <copyright_text>`, năm là năm hiện tại (prerender:
năm lúc ghi; `app.js`: năm của trình duyệt).

Mọi trường mới có mặt ở ba nơi: schema, `editableFields` + `fields` trong
`dha-cms/src/api/admin-ui/services/resource-config.js`, và
`admin/src/config/resources.js`.

### 3. Một khung chân trang chung

Cả 9 trang dùng đúng một đoạn `<footer>`, khung `footer-widgets > container >
footer-grid` + `site-info` (kiểu 8/9 trang đang dùng; CSS `.footer-bottom` và
`.site-info` vốn giống nhau). Bốn cột:

1. **Thương hiệu** — logo, `site-brand-bio`, bốn nút mạng xã hội Facebook,
   YouTube, Twitter/X, Zalo (`aria-label` sẵn có — nút nào không có link thì cơ
   chế hiện tại tự ẩn).
2. **Danh mục** — `<h4 data-site-text="footer_categories_title">` +
   `<ul data-category-list>` (đợt 1).
3. **Liên kết** — `<h4 data-site-text="footer_links_title">` +
   `<ul class="footer-list" data-footer-links>`.
4. **Liên hệ** — `site-office-name`, `site-address`, hotline, `site-email`,
   `site-tax-code`.

Dòng bản quyền: `<p class="copyright" data-copyright>`.

Chữ nhãn "Hotline:", "Email:" giữ trong code (nhóm 6 của lộ trình).

### 4. Nút đầu trang

`<a href="/contact" class="btn-contact" data-site-text="header_cta_label">`. Link
lấy từ `header_cta_url`, qua cùng quy tắc an toàn với menu: chỉ nhận `/...`,
`#...`, `http(s)://...`; sai quy tắc hoặc bỏ trống thì giữ `href` sẵn có.

### 5. Menu đầu trang được prerender

Prerender đọc thêm `GET /api/navigation`, ghi vào `ul.nav-links` đúng mẫu HTML
mà `renderNavItems()` trong `app.js` dựng (kể cả menu con và nút mở menu con),
và đánh dấu mục đang xem theo đúng quy tắc chấm điểm của `markActiveNavLink()`,
với đường dẫn của trang suy từ tên file (`index.html` → `/`, `x.html` → `/x`).
Menu rỗng hoặc lỗi thì giữ HTML.

`dha-cms/src/api/navigation/content-types/navigation/lifecycles.js` (mới) gọi
`schedulePrerender()` sau `afterCreate` và `afterUpdate`.

HTML trong repo giữ 8 mục mặc định (trùng `DEFAULT_NAV_ITEMS`), đồng nhất trên 9
trang; chỉ dấu `active` khác nhau theo trang.

### 6. Ô "Liên kết chân trang" trong admin

Kiểu ô mới `link-list` trong `admin/src/components/FieldRenderer.jsx`, phát
triển từ `text-list` sẵn có. Mỗi dòng: ô chữ, ô đường dẫn, công tắc ẩn/hiện, nút
lên/xuống, nút xoá; cuối danh sách có nút "Thêm liên kết". Đường dẫn sai quy tắc
hiện cảnh báo ngay dưới ô. Lưu dạng mảng JSON `{ label, url, visible }`.

### 7. Quy tắc dựng, dùng chung cho `app.js` và prerender

- **Liên kết chân trang:** bỏ mục `visible === false`, mục thiếu `label`, mục có
  URL sai quy tắc. Không còn mục nào thì giữ HTML. Mỗi mục:
  `<li><a href="URL">CHỮ</a></li>`.
- **Menu:** như `renderNavItems()` hiện tại.
- **Bản quyền:** `© <năm> <copyright_text>`; trường trống thì giữ HTML.
- **Nút đầu trang, tiêu đề cột:** qua `data-site-text` sẵn có (trống thì giữ HTML).

`app.js` áp liên kết chân trang, bản quyền và link nút đầu trang trong
`renderSiteSettings()` — cùng lượt với bộ nhớ đệm `localStorage` sẵn có, nên
lần tải sau không chớp kể cả khi prerender chưa chạy.

## Luồng dữ liệu

```
Lưu Cài đặt website ─► lifecycle site-setting ─┐
Lưu Danh mục        ─► lifecycle product-category ─┼─► schedulePrerender()
Lưu Menu            ─► lifecycle navigation (mới) ─┘         │
Deploy ─► build/khởi động lại Strapi ─► đợi Strapi ─► prerender ◄┘
                                                        │
      scripts/prerender-site-settings.js đọc site-setting + product-categories + navigation
      và ghi vào HTML đang phục vụ
Khách mở trang ─► HTML đã đúng ─► app.js áp bộ nhớ đệm + dữ liệu CMS (cùng một DOM)
```

`prerenderDirectory()` đọc ba nguồn độc lập: nguồn nào lỗi thì bỏ qua riêng phần
đó; chỉ báo lỗi khi cả ba cùng lỗi, và khi đó in cả ba lý do.

## Những chỗ dễ vỡ và cách xử lý

- **Chín trang trôi lệch nhau lần nữa.** Test so khớp: sau khi bỏ dấu `active`
  của menu, đoạn `<header>`, `<nav class="main-navigation">` và `<footer>` của 9
  trang phải giống hệt nhau.
- **JS và prerender lệch nhau → chớp.** Test so khớp từng phần (menu, liên kết
  chân trang, bản quyền, nút đầu trang) trên cả 9 trang, như đợt 1.
- **URL độc hại từ CMS** (`javascript:`...). Cùng một hàm kiểm URL ở hai bên;
  chữ và URL đều được escape.
- **Bản ghi `site-setting` có sẵn** nhận trường mới rỗng → HTML giữ chữ mặc định.
  Ô trong admin có gợi ý nói rõ điều này.
- **Strapi chậm khởi động lúc deploy** → prerender bỏ qua có cảnh báo, không làm
  hỏng deploy.
- **Menu có mục trỏ ra ngoài** (`https://...`) — không bao giờ được đánh dấu
  đang xem, như quy tắc hiện tại.

## Kiểm chứng

- `tests/hardcoded-content.test.js`: chữ khách thấy trong `<header>`,
  `<nav class="main-navigation">`, `<footer>` phải nằm trong vùng nối CMS hoặc
  thuộc danh sách cho phép nhóm 6 ("Tìm", "Hotline:", "Email:", placeholder ô
  tìm kiếm, tên các mạng xã hội); đoạn đầu trang/chân trang của 9 trang giống
  hệt nhau; không còn link `/#about`.
- `tests/prerender-site-settings.test.js`: prerender ghi menu (có menu con, đánh
  dấu đúng trang), liên kết chân trang, bản quyền, link nút đầu trang; bỏ URL
  độc hại; nguồn lỗi không chặn nguồn khác; `app.js` không phải sửa gì sau
  prerender trên cả 9 trang.
- Test lifecycle `navigation` gọi `schedulePrerender`.
- Test cấu hình: trường mới có ở schema, resource-config, admin; kiểu `link-list`
  có trong `FieldRenderer`.
- Test `deploy.sh`: bước prerender đứng sau khối khởi động lại Strapi và có vòng
  đợi Strapi.
- Thử trên trình duyệt: 9 trang, bấm từng link chân trang, kiểm nút đầu trang,
  menu đánh dấu đúng trang.

## Ngoài phạm vi

- Tiêu đề khối "DANH MỤC SẢN PHẨM" bên hông trang chủ và chữ nội dung các trang,
  SEO — đợt 3.
- Chữ trên thanh gọi nhanh ở điện thoại (`.mobile-cta-bar`, do `app.js` dựng) —
  nhãn giao diện, giữ trong code.
- Kéo thả trong ô "Liên kết chân trang" — dùng nút lên/xuống.
