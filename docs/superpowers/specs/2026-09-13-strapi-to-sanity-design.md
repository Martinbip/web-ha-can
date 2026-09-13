# Chuyển Strapi sang Sanity — Thiết kế

Ngày: 2026-09-13 · Trạng thái: chờ duyệt

## 1. Mục tiêu và phạm vi

**Mục tiêu:** bỏ Strapi (`dha-cms/`: Strapi 5, SQLite, backup CSDL, migration schema) và đưa nội dung lên Sanity Content Lake, **không đổi trải nghiệm** của website công khai lẫn khu quản trị riêng.

**Đã chốt với chủ dự án:**

| Câu hỏi | Quyết định |
|---|---|
| Động cơ | Bỏ tự vận hành Strapi, giảm gánh bảo trì |
| Khu quản trị `admin/` | Giữ nguyên, nối Sanity qua lớp Node trung gian |
| Hosting | Giữ VPS, nginx phục vụ file tĩnh |
| Form công khai | Một service Node nhỏ trên VPS |
| Media | Giữ Cloudinary, Sanity chỉ lưu URL/public_id |
| Dữ liệu cũ | Xuất từ Strapi production, nạp toàn bộ vào Sanity |

**Trong phạm vi:** service mới `dha-api/`, adapter Sanity, script chuyển dữ liệu, script đối chiếu, cập nhật deploy (pm2, nginx, `deploy.sh`), dời và cập nhật test.

**Ngoài phạm vi:** sửa `app.js`, `admin/src`, `preview.html`, các file HTML; Sanity Studio; cho frontend đọc thẳng Sanity CDN (phương án B/C — làm sau nếu cần).

**Lỗi đã biết, không sửa trong đợt này:** `preview.html` xem trước tin tức gọi `GET /api/news/:documentId`, nhưng route thật là `news-articles` → hiện nhiều khả năng đang 404 trên Strapi. `dha-api` giữ đúng hành vi đó để việc đối chiếu hai bên còn ý nghĩa; sửa riêng sau khi chuyển xong.

## 2. Kiến trúc

```
Trình duyệt ──► nginx (VPS)
                 ├─ /            file tĩnh (HTML, app.js, data/*.json)
                 ├─ /admin       admin/dist (React, không đổi)
                 └─ /api/        ──► dha-api (Koa, pm2, 127.0.0.1:1337)
                                        ├─ Sanity Content Lake (@sanity/client, token server)
                                        └─ Cloudinary (ký upload phía server)
```

`dha-api` **giữ nguyên hợp đồng HTTP** mà Strapi đang phục vụ: đường dẫn, tham số query, dạng JSON trả về, cookie phiên. Mọi thứ phía trình duyệt không đổi.

Chọn **Koa** (không phải Express) vì các service hiện có viết theo `ctx` của Koa — Strapi chạy trên Koa — nên port gần như nguyên văn.

### Cấu trúc thư mục

```
dha-api/
  package.json              koa, @koa/router, koa-body, @sanity/client, cloudinary, bcryptjs
  src/server.js             tạo app Koa, gắn middleware + router, listen
  src/config.js             đọc và kiểm tra biến môi trường
  src/sanity/client.js      tạo @sanity/client
  src/sanity/store.js       store.documents(type) — adapter giả lập Strapi Document Service
  src/sanity/query-engine.js  lọc / sắp xếp / phân trang trong bộ nhớ (hàm thuần)
  src/sanity/cache.js       cache đọc trong tiến trình, xoá sạch khi có lượt ghi
  src/http/strapi-query.js  đọc `sort=`, `pagination[...]`, `filters[...]`, `status=`
  src/http/cors.js          port từ dha-cms/config/middlewares.js
  src/http/rate-limit.js    port từ dha-cms/src/middlewares/rate-limit.js
  src/routes/public.js      API công khai (đọc + 2 form)
  src/routes/admin-ui.js    port từ dha-cms/src/api/admin-ui/routes
  src/services/             auth, resources, resource-config, media, navigation,
                            dashboard-metrics, errors — port từ admin-ui/services
  src/hooks/product-category.js  port lifecycles dọn mã danh mục mồ côi
  src/hooks/site-setting.js      port prerender.js + lifecycles site-setting
  src/defaults/             default-items.js, default-categories.js (chép nguyên)
  scripts/migrate-from-strapi.js
  scripts/seed-from-json.js
  scripts/admin-user.js
  scripts/compare-apis.js
  src/schemas/              schema.json của Strapi, đổi tên theo sanityType
  src/sanity/store-registry.js  setStore()/getStore() — services lấy store qua đây
```

