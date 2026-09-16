# Đợt 3: Nội dung từng trang và SEO lấy từ admin

Ngày 16/09/2026. Thuộc lộ trình `2026-09-14-xoa-html-cung-lo-trinh.md`, sau đợt 1
(`2026-09-14-dong-bo-danh-muc-hotline-design.md`) và đợt 2
(`2026-09-14-dau-trang-chan-trang-design.md`).

## Vấn đề

Sau hai đợt đầu, phần chữ trong đầu trang, chân trang, menu, danh mục và khung
hotline đã do quản trị đặt. Rà lại 9 trang (bỏ các vùng đã nối CMS) còn hai nhóm:

1. **Chữ nội dung từng trang — khoảng 60 mục trên 7 trang.** Trang chủ: chữ và
   link hai nút ở hero; nhãn nhỏ, tiêu đề, mô tả của các khu Sản phẩm, Dịch vụ,
   Quy trình; tiêu đề khu Giá thị trường và Tin tức; chữ các nút "Xem tất cả…",
   "Gọi Nhận Báo Giá"; tiêu đề khối danh mục bên hông. Các trang con: tiêu đề
   trang, đoạn giới thiệu, khung "CẦN BÁO GIÁ CHI TIẾT?", chữ nút gọi, đoạn
   "Lưu ý" ở Dự toán, khối "CAM KẾT" 4 dòng và thông báo gửi thành công ở Liên hệ.
2. **SEO của 7 trang tĩnh.** `<title>`, `meta description`, các thẻ `og:` và
   `twitter:` viết cứng trong HTML.

Ngoài ra còn một **nợ kỹ thuật** từ đợt 2: `scripts/prerender-site-settings.js`
đọc và ghi tại chỗ trong thư mục đang phục vụ, nên ô bị xoá trắng trong admin
không quay về chữ mặc định cho tới lần deploy kế tiếp.

## Giải pháp

### 1. Prerender đọc nguồn, ghi sang đích (làm trước)

`prerenderDirectory(target, ...)` đổi thành đọc từ thư mục nguồn (bản mẫu trong
repo, `/var/www/web-ha-can`) và ghi sang thư mục đích (thư mục nginx phục vụ,
`/var/www/dhakimloaimau.vn`). Nguồn mặc định là gốc repo của chính script, nên
gọi cũ một tham số vẫn chạy được ở máy dev.

- `deploy/deploy.sh`: cả hai lượt truyền nguồn và đích.
- `dha-cms/src/api/site-setting/prerender.js`: truyền thêm nguồn
  (`PRERENDER_SOURCE_DIR`, mặc định `/var/www/web-ha-can`).
- Hệ quả mong muốn: ô trống trong admin → HTML quay về chữ mặc định ngay lần lưu
  kế tiếp. Đây cũng là điều gợi ý trong admin đang hứa.

### 2. Nơi lưu: single type `page-content` ("Nội dung trang")

Hai trường JSON:

- `texts`: `{ "<trang>": { "<khoá>": "chữ" | ["dòng", ...] } }`
- `seo`: `{ "<trang>": { title, description, image, image_alt } }`

Bảy mã trang: `home`, `products`, `projects`, `news`, `pricing`, `estimator`,
`contact`. Chọn JSON thay vì ~90 cột phẳng: danh sách ô còn dài thêm ở các đợt
sau, và repo đã dùng JSON cho menu, thông số sản phẩm, liên kết chân trang.

Hero và số liệu trang chủ **giữ nguyên** trong `site-setting` (trang "Trang chủ"
của admin) — không chuyển dữ liệu đang có.

### 3. Danh sách ô khai báo một chỗ

`dha-cms/src/api/page-content/fields.js` và `admin/src/config/page-content-fields.js`
cùng khai báo, theo từng trang: khoá, nhãn tiếng Việt, loại ô (`text`,
`textarea`, `url`, `text-list`) và chữ mặc định (dùng làm placeholder trong
admin). Một test giữ hai file khớp nhau, như cách `DEFAULT_CATEGORIES` đang được
giữ khớp ở ba nơi.

Phía CMS dùng danh sách này để **lọc khi lưu**: bỏ trang lạ, khoá lạ, giá trị sai
kiểu; chuỗi cắt theo độ dài tối đa khai báo.

### 4. Đánh dấu trong HTML

- `<body data-page="home">` trên mỗi trang — cả prerender lẫn `app.js` đọc mã
  trang từ đây (prerender có suy từ tên file làm phương án dự phòng).
- `data-page-text="services_title"` — thay phần chữ của thẻ.
- `data-page-list="commitments"` — thay các `<li>` (khối Cam kết ở Liên hệ), mẫu
  `<li>dòng</li>`.
