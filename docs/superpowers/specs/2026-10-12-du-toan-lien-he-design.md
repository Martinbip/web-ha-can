# Đợt 4: Cấu hình Dự toán và danh sách Nhu cầu lấy từ admin

Ngày 12/10/2026. Thuộc lộ trình `2026-09-14-xoa-html-cung-lo-trinh.md`, sau đợt 3
(`2026-09-16-noi-dung-trang-seo-design.md`). Đây là đợt cuối của lộ trình.

## Vấn đề

Sau đợt 3, chữ khách thấy chỉ còn viết cứng ở hai form (nhóm 5 của lộ trình):

1. **Dự toán (`estimator.html`).**
   - Ô "Nhóm khoáng sản": 3 option viết cứng trong HTML.
   - Ô "Loại quặng": lấy từ collection `ores` (Quặng Mẫu). Admin **không có màn
     hình** sửa collection này. Collection lại seed từ `data/products.json`, mà
     file đó không được rsync sang máy chủ Strapi, nên nhiều khả năng `ores` trên
     VPS trống. Khi đó `app.js` dùng bảng quặng dự phòng **có giá** viết cứng.
   - Giá đóng gói, phí CO, ngưỡng và tỉ lệ chiết khấu: hằng số trong `app.js`.
   - Ô "Yêu cầu kiểm định": HTML có 4 option không mang giá. Khi CMS lỗi, mọi
     phương pháp đều tính 0đ. Chữ "Không phân tích" viết cứng trong `app.js`.
   - Nhãn checkbox CO viết cứng.
2. **Liên hệ (`contact.html`).** Danh sách "Nhu cầu" viết cứng trong HTML và bị
   khoá bằng enum trong schema `contact-inquiry`.

## Quyết định

- **Quặng lấy từ Sản phẩm** (người dùng chọn ngày 12/10). Nhóm là Danh mục sản
  phẩm, quặng là sản phẩm trong danh mục, đơn giá là giá sản phẩm. Ngừng dùng
  collection `ores` (không xoá dữ liệu, không xoá schema).
- **Giữ nguyên con số đang chạy làm mặc định.** Deploy xong, khách thấy y như
  trước cho tới khi quản trị sửa.

## Giải pháp

### 1. Nguyên tắc: tính tiền chỉ đọc DOM

Mọi con số dùng để tính nằm trong HTML dưới dạng thuộc tính:

| Chỗ | Thuộc tính |
|---|---|
| `#est-ore option` | `data-price` (đ/kg), `data-group` (mã danh mục) |
| `#est-method option` | `data-price` (option `raw` không có giá = 0) |
| `#est-pack option` | `data-price` |
| `#est-permit` | `data-price` (phí CO) |
| `#calculator-form` | `data-bulk-threshold` (kg), `data-bulk-percent` (%) |

`app.js` bỏ hết hằng số giá. Lúc bấm "Tính Toán Báo Giá" nó đọc các thuộc tính
trên. Công thức giữ nguyên:

- tiền quặng = đơn giá × khối lượng
- chiết khấu = làm tròn(tiền quặng × % / 100) khi khối lượng ≥ ngưỡng
- tổng = tiền quặng + phí phân tích + giá đóng gói + (phí CO nếu tích) − chiết khấu

