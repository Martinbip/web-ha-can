# Đợt 1: Đồng bộ danh mục sản phẩm và khung hotline

Ngày 14/09/2026. Thuộc lộ trình `2026-09-14-xoa-html-cung-lo-trinh.md`.

## Vấn đề

Từ bản `2026-08-23-danh-muc-san-pham-design.md`, tab lọc lấy danh mục từ CMS và
trang Sản phẩm chỉ lọc theo mã danh mục (`color-metal`, `black-metal`,
`rare-earth`). Nhưng mọi danh sách danh mục khác vẫn viết cứng trong HTML:

| Chỗ hiện | Trang | Hiện trạng |
|---|---|---|
| Khối "Danh mục sản phẩm" bên hông | Trang chủ | 5 dòng, mã cũ `dong/quang/nhom/chi/thiec` → trang trống |
| Cột "DANH MỤC SẢN PHẨM" chân trang | Trang chủ, Sản phẩm, Dự án, Dự toán | 5 dòng, tên không khớp danh mục thật |
| Cột "SẢN PHẨM" chân trang | Tin tức, Chi tiết tin, Chi tiết sản phẩm, Bảng giá, Liên hệ | 5 dòng, mã cũ → trang trống |
| Tab lọc | Trang chủ, Sản phẩm | Đã lấy từ CMS nhưng HTML chỉ có tab "Tất Cả", các tab khác hiện sau khi tải |
| Nút "← Quay Lại Danh Mục" | Chi tiết sản phẩm | Dùng trường `group` (`dong`...) → trang trống |

Khung "HOTLINE TƯ VẤN" ở trang chủ: số điện thoại đã lấy từ Cài đặt website,
còn tiêu đề và hai dòng mô tả viết cứng.

## Giải pháp

### Danh mục: một nguồn cho mọi chỗ

Nguồn duy nhất là admin → **Danh mục sản phẩm** (collection `product-category`,
đã có). Danh mục hiện ra theo `sort_order`, bỏ danh mục `visible: false`. Không
có danh mục nào hiển thị thì dùng 3 danh mục mặc định — đúng quy tắc
`fetchProductCategories()` đang áp cho tab, để mọi chỗ luôn giống nhau.

**Đánh dấu trong HTML.** Mỗi danh sách danh mục mang thuộc tính
`data-category-list`, mỗi mục có đúng dạng:

```html
<li><a href="/products?filter=MÃ">TÊN</a></li>
```

Tiêu đề từng cột ("DANH MỤC SẢN PHẨM", "SẢN PHẨM") giữ nguyên — thống nhất
chân trang là việc của đợt 2.

**HTML trong repo** thay toàn bộ danh sách cũ bằng 3 danh mục mặc định có mã
đúng, lấy từ `data/product_categories.json`. Chạy ở máy dev hay lúc CMS lỗi
cũng không còn link hỏng.

**Tab lọc.** Prerender ghi sẵn các nút tab (tên + mã, ô số lượng để trống) vào
`#home-filter-tabs` và `#product-filter-tabs`. `app.js` dựng lại như hiện nay
và điền số lượng khi đã có danh sách sản phẩm.

**Nút "← Quay Lại Danh Mục"** trỏ tới danh mục đầu tiên trong `categories` của
sản phẩm; sản phẩm chưa có danh mục thì trỏ `/products`.

### Khung hotline

Thêm hai trường vào Cài đặt website (`site-setting`):

| Trường | Kiểu | Mặc định | Nhãn trong admin |
|---|---|---|---|
| `hotline_box_title` | string, tối đa 60 | `HOTLINE TƯ VẤN` | Tiêu đề khung hotline |
| `hotline_box_note` | text, tối đa 300 | `Kỹ sư phản hồi trong 30 phút` + xuống dòng + `Hỗ trợ 7:30 – 17:30 các ngày trong tuần` | Mô tả khung hotline |

Gắn bằng cơ chế sẵn có `data-site-text` — cơ chế này đã được cả bộ nhớ đệm
trình duyệt lẫn prerender lo chống chớp, không cần code mới. Mô tả xuống dòng
bằng ký tự xuống dòng thật và CSS `white-space: pre-line` trên
`.widget-hotline-desc`, thay cho `<br>` — nhờ vậy `textContent` và
`escapeText` của prerender cho ra cùng một kết quả.

Trường mới phải có mặt ở ba nơi: schema `site-setting`, `editableFields` trong
`dha-cms/src/api/admin-ui/services/resource-config.js`, và cấu hình form trong
`admin/src/config/resources.js`.

## Luồng dữ liệu

