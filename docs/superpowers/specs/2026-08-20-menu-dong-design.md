# Thanh menu động (sửa nội dung + sắp xếp từ admin)

Ngày: 2026-08-20

## Vấn đề

Thanh điều hướng đang được viết cứng 8 mục trong 9 file HTML. Muốn đổi tên,
đổi thứ tự, thêm hay ẩn một mục đều phải sửa code và deploy lại.

## Mục tiêu

Quản trị viên tự làm được trong `/admin`:

- Sửa nhãn hiển thị và URL của từng mục
- Kéo thả để sắp xếp lại
- Ẩn/hiện từng mục
- Thêm mục mới, xoá mục không cần
- Tạo menu con 2 cấp (dropdown)

Website luôn hiển thị menu, kể cả khi CMS chết.

## Lưu trữ: single type `navigation` với trường JSON

Cả cây menu nằm trong một bản ghi (`api::navigation.navigation`), attribute
`items` kiểu json. Mỗi mục:

```json
{ "id": "products", "label": "Sản Phẩm", "url": "/products", "visible": true,
  "children": [] }
```

`children` chỉ sâu đúng một cấp. Lý do chọn hướng này thay vì collection type
`nav-item` + quan hệ tự tham chiếu: menu chỉ ~8-15 mục, kéo thả và menu con trở
thành thao tác trên mảng lồng nhau, mỗi lần lưu là nguyên tử (không có trạng
thái nửa vời khi đổi thứ tự), và lớp `admin-ui` hiện chưa hỗ trợ trường quan hệ.

Seed: `data/navigation.json` chứa đúng 8 mục hiện tại, nạp trong
`dha-cms/src/index.js` qua `seedSingleType`. Cấp quyền public cho
`api::navigation.navigation.find`.

## Backend admin-ui

Hai route mới, ngoài lớp resource-config chung (vì đây là cây, không phải bảng):

- `GET /admin-ui/navigation` → trả cây hiện tại
- `PUT /admin-ui/navigation` → ghi đè cả cây

Validate phía server trước khi ghi:

- `label` bắt buộc, ≤ 100 ký tự
- `url` bắt buộc, chỉ chấp nhận đường dẫn nội bộ (`/...`, `#...`) hoặc
  `http(s)://...`; từ chối `javascript:`, `data:`
- tối đa 2 cấp, tối đa 20 mục gốc và 20 mục con mỗi nhánh
- `id` tự sinh nếu thiếu, duy nhất trong cây

## Admin UI

Trang mới `/admin/menu` (`admin/src/pages/MenuPage.jsx`), thêm mục "Thanh menu"
vào sidebar `AdminShell`.

- Danh sách kéo thả bằng HTML5 drag & drop thuần (không thêm dependency)
- Kéo lên xuống để đổi thứ tự; nút thụt vào/ra để chuyển một mục thành mục con
  của mục ngay trên nó hoặc đưa ngược lên cấp 1
- Mỗi dòng: ô nhãn, ô URL, công tắc ẩn/hiện, nút xoá
- Nút "Thêm mục"; một nút Lưu duy nhất, hiện trạng thái "chưa lưu"
- Cảnh báo mềm khi URL nội bộ không nằm trong danh sách trang có thật

## Frontend

`renderNavigation()` trong `app.js`, chạy trong `DOMContentLoaded`:

1. Fetch `/api/navigation` (timeout như các fetch khác)
2. Thành công và có mục hiển thị → dựng lại `ul.nav-links`
3. Lỗi, rỗng, hoặc dữ liệu không hợp lệ → giữ nguyên HTML tĩnh

HTML của 9 trang giữ nguyên 8 mục tĩnh: không chớp menu lúc tải và vẫn tốt cho
SEO. Mục `visible: false` bị bỏ. Active state tính theo `location.pathname` +
hash thay vì các id cứng `nav-home`, `nav-products`, ...

CSS: dropdown hover cho desktop, accordion trong sidebar mobile.

## Kiểm thử

- Backend: validate URL, độ sâu, số lượng mục
- Frontend: render từ CMS, giữ menu tĩnh khi CMS lỗi, đánh dấu active đúng
- Admin: dựng cây sau kéo thả và sau khi thụt vào/ra

## Ngoài phạm vi

Đổi URL một mục không tạo trang mới; trỏ tới đường dẫn chưa tồn tại vẫn ra 404.
Menu footer không nằm trong lần này.