## 3. Mô hình dữ liệu trên Sanity

Content Lake không bắt buộc schema; **`resource-config.js` tiếp tục là nguồn sự thật** cho trường, nhãn và ràng buộc (như hiện nay).

### Tên type

| Strapi uid | Đường dẫn công khai | Sanity `_type` | Nháp/xuất bản |
|---|---|---|---|
| api::news.news | news-articles | `news` | có |
| api::product.product | products | `product` | không |
| api::product-category.product-category | product-categories | `productCategory` | không |
| api::project.project | projects | `project` | có |
| api::service.service | services | `service` | có |
| api::hero-slide.hero-slide | hero-slides | `heroSlide` | có |
| api::workflow-step.workflow-step | workflow-steps | `workflowStep` | có |
| api::pricing-package.pricing-package | pricing-packages | `pricingPackage` | không |
| api::pricing-analysis.pricing-analysis | pricing-analyses | `pricingAnalysis` | có |
| api::pricing-survey.pricing-survey | pricing-surveys | `pricingSurvey` | có |
| api::ore.ore | ores | `ore` | có |
| api::site-setting.site-setting | site-setting | `siteSetting` (singleton) | không |
| api::navigation.navigation | navigation | `navigation` (singleton) | không |
| api::contact-inquiry.contact-inquiry | contact-inquiries (POST) | `contactInquiry` | không |
| api::order-request.order-request | order-requests (POST) | `orderRequest` | không |
| admin::user | — | `adminUser` | không |

Cột "Nháp/xuất bản" đã đối chiếu với `draftAndPublish` trong từng `schema.json` hiện tại. `ore` không có trong `resource-config.js` (không sửa được từ admin) nên adapter đọc cờ nháp từ một bảng riêng trong `store.js` cho mọi type.

Trong `resource-config.js`, trường `uid: 'api::…'` được thay bằng `sanityType: '…'`.

### Quy ước document

- **`_id` = `documentId` của Strapi** (chuỗi 24 ký tự chữ-số, hợp lệ với Sanity). Mọi liên kết/tham chiếu dùng `documentId` giữ nguyên giá trị. Document mới tạo dùng id ngẫu nhiên cùng định dạng.
- Singleton dùng `_id` cố định: `siteSetting`, `navigation`.
- Type có nháp: bản nháp ở `drafts.<id>`, bản đã xuất bản ở `<id>`. Type không có nháp: chỉ có `<id>`.
- Trường tường minh lưu trên mọi document: `createdAt` (ISO, đặt khi tạo, mang theo từ Strapi khi chuyển), và với type có nháp, `publishedAt` (đặt mỗi lần xuất bản — đúng ngữ nghĩa Strapi 5, vì `projects` sắp xếp theo `publishedAt:desc`). `updatedAt` lấy từ `_updatedAt` của Sanity.
- Trường của từng type giữ **nguyên tên và kiểu JSON** như Strapi trả hiện nay (`sort_order`, `in_stock`, `specs`, `items`…). Không đổi sang slug object hay Portable Text.
- `adminUser` dùng `_id` có dấu chấm: `adminUser.<id>` (xem mục 3a).

Các file `schema.json` của Strapi được chép sang `dha-api/src/schemas/<sanityType>.json` và giữ vai trò hợp đồng trường: `validate` hai form công khai đọc ràng buộc từ đó, và test đối chiếu `resource-config.js` với chúng như hiện nay.

### 3a. Dataset phải private

Dataset chứa hash mật khẩu quản trị và thông tin cá nhân của khách (tên, số điện thoại, địa chỉ). Dataset public thì ai cũng đọc được bằng một truy vấn GROQ không cần token. Ba lớp chặn:

1. Tạo mọi dataset bằng `--visibility private`.
2. `adminUser` dùng `_id` có dấu chấm — Sanity không trả document có dấu chấm trong id cho truy vấn không xác thực, kể cả khi dataset lỡ để public.
3. Lúc khởi động, `dha-api` chạy một truy vấn **không token** đếm `contactInquiry`, `orderRequest`, `adminUser`. Kết quả khác 0 → ghi lỗi và thoát, không phục vụ request nào.

## 4. Lõi: `store.documents(type)`

