# SureEdge AI — Production Makefile
# Usage: make <target>
# Run from /opt/sureedge on the production server

COMPOSE     = docker compose -f docker-compose.production.yml
APP         = sureedge-app
DB          = sureedge-db
CACHE       = sureedge-cache
DEPLOY_DIR  = $(shell pwd)

.DEFAULT_GOAL := help

# ─── Help ──────────────────────────────────────────────────────────────────────
.PHONY: help
help:
	@echo ""
	@echo "  SureEdge AI — Production Operations"
	@echo "  ────────────────────────────────────────────────"
	@echo "  make setup        First-time server setup + SSL"
	@echo "  make deploy       Build + rolling deploy (zero-downtime)"
	@echo "  make start        Start all services"
	@echo "  make stop         Stop all services"
	@echo "  make restart      Restart app + worker only"
	@echo "  make logs         Tail app logs"
	@echo "  make logs-all     Tail all service logs"
	@echo "  make status       Show container status + resource usage"
	@echo "  make health       Run health checks"
	@echo "  make migrate      Run pending DB migrations"
	@echo "  make seed         Seed initial data (first time only)"
	@echo "  make backup       Create encrypted DB backup now"
	@echo "  make restore      Restore from latest backup"
	@echo "  make shell-app    Shell into app container"
	@echo "  make shell-db     psql shell into database"
	@echo "  make shell-redis  redis-cli into cache"
	@echo "  make clean        Remove stopped containers + dangling images"
	@echo "  make ssl-renew    Force SSL certificate renewal"
	@echo "  make secrets      Generate new random secrets (prints to stdout)"
	@echo ""

# ─── First-time Setup ──────────────────────────────────────────────────────────
.PHONY: setup
setup:
	@echo "→ Running first-time production setup..."
	@[ -f .env.production ] || (echo "ERROR: .env.production not found" && exit 1)
	@bash scripts/setup-production.sh

# ─── Deploy ────────────────────────────────────────────────────────────────────
.PHONY: deploy
deploy:
	@echo "→ Starting production deploy..."
	@export BUILD_ID=$$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d_%H%M%S) && \
	 $(COMPOSE) build --no-cache && \
	 $(COMPOSE) up -d --remove-orphans
	@$(MAKE) migrate
	@$(MAKE) health
	@echo "✓ Deploy complete"

# ─── Lifecycle ─────────────────────────────────────────────────────────────────
.PHONY: start
start:
	$(COMPOSE) up -d

.PHONY: stop
stop:
	$(COMPOSE) down

.PHONY: restart
restart:
	$(COMPOSE) restart app
	@echo "✓ App restarted"

# ─── Logs ──────────────────────────────────────────────────────────────────────
.PHONY: logs
logs:
	$(COMPOSE) logs -f --tail=100 app

.PHONY: logs-all
logs-all:
	$(COMPOSE) logs -f --tail=50

.PHONY: logs-nginx
logs-nginx:
	$(COMPOSE) logs -f --tail=100 nginx

.PHONY: logs-db
logs-db:
	$(COMPOSE) logs -f --tail=100 postgres

# ─── Status ────────────────────────────────────────────────────────────────────
.PHONY: status
status:
	@echo "\n── Containers ──────────────────────────────────────"
	@$(COMPOSE) ps
	@echo "\n── Resource Usage ───────────────────────────────────"
	@docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
	@echo "\n── Disk ──────────────────────────────────────────────"
	@df -h /var/lib/docker 2>/dev/null || df -h /

# ─── Health ────────────────────────────────────────────────────────────────────
.PHONY: health
health:
	@echo "→ Checking health endpoints..."
	@curl -sf http://localhost:3000/api/health | python3 -m json.tool 2>/dev/null || \
	 curl -sf http://localhost:3000/api/health
	@curl -sf http://localhost:3000/api/health/ready && echo " [ready: OK]" || echo " [ready: FAIL]"
	@curl -sf http://localhost:3000/api/health/live  && echo " [live:  OK]" || echo " [live:  FAIL]"

