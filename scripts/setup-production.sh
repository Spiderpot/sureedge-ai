#!/usr/bin/env bash
# SureEdge AI — One-shot production setup
# Run once on a fresh Ubuntu 22.04+ server:
#   curl -fsSL https://raw.githubusercontent.com/your-repo/sureedge-ai/main/scripts/setup-production.sh | bash

set -euo pipefail
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC}   $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

# ─── 0. Root check ────────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || fail "Run as root: sudo bash $0"

DEPLOY_DIR="${DEPLOY_DIR:-/opt/sureedge}"
DOMAIN="${DOMAIN:-sureedge.ai}"
EMAIL="${EMAIL:-admin@sureedge.ai}"

ok "Starting SureEdge AI production setup"
ok "Deploy dir: $DEPLOY_DIR | Domain: $DOMAIN"

# ─── 1. System update ─────────────────────────────────────────────────────────
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl wget git openssl gpg ca-certificates

# ─── 2. Docker ────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
  ok "Docker installed"
else
  ok "Docker already installed: $(docker --version)"
fi

# ─── 3. Deploy directory ──────────────────────────────────────────────────────
mkdir -p "${DEPLOY_DIR}/nginx" "${DEPLOY_DIR}/redis" "${DEPLOY_DIR}/scripts"
mkdir -p /var/log/sureedge /backups/daily

# ─── 4. Generate DH params (4096-bit, one-time) ───────────────────────────────
if [[ ! -f "${DEPLOY_DIR}/nginx/dhparam.pem" ]]; then
  warn "Generating 4096-bit DH parameters (takes ~2 minutes)..."
  openssl dhparam -out "${DEPLOY_DIR}/nginx/dhparam.pem" 4096
  ok "DH params generated"
fi

# ─── 5. Generate secrets if .env.production doesn't have them filled in ──────
ENV_FILE="${DEPLOY_DIR}/.env.production"
if [[ ! -f "$ENV_FILE" ]]; then
  fail ".env.production not found at $ENV_FILE. Copy and fill in the template first."
fi

# Validate required secrets are set
for var in JWT_SECRET POSTGRES_PASSWORD REDIS_PASSWORD; do
  val=$(grep "^${var}=" "$ENV_FILE" | cut -d= -f2- | tr -d '"')
  [[ -z "$val" || "$val" == REPLACE* ]] && fail "${var} is not set in .env.production"
done
ok "Required secrets validated"

# ─── 6. Write Redis config with password substituted ─────────────────────────
REDIS_PASSWORD=$(grep "^REDIS_PASSWORD=" "$ENV_FILE" | cut -d= -f2- | tr -d '"')
sed "s/REDIS_PASSWORD_PLACEHOLDER/${REDIS_PASSWORD}/g" \
    "${DEPLOY_DIR}/redis/redis.conf.template" \
  > "${DEPLOY_DIR}/redis/redis.conf"
chmod 600 "${DEPLOY_DIR}/redis/redis.conf"
ok "Redis config written"

# ─── 7. SSL certificate (Let's Encrypt) ──────────────────────────────────────
if [[ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  warn "Provisioning SSL certificate for $DOMAIN..."
  apt-get install -y -qq certbot
  certbot certonly --standalone -d "$DOMAIN" -d "www.${DOMAIN}" \
    --email "$EMAIL" --agree-tos --non-interactive
  ok "SSL certificate provisioned"
else
  ok "SSL certificate already exists"
fi

# ─── 8. Set up auto-renewal cron ──────────────────────────────────────────────
echo "0 3 * * * root certbot renew --quiet --deploy-hook 'docker compose -f ${DEPLOY_DIR}/docker-compose.production.yml restart nginx'" \
  > /etc/cron.d/certbot-sureedge
chmod 644 /etc/cron.d/certbot-sureedge
ok "SSL auto-renewal cron configured"

# ─── 9. Build and start ──────────────────────────────────────────────────────
cd "$DEPLOY_DIR"

# Build image
docker compose -f docker-compose.production.yml build --no-cache
ok "Docker image built"

# Start infrastructure first
docker compose -f docker-compose.production.yml up -d postgres redis
sleep 10

# Run migrations
docker compose -f docker-compose.production.yml run --rm app npx prisma migrate deploy
ok "Database migrations applied"

# Start full stack
docker compose -f docker-compose.production.yml up -d
ok "All services started"

# ─── 10. Health check ─────────────────────────────────────────────────────────
sleep 15
if curl -sf "http://localhost:3000/api/health" | grep -q '"status":"ok"'; then
  ok "Health check passed"
else
  warn "Health check returned unexpected response — check: docker logs sureedge-app"
fi

echo ""
ok "═══════════════════════════════════════"
ok "  SureEdge AI is live at https://${DOMAIN}"
ok "═══════════════════════════════════════"
docker compose -f docker-compose.production.yml ps
