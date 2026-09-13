# Hướng dẫn Vận hành Headless CMS - DHA Minerals

Nội dung website nằm trên **Sanity** (Content Lake, dataset private). Máy chủ
nhỏ **`dha-api/`** (Koa) đứng giữa: phục vụ API công khai `/api/*` đúng dạng
Strapi 5 mà `app.js` đang đọc, nhận form liên hệ/đặt mẫu, và phục vụ khu quản
trị riêng `/admin`. Ảnh nằm ở Cloudinary. Thiết kế: `docs/superpowers/specs/2026-09-13-strapi-to-sanity-design.md`.

## 1. Chạy ở máy phát triển

```bash
npm run api:install
cp dha-api/.env.example dha-api/.env   # điền SANITY_* (dataset development) + ADMIN_UI_SESSION_SECRET
./start.sh                             # dha-api :1337 + frontend :3000
npm run admin:dev                      # khu quản trị :5173 (proxy /api sang :1337)
```

Dataset dev trống thì nạp dữ liệu mẫu từ `data/`:

```bash
node dha-api/scripts/seed-from-json.js > dha-api/out/seed.ndjson
SANITY_AUTH_TOKEN=... npx sanity@latest datasets import dha-api/out/seed.ndjson development \
  --project-id "$SANITY_PROJECT_ID" --replace
```

## 2. Tài khoản quản trị

Không còn trang tạo tài khoản kiểu Strapi. Dùng CLI (mật khẩu nhập ẩn, không qua đối số):

```bash
cd dha-api
node --env-file=.env scripts/admin-user.js create ten@dhakimloaimau.vn --first=Tên --last=Họ
node --env-file=.env scripts/admin-user.js set-password ten@dhakimloaimau.vn
node --env-file=.env scripts/admin-user.js disable ten@dhakimloaimau.vn
```

## 3. Dự phòng khi API lỗi (Static Fallback)

Khi `/api` không trả lời, `app.js` tự đọc các file JSON tĩnh trong `data/`
(trừ slide trang chủ, cố ý không có bản dự phòng). Dataset Sanity gói free bị
**chặn cứng** khi hết hạn mức tháng — dha-api cache đọc 5 phút và xoá cache mỗi
lần ghi để giữ số request thấp. Hạn mức thực tế của project ghi ở đây khi tạo:
_(điền ở runbook bước 1)_.

---

## Custom Admin tại `/admin`

Admin riêng được xây bằng React/Vite trong thư mục `admin/`, gọi `/api/admin-ui/*`
của `dha-api`.

Biến môi trường của `dha-api` (xem `dha-api/.env.example`):

```env
SANITY_PROJECT_ID=...
SANITY_DATASET=production
SANITY_API_TOKEN=...          # quyền Editor, chỉ nằm trên máy chủ
ADMIN_UI_SESSION_SECRET=replace-with-random-secret
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
FRONTEND_URL=http://localhost:3000
HOST=127.0.0.1                # trên VPS: chỉ nghe nội bộ, nginx đứng trước
```

Không đưa `SANITY_API_TOKEN`, `CLOUDINARY_URL`, `CLOUDINARY_API_SECRET` vào frontend.

### Hướng dẫn sử dụng ngay trong admin

Khu quản trị có sẵn tour chỉ việc bằng lớp phủ. Lần đầu đăng nhập, tour **Làm quen
khu quản trị** tự chạy một lần; xem xong (hoặc bấm đóng) là thôi, ghi nhớ trong
trình duyệt của từng người qua `localStorage` khoá `dha-admin-tour-seen`.

Nút dấu hỏi trên thanh trên cùng mở lại hướng dẫn bất cứ lúc nào, và gợi ý đúng
bài của màn hình đang mở. Chấm xanh trên nút nghĩa là màn hình này còn bài chưa xem.

Mã nguồn nằm trong `admin/src/tour/`:

*   `tourSteps.js` — nội dung các tour và ánh xạ đường dẫn → tour. Sửa lời hướng
    dẫn hay thêm bước thì chỉ động vào file này.
*   `tourPlacement.js` — lọc bước và tính vị trí bong bóng (thuần, có test riêng).
*   `TourProvider.jsx` / `TourOverlay.jsx` / `TourButton.jsx` — trạng thái, lớp phủ, nút mở.

