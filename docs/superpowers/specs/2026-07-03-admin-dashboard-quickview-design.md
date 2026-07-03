# Admin Dashboard Quickview — Design

## Bối cảnh

Dashboard admin hiện tại (`admin/src/pages/DashboardPage.jsx` + backend
`dha-cms/src/api/admin-ui/services/resources.js#dashboard`) chỉ hiển thị số
lượng bản ghi theo từng loại nội dung (tin tức, sản phẩm, dự án...). Người
quản trị phải mở từng trang danh sách mới biết có việc gì cần xử lý, xu
hướng tương tác gần đây ra sao, hay nội dung nào đang có vấn đề (hết hàng,
chưa xuất bản).

## Mục tiêu

Bổ sung 3 khối "quickview" vào dashboard, tính toán hoàn toàn từ dữ liệu nội
bộ đã có trong Strapi (không phụ thuộc dịch vụ ngoài):

1. **Yêu cầu cần xử lý** — số liên hệ / đơn đặt mẫu đang ở trạng thái "Mới",
   kèm danh sách rút gọn để nhảy thẳng vào xử lý.
2. **Xu hướng 14 ngày** — biểu đồ số liên hệ + đơn đặt mẫu theo ngày, giúp
   thấy nhịp độ tương tác tăng/giảm.
3. **Tình trạng nội dung** — cảnh báo sản phẩm hết hàng và nội dung chưa
   xuất bản (draft).

**Ngoài phạm vi:** tích hợp traffic/lượt truy cập từ Google Analytics (GA4).
Đây là hạng mục riêng, cần chuẩn bị Service Account credentials và cấp
quyền Viewer trên GA4 property trước — sẽ làm thành spec/task kế tiếp sau
khi phần này hoàn tất.

## Kiến trúc

Mở rộng endpoint hiện có `GET /admin-ui/dashboard` để trả về thêm 3 khối dữ
liệu mới, thay vì tách thành nhiều endpoint. Lý do: quy mô dữ liệu nhỏ (site
SMB), giữ 1 lần gọi API duy nhất từ frontend, và tập trung logic tổng hợp ở
một chỗ thay vì rải rác — nhất quán với cách `cards` đang hoạt động.

## Backend — `dha-cms/src/api/admin-ui/services/resources.js`

### Response shape mới

```json
{
  "cards": [ /* giữ nguyên như hiện tại */ ],
  "pending": {
    "contactInquiries": {
      "count": 3,
      "recent": [
        { "documentId": "abc123", "name": "Nguyễn Văn A", "service": "...", "createdAt": "2026-07-02T10:00:00.000Z" }
      ]
    },
    "orderRequests": {
      "count": 2,
      "recent": [
        { "documentId": "xyz789", "customerName": "...", "productName": "...", "quantity": 5, "createdAt": "..." }
      ]
    }
  },
  "trends": {
    "days": ["20/06", "21/06", "...", "03/07"],
    "contactInquiries": [0, 1, 2, 0, ...],
    "orderRequests": [1, 0, 0, 3, ...]
  },
  "contentHealth": {
    "outOfStockProducts": 2,
    "draftItems": [
      { "type": "news", "label": "Tin tức", "count": 2 },
      { "type": "projects", "label": "Dự án", "count": 1 }
    ]
  }
}
```

### Logic tính toán

- **pending**: với mỗi resource (`contact-inquiries`, `order-requests`),
  dùng `strapi.documents(uid).count({ filters: { status: 'new' } })` và
  `findMany({ filters: { status: 'new' }, sort: { createdAt: 'desc' }, limit: 5 })`.
- **trends**: tính mốc `startDate = now - 14 ngày`. Với mỗi resource, gọi 1
  lần `findMany({ filters: { createdAt: { $gte: startDate } }, fields: ['createdAt'], limit: 1000 })`
  (giới hạn cao thay vì không giới hạn, vì chưa xác nhận document service
  service hỗ trợ "unlimited" — 1000 bản ghi liên hệ/đơn hàng trong 14 ngày
  là dư thừa nhiều lần so với quy mô site hiện tại), sau đó gom nhóm theo
  ngày (`YYYY-MM-DD`) trong JS. Sinh mảng 14 ngày liên tục (label `dd/mm`)
  rồi map count tương ứng, ngày không có dữ liệu = 0.
