# SureEdge AI v2.4.1 — Production Deployment Guide

## What Was Fixed in This Build

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | `next.config.ts` | Missing `output: 'standalone'` — Docker `server.js` never generated | Added |
| 2 | `Dockerfile` | `npm ci --omit=dev` strips Prisma CLI → build fails | Full deps in builder, stripped in runner |
| 3 | `docker-compose.yml` | Postgres `5432` + Redis `6379` exposed to internet | Internal `expose` only |
| 4 | `docker-compose.yml` | Redis no password, hardcoded DB password | Password from env, no defaults |
| 5 | `nginx/nginx.conf` | HTTPS redirect commented out | Enabled, with ACME challenge |
| 6 | `nginx/nginx.conf` | `X-Frame-Options: SAMEORIGIN` | Changed to `DENY` |
| 7 | `nginx/nginx.conf` | Broken `X-XSS-Protection` header | Removed, replaced with `Content-Security-Policy` |
| 8 | `src/lib/auth.ts` | Hardcoded fallback JWT secret | Hard crash if missing — no silent fallback |
| 9 | `src/lib/auth.ts` | 7-day JWT (too long) | 15-min access + 7-day refresh tokens |
| 10 | `src/app/api/auth/login` | No brute force protection | Lockout after 10 failures, 30-min ban |
| 11 | `src/app/api/auth/register` | No email/password validation | Regex + strength check |
| 12 | `src/app/api/surebet/scan` | Random fake data | Real The Odds API + arbitrage math |
| 13 | `src/app/api/ai/advisor` | Hardcoded mock response | Real Anthropic Claude API |
| 14 | `src/app/api/risk/score` | Random numbers | Calculated from real DB bet history |
| 15 | `src/app/api/analytics` | Random data, no auth | Real DB queries + middleware auth |
| 16 | `src/app/api/odds/live` | Random fake odds | Real Odds API feed |
| 17 | `src/app/api/health` | No actual DB check | Real connectivity test |
| 18 | `src/app/api/health/ready` | Returns 200 when DB down | Returns 503 on failure |
| 19 | `prisma/schema.prisma` | No `failedLoginCount`, `lockedUntil`, no FK on `Transaction` | Fixed |
| 20 | `prisma/seed.ts` | Logs `password: admin123` to stdout | Removed, env-driven passwords |
| 21 | `src/middleware.ts` | Did not exist — all API routes unprotected | Added JWT middleware |
| 22 | `src/components/LoginPage.tsx` | Shows `demo123` in UI + auth bypass via `handleDemo()` | Fixed — goes through real API |
| 23 | `prisma/migrations/` | No migration files — `migrate deploy` fails | Initial migration SQL added |

---

## Option A — Docker on VPS (Recommended for production)

### Server requirements
- Ubuntu 22.04+ / Debian 12
- 4 vCPU, 8 GB RAM, 50 GB SSD
- Ports 22, 80, 443 open
- Domain A record → server IP

### Step 1 — Clone to server
```bash
ssh user@YOUR_SERVER_IP
git clone https://github.com/YOUR_ORG/sureedge-ai.git /opt/sureedge
cd /opt/sureedge
```

### Step 2 — Generate secrets
```bash
make secrets
# Copy the output values into .env.production
```

### Step 3 — Fill .env.production
```bash
cp .env.production .env.production.bak    # backup template
nano .env.production

# Required fields to fill:
# JWT_SECRET        (from make secrets)
# POSTGRES_PASSWORD (from make secrets)
# REDIS_PASSWORD    (from make secrets)
# ODDS_API_KEY      (https://the-odds-api.com — free: 500 req/month)
# ANTHROPIC_API_KEY (https://console.anthropic.com — AI advisor)
# DOMAIN            (your domain, e.g. sureedge.ai)
```

### Step 4 — Run setup (installs Docker, SSL, starts everything)
```bash
sudo DOMAIN=sureedge.ai EMAIL=you@email.com bash scripts/setup-production.sh
```

That's it. Setup handles: Docker install → DH params → SSL cert → DB migration → stack start.

### Step 5 — Seed initial data (first time only)
```bash
make seed
```

### Step 6 — Verify
```bash
make health
make status
```

---

## Option B — Vercel + Neon (Free tier)

### Step 1 — Push to GitHub
```bash
git init && git add . && git commit -m "SureEdge AI v2.4.1"
git remote add origin https://github.com/YOUR_USERNAME/sureedge-ai.git
git push -u origin main
```

### Step 2 — Create Neon database
1. Go to https://console.neon.tech
2. Create project → copy the `postgresql://...` connection string

### Step 3 — Deploy on Vercel
1. https://vercel.com → New Project → import your GitHub repo
2. Add environment variables:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Neon connection string |
| `DIRECT_URL` | Same Neon connection string |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |
| `ODDS_API_KEY` | From the-odds-api.com |
| `ANTHROPIC_API_KEY` | From console.anthropic.com |

3. Click Deploy

### Step 4 — Migrate + seed
```bash
npm i -g vercel
vercel link
vercel env pull .env.local
npx prisma migrate deploy
ALLOW_SEED=true npx prisma db seed
```

---

## Day-to-day Operations (Docker)

```bash
# Deploy new code
make deploy

# View logs
make logs

# Database shell
make shell-db

# Create backup now
make backup

# Check health
make health

# Show resource usage
make status

# Renew SSL manually
make ssl-renew
```

---

## Required GitHub Secrets (for CI/CD)

| Secret | Value |
|--------|-------|
| `DEPLOY_SSH_KEY` | Private key for deploy user (`ssh-keygen -t ed25519`) |
| `DEPLOY_KNOWN_HOSTS` | Run `ssh-keyscan YOUR_SERVER_IP` |
| `DEPLOY_USER` | `deploy` (or your user) |
| `DEPLOY_HOST` | Your server IP |
| `SLACK_WEBHOOK` | Optional — Slack notification URL |

---

## Environment Variables Quick Reference

| Variable | Required | Notes |
|----------|----------|-------|
| `JWT_SECRET` | ✅ | Min 32 chars. Crash on missing. |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `DIRECT_URL` | ✅ | Same as DATABASE_URL |
| `POSTGRES_PASSWORD` | ✅ (Docker) | No default |
| `REDIS_PASSWORD` | ✅ (Docker) | No default |
| `ODDS_API_KEY` | ⚠️ Recommended | Scanner returns empty without it |
| `ANTHROPIC_API_KEY` | ⚠️ Recommended | AI Advisor disabled without it |
| `STRIPE_SECRET_KEY` | Optional | Payments |
| `TELEGRAM_BOT_TOKEN` | Optional | Alerts |
| `ALLOW_SEED` | Set `true` for first seed only | Default blocks production seeding |

---

## Diagnostics

```bash
# All container logs
make logs-all

# Just app
make logs

# Database connections
make db-connections

# Database size
make db-size

# Redis memory
make redis-info

# Container resource usage
make status
```
