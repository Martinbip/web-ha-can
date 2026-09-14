# Runbook — Chuyển Strapi sang Sanity (dhakimloaimau.vn)

Thiết kế: `docs/superpowers/specs/2026-09-13-strapi-to-sanity-design.md`.
Mỗi bước ghi **kết quả mong đợi**. Không khớp thì dừng lại, không làm tiếp.

Điều kiện: Task 1–13 đã merge vào `main`, `npm test` xanh, đã chạy
`bash deploy/deploy.sh` một lần. Lần deploy đó chép `dha-api` vào
`/var/www/dha-api` nhưng **không** khởi động (chưa có `.env`).

## A. Chuẩn bị (làm bất cứ lúc nào, web không bị ảnh hưởng)

1. **Tạo project Sanity** tại https://www.sanity.io/manage → ghi `projectId`.
   Vào *Usage*, ghi hạn mức API/CDN/băng thông của gói vào mục 3 của
   `README_CMS.md`. Admin project nhận email cảnh báo ở mức 80% và 100%.
   Kiểm tra email đó tới được hộp thư đang dùng.

2. **Tạo dataset private** (máy có Node, đã `npx sanity@latest login`):
   ```bash
   for ds in development staging production; do
     npx sanity@latest dataset create "$ds" --visibility private --project-id <projectId>
   done
   npx sanity@latest dataset list --project-id <projectId>
   ```
   Mong đợi: ba dataset, đều `private`. **Không** thêm CORS origin nào cho
   project: chỉ `dha-api` gọi Sanity, trình duyệt không bao giờ gọi.

3. **Tạo token** ở *API → Tokens*, quyền **Editor**, tên `dha-api-vps`. Trên VPS:
   ```bash
   cat /var/www/dha-cms/.env | grep -E '^(ADMIN_UI_SESSION_SECRET|ADMIN_JWT_SECRET|CLOUDINARY_URL)='
   sudo -e /var/www/dha-api/.env
   chmod 600 /var/www/dha-api/.env
   ```
   Nội dung `/var/www/dha-api/.env`:
   ```env
   SANITY_PROJECT_ID=<projectId>
   SANITY_DATASET=staging
   SANITY_API_TOKEN=<token Editor>
   ADMIN_UI_SESSION_SECRET=<chép nguyên giá trị đang dùng ở dha-cms: ADMIN_UI_SESSION_SECRET, không có thì ADMIN_JWT_SECRET>
   CLOUDINARY_URL=<chép từ dha-cms>
   FRONTEND_URL=https://dhakimloaimau.vn
   HOST=127.0.0.1
   PORT=1338
   ```
   Kiểm `node -v` ≥ 22.12 (`@sanity/client` 8 đòi). Thấp hơn thì nâng Node trên VPS
   trước (vd. `nvm install 22 && nvm alias default 22`, hoặc gói Node 22 của NodeSource),
   rồi xác nhận Strapi cũ vẫn chạy trên Node mới:
   `pm2 restart dha-cms && curl -s http://127.0.0.1:1337/api/site-setting | head -c 100`.

4. **Tạo API token của Strapi** để đọc dữ liệu: `https://dhakimloaimau.vn/strapi-admin`
   → Settings → API Tokens → *Full access*, hạn 7 ngày. Không lưu vào file;
   dán trực tiếp vào lệnh ở bước 5.

## B. Chạy thử trên staging (web vẫn chạy Strapi)

5. **Xuất dữ liệu**:
   ```bash
   cd /var/www/dha-api
   read -rs STRAPI_TOKEN && export STRAPI_TOKEN
   node --env-file=.env scripts/migrate-from-strapi.js out/migrate.ndjson
   ls -l out/migrate.ndjson
   ```
   Mong đợi: JSON tóm tắt. Số lượng mỗi loại khớp với Content Manager của
   Strapi; `adminUsersSkipped` rỗng; file có quyền `-rw-------`. Nếu báo
   thiếu `CLOUDINARY_URL` kèm danh sách ảnh `/uploads`, kiểm tra `.env` rồi chạy lại.

6. **Nạp vào staging**:
   ```bash
   set -a; . ./.env; set +a
   SANITY_AUTH_TOKEN="$SANITY_API_TOKEN" npx --yes sanity@latest datasets import \
     out/migrate.ndjson staging --project-id "$SANITY_PROJECT_ID" --replace
   ```
   Mong đợi: `Done! Imported N documents`, N bằng `total` ở bước 5.

7. **Khởi động dha-api ở cổng 1338**:
   ```bash
   pm2 start /var/www/web-ha-can/deploy/ecosystem.config.js && pm2 save
   pm2 logs dha-api --lines 20 --nostream
   curl -s http://127.0.0.1:1338/api/site-setting | head -c 200
   ```
   Mong đợi: log `nghe 127.0.0.1:1338 — dataset staging`, không có lỗi
   "đang public"; `curl` trả `{"data":{...`.

8. **Đối chiếu**:
   ```bash
   read -r ADMIN_EMAIL && read -rs ADMIN_PASSWORD && export ADMIN_EMAIL ADMIN_PASSWORD
   node scripts/compare-apis.js http://127.0.0.1:1337 http://127.0.0.1:1338
   ```
   Mong đợi: dòng cuối `Khớp`. Cảnh báo `khác thứ tự` thì chấp nhận được.
   Mỗi dòng `✗` là một lỗi phải sửa trong code (quay lại Task tương ứng),
   deploy lại, rồi làm lại từ bước 5.