Adapter tái tạo đúng phần API của Strapi Document Service mà code hiện có đang gọi (13 chỗ gọi `strapi.documents(uid)` trong `resources.js`, `media.js`, `navigation.js`):

| Phương thức | Hành vi |
|---|---|
| `findMany({fields, filters, sort, start, limit, status})` | `status` mặc định `'draft'`: trả bản nháp nếu có, không thì bản xuất bản, **`publishedAt: null`** (y như Strapi, để `mergePublishedAt()` chạy không đổi). `status: 'published'`: chỉ bản xuất bản. |
| `findOne({documentId, fields, status})` | như trên, một bản ghi hoặc `null` |
| `count({filters})` | số document thoả điều kiện (tính theo document, không đếm đôi nháp + xuất bản) |
| `create({data})` | type có nháp → tạo `drafts.<id>`; không nháp → tạo `<id>`. Đặt `createdAt`. |
| `update({documentId, data})` | patch `set` các trường vào bản nháp (tạo nháp từ bản xuất bản nếu chưa có) hoặc vào `<id>` với type không nháp |
| `delete({documentId})` | xoá cả `<id>` và `drafts.<id>` trong một transaction |
| `publish({documentId})` | transaction: `createOrReplace(<id>)` từ nội dung nháp + `publishedAt = now`, rồi `delete(drafts.<id>)` |
| `unpublish({documentId})` | transaction: `createOrReplace(drafts.<id>)` từ bản xuất bản, rồi `delete(<id>)` |

Mọi lượt ghi xoá toàn bộ cache đọc (mục 6).

**Truy vấn:** mỗi lời gọi chạy một GROQ `*[_type == $type]` (perspective `raw`, `useCdn: false`), gộp cặp nháp/xuất bản trong Node, rồi đưa qua `query-engine.js` để lọc, sắp xếp, phân trang. Lọc trong bộ nhớ là chủ ý:

- Dữ liệu nhỏ (lớn nhất là `product` ~500 bản ghi; form liên hệ/đơn hàng tăng chậm).
- GROQ không có toán tử "chứa chuỗi con, không phân biệt hoa thường" (`match` tách theo từ), nên `$containsi` không dịch được chính xác.
- Giữ đúng ngữ nghĩa Strapi mà không phải dịch từng toán tử.

Toán tử hỗ trợ: `$or`, `$eq`, `$in`, `$null`, `$contains`, `$containsi`, và giá trị trần (`{status: 'new'}` ≡ `$eq`). Toán tử khác → ném lỗi rõ ràng (lỗi lập trình, không im lặng bỏ qua). Khi một type vượt 5.000 document, ghi cảnh báo vào log — ngưỡng để xem xét đẩy lọc xuống GROQ.

## 5. HTTP

### API công khai (`src/routes/public.js`)

| Route | Hành vi |
|---|---|
| `GET /api/:plural` | danh sách, **chỉ bản đã xuất bản** |
| `GET /api/:plural/:documentId` | một bản ghi đã xuất bản, không có → 404 |
| `GET /api/site-setting`, `GET /api/navigation` | singleton |
| `POST /api/contact-inquiries`, `POST /api/order-requests` | validate, ép `status = 'new'`, tạo document |

`:plural` lấy theo bảng mục 3; tên không có trong bảng → 404.

Tham số query hiểu được: `sort=field:asc|desc` (nhiều giá trị, cách nhau dấu phẩy), `pagination[limit]`, `pagination[start]`, `pagination[page]`, `pagination[pageSize]`, `filters[field][$op]=…`. Mặc định 25, trần 100 — y như `dha-cms/config/api.js` (`defaultLimit: 25, maxLimit: 100`). Frontend xin tới 500 nhưng Strapi hiện chỉ trả 100; giữ nguyên để hai bên đối chiếu được. Tham số `status` bị bỏ qua: API công khai luôn chỉ trả bản đã xuất bản.

Dạng trả về theo Strapi 5 (phẳng, không có `attributes`):

```json
{ "data": [{ "id": "<documentId>", "documentId": "…", "createdAt": "…", "updatedAt": "…", "publishedAt": "…", "…": "…" }],
  "meta": { "pagination": { "page": 1, "pageSize": 25, "pageCount": 1, "total": 3 } } }
```

