#!/usr/bin/env bash
# SureEdge AI — Vercel + Neon CLI Setup Script
# Run from your LOCAL machine (not the server)
# Prerequisites: Node.js 18+, git, internet access

set -euo pipefail
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
step() { echo -e "\n${BOLD}$*${NC}"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
fail() { echo -e "${RED}✗${NC} $*"; exit 1; }

PROJ_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJ_DIR"

step "── Step 1: Install CLIs ────────────────────────────────────────"
npm install -g vercel 2>/dev/null || warn "Vercel CLI already installed"
ok "Vercel CLI: $(vercel --version)"

step "── Step 2: Check Git ───────────────────────────────────────────"
git status &>/dev/null || fail "Not a git repo. Run: git init && git add . && git commit -m 'init'"
ok "Git repo OK"

REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
if [[ -z "$REMOTE" ]]; then
  echo ""
  warn "No git remote found. You need to push to GitHub first:"
  echo "   1. Create a repo at https://github.com/new"
  echo "   2. Run:"
  echo "      git remote add origin https://github.com/YOUR_USERNAME/sureedge-ai.git"
  echo "      git push -u origin main"
  echo ""
  read -p "Press Enter after pushing to GitHub to continue..."
fi

step "── Step 3: Generate secrets ────────────────────────────────────"
echo ""
echo "  Copy these into Vercel → Project → Settings → Environment Variables:"
echo ""
JWT=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
echo -e "  ${BOLD}JWT_SECRET${NC}=${JWT}"
echo ""
warn "Save this secret somewhere safe — you cannot recover it later."
echo ""
read -p "  Press Enter when you have copied the secret..."

step "── Step 4: Vercel login + link ─────────────────────────────────"
vercel whoami &>/dev/null || vercel login
ok "Logged into Vercel"

echo ""
echo "  Linking project (follow the prompts)..."
vercel link
ok "Project linked"

step "── Step 5: Pull env vars template ─────────────────────────────"
echo ""
warn "You need to add these env vars in the Vercel Dashboard BEFORE deploying:"
echo ""
echo "  Go to: https://vercel.com → Your Project → Settings → Environment Variables"
echo ""
cat << 'VARS'
  ┌──────────────────────────┬────────────────────────────────────────────────┐
  │ Key                      │ Value                                          │
  ├──────────────────────────┼────────────────────────────────────────────────┤
  │ DATABASE_URL             │ Neon pooled connection string (Step 6 below)  │
  │ DIRECT_URL               │ Same Neon string (needed for migrations)       │
  │ JWT_SECRET               │ The secret you generated above                 │
  │ NODE_ENV                 │ production                                     │
  │ NEXT_PUBLIC_APP_NAME     │ SureEdge AI                                    │
  │ NEXT_PUBLIC_APP_URL      │ https://your-app.vercel.app  (after deploy)    │
  │ ODDS_API_KEY             │ From https://the-odds-api.com (free)           │
  │ ANTHROPIC_API_KEY        │ From https://console.anthropic.com (free tier) │
  └──────────────────────────┴────────────────────────────────────────────────┘
VARS
echo ""
read -p "  Press Enter after adding all env vars in Vercel dashboard..."

step "── Step 6: Neon database ───────────────────────────────────────"
echo ""
echo "  If you haven't set up Neon yet:"
echo "  1. Go to https://console.neon.tech"
echo "  2. Sign in with GitHub → Create Project → name it 'sureedge-ai'"
echo "  3. Click 'Connection Details' → copy the connection string"
echo "  4. Add DATABASE_URL and DIRECT_URL in Vercel (same string for both)"
echo ""
read -p "  Press Enter once DATABASE_URL is set in Vercel..."

step "── Step 7: Deploy to Vercel ────────────────────────────────────"
echo ""
vercel env pull .env.local
ok "Env vars pulled to .env.local"

echo ""
echo "  Deploying to production..."
vercel --prod
echo ""
ok "Deployed!"

VERCEL_URL=$(vercel inspect --json 2>/dev/null | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); try{console.log(JSON.parse(d).url)}catch{}" 2>/dev/null || echo "your-app.vercel.app")

step "── Step 8: Run database migration ─────────────────────────────"
echo ""
echo "  Running Prisma migrations against Neon..."
npx prisma migrate deploy
ok "Database migrated"

step "── Step 9: Seed initial data ───────────────────────────────────"
echo ""
read -p "  Seed demo accounts? (demo@sureedge.ai, admin@sureedge.ai) [y/N] " yn
if [[ "$yn" =~ ^[Yy]$ ]]; then
  read -s -p "  Set demo password (min 8 chars, 1 uppercase, 1 number): " DEMO_PW
  echo ""
  read -s -p "  Set admin password: " ADMIN_PW
  echo ""
  ALLOW_SEED=true SEED_DEMO_PASSWORD="$DEMO_PW" SEED_ADMIN_PASSWORD="$ADMIN_PW" \
    npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
  ok "Database seeded"
fi

step "── Step 10: Verify ─────────────────────────────────────────────"
echo ""
PROD_URL=$(grep NEXT_PUBLIC_APP_URL .env.local | cut -d= -f2 | tr -d '"' || echo "https://your-app.vercel.app")
echo "  Testing health endpoint..."
curl -sf "${PROD_URL}/api/health" | python3 -m json.tool 2>/dev/null \
  || curl -sf "${PROD_URL}/api/health" \
  || warn "Health check failed — wait 30s and retry: curl ${PROD_URL}/api/health"

echo ""
ok "══════════════════════════════════════════════════"
ok "  SureEdge AI is live!"
ok "  URL: ${PROD_URL}"
ok "══════════════════════════════════════════════════"
echo ""
echo "  Next steps:"
echo "  • Add NEXT_PUBLIC_APP_URL=${PROD_URL} in Vercel env vars"
echo "  • Set your custom domain: Vercel → Project → Settings → Domains"
echo "  • Monitor logs: vercel logs --follow"
echo ""
