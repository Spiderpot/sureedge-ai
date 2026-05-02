# SureEdge AI — Vercel + Neon Deployment
**Zero cost. No server. Live in ~15 minutes.**

---

## What you get for free

| Service | Free Tier | Limits |
|---------|-----------|--------|
| **Vercel** | Hobby plan | 100GB bandwidth/mo, 100 serverless function invocations/day per function |
| **Neon** | Free tier | 0.5GB storage, 100 compute-hours/month, 1 project |
| **The Odds API** | Free plan | 500 requests/month |
| **Anthropic** | $5 free credit | ~5,000 AI advisor queries |

---

## Prerequisites (local machine)
- Node.js 18+ (`node --version`)
- Git
- A GitHub account
- A browser

---

## Automated deploy (recommended)

```bash
bash scripts/vercel-deploy.sh
```

The script walks you through every step interactively.

---

## Manual step-by-step

### Step 1 — Neon database (2 min)

1. Go to **https://console.neon.tech**
2. Sign up with GitHub (fastest)
3. Click **Create Project** → name: `sureedge-ai` → region: closest to your users → **Create**
4. In the dashboard click **Connection Details**
5. Select **Connection string** tab → copy the URL:
   ```
   postgresql://neondb_owner:AbCdEf@ep-cool-name.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
6. Keep this tab open — you'll need the URL in Step 4

---

### Step 2 — Push code to GitHub (3 min)

```bash
cd /path/to/sureedge-ai

git init
git add .
git commit -m "SureEdge AI v2.4.1 — production"

# Create a new repo at https://github.com/new (name: sureedge-ai, private)
git remote add origin https://github.com/YOUR_USERNAME/sureedge-ai.git
git branch -M main
git push -u origin main
```

---

### Step 3 — Generate secrets (1 min)

Run this on your local machine:
```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(48).toString('hex'))"
```

Copy the output. You'll need it in Step 4.

---

### Step 4 — Deploy on Vercel (5 min)

1. Go to **https://vercel.com** → **Add New Project**
2. Click **Import** next to your `sureedge-ai` GitHub repo
3. **⚠️ DO NOT click Deploy yet** — expand **Environment Variables** first

Add these variables:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your Neon connection string (from Step 1) |
| `DIRECT_URL` | Same Neon connection string |
| `JWT_SECRET` | The hex string from Step 3 |
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_APP_NAME` | `SureEdge AI` |
| `NEXT_PUBLIC_APP_URL` | Leave blank for now — fill after first deploy |
| `ODDS_API_KEY` | Get free at https://the-odds-api.com |
| `ANTHROPIC_API_KEY` | Get free at https://console.anthropic.com |

4. Click **Deploy**
5. Wait ~2 minutes for the build
6. Copy your live URL (e.g. `https://sureedge-ai-abc123.vercel.app`)
7. Go back to **Settings → Environment Variables** → add:
   - `NEXT_PUBLIC_APP_URL` = `https://sureedge-ai-abc123.vercel.app`
8. Click **Redeploy** (top right) → **Redeploy without cache**

---

### Step 5 — Database migration (2 min)

Run from your local machine:
```bash
# Install Vercel CLI
npm install -g vercel

# Login + link
vercel login
vercel link     # select your sureedge-ai project

# Pull env vars to local
vercel env pull .env.local

# Run migrations against Neon
npx prisma migrate deploy
```

Expected output:
```
Prisma Migrate: 1 migration applied
✓  20260101000000_init
```

---

### Step 6 — Seed demo accounts (1 min)

```bash
# Set passwords for demo accounts
export ALLOW_SEED=true
export SEED_ADMIN_PASSWORD="Admin@SureEdge1"   # change this
export SEED_DEMO_PASSWORD="Demo@SureEdge1"     # change this

npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```

Demo accounts created:
- `demo@sureedge.ai` → your SEED_DEMO_PASSWORD
- `admin@sureedge.ai` → your SEED_ADMIN_PASSWORD

---

### Step 7 — Verify

```bash
# Health check
curl -s https://your-app.vercel.app/api/health | python3 -m json.tool

# DB check
curl -s https://your-app.vercel.app/api/health/ready
```

Expected:
```json
{ "success": true, "data": { "status": "ok", "checks": { "database": "ok" } } }
```

Open your app URL in a browser → login with demo credentials → explore.

---

## Custom domain

1. Buy a domain (Namecheap, Cloudflare, etc.)
2. Vercel Dashboard → **Settings → Domains** → Add domain
3. Update DNS at your registrar:
   - Add `CNAME` record: `www` → `cname.vercel-dns.com`
   - Add `A` record: `@` → `76.76.21.21`
4. SSL is automatic — no configuration needed
5. Update `NEXT_PUBLIC_APP_URL` env var to your custom domain
6. Redeploy

---

## Upgrading from free → paid (when you have users)

| Users | Action | Monthly cost |
|-------|--------|-------------|
| 1–50 | Stay free | $0 |
| 50–500 | Vercel Pro + Neon Launch | ~$39 |
| 500+ | Switch to Docker VPS | ~$20 (DigitalOcean droplet) |

To switch to Docker later — your codebase already has everything:
`Dockerfile`, `docker-compose.production.yml`, `nginx/nginx.conf`, `scripts/`
Just run `make setup` on a VPS.

---

## Monitoring logs

```bash
# Live function logs
vercel logs --follow

# Specific function
vercel logs --follow --filter "api/surebet/scan"
```

Or in Vercel Dashboard → **Project → Functions** → click any function → **Logs**

---

## Common issues

| Problem | Fix |
|---------|-----|
| `P1001: Can't reach database` | Check `DATABASE_URL` in Vercel env vars matches Neon exactly |
| `JWT_SECRET not configured` | Ensure `JWT_SECRET` is set in Vercel env vars (not just local) |
| Build fails: `prisma generate` | Vercel runs `buildCommand` from `vercel.json` — check build logs |
| Login returns 500 | Run `vercel logs --follow` while logging in to see the error |
| Scanner shows empty | `ODDS_API_KEY` not set or quota exceeded (500/month free limit) |
| AI Advisor disabled | `ANTHROPIC_API_KEY` not set in Vercel env vars |
| `error: relation "User" does not exist` | Run `npx prisma migrate deploy` (Step 5 not done) |
| App built but shows blank page | Add `NEXT_PUBLIC_APP_URL` env var + redeploy |
