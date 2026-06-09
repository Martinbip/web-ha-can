#!/bin/bash
# ============================================================
# deploy.sh — Chạy trên máy LOCAL: push lên GitHub → VPS tự pull
# Cú pháp: bash deploy/deploy.sh
# ============================================================
set -e

# ── Cấu hình ──────────────────────────────────────────────
VPS_USER="deploy"
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
$SSH bash << REMOTE
set -e

echo "▸ Pull code mới..."
cd /var/www/web-ha-can
git pull origin main

echo "▸ Sync frontend..."
rsync -a --delete \
    --exclude="deploy/" \
    --exclude="dha-cms/" \
    --exclude="design-system/" \
    --exclude=".git/" \
    /var/www/web-ha-can/ \
    $FRONTEND_DIR/

echo "▸ Cài npm dependencies Strapi..."
cd $CMS_DIR
npm ci --omit=dev

echo "▸ Build Strapi admin..."
NODE_ENV=production npm run build

echo "▸ Restart Strapi..."
if pm2 describe dha-cms > /dev/null 2>&1; then
    pm2 restart dha-cms
else
    pm2 start /var/www/web-ha-can/deploy/ecosystem.config.js
fi
pm2 save
REMOTE

echo ""
echo "✅ Deploy hoàn tất!"
echo "   https://smadesign.vn"
