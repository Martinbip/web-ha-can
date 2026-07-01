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
*   **Trang Quản trị Strapi (built-in Admin Panel):** `http://localhost:1337/strapi-admin`

### Bước 2: Chạy trang Web Frontend
Mở một cửa sổ Terminal khác ở thư mục gốc của trang web và chạy:
```bash
npx serve -p 3000
```
*   **Địa chỉ Web chính:** `http://localhost:3000`

---

## 2. Truy cập Bảng Quản trị & Nhập liệu

1.  Truy cập vào trang quản trị: `http://localhost:1337/strapi-admin`
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

---

## Custom Admin tại `/admin`

Admin riêng được xây bằng React/Vite trong thư mục `admin/`.

> **Lưu ý về route:** `/admin` trước đây trỏ tới trang quản trị built-in của Strapi. Để tránh xung đột với admin riêng mới, trang quản trị built-in của Strapi đã được **chuyển sang `/strapi-admin`** (xem `dha-cms/config/admin.js`, biến `url`). Từ nay:
> *   `/admin` → Admin riêng (React/Vite, build tĩnh từ `admin/dist`).
> *   `/strapi-admin` → Trang quản trị built-in của Strapi (dùng để quản lý Content-Type Builder, users & permissions, v.v.).

Chạy local:

```bash
cd dha-cms
npm run develop
```

```bash
npm run admin:dev
```

Biến môi trường cần có trong Strapi:

```env
ADMIN_URL=/strapi-admin
ADMIN_UI_SESSION_SECRET=replace-with-random-secret
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
FRONTEND_URL=http://localhost:3000
```

Không đưa `CLOUDINARY_URL`, `CLOUDINARY_API_SECRET`, hoặc token Strapi vào frontend.

### Triển khai (Production)

*   Nginx phục vụ `/admin` như static site (`try_files $uri $uri/ /admin/index.html;`), trỏ vào thư mục `admin/dist` đã build, được rsync vào `/var/www/smadesign.vn/admin/`.
*   Nginx proxy `/strapi-admin` sang Strapi built-in admin panel (`http://127.0.0.1:1337`), thay cho `/admin` trước đây.
*   `deploy/deploy.sh` chỉ build & sync `admin/` khi phát hiện thay đổi trong thư mục đó (tương tự cơ chế đã áp dụng cho `dha-cms/`), giữ deploy nhanh khi không đổi gì ở admin.
*   Scripts hữu ích ở root `package.json`: `npm run admin:install`, `npm run admin:dev`, `npm run admin:build`.
