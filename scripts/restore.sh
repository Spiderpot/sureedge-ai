#!/usr/bin/env bash
# SureEdge AI — Database Restore
# Usage: bash scripts/restore.sh /backups/daily/sureedge_20260101_020000.sql.gz

set -euo pipefail

BACKUP_FILE="${1:-}"
[[ -f "$BACKUP_FILE" ]] || { echo "ERROR: Backup file not found: $BACKUP_FILE"; exit 1; }

DEPLOY_DIR="${DEPLOY_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
source "${DEPLOY_DIR}/.env.production"

echo "Restoring from: $BACKUP_FILE"
echo "Target DB:      ${POSTGRES_DB:-sureedge_prod}"
echo ""
read -p "This will REPLACE all data. Type 'RESTORE' to confirm: " CONFIRM
[[ "$CONFIRM" == "RESTORE" ]] || { echo "Aborted."; exit 1; }

# Drop + recreate DB
docker exec sureedge-db psql -U postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${POSTGRES_DB:-sureedge_prod}';" || true
docker exec sureedge-db psql -U postgres -c "DROP DATABASE IF EXISTS ${POSTGRES_DB:-sureedge_prod};"
docker exec sureedge-db psql -U postgres -c \
  "CREATE DATABASE ${POSTGRES_DB:-sureedge_prod} OWNER ${POSTGRES_USER:-sureedge};"

# Restore
gunzip -c "$BACKUP_FILE" | docker exec -i sureedge-db psql -U "${POSTGRES_USER:-sureedge}" "${POSTGRES_DB:-sureedge_prod}"
echo "✓ Restore complete"
