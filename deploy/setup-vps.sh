#!/bin/bash
# ============================================================
# setup-vps.sh — Chạy MỘT LẦN trên VPS mới (Ubuntu 22.04)
# Chạy: bash setup-vps.sh <GITHUB_REPO_URL>
# Ví dụ: bash setup-vps.sh https://github.com/yourname/web-ha-can.git
# ============================================================
set -e

GITHUB_REPO="${1}"
DOMAIN="smadesign.vn"
APP_USER="deploy"
REPO_DIR="/var/www/web-ha-can"
FRONTEND_DIR="/var/www/smadesign.vn"
CMS_DIR="/var/www/dha-cms"

if [ -z "$GITHUB_REPO" ]; then
    echo "❌ Thiếu URL GitHub repo!"
    echo "   Cú pháp: bash setup-vps.sh https://github.com/yourname/web-ha-can.git"
    exit 1
fi

echo "==> [1/8] Cập nhật hệ thống..."
apt-get update -y && apt-get upgrade -y

echo "==> [2/8] Cài Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git
node -v && npm -v

echo "==> [3/8] Cài PM2, Nginx, Certbot..."
npm install -g pm2
apt-get install -y nginx certbot python3-certbot-nginx ufw

echo "==> [4/8] Tạo user '$APP_USER'..."
if ! id "$APP_USER" &>/dev/null; then
    adduser --disabled-password --gecos "" "$APP_USER"
    usermod -aG sudo "$APP_USER"
fi

echo "==> [5/8] Clone repo từ GitHub..."
mkdir -p /var/www
git clone "$GITHUB_REPO" "$REPO_DIR"
chown -R "$APP_USER":"$APP_USER" "$REPO_DIR"

echo "==> [6/8] Tạo thư mục frontend & CMS..."
mkdir -p "$FRONTEND_DIR" "$CMS_DIR"

# Sync frontend files
rsync -a --delete \
    --exclude="deploy/" \
    --exclude="dha-cms/" \
    --exclude="design-system/" \
    --exclude=".git/" \
    "$REPO_DIR/" "$FRONTEND_DIR/"

# Symlink dha-cms
cp -r "$REPO_DIR/dha-cms/." "$CMS_DIR/"
chown -R "$APP_USER":"$APP_USER" "$FRONTEND_DIR" "$CMS_DIR"

echo "==> [7/8] Cấu hình Nginx..."
cp "$REPO_DIR/deploy/nginx.conf" /etc/nginx/sites-available/smadesign.vn
ln -sf /etc/nginx/sites-available/smadesign.vn /etc/nginx/sites-enabled/smadesign.vn
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> [8/8] Cấu hình UFW firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo ""
echo "✓ Setup VPS xong!"
echo ""
echo "Bước tiếp theo:"
echo "  1. Tạo file /var/www/dha-cms/.env (xem mẫu deploy/.env.example)"
echo "  2. Cài npm & build Strapi:"
echo "       cd $CMS_DIR && npm ci --omit=dev && NODE_ENV=production npm run build"
echo "  3. Khởi động Strapi:"
echo "       pm2 start $REPO_DIR/deploy/ecosystem.config.js && pm2 save"
echo "  4. Cài SSL:"
echo "       certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "  5. PM2 auto-start khi reboot:"
echo "       pm2 startup systemd -u $APP_USER --hp /home/$APP_USER && pm2 save"
