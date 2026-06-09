# Hướng dẫn Vận hành Headless CMS - DHA Minerals

Hệ thống quản trị nội dung (Headless CMS) đã được tích hợp thành công bằng cách sử dụng **Strapi v5** (chạy SQLite cục bộ). 

## 1. Khởi chạy dự án ở môi trường phát triển (Local)

Để chạy ứng dụng ở máy của bạn, hãy mở terminal và khởi động 2 máy chủ:

### Bước 1: Chạy Strapi CMS
Mở một cửa sổ Terminal mới và chạy:
```bash
cd dha-cms
npm run develop
```
*   **Địa chỉ CMS:** `http://localhost:1337`
*   **Trang Quản trị (Admin Panel):** `http://localhost:1337/admin`

### Bước 2: Chạy trang Web Frontend
Mở một cửa sổ Terminal khác ở thư mục gốc của trang web và chạy:
```bash
npx serve -p 3000
```
*   **Địa chỉ Web chính:** `http://localhost:3000`

---

## 2. Truy cập Bảng Quản trị & Nhập liệu

1.  Truy cập vào trang quản trị: `http://localhost:1337/admin`
2.  Khi truy cập lần đầu tiên, Strapi sẽ yêu cầu bạn đăng ký tài khoản quản trị (Administrator). Hãy điền Tên, Email, và Mật khẩu của bạn để tạo tài khoản.
3.  Sau khi đăng nhập, chọn mục **Content Manager** ở thanh menu bên trái.
4.  Tại đây, bạn sẽ thấy danh sách các Content Types được tạo sẵn và đã tự động nạp dữ liệu mặc định (auto-seed) từ thư mục `data/`:
    *   **Quặng Mẫu (Ores):** Chứa giá và nhóm quặng phục vụ bộ dự tính chi phí (Estimator).
    *   **Gói Quặng Mẫu (Pricing Packages):** Chứa các gói quặng ở trang báo giá.
    *   **Biểu phí Phân tích (Biểu Phí Phân Tích):** Đơn giá dịch vụ đo đạc phòng thí nghiệm.
    *   **Biểu phí Khảo sát (Biểu Phí Khảo Sát):** Giá dịch vụ khảo sát thực địa.
    *   **Dự án (Projects):** Danh sách các dự án địa chất.
5.  Bạn có thể bấm **Create new entry** để thêm mới, hoặc click trực tiếp vào một dòng dữ liệu để sửa và lưu. Nhấn **Publish** để áp dụng thay đổi lên website.

---

## 3. Cơ chế hoạt động & Triển khai (Static Fallback)

*   **Tải ảnh động:** Khi thêm mới một dự án trong trang quản trị, hãy bấm tải ảnh lên thư viện Media của Strapi. Hệ thống sẽ tự động tạo URL ảnh và trả về cho frontend hiển thị.
*   **Cơ chế dự phòng (Static Fallback):**
    *   Khi bạn chạy server Strapi ở cổng `1337`, Frontend (`app.js`) sẽ tự động gọi API lấy dữ liệu động mới nhất từ Strapi.
    *   Nếu Strapi tắt (offline) hoặc khi bạn triển khai trang web này lên các hosting tĩnh (như GitHub Pages, Vercel tĩnh), mã nguồn Javascript sẽ tự động chuyển sang đọc các file JSON tĩnh tương ứng trong thư mục `data/` mà không gây lỗi giao diện. Điều này đảm bảo trang web luôn hiển thị đầy đủ thông tin ở mọi môi trường.