Mỗi bước neo vào thuộc tính `data-tour="..."` đặt sẵn trên giao diện. **Đổi tên hay
xoá một `data-tour` là làm hụt một bước hướng dẫn** — `tests/admin-tour.test.js`
canh chỗ này, chạy `npm test` trước khi sửa giao diện admin.

Muốn xem lại tour tổng quan từ đầu như người dùng mới: xoá khoá `dha-admin-tour-seen`
trong localStorage rồi tải lại trang.

### Thanh menu động

Mục **Thanh menu** trong admin (`/admin/menu`) quản lý thanh điều hướng chính của
website: sửa tên hiển thị và đường dẫn, kéo thả để sắp xếp, ẩn/hiện, thêm hoặc
xoá mục, và tạo menu con hai cấp (nút `→` biến một mục thành mục con của mục ngay
trên nó, nút `←` đưa nó trở lại cấp 1).

Dữ liệu nằm trong document `navigation` (`items` kiểu JSON), đọc công khai qua
`GET /api/navigation` và ghi qua `GET|PUT /api/admin-ui/navigation`. Menu mặc định
nằm trong `dha-api/src/defaults/default-items.js` chứ không nằm ở `data/`. Backend chỉ
chấp nhận đường dẫn nội bộ (`/...`, `#...`) hoặc `http(s)://...`, tối đa 2 cấp.

Menu 8 mục viết sẵn trong các file HTML vẫn giữ nguyên và đóng vai trò dự phòng:
`app.js` chỉ thay thế khi đọc được dữ liệu từ CMS, nên website không mất điều
hướng nếu CMS lỗi. Đổi đường dẫn của một mục **không** tạo trang mới — trỏ tới
địa chỉ chưa tồn tại thì người xem sẽ gặp 404, admin có cảnh báo cho trường hợp này.

### Triển khai (Production)

*   Nginx phục vụ `/admin` như static site (`try_files $uri $uri/ /admin/index.html;`), trỏ vào `admin/dist` đã build, được rsync vào `/var/www/dhakimloaimau.vn/admin/`.
*   Nginx proxy `/api/` sang `dha-api` (`http://127.0.0.1:1337`, pm2 app `dha-api`, cấu hình ở `/var/www/dha-api/.env`).
*   `deploy/deploy.sh` chỉ build & sync `admin/` hoặc `dha-api/` khi thư mục đó đổi. Chưa có `/var/www/dha-api/.env` thì chỉ chép code, không khởi động.
*   Sao lưu: `deploy/backup-sanity.sh` (cron hằng tuần) xuất dataset vào `/var/backups/dha-sanity`.
*   Chuyển từ Strapi và rollback: `docs/runbooks/2026-09-strapi-to-sanity-cutover.md`.

## Test tự động (Playwright)

`tests/e2e/` chứa test trình duyệt thật bằng Playwright, mặc định chạy nhắm vào production (`https://dhakimloaimau.vn`) — khác với `tests/*.test.js` ở root (chỉ kiểm tra bằng regex trên source code, không mở trình duyệt).

Cài đặt (một lần):

```bash
npm install
npx playwright install --with-deps chromium
```

Chạy test không cần đăng nhập (an toàn tuyệt đối, chỉ đọc — trang chủ, sản phẩm, dự án, tin tức, form liên hệ):

```bash
npm run test:e2e
```

Để chạy thêm các test cần đăng nhập admin (đăng nhập/đăng xuất, tạo-sửa-xóa một bài tin tức test, upload/xóa một ảnh test trong `ha-can/settings`):

1.  Sao chép `.env.e2e.example` thành `.env.e2e` (đã gitignore, không commit).
2.  Điền `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` bằng một tài khoản quản trị thật (tạo bằng `dha-api/scripts/admin-user.js`).
3.  Chạy lại `npm run test:e2e`.

Các test có ghi dữ liệu (tạo tin tức, upload ảnh) luôn tự xóa dữ liệu test ngay sau khi chạy — kể cả khi assertion phía trên bị fail — để không để lại rác `[E2E TEST] ...` hay ảnh test trên production. Muốn nhắm vào môi trường khác, đặt `E2E_BASE_URL` trong `.env.e2e`.

Xem giao diện chạy test trực quan: `npm run test:e2e:ui`.