Giá trị mặc định nằm ngay trong HTML của repo (đúng nguyên tắc "HTML trong repo
mang dữ liệu mặc định hợp lệ"), không lặp lại ở JS.

### 2. Nơi lưu: single type `form-config` ("Dự toán & Liên hệ")

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `packaging` | JSON `[{code, name, price}]` | Quy cách đóng gói |
| `co_label` | chuỗi ≤ 150 | Nhãn checkbox CO |
| `co_price` | số nguyên ≥ 0 | Phí CO |
| `bulk_threshold_kg` | số nguyên ≥ 1 | Ngưỡng chiết khấu |
| `bulk_discount_percent` | số 0–100 | Tỉ lệ chiết khấu trên tiền quặng |
| `no_analysis_label` | chuỗi ≤ 100 | Chữ của lựa chọn không phân tích |
| `contact_services` | JSON `[{code, label}]` | Danh sách Nhu cầu |

`dha-cms/src/api/form-config/fields.js` lọc dữ liệu trước khi lưu (lifecycle
`beforeCreate`/`beforeUpdate`, chỉ lọc trường có mặt trong lượt ghi):

- Dòng danh sách thiếu tên, hoặc có mã không khớp `^[a-z0-9-]{1,60}$`, bị bỏ. Mã
  trùng thì giữ dòng đầu. Tên cắt còn 150 ký tự. Giá phải là số nguyên ≥ 0.
- Số sai kiểu hoặc ngoài khoảng thì lưu `null`.
- Danh sách rỗng, chữ rỗng hoặc số `null` nghĩa là **"dùng mặc định trong HTML"**.

Lưu xong thì gọi prerender (`afterCreate`/`afterUpdate`), giống `page-content`.

### 3. Nhóm và quặng

- **Nhóm** = các danh mục đang hiện (`pickVisibleCategories`, đúng thứ tự) **có ít
  nhất một quặng**.
- **Quặng** = sản phẩm thoả cả ba điều kiện:
  - `price_on_request` tắt và `price` > 0;
  - đơn vị giá tính theo kg. Đơn vị lấy theo thứ tự `price_unit` → `price_unit_default`
    trong Cài đặt → `đ/kg`, rồi kiểm xem có kết thúc bằng `/kg` không (không phân
    biệt hoa thường, bỏ khoảng trắng);
  - thuộc danh mục đó.

  Sản phẩm thuộc hai danh mục thì có một option ở mỗi nhóm.
- Thứ tự quặng theo `sort_order` của sản phẩm, như trang Sản phẩm.
- `#est-ore` chứa quặng của **mọi** nhóm. Option không thuộc nhóm đầu tiên mang
  thuộc tính `hidden`. Khách đổi nhóm thì `app.js` bật/tắt `hidden` rồi chọn
  quặng đầu tiên của nhóm. Vì vậy Dự toán vẫn chạy khi CMS không phản hồi.
- Không có quặng nào hợp lệ thì giữ nguyên HTML.
- Admin, ô "Đơn vị giá" của sản phẩm: thêm gợi ý rằng chỉ sản phẩm tính theo kg
  mới hiện trong Dự toán.

Mặc định trong HTML: 3 nhóm theo 3 danh mục mặc định, 6 quặng đúng tên và giá
đang nằm trong bảng dự phòng của `app.js`, 3 quy cách đóng gói, phí CO 500.000đ,
ngưỡng 500 kg, 5%. Ô phân tích mặc định gồm "Không phân tích" và 5 mục của
`data/pricing_analysis.json`, có giá.

### 4. Phương pháp phân tích

Giữ nguồn hiện có: Biểu phí phân tích (`pricing-analyses`, giá > 0). Option đầu
`<option value="raw">` mang chữ `no_analysis_label`. Option sau có mẫu
`<option value="{id}" data-price="{giá}">{tên} — {giá vi-VN}đ</option>`.

### 5. Danh sách Nhu cầu

- `contact.html`: `<option value="{code}">{label}</option>`.
- Schema `contact-inquiry`: `service` đổi từ enum sang chuỗi (≤ 60), thêm
  `service_label` (chuỗi ≤ 150).
- Lifecycle `beforeCreate` của `contact-inquiry`:
  - mã sai mẫu thì dùng mã của mục đầu danh sách;
  - `service_label` tra theo danh sách trong `form-config`, rỗng thì theo danh sách
    mặc định (`DEFAULT_CONTACT_SERVICES` trong `fields.js`, có test giữ khớp
    `contact.html`), không thấy thì lấy chính mã.
- Admin, danh sách Liên hệ: cột Nhu cầu hiện `service_label`. Tên được chốt lúc
  khách gửi, nên sau này đổi hoặc xoá mục trong danh sách cũng không làm hỏng
  yêu cầu cũ. Yêu cầu gửi trước đợt này không có `service_label`, admin hiện mã.

### 6. Prerender và `app.js` cùng một DOM

`scripts/prerender-site-settings.js` đọc thêm ba nguồn: `products`,
`pricing-analyses`, `form-config` (404 = chưa có dữ liệu). Mỗi nguồn lỗi thì bỏ
riêng phần của nó, như bốn nguồn cũ.

Hàm render dùng chung tên và mẫu thẻ ở hai bên:

- `renderEstimatorGroups`, `renderEstimatorOres`, `renderAnalysisOptions`,
  `renderPackagingOptions`, `renderContactServices`;
- `pickEstimatorOres` (lọc sản phẩm thành quặng).

Prerender sửa các chỗ sau:

- nội dung của `#est-group`, `#est-ore`, `#est-method`, `#est-pack`,
  `#contact-service`;
- thuộc tính `data-price` của `#est-permit`;
- chữ của `[data-form-text="co_label"]`;
- `data-bulk-*` của `#calculator-form`.

`app.js` (`initEstimator`, `initContactForm`) chỉ dựng lại phần nào có dữ liệu
CMS thật. Nhóm và quặng chỉ dựng lại khi **cả** danh mục lẫn sản phẩm đến từ CMS.
CMS lỗi thì giữ HTML có sẵn.

### 7. Admin

- Trang mới `/form-config` "Dự toán & Liên hệ", trong nhóm "Trang trên website",
  có tour riêng.
- Hai khối: **Dự toán** (đóng gói, CO, chiết khấu, chữ không phân tích) và **Form
  Liên hệ** (Nhu cầu).
- Kiểu ô mới `option-list`: bảng dòng có cột khai báo (mã, tên, giá tuỳ cột), nút
  lên/xuống/xoá/thêm, như `link-list`. Placeholder hiện giá trị mặc định.
- Gợi ý nói rõ: bỏ trống thì website dùng mặc định; đổi mã Nhu cầu không ảnh
  hưởng yêu cầu cũ.

## Test

- **Lọc dữ liệu:** `form-config` (mã sai, mã trùng, giá âm, số ngoài khoảng, lượt
  ghi một phần) và `contact-inquiry` (mã sai, tra tên).
- **Lọc quặng:** `pickEstimatorOres` theo đơn vị, giá liên hệ, nhiều danh mục,
  danh mục ẩn, nhóm rỗng.
- **Không chớp:** prerender `estimator.html`/`contact.html` xong thì `app.js` với
  cùng dữ liệu không đổi gì ở các vùng trên. Cũng kiểm CMS lỗi thì giữ HTML.
- **Tính tiền trên DOM thật (jsdom):** mặc định cho ra đúng số như trước. Sửa cấu
  hình thì số đổi theo. Đổi nhóm thì ẩn/hiện đúng quặng.
- **`hardcoded-content.test.js`:** bỏ các mục "đợt 4" khỏi danh sách cho phép,
  thêm các vùng mới vào danh sách vùng đã nối CMS.
- **Khớp mặc định:** `DEFAULT_CONTACT_SERVICES` khớp `contact.html`. Danh sách ô
  của admin khớp `fields.js`.

## Ngoài phạm vi

Form Đặt mẫu (`order-request`), nhãn ô nhập và nhãn kết quả (nhóm 6), xoá
collection `ores`.