`id` trả về bằng `documentId` (Strapi trả số nguyên). Đã kiểm: nơi duy nhất frontend đọc `id` là `app.js:1731`, dùng làm `value` của option trong bộ dự tính, giá lấy từ `data-price` — đổi sang chuỗi không ảnh hưởng. `preview.html` tra theo `documentId`, vẫn khớp.

**Validate hai form** — chép nguyên ràng buộc từ `schema.json` hiện tại:

- `contactInquiry`: `name` 2–200, `phone` khớp `^[0-9+\-\s()]{8,20}$`, `email` hợp lệ ≤254 (tuỳ chọn), `address` 5–500, `service` ∈ {cung-cap-mau, phan-tich-lab, khao-sat-mo, tuyen-khoang} (mặc định cung-cap-mau), `message` ≤2000.
- `orderRequest`: `product_name` 2–200, `product_uid` ≤100, `customer_name` 2–200, `phone` như trên, `email` tuỳ chọn, `quantity` ≥ 0.01, `unit` ∈ {kg, tan} (mặc định kg), `note` ≤2000.
- Nhận cả body `{data: {...}}` (dạng `app.js` đang gửi) lẫn body phẳng. Trường lạ bị bỏ. Sai → 400 với `{error: {status, name: 'ValidationError', message}}`.
- Giới hạn tần suất theo IP, cửa sổ 15 phút, đúng như route Strapi hiện tại: `contact-inquiries` **5** lượt, `order-requests` **10** lượt.

### API khu quản trị (`src/routes/admin-ui.js`)

Giữ nguyên 17 route `/api/admin-ui/*`. `POST /api/admin-ui/auth/login` giữ giới hạn riêng **5 lượt / 15 phút / IP**. Controller và service port nguyên văn, chỉ thay:

- `strapi.documents(config.uid)` → `store.documents(config.sanityType)`.
- `auth.js`: `findAdminUser` / `validateAdminPassword` đọc document `adminUser` (`email`, `passwordHash`, `firstname`, `lastname`, `isActive`) và so bằng `bcryptjs`. Cookie `ha_can_admin_session`, định dạng HMAC, TTL 8 giờ, `ADMIN_UI_SESSION_SECRET` giữ nguyên → phiên đang đăng nhập vẫn hợp lệ sau khi chuyển.
- Hook sau ghi trong `resources.js` gọi tường minh (thay cho lifecycles Strapi):
  - `productCategory` đổi `slug` → thay mã cũ bằng mã mới trong `categories` của mọi `product`; xoá danh mục → gỡ mã đó khỏi mọi `product`.
  - `siteSetting` tạo/cập nhật → `schedulePrerender()` (port nguyên `prerender.js`, gồm cơ chế trễ 1,5 s và gộp lượt).

### Middleware chung

CORS (danh sách origin như hiện nay: localhost:3000, 127.0.0.1:3000, `FRONTEND_URL`, `credentials: true`), body JSON ≤ 1 MB, bắt lỗi toàn cục trả JSON 500 không lộ stack, log mỗi request một dòng.

`app.proxy` lấy từ `IS_BEHIND_PROXY`, mặc định `true` khi `NODE_ENV=production` — y như `dha-cms/config/server.js`. Thiếu nó thì mọi khách đều mang IP của nginx, mọi rate limit dồn chung một bucket và khoá tất cả quản trị viên sau vài lượt đăng nhập (lỗi đã từng gặp, ghi trong comment của `server.js`).

## 6. Cache và hạn mức Sanity

Gói free của Sanity **chặn cứng** truy cập API khi hết 100% hạn mức tháng; nội dung website ngừng tải cho đến ngày 1 tháng sau. Vì vậy:

- `cache.js`: cache kết quả `fetch` theo khoá (type + perspective), TTL 5 phút, **xoá toàn bộ khi `dha-api` ghi bất cứ gì**. Chỉ một tiến trình ghi (pm2 `instances: 1`) nên xoá cache tại chỗ là đủ để admin sửa xong là web đổi ngay.
- Hệ quả: lượng request lên Sanity tỉ lệ với số lượt ghi và số lần hết hạn cache, không tỉ lệ với lưu lượng khách.
- Khi Sanity lỗi, `app.js` đã tự rơi về `data/*.json` với hầu hết endpoint (trừ `hero-slides`, cố ý không có fallback).
- Lúc tạo project: ghi lại con số hạn mức thực tế của gói vào README và bật email cảnh báo 80%.

## 7. Chuyển dữ liệu (`scripts/migrate-from-strapi.js`)