9. *(Tuỳ chọn)* **Thử khu quản trị trên staging** từ máy cá nhân:
   `ssh -L 1337:127.0.0.1:1338 root@<VPS>` rồi `npm run admin:dev`. Đăng nhập
   bằng tài khoản cũ, sửa thử một bài tin, xem `http://localhost:1337/api/news-articles`.

## C. Chuyển (báo trước với người biên tập; khoảng 30 phút)

10. **Đóng băng biên tập**: báo người biên tập ngừng sửa nội dung. Ghi lại
    giờ bắt đầu: `date -u +%Y-%m-%dT%H:%M:%SZ`.

11. **Xuất lại và nạp vào production**:
    ```bash
    node --env-file=.env scripts/migrate-from-strapi.js out/migrate.ndjson
    SANITY_AUTH_TOKEN="$SANITY_API_TOKEN" npx --yes sanity@latest datasets import \
      out/migrate.ndjson production --project-id "$SANITY_PROJECT_ID" --replace
    sed -i 's/^SANITY_DATASET=.*/SANITY_DATASET=production/' .env
    pm2 restart dha-api && sleep 2
    node scripts/compare-apis.js http://127.0.0.1:1337 http://127.0.0.1:1338
    ```
    Mong đợi: `Khớp`.

12. **Đổi cổng**. Mục 12–14 nên làm liền nhau; thời gian web lỗi API
    khoảng vài giây, và `app.js` tự rơi về `data/*.json` trong lúc đó.
    ```bash
    pm2 stop dha-cms
    sed -i 's/^PORT=.*/PORT=1337/' .env
    pm2 restart dha-api && pm2 save
    curl -s http://127.0.0.1:1337/api/site-setting | head -c 200
    ```
    Mong đợi: JSON như bước 7. `pm2 ls`: `dha-cms` *stopped*, `dha-api` *online*.

13. **Cập nhật nginx** (deploy.sh không tự ghi đè vì Certbot quản lý SSL):
    ```bash
    diff /var/www/web-ha-can/deploy/nginx.conf /etc/nginx/sites-available/dhakimloaimau.vn
    cp /etc/nginx/sites-available/dhakimloaimau.vn /root/nginx-dhakimloaimau.vn.truoc-chuyen
    sudo -e /etc/nginx/sites-available/dhakimloaimau.vn   # xoá các location Strapi, giữ khối SSL
    nginx -t && systemctl reload nginx
    ```

14. **Kiểm tra trên production**:
    ```bash
    curl -s https://dhakimloaimau.vn/api/news-articles?pagination[limit]=1 | head -c 200
    curl -s -o /dev/null -w '%{http_code}\n' -X POST https://dhakimloaimau.vn/api/contact-inquiries \
      -H 'Content-Type: application/json' -d '{"data":{"name":"x"}}'
    curl -s -o /dev/null -w '%{http_code}\n' https://dhakimloaimau.vn/strapi-admin
    ```
    Mong đợi lần lượt: JSON tin tức, `400` (route form sống, không ghi gì), `404`.
    Trên máy cá nhân, chạy `npm run test:e2e` (có `.env.e2e`) → xanh.
    Đăng nhập `/admin` bằng tài khoản cũ → vào được, thấy đủ dữ liệu.

15. **Mở lại biên tập**. Xoá file xuất:
    `shred -u out/migrate.ndjson 2>/dev/null || rm -f out/migrate.ndjson`.
    Thu hồi API token Strapi ở bước 4.

16. **Bật sao lưu**:
    ```bash
    /var/www/web-ha-can/deploy/backup-sanity.sh
    ls -l /var/backups/dha-sanity/
    ( crontab -l 2>/dev/null; echo '0 3 * * 0 /var/www/web-ha-can/deploy/backup-sanity.sh >> /var/log/dha-sanity-backup.log 2>&1' ) | crontab -
    ```
    Mong đợi: có file `production-<ngày>.tar.gz`, quyền `-rw-------`.

17. **Theo dõi 48 giờ**: `pm2 logs dha-api` không có lỗi 500 lặp lại; trang
    *Usage* của Sanity tăng đều, không vọt.

## D. Rollback (trong 14 ngày sau bước 12)

Mọi lượt ghi vào Sanity sau khi chuyển **không** có trong Strapi. Trước khi
rollback, xuất các yêu cầu liên hệ và đơn đặt mẫu mới để nhập tay lại:

```bash
cd /var/www/dha-api && set -a; . ./.env; set +a
SANITY_AUTH_TOKEN="$SANITY_API_TOKEN" npx --yes sanity@latest documents query \
  '*[_type in ["contactInquiry","orderRequest"] && createdAt > "<giờ ở bước 10>"]' \
  --dataset production --project-id "$SANITY_PROJECT_ID" > /root/sau-chuyen.json
chmod 600 /root/sau-chuyen.json
```

Rồi:

```bash
pm2 stop dha-api
pm2 start dha-cms            # tiến trình cũ vẫn còn trong pm2 (đã stop ở bước 12)
# nếu đã bị xoá khỏi pm2:
# pm2 start /var/www/web-ha-can/deploy/ecosystem.strapi-rollback.config.js
pm2 save
cp /root/nginx-dhakimloaimau.vn.truoc-chuyen /etc/nginx/sites-available/dhakimloaimau.vn
nginx -t && systemctl reload nginx
```

Mong đợi: `/strapi-admin` mở lại được; web đọc từ Strapi.