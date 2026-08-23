# Danh mục sản phẩm tự đặt trong CMS

Ngày 23/08/2026.

## Vấn đề

Bốn tab lọc sản phẩm ở trang chủ (`Tất Cả / Kim Loại Màu / Kim Loại Đen / Đất Hiếm`)
viết cứng trong `index.html`, luật phân loại viết cứng trong `app.js` và đoán theo
tên sản phẩm ("uid chứa `sat`", "tên chứa `đất hiếm`"). Trang `/products` lại có một
bộ tab khác hẳn (`Đồng / Nhôm / Chì / Thiếc / Quặng`). Quản trị không sửa được gì,
và luật đoán theo tên là lý do tab "Đất Hiếm" luôn hiện 0 sản phẩm.

## Giải pháp

Danh mục trở thành dữ liệu do quản trị nhập, dùng chung cho cả hai trang.

- Collection `product-category`: `slug`, `name`, `visible`, `sort_order`.
- Sản phẩm có thêm trường `categories` kiểu JSON — mảng mã danh mục. Một sản phẩm
  thuộc được nhiều danh mục.
- Trường `group` cũ giữ nguyên, chỉ còn nhiệm vụ chọn nhãn màu ở góc ảnh sản phẩm.

Chọn mảng mã thay vì quan hệ many-to-many của Strapi vì mọi lời gọi API sẵn có
(`products?sort=...`) trả luôn mảng đó, không cần `populate`, không phải đổi cấu
trúc `data/products.json` dự phòng.

## Những chỗ dễ vỡ và cách xử lý

- **Mã mồ côi khi đổi/xoá danh mục.** Mảng mã không có ràng buộc khoá ngoại, nên
  `lifecycles.js` của `product-category` viết lại mã trong sản phẩm khi `slug` đổi,
  và gỡ mã khi danh mục bị xoá. Mã còn sót vẫn hiện trong admin kèm ghi chú để
  quản trị tự gỡ, thay vì biến mất âm thầm.
- **Sản phẩm cũ chưa có danh mục.** Bootstrap đoán một lần theo đúng luật cũ
  (`default-categories.js`), chỉ với sản phẩm còn trống, nên deploy xong trang
  trông y như trước.
- **`data/` không tồn tại trên máy chủ Strapi.** Danh mục mặc định nằm trong code
  dưới `dha-cms/`, giống cách menu mặc định đã làm.
- **Cache 7 ngày của `app.js`.** Chuỗi `?v=` tăng lên 3 ở toàn bộ file HTML.

## Kiểm chứng

`tests/product-categories.test.js`: schema, quyền công khai, luật đoán danh mục,
dữ liệu dự phòng, cấu hình admin, và hai lifecycle chạy trên `strapi` giả.