- `data-page-seo="title|description|image|image_alt"` — đặt trên `<title>` và các
  thẻ meta. Một ô điền cho cả ba nhóm thẻ:
  - `title` → `<title>`, `og:title`, `twitter:title`
  - `description` → `meta description`, `og:description`, `twitter:description`
  - `image` → `og:image`, `twitter:image`
  - `image_alt` → `og:image:alt`

### 5. Prerender và `app.js`

Cùng quy tắc, cùng kết quả DOM (lệch là chớp):

- Ô trống, thiếu trang, hoặc dữ liệu sai kiểu → giữ nguyên HTML.
- `data-page-list` không còn dòng nào dùng được → giữ nguyên HTML.
- Chữ được escape; `image` đi qua cùng quy tắc URL của đợt 2 (`/...`, `#...`,
  `http(s)://...`; chặn `//...` và `/\...`).
- `app.js` áp nội dung trang trong một hàm riêng, gọi cùng lượt với cài đặt
  website; `prerenderDirectory` đọc thêm nguồn thứ tư là `/api/page-content`,
  độc lập với ba nguồn hiện có (một nguồn lỗi không chặn các nguồn khác; cả bốn
  cùng lỗi mới báo lỗi, kèm đủ bốn lý do).
- Lưu "Nội dung trang" trong admin kích hoạt ghi lại HTML (lifecycle gọi
  `schedulePrerender()`), như Menu và Danh mục.

### 6. Admin

Mục mới **"Nội dung trang"** trên thanh bên, 7 tab theo trang. Mỗi tab hai phần:
*Nội dung* (các ô theo khai báo) và *SEO* (4 ô: tiêu đề, mô tả, ảnh chia sẻ, mô
tả ảnh). Ô để trống hiện chữ mặc định dạng placeholder, kèm gợi ý nói rõ: bỏ
trống thì website dùng lại chữ mặc định.

## Những chỗ dễ vỡ và cách xử lý

- **Đọc nguồn ghi đích làm mất nội dung khác trong thư mục phục vụ?** Không:
  script chỉ ghi các file `.html` nó dựng ra, các file khác (sitemap, ảnh tải
  lên) không đụng tới. Có test cho việc này.
- **Nguồn không tồn tại** (máy dev, đường dẫn sai): script báo lỗi rõ và không
  ghi gì, thay vì tạo file rỗng.
- **JSON hỏng trong CMS** (sửa tay, dữ liệu cũ): lọc theo khai báo, phần không
  hợp lệ bị bỏ qua, HTML giữ chữ mặc định.
- **Trang chi tiết sản phẩm và chi tiết tin** tự đặt tiêu đề, mô tả, ảnh chia sẻ
  theo từng sản phẩm/bài viết. Đợt này **không** gắn `data-page-seo` cho hai
  trang đó để hai bên không tranh nhau ghi.
- **Chữ SEO quá dài** làm Google cắt: ô có độ dài tối đa khai báo trong danh
  sách ô (tiêu đề 70, mô tả 200), cắt khi lưu.

## Kiểm chứng

- `tests/prerender-site-settings.test.js`: ghi `data-page-text`,
  `data-page-list`, `data-page-seo` (đủ ba nhóm thẻ) theo đúng mã trang; ô trống
  giữ HTML; escape; URL ảnh sai quy tắc bị bỏ; `app.js` không phải sửa gì sau
  prerender trên cả 9 trang; bốn nguồn độc lập.
- Test tách nguồn/đích: ghi từ nguồn sang đích; xoá trắng một ô thì đích quay về
  chữ mặc định của nguồn; nguồn thiếu thì báo lỗi; file ngoài `.html` trong đích
  không bị đụng.
- `tests/hardcoded-content.test.js`: sau đợt này, chữ khách nhìn thấy trong 9
  trang chỉ còn nằm trong vùng đã nối CMS hoặc trong danh sách cho phép của
  nhóm 6 (nhãn ô nhập, tiêu đề cột bảng, "Đang tải…", "0đ", thông báo trống);
  mỗi trang có `data-page` đúng; 7 trang tĩnh có đủ 4 thẻ SEO đánh dấu.
- Test khai báo: hai file danh sách ô khớp nhau; CMS lọc đúng khoá lạ và kiểu sai.
- Test lifecycle `page-content` gọi `schedulePrerender`.
- Test giao diện admin: mục "Nội dung trang" dựng đủ tab, sửa và lưu được, danh
  sách Cam kết thêm/xoá/đổi thứ tự được.
- Thử trên trình duyệt: 7 trang, xem chữ mặc định còn nguyên; đổi vài ô trong
  admin (nếu có Strapi) rồi kiểm lại.

## Ngoài phạm vi

- SEO của hai trang chi tiết (sản phẩm, tin tức) — xem lại sau đợt 3.
- Nhãn giao diện và thông báo hệ thống (nhóm 6) — giữ trong code.
- Cấu hình Dự toán và danh sách nhu cầu form Liên hệ — đợt 4.
