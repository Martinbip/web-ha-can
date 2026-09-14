#!/bin/bash
# ============================================================
# deploy.sh — Chạy trên máy LOCAL: push lên GitHub → VPS tự pull
# Cú pháp: bash deploy/deploy.sh
# ============================================================
set -e

# ── Cấu hình ──────────────────────────────────────────────
VPS_USER="root"
VPS_HOST="183.81.39.14"
VPS_PORT="22"
FRONTEND_DIR="/var/www/dhakimloaimau.vn"
CMS_DIR="/var/www/dha-cms"
# ──────────────────────────────────────────────────────────

SSH="ssh -p $VPS_PORT $VPS_USER@$VPS_HOST"

echo "==> [1/3] Kiểm tra working tree & push code lên GitHub..."
cd "$(dirname "$0")/.."

if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git status --porcelain --untracked-files=all)" ]; then
    echo "❌ Working tree chưa sạch. Hãy commit/stash các thay đổi trước khi deploy."
    git status --short
    exit 1
fi

git push origin main

echo "==> [2/3] VPS kéo code từ GitHub..."
$SSH bash << 'REMOTE'
set -e

cd /var/www/web-ha-can

echo "▸ Pull code mới..."
BEFORE=$(git rev-parse HEAD)
git pull origin main
AFTER=$(git rev-parse HEAD)

echo "▸ Sync frontend..."
rsync -a --delete \
    --exclude="deploy/" \
    --exclude="dha-cms/" \
    --exclude="design-system/" \
    --exclude="admin/" \
    --exclude=".git/" \
    /var/www/web-ha-can/ \
    /var/www/dhakimloaimau.vn/

# Sitemap phải liệt kê từng bài viết thì Google mới tìm được chúng, mà danh sách
# bài thì nằm trong CMS chứ không nằm trong repo — nên sinh lại sau mỗi lần sync.
# Ghi thẳng vào thư mục nginx phục vụ, không ghi vào repo (tránh làm bẩn git tree).
echo "▸ Sinh sitemap từ CMS..."
node /var/www/web-ha-can/scripts/generate-sitemap.js /var/www/dhakimloaimau.vn/sitemap.xml \
    || echo "⚠️  Không sinh được sitemap — giữ nguyên bản cũ."

# Lượt 1: rsync vừa ghi đè HTML bằng bản mẫu trong repo — ghi ngay dữ liệu từ
# Strapi đang chạy, để website không nằm ở nội dung mẫu trong lúc build (hay mãi
# nếu build lỗi và set -e dừng script).
echo "▸ Ghi cài đặt website, danh mục và menu từ CMS vào HTML tĩnh (lượt 1)..."
node /var/www/web-ha-can/scripts/prerender-site-settings.js /var/www/dhakimloaimau.vn \
    || echo "⚠️  Không ghi được cài đặt vào HTML — trang vẫn tự áp bằng JS như trước."

# Chỉ build & sync admin khi thư mục admin/ thật sự có thay đổi
if git diff --name-only "$BEFORE" "$AFTER" | grep -q '^admin/'; then
    echo "▸ Phát hiện thay đổi Admin → build & sync admin tĩnh..."
    cd /var/www/web-ha-can/admin
    npm ci
    npm run build
    rsync -a --delete /var/www/web-ha-can/admin/dist/ /var/www/dhakimloaimau.vn/admin/
    cd /var/www/web-ha-can
else
    echo "▸ Admin không đổi → bỏ qua build admin (deploy nhanh)."
fi

# Chỉ đụng tới Strapi khi thư mục dha-cms/ thật sự có thay đổi
if git diff --name-only "$BEFORE" "$AFTER" | grep -q '^dha-cms/'; then
    echo "▸ Phát hiện thay đổi CMS → sync + build Strapi..."
    rsync -a \
        --exclude=".env" \
        --exclude=".tmp/" \
        --exclude="node_modules/" \
        /var/www/web-ha-can/dha-cms/ \
        /var/www/dha-cms/

    cd /var/www/dha-cms
    npm ci --omit=dev
    NODE_ENV=production npm run build

    if pm2 describe dha-cms > /dev/null 2>&1; then
        pm2 restart dha-cms
    else
        pm2 start /var/www/web-ha-can/deploy/ecosystem.config.js
    fi
    pm2 save
else
    echo "▸ CMS không đổi → bỏ qua build Strapi (deploy nhanh)."
fi

# Lượt 2: Strapi vừa được build & khởi động lại ở trên có thể mang trường mới
# mà lượt 1 (chạy trước khi build) chưa thấy — ghi lại để HTML tĩnh có đủ dữ
# liệu mới nhất. Dò /_health thay vì /api/site-setting vì bản ghi site-setting
# có thể chưa tồn tại (API trả 404), khi đó cả danh mục lẫn menu cũng bị bỏ qua
# theo; --max-time 5 để một Strapi nhận kết nối nhưng treo không làm deploy treo
# mãi. Ghi thẳng vào thư mục nginx phục vụ, không ghi vào repo — hệt như sitemap.
echo "▸ Đợi Strapi sẵn sàng..."
STRAPI_READY=0
for _ in $(seq 1 30); do
    if curl -sf -o /dev/null --max-time 5 http://127.0.0.1:1337/_health; then
        STRAPI_READY=1
        break
    fi
    sleep 2
done
if [ "$STRAPI_READY" = 1 ]; then
    echo "▸ Ghi cài đặt website, danh mục và menu từ CMS vào HTML tĩnh (lượt 2)..."
    node /var/www/web-ha-can/scripts/prerender-site-settings.js /var/www/dhakimloaimau.vn \
        || echo "⚠️  Không ghi được cài đặt vào HTML — trang vẫn tự áp bằng JS như trước."
else
    echo "⚠️  Strapi chưa trả lời sau 60 giây — bỏ qua prerender lượt 2, HTML giữ dữ liệu từ lượt 1."
fi

# Cảnh báo nếu nginx config thay đổi (không tự ghi đè vì Certbot quản lý SSL)
cd /var/www/web-ha-can
if git diff --name-only "$BEFORE" "$AFTER" | grep -q '^deploy/nginx.conf'; then
    echo "⚠️  deploy/nginx.conf đã thay đổi — cần cập nhật thủ công trên server:"
    echo "   Xem diff: diff /var/www/web-ha-can/deploy/nginx.conf /etc/nginx/sites-available/dhakimloaimau.vn"
fi
REMOTE

echo ""
echo "✅ Deploy hoàn tất!"
echo "   https://dhakimloaimau.vn"