```
Quản trị lưu danh mục ─► lifecycle product-category ─┐
Quản trị lưu cài đặt  ─► lifecycle site-setting ─────┼─► schedulePrerender() (hoãn 1,5 giây, gộp lần lưu liên tiếp)
Deploy ─► deploy.sh ─────────────────────────────────┘        │
                                                              ▼
                        scripts/prerender-site-settings.js đọc site-setting + product-categories,
                        ghi vào HTML trong thư mục nginx đang phục vụ
Khách mở trang ─► HTML đã đúng ─► app.js hỏi lại CMS ─► CMS trả lời thật: dựng lại
                                                      └► CMS lỗi: giữ nguyên HTML
```

- **Prerender.** Mở rộng `scripts/prerender-site-settings.js` để đọc thêm
  `product-categories?sort=sort_order:asc&pagination[limit]=100` và thêm handler
  cho `[data-category-list]`, `#home-filter-tabs`, `#product-filter-tabs`. Giữ
  tên file để `deploy.sh` và `prerender.js` không phải đổi. Đọc danh mục lỗi thì
  bỏ qua riêng phần danh mục, vẫn ghi phần cài đặt.
- **Lifecycle.** `product-category/lifecycles.js` gọi `schedulePrerender()` sau
  `afterCreate`, `afterUpdate`, `afterDelete`, sau khi các hook dọn mã đã chạy
  xong (để sản phẩm được cập nhật trước).
- **Frontend.** `app.js` thêm hàm dựng `[data-category-list]` trên mọi trang.
  Kết quả tải danh mục được dùng chung cho tab và danh sách trong cùng một lượt
  tải trang (không gọi CMS hai lần). Chỉ dựng lại khi dữ liệu đến từ CMS thật:
  `fetchFromCMS` hiện rơi thầm về `data/product_categories.json`, nên phần danh
  mục cần một đường gọi biết được nguồn dữ liệu, và bỏ qua khi là bản dự phòng.
- **Bộ nhớ đệm.** Tăng chuỗi `?v=` của `app.js` và `styles.css` ở toàn bộ HTML.

## Những chỗ dễ vỡ và cách xử lý

- **JS và prerender lệch nhau → chớp.** Hai bên cùng dựng đúng một mẫu `<li>`,
  cùng escape `& < >` (và `"` trong thuộc tính). Có test so khớp từng ký tự.
- **CMS lỗi lúc khách tải trang.** Giữ nguyên HTML đã prerender, không ghi đè
  bằng file dự phòng có thể cũ hơn.
- **Prerender lỗi lúc deploy hoặc sau khi lưu.** HTML giữ bản đúng lần trước;
  `app.js` vẫn tự sửa khi CMS trả lời. Lỗi được ghi log như hiện nay.
- **Đổi mã danh mục.** Link cũ trong HTML được prerender viết lại ngay sau khi
  lưu; sản phẩm đã được lifecycle sẵn có đổi mã theo.
- **Tên danh mục chứa ký tự đặc biệt** (`&`, `<`, dấu nháy). Escape như trên; mã
  đi vào URL bằng `encodeURIComponent` ở cả hai bên.
- **Máy dev không có script prerender** — `prerender.js` đã tự bỏ qua.

## Kiểm chứng

- `tests/prerender-site-settings.test.js`: ghi danh mục vào mọi
  `[data-category-list]` và hai thanh tab; bỏ danh mục bị ẩn; rơi về mặc định
  khi không còn danh mục hiển thị; escape đúng; danh mục lỗi không chặn phần cài
  đặt; ghi hai trường khung hotline, giữ xuống dòng.
- `tests/product-categories.test.js`: lifecycle tạo/sửa/xoá gọi
  `schedulePrerender`; nút "Quay lại danh mục" trỏ đúng danh mục đầu tiên.
- `tests/site-settings-dom.test.js`: `app.js` dựng danh sách giống hệt bản
  prerender; CMS lỗi thì giữ nguyên HTML; khung hotline nhận hai trường mới.
- **Test chống tái phát** (mới): quét cả 9 trang, báo lỗi nếu có link
  `/products?filter=` nằm ngoài `[data-category-list]` và ngoài thanh tab, hoặc
  mã lọc không có trong danh mục mặc định; báo lỗi nếu khung hotline còn chữ
  không gắn `data-site-text`.
- Chạy thử trên trình duyệt: trang chủ, Sản phẩm, Chi tiết sản phẩm, Liên hệ —
  bấm từng link danh mục phải ra đúng sản phẩm.

## Ngoài phạm vi

- Thống nhất hai phiên bản chân trang, tiêu đề các cột, link `/#about` — đợt 2.
- Tiêu đề khối "DANH MỤC SẢN PHẨM" bên hông và mọi chữ nội dung khác — đợt 3.
- Nhóm khoáng sản và bảng giá ở Dự toán — đợt 4.
- Nhãn giao diện và thông báo hệ thống — giữ trong code (xem lộ trình).