Chạy **trên VPS**, lúc Strapi còn chạy:

1. Đọc nội dung qua REST của Strapi bằng API token full-access, với `status=draft` và `status=published` cho mỗi type có nháp → biết bản nào đã xuất bản và `publishedAt` thật. Gồm cả `contact-inquiries`, `order-requests`, `ores`. Lấy **hợp** hai tập theo `documentId`: bản ghi do seed cũ tạo chỉ có dòng xuất bản, không có dòng nháp.
2. Đọc `admin_users` trực tiếp từ file SQLite (`better-sqlite3` mượn từ `node_modules` của Strapi trên VPS, mở chế độ chỉ đọc). Chép **nguyên bcrypt hash** (`$2a$10$…`) → quản trị viên đăng nhập bằng mật khẩu cũ. `isActive = is_active && !blocked`.
3. Tìm URL dạng `/uploads/…` (media cục bộ của Strapi, ví dụ `project.image`). Mỗi file tìm thấy được upload lên Cloudinary thư mục `dha/legacy` và thay URL trong dữ liệu. Liệt kê trong báo cáo.
4. Ghi NDJSON: bản xuất bản ở `<documentId>`; nếu nháp khác bản xuất bản thì thêm `drafts.<documentId>`; bản chưa từng xuất bản chỉ ở `drafts.<documentId>`.
5. In báo cáo: số lượng theo type (nháp/xuất bản), số admin user, số file media đã chuyển, bản ghi bị bỏ kèm lý do.
6. Nạp: `sanity datasets import out.ndjson staging --replace` → đối chiếu (mục 8) → nạp `production` bằng cùng lệnh.

Script chạy lại được: `--replace` cùng `_id` cố định cho kết quả giống hệt nhau.

Các script đi kèm:

- `seed-from-json.js`: dựng dataset dev từ `data/*.json` + `src/defaults/`, thay cho phần seed trong `dha-cms/src/index.js`; seed không còn chạy khi khởi động.
- `admin-user.js`: `create <email>` / `set-password <email>` / `disable <email>`, hỏi mật khẩu qua stdin, không nhận qua đối số dòng lệnh.

## 8. Đối chiếu và chuyển đổi

`scripts/compare-apis.js <gốc-A> <gốc-B>` gọi cùng một danh sách endpoint trên cả hai bên — mọi lời gọi của `app.js`, `preview.html`, `scripts/*.js` và các GET của admin-ui (có cookie) — rồi so JSON sau khi chuẩn hoá (bỏ `id` số, chuẩn định dạng thời gian). Có khác biệt → in diff, trả mã thoát ≠ 0.

Trình tự:

1. `dha-api` chạy ở cổng 1338 cạnh Strapi (1337), trỏ dataset `staging`.
2. Chạy migrate → import `staging` → `compare-apis http://127.0.0.1:1337 http://127.0.0.1:1338` phải sạch.
3. Đóng băng biên tập (báo quản trị viên không sửa), migrate lại → import `production` → đối chiếu lần nữa.
4. Dừng Strapi, chạy `dha-api` ở 1337 trỏ `production`; bỏ các location nginx riêng của Strapi (`/strapi-admin`, `/content-manager/`, `/content-type-builder/`, `/i18n/`, `/users-permissions/`, `/upload/`, `/uploads/`).
5. Chạy Playwright e2e trên production (gồm luồng đăng nhập nếu có `.env.e2e`).

**Rollback** (trong 14 ngày): dựng lại pm2 `dha-cms` và nginx cũ; thư mục `/var/www/dha-cms` cùng file SQLite giữ nguyên, không xoá. Mọi lượt ghi vào Sanity sau khi chuyển sẽ **không** có trong Strapi khi rollback — chấp nhận, ghi rõ trong runbook. Sau 14 ngày ổn định: nén SQLite để lưu trữ, xoá `dha-cms/` khỏi repo.

## 9. Triển khai