# ─── Database ──────────────────────────────────────────────────────────────────
.PHONY: migrate
migrate:
	@echo "→ Running database migrations..."
	@$(COMPOSE) exec -T app npx prisma migrate deploy
	@echo "✓ Migrations complete"

.PHONY: migrate-status
migrate-status:
	@$(COMPOSE) exec -T app npx prisma migrate status

.PHONY: seed
seed:
	@echo "→ Seeding database..."
	@read -p "This will insert demo data. Continue? [y/N] " yn && [ "$$yn" = "y" ] || exit 1
	@$(COMPOSE) exec -e ALLOW_SEED=true -T app npx prisma db seed
	@echo "✓ Seed complete"

.PHONY: shell-db
shell-db:
	@source .env.production && $(COMPOSE) exec postgres psql -U $$POSTGRES_USER -d $$POSTGRES_DB

.PHONY: db-size
db-size:
	@source .env.production && $(COMPOSE) exec -T postgres psql -U $$POSTGRES_USER -d $$POSTGRES_DB \
	  -c "SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size;"

.PHONY: db-connections
db-connections:
	@source .env.production && $(COMPOSE) exec -T postgres psql -U $$POSTGRES_USER -d $$POSTGRES_DB \
	  -c "SELECT count(*) AS connections, state FROM pg_stat_activity GROUP BY state;"

# ─── Redis ─────────────────────────────────────────────────────────────────────
.PHONY: shell-redis
shell-redis:
	@source .env.production && $(COMPOSE) exec cache redis-cli -a $$REDIS_PASSWORD

.PHONY: redis-info
redis-info:
	@source .env.production && $(COMPOSE) exec -T cache redis-cli -a $$REDIS_PASSWORD info memory | grep used_memory_human

# ─── App Shell ─────────────────────────────────────────────────────────────────
.PHONY: shell-app
shell-app:
	$(COMPOSE) exec app sh

# ─── Backup ────────────────────────────────────────────────────────────────────
.PHONY: backup
backup:
	@echo "→ Creating database backup..."
	@bash scripts/backup.sh
	@echo "✓ Backup complete"

.PHONY: backup-list
backup-list:
	@ls -lht /backups/daily/ 2>/dev/null | head -20

.PHONY: restore
restore:
	@echo "→ Listing available backups:"
	@ls -t /backups/daily/*.gpg 2>/dev/null | head -10
	@echo ""
	@read -p "Enter backup filename to restore: " BACKUP && \
	 read -p "WARNING: This will OVERWRITE the current database. Type 'yes' to confirm: " CONFIRM && \
	 [ "$$CONFIRM" = "yes" ] && bash scripts/restore.sh $$BACKUP || echo "Aborted"

# ─── SSL ───────────────────────────────────────────────────────────────────────
.PHONY: ssl-renew
ssl-renew:
	$(COMPOSE) run --rm certbot certbot renew --webroot -w /var/www/certbot
	$(COMPOSE) restart nginx
	@echo "✓ SSL renewed"

.PHONY: ssl-status
ssl-status:
	@certbot certificates 2>/dev/null || docker run --rm -v certbot_conf:/etc/letsencrypt certbot/certbot certificates

# ─── Secrets ───────────────────────────────────────────────────────────────────
.PHONY: secrets
secrets:
	@echo "\n── Generate these values for .env.production ──────────"
	@echo -n "JWT_SECRET=";         node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
	@echo -n "POSTGRES_PASSWORD=";  node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
	@echo -n "REDIS_PASSWORD=";     node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
	@echo "────────────────────────────────────────────────────────\n"

# ─── Cleanup ───────────────────────────────────────────────────────────────────
.PHONY: clean
clean:
	docker system prune -f --filter "until=72h"
	@echo "✓ Cleanup complete"

.PHONY: clean-all
clean-all:
	@read -p "Remove ALL containers, images, volumes? [y/N] " yn && [ "$$yn" = "y" ] || exit 1
	$(COMPOSE) down -v --rmi all
