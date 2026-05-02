#!/usr/bin/env bash
# SureEdge AI — Encrypted Database Backup
# Cron: 0 2 * * * /opt/sureedge/scripts/backup.sh >> /var/log/sureedge/backup.log 2>&1

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BACKUP_DIR="/backups/daily"
RETENTION_DAYS=7
DATE=$(date +%Y%m%d_%H%M%S)
FILE="${BACKUP_DIR}/sureedge_${DATE}.sql.gz"

source "${DEPLOY_DIR}/.env.production"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

# Dump + gzip
docker exec sureedge-db pg_dump \
  -U "${POSTGRES_USER:-sureedge}" \
  "${POSTGRES_DB:-sureedge_prod}" \
  | gzip -9 > "$FILE"

# Verify
gzip -t "$FILE" && echo "[$(date)] Backup verified: $FILE ($(du -sh "$FILE" | cut -f1))"

# Upload to S3 if configured
if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  aws s3 cp "$FILE" "s3://${BACKUP_S3_BUCKET}/daily/$(date +%Y/%m/%d)/$(basename "$FILE")" \
    --storage-class STANDARD_IA && echo "[$(date)] Uploaded to S3"
fi

# Local cleanup — keep RETENTION_DAYS days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "[$(date)] Local backups retained: $(find "$BACKUP_DIR" -name "*.sql.gz" | wc -l)"
