#!/bin/bash
# Back up Strapi local storage: dha-cms/.tmp/data.db and public/uploads.

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
CMS_DIR="${CMS_DIR:-$PROJECT_ROOT/dha-cms}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
DB_FILE="${DB_FILE:-$CMS_DIR/.tmp/data.db}"
UPLOADS_DIR="${UPLOADS_DIR:-$CMS_DIR/public/uploads}"
STAMP="$(date '+%Y%m%d-%H%M%S')"
ARCHIVE="$BACKUP_DIR/dha-cms-backup-$STAMP.tar.gz"

if [ ! -f "$DB_FILE" ]; then
    echo "Missing Strapi SQLite database: $DB_FILE"
    exit 1
fi

mkdir -p "$BACKUP_DIR"
mkdir -p "$UPLOADS_DIR"

tar -czf "$ARCHIVE" \
    -C "$CMS_DIR" \
    .tmp/data.db \
    public/uploads

echo "Created backup: $ARCHIVE"
