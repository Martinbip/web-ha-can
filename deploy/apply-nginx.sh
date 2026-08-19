#!/bin/bash
# ============================================================
# apply-nginx.sh — Áp dụng thay đổi nginx lên VPS
# Cú pháp: bash deploy/apply-nginx.sh
#
# deploy.sh cố tình không đụng vào nginx (Certbot quản lý phần SSL trong đó),
# nên mỗi lần deploy/nginx.conf đổi thì chạy script này một lần.
# Script tự backup, chỉ chèn phần còn thiếu, kiểm tra cú pháp rồi mới reload.
# ============================================================
set -e

VPS_USER="root"
VPS_HOST="183.81.39.14"
VPS_PORT="22"

ssh -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" 'bash -s' <<'REMOTE'
set -e
CONF=/etc/nginx/sites-available/dhakimloaimau.vn
BACKUP="${CONF}.bak-$(date +%Y%m%d-%H%M%S)"

cp "$CONF" "$BACKUP"
echo "▸ Đã backup: $BACKUP"

if grep -q "location /tin-tuc/" "$CONF"; then
    echo "▸ Cấu hình đã có sẵn /tin-tuc/ — không cần chèn lại."
else
    python3 - "$CONF" <<'PY'
import sys

path = sys.argv[1]
src = open(path).read()

anchor = "    # ── Frontend static files"
assert anchor in src, "Không tìm thấy mốc chèn trong file nginx"

block = """    # ── Trang chi tiết tin tức: /tin-tuc/<duong-dan> ────
    location /tin-tuc/ {
        try_files $uri /news-detail.html;
    }

    # Địa chỉ cũ /news-detail?slug=... chuyển vĩnh viễn sang dạng mới.
    location = /news-detail {
        if ($arg_slug) {
            return 301 /tin-tuc/$arg_slug;
        }
        return 301 /news;
    }

"""

open(path, "w").write(src.replace(anchor, block + anchor, 1))
print("▸ Đã chèn route /tin-tuc/ và chuyển hướng từ địa chỉ cũ")
PY
fi

echo "▸ Kiểm tra cú pháp nginx..."
nginx -t

echo "▸ Nạp lại nginx..."
systemctl reload nginx
echo "✅ Xong."
REMOTE
