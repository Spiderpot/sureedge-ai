#!/usr/bin/env bash
# SureEdge AI — Zero-downtime Rolling Deploy
# Usage: bash scripts/deploy.sh [--skip-backup] [--skip-migrate]
# Env: BUILD_ID (optional, defaults to git sha)

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
COMPOSE="docker compose -f ${DEPLOY_DIR}/docker-compose.production.yml"
BUILD_ID="${BUILD_ID:-$(git -C "$DEPLOY_DIR" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d_%H%M%S)}"
LOG_FILE="/var/log/sureedge/deploy-$(date +%Y%m%d_%H%M%S).log"
SKIP_BACKUP=false
SKIP_MIGRATE=false

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "$(date +%H:%M:%S) ${GREEN}[OK]${NC}   $*" | tee -a "$LOG_FILE"; }
warn() { echo -e "$(date +%H:%M:%S) ${YELLOW}[WARN]${NC} $*" | tee -a "$LOG_FILE"; }
fail() { echo -e "$(date +%H:%M:%S) ${RED}[FAIL]${NC} $*" | tee -a "$LOG_FILE"; exit 1; }

for arg in "$@"; do
  case $arg in
    --skip-backup)  SKIP_BACKUP=true  ;;
    --skip-migrate) SKIP_MIGRATE=true ;;
  esac
done

mkdir -p "$(dirname "$LOG_FILE")"
ok "Deploy started — Build: ${BUILD_ID}"
cd "$DEPLOY_DIR"

# ─── 1. Pre-flight ────────────────────────────────────────────────────────────
[[ -f .env.production ]]              || fail ".env.production missing"
[[ -f docker-compose.production.yml ]] || fail "docker-compose.production.yml missing"
[[ -f nginx/dhparam.pem ]]            || fail "nginx/dhparam.pem missing. Run: openssl dhparam -out nginx/dhparam.pem 4096"

source .env.production
[[ -z "${JWT_SECRET:-}"        ]] && fail "JWT_SECRET not set"
[[ -z "${POSTGRES_PASSWORD:-}" ]] && fail "POSTGRES_PASSWORD not set"
[[ -z "${REDIS_PASSWORD:-}"    ]] && fail "REDIS_PASSWORD not set"
ok "Pre-flight passed"

# ─── 2. Pre-deploy backup ─────────────────────────────────────────────────────
if [[ "$SKIP_BACKUP" == "false" ]]; then
  if docker ps --format '{{.Names}}' | grep -q sureedge-db; then
    ok "Creating pre-deploy DB backup..."
    mkdir -p /backups/pre-deploy
    BACKUP_FILE="/backups/pre-deploy/pre-deploy-${BUILD_ID}-$(date +%Y%m%d_%H%M%S).sql.gz"
    docker exec sureedge-db pg_dump -U "${POSTGRES_USER:-sureedge}" "${POSTGRES_DB:-sureedge_prod}" \
      | gzip > "$BACKUP_FILE" \
      && ok "Backup: $BACKUP_FILE" \
      || warn "Backup failed — continuing"
  fi
fi

# ─── 3. Update Redis config with current password ─────────────────────────────
if [[ -f redis/redis.conf ]]; then
  sed -i "s/^requirepass .*/requirepass ${REDIS_PASSWORD}/" redis/redis.conf
fi

# ─── 4. Build new image ───────────────────────────────────────────────────────
ok "Building image (BUILD_ID=${BUILD_ID})..."
export BUILD_ID
$COMPOSE build --no-cache app
ok "Image built"

# ─── 5. Ensure infrastructure is running ──────────────────────────────────────
ok "Ensuring postgres + redis are running..."
$COMPOSE up -d postgres redis
for i in $(seq 1 12); do
  docker exec sureedge-db pg_isready -U "${POSTGRES_USER:-sureedge}" &>/dev/null && break
  [[ $i -eq 12 ]] && fail "Postgres not ready after 60s"
  sleep 5
done
ok "Infrastructure ready"

# ─── 6. Run migrations ────────────────────────────────────────────────────────
if [[ "$SKIP_MIGRATE" == "false" ]]; then
  ok "Running migrations..."
  $COMPOSE run --rm -e DATABASE_URL="${DATABASE_URL}" app npx prisma migrate deploy
  ok "Migrations done"
fi

# ─── 7. Rolling restart — trap errors for rollback ───────────────────────────
PREVIOUS_IMAGE=$(docker inspect sureedge-app --format '{{.Image}}' 2>/dev/null || echo "")

rollback() {
  warn "Deploy failed — attempting rollback..."
  if [[ -n "$PREVIOUS_IMAGE" ]]; then
    docker tag "$PREVIOUS_IMAGE" sureedge-app-rollback:latest 2>/dev/null || true
    $COMPOSE up -d --no-deps app
    ok "Rolled back to previous image"
  else
    warn "No previous image to roll back to"
  fi
  exit 1
}
trap rollback ERR

ok "Deploying app container..."
$COMPOSE up -d --no-deps --remove-orphans app

# ─── 8. Health check ──────────────────────────────────────────────────────────
ok "Waiting for health check..."
for i in $(seq 1 18); do
  sleep 5
  if curl -sf http://localhost:3000/api/health/ready &>/dev/null; then
    ok "Health check passed (attempt ${i})"
    break
  fi
  [[ $i -eq 18 ]] && fail "Health check failed after 90s"
  echo "  Attempt ${i}/18..."
done

# ─── 9. Start remaining services (nginx, certbot) ────────────────────────────
$COMPOSE up -d --remove-orphans
trap - ERR

# ─── 10. Cleanup ──────────────────────────────────────────────────────────────
docker image prune -f --filter "until=72h" &>/dev/null || true

ok "═══════════════════════════════════"
ok "  Deploy complete — ${BUILD_ID}"
ok "═══════════════════════════════════"
$COMPOSE ps