- `deploy/ecosystem.config.js`: app `dha-api`, `node --env-file=.env src/server.js`, `instances: 1`, `max_memory_restart: '256M'`, **không** đặt `PORT` trong `env` của pm2 (`--env-file` không ghi đè biến đã có, cổng phải lấy từ `.env` để chạy song song ở 1338). Cấu hình cũ giữ ở `deploy/ecosystem.strapi-rollback.config.js` cho tới hết 14 ngày.
- `deploy/deploy.sh`: đoạn đồng bộ `dha-cms/` đổi thành `dha-api/` (vẫn chỉ chạy khi thư mục đó đổi), `npm ci --omit=dev`, `pm2 restart dha-api`. Chưa có `/var/www/dha-api/.env` thì chỉ chép code, không khởi động (Strapi còn giữ cổng 1337 cho tới ngày chuyển).
- Rsync frontend hiện chép gần hết repo vào thư mục web công khai; thêm `--exclude` cho `dha-api/` và `docs/` (spec, plan, runbook có IP máy chủ và quy trình vận hành).
- `deploy/nginx.conf`: giữ `/api/` → 127.0.0.1:1337, bỏ các location ở bước 4 mục 8.
- `deploy/backup-strapi.sh`: thay bằng lệnh cron `sanity datasets export production` hằng tuần (backup nội dung vẫn cần, chỉ nhẹ hơn nhiều).
- Biến môi trường `dha-api`: `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_TOKEN` (quyền Editor), `SANITY_API_VERSION`, `ADMIN_UI_SESSION_SECRET` (giá trị cũ), `CLOUDINARY_URL`, `FRONTEND_URL`, `PORT`, `HOST` (trên VPS đặt `127.0.0.1`: chỉ nginx gọi vào), `IS_BEHIND_PROXY`, `PRERENDER_SCRIPT`, `SITE_HTML_DIR`. `config.js` thoát ngay kèm thông báo rõ nếu thiếu biến bắt buộc.

## 10. Kiểm thử

Mốc hiện tại: `npm test` 285/285 pass.

- 12 file test đang đọc đường dẫn `dha-cms/…` được trỏ sang `dha-api/…`. Test kiểm hành vi Strapi-riêng (`schema.json`, seed trong `index.js`, lifecycles, `config/middlewares.js`) được viết lại để kiểm thứ tương đương mới (validate form, `seed-from-json.js`, hook, `cors.js`). **Không xoá test nào mà không có test thay thế cho cùng hành vi.**
- Test mới đặt ở `tests/` gốc như mọi test khác (`regression.test.js` bắt mọi file `tests/*.test.js` phải có trong `npm test`), `node --test`, không cần mạng. Test service cũ vẫn chạy trên `createFakeStore()` của `tests/helpers/admin-ui-harness.js` (bản giả document service hiện có, đổi khoá từ uid sang sanityType), gắn qua `setStore()` thay cho `global.strapi`. Một bộ test hợp đồng chung chạy trên cả bản giả lẫn adapter thật, để bảo đảm hai bên hành xử giống nhau:
  - `query-engine`: từng toán tử lọc, sắp xếp nhiều khoá, phân trang, `$containsi` với tiếng Việt có dấu.
  - `store`: chạy trên client Sanity giả lập trong bộ nhớ (hỗ trợ `fetch` + `transaction`) — tạo/sửa/xoá/xuất bản/gỡ xuất bản, `status` draft vs published, `publishedAt: null` ở bản nháp, `count` không đếm đôi.
  - `strapi-query`: phân tích mọi chuỗi query mà `app.js` đang gửi.
  - Hợp đồng HTTP: dựng app Koa với store giả, kiểm dạng JSON công khai, validate + rate limit hai form, luồng login → CRUD → publish của admin-ui.
  - Hook: đổi/xoá slug danh mục cập nhật sản phẩm; lưu cài đặt gọi prerender.
- Tiêu chí xong: `npm test` xanh toàn bộ; `compare-apis` sạch trên `staging`; e2e Playwright xanh trên production sau khi chuyển.

## 11. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Hết hạn mức gói free → web mất nội dung đến đầu tháng | Cache + xoá khi ghi (mục 6), fallback `data/*.json`, cảnh báo 80% |
| Khác biệt nhỏ về dạng JSON làm hỏng frontend | `compare-apis` trên toàn bộ endpoint trước khi chuyển |
| Mất logic ẩn trong lifecycles Strapi | Đã liệt kê đủ: dọn danh mục, prerender, seed; mỗi cái có test |
| Mất công cụ chữa cháy `/strapi-admin` | Rollback 14 ngày; về lâu dài có thể dựng Sanity Studio |
| Không còn Content-Type Builder | Thêm trường = sửa `resource-config.js` (lâu nay đã vậy) |
| Token Sanity lộ | Chỉ nằm trong env của `dha-api` trên VPS, không bao giờ gửi xuống trình duyệt |
