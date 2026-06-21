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
FRONTEND_DIR="/var/www/smadesign.vn"
CMS_DIR="/var/www/dha-cms"
# ──────────────────────────────────────────────────────────

SSH="ssh -p $VPS_PORT $VPS_USER@$VPS_HOST"

echo "==> [1/3] Push code lên GitHub..."
cd "$(dirname "$0")/.."
git add -A
git commit -m "deploy: $(date '+%Y-%m-%d %H:%M')" || echo "(Không có thay đổi mới)"
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
    --exclude=".git/" \
    /var/www/web-ha-can/ \
    /var/www/smadesign.vn/

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

# Cập nhật nginx config nếu có thay đổi
if git diff --name-only "$BEFORE" "$AFTER" | grep -q '^deploy/nginx.conf'; then
    echo "▸ Phát hiện thay đổi nginx.conf → cập nhật & reload..."
    cp /var/www/web-ha-can/deploy/nginx.conf /etc/nginx/sites-available/smadesign.vn
    nginx -t && systemctl reload nginx
fi
REMOTE

echo ""
echo "✅ Deploy hoàn tất!"
echo "   https://smadesign.vn"
