#!/bin/bash
# Sao lưu dataset Sanity (nội dung + tài khoản quản trị) — thay backup-strapi.sh.
# Chạy bằng cron hằng tuần trên VPS (runbook bước 16). Bản sao chứa hash mật khẩu
# và dữ liệu khách hàng: thư mục chỉ root đọc được.

set -euo pipefail

ENV_FILE="${ENV_FILE:-/var/www/dha-api/.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/dha-sanity}"
KEEP="${KEEP:-8}"
# Ghim phiên bản CLI Sanity — cùng giá trị với runbook (docs/runbooks/2026-09-
# strapi-to-sanity-cutover.md), ghi đè được qua biến môi trường SANITY_CLI.
SANITY_CLI="${SANITY_CLI:-sanity@6.13.2}"

if [ ! -f "$ENV_FILE" ]; then
    echo "Thiếu file cấu hình: $ENV_FILE"
    exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
: "${SANITY_PROJECT_ID:?thiếu SANITY_PROJECT_ID}" "${SANITY_DATASET:?thiếu SANITY_DATASET}" "${SANITY_API_TOKEN:?thiếu SANITY_API_TOKEN}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date '+%Y%m%d-%H%M%S')"
ARCHIVE="$BACKUP_DIR/$SANITY_DATASET-$STAMP.tar.gz"

# Ảnh nằm ở Cloudinary, dataset không có asset nào để tải.
SANITY_AUTH_TOKEN="$SANITY_API_TOKEN" npx --yes "$SANITY_CLI" datasets export \
    "$SANITY_DATASET" "$ARCHIVE" --project-id "$SANITY_PROJECT_ID" --no-assets --overwrite
chmod 600 "$ARCHIVE"

# Giữ KEEP bản mới nhất.
ls -1t "$BACKUP_DIR"/"$SANITY_DATASET"-*.tar.gz | tail -n +"$((KEEP + 1))" | xargs -r rm --

echo "Đã sao lưu: $ARCHIVE"