- **contentHealth**:
  - `outOfStockProducts`: `strapi.documents('api::product.product').count({ filters: { in_stock: false } })`.
  - `draftItems`: lặp qua `listResourceConfigs()`, với mỗi config có
    `draftAndPublish: true`, đếm `count({ filters: { publishedAt: { $null: true } } })`;
    chỉ đưa vào mảng kết quả nếu `count > 0` (giữ payload gọn, đúng nghĩa
    "cảnh báo" thay vì báo cáo đầy đủ).

Tất cả các query độc lập chạy song song bằng `Promise.all`.

## Frontend — `admin/src/pages/DashboardPage.jsx`

Giữ nguyên khối "Tổng quan nội dung" (metric-grid các `cards`) ở đầu trang.
Thêm 3 section mới bên dưới, theo đúng thứ tự:

### 1. "Cần xử lý"
Layout 2 cột (`.card-grid`), mỗi cột là 1 `.card`:
- Tiêu đề + số đếm lớn (vd: "Liên hệ mới — 3").
- Danh sách tối đa 5 dòng: tên + thông tin phụ (dịch vụ / sản phẩm) + thời
  gian tạo (định dạng `dd/mm HH:mm` bằng `toLocaleString('vi-VN')`, không
  cần thư viện relative-time).
- Mỗi dòng là `<Link to="/resources/{type}/{documentId}">` để nhảy thẳng
  vào xử lý.
- Nếu `count === 0`: hiện dòng "Không có yêu cầu mới" thay vì danh sách rỗng.

### 2. "Xu hướng 14 ngày"
1 `.card` chứa component SVG viết tay (không thêm chart library — admin
hiện không có dependency chart nào, giữ bundle nhẹ):
- 2 đường (polyline) cho `contactInquiries` và `orderRequests`, scale theo
  giá trị max trong tập dữ liệu.
- Legend 2 màu (dùng `--brand` cho liên hệ, thêm 1 màu accent mới cho đơn
  hàng).
- Trục X hiện nhãn ngày, có thể bỏ bớt nhãn xen kẽ nếu 14 điểm quá dày.
- Component đặt trong file riêng `admin/src/components/TrendChart.jsx` để
  `DashboardPage.jsx` không phình to.

### 3. "Tình trạng nội dung"
1 `.card`:
- Số "Sản phẩm hết hàng" — hiện nổi bật (màu cảnh báo) nếu > 0, mờ/ẩn nếu 0.
  Click → `/resources/products`.
- Danh sách chip cho từng mục trong `draftItems` (vd: "Tin tức (2)"), mỗi
  chip là `<Link to="/resources/{type}">`. Nếu `draftItems` rỗng, hiện dòng
  "Không có nội dung nháp".

### Error handling
Giữ pattern hiện tại: `apiRequest('/dashboard')` 1 lần trong `useEffect`.
Nếu request lỗi, set state rỗng cho tất cả khối (như code hiện tại đang làm
với `cards`) — không hiện lỗi riêng cho từng widget vì cùng 1 nguồn dữ liệu.
Nếu 1 field cụ thể thiếu trong response (vd trong lúc rollout), section
tương ứng tự ẩn thay vì crash (dùng optional chaining + fallback `[]`/`{}`).

## Testing

Repo đã có `tests/admin-ui-config.test.js` và `tests/admin-app.test.js`
(chạy bằng `node --test`, static/regex checks trên source, không khởi động
Strapi runtime thật) và Playwright e2e (`tests/e2e/admin-*.spec.js`).

- Backend: thêm test tĩnh vào `tests/admin-ui-config.test.js` xác nhận
  `dashboard()` trả về đủ 4 khối (`cards`, `pending`, `trends`,
  `contentHealth`) và không lộ field nhạy cảm (vd `email`, `message` đầy đủ
  của contact-inquiry) trong danh sách `recent` — theo đúng pattern
  regex-on-source đã dùng trong file này.
- Frontend: xác minh bằng dev server + preview tool trong trình duyệt — tạo
  vài `contact-inquiry`/`order-request` mẫu qua Strapi console hoặc seed data
  để thấy đủ 3 khối render đúng với dữ liệu thật; không cần thêm Playwright
  spec mới cho scope này trừ khi phát sinh lỗi khó tái hiện bằng tay.
- Regression: chạy `npm test` (root) để đảm bảo `admin-ui-config.test.js`
  và `admin-app.test.js` hiện có vẫn pass, và khối "Tổng quan nội dung"
  (cards) không đổi hành vi.
