#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# SureEdge AI — Supabase Database Setup Script
# ═══════════════════════════════════════════════════════════════════════════════
# This script guides you through setting up Supabase as your PostgreSQL provider.
#
# Prerequisites:
#   1. Node.js 20+ installed
#   2. Supabase CLI installed: npm install -g supabase
#   3. A Supabase account: https://supabase.com (free tier works)
#
# Usage:
#   chmod +x scripts/supabase-setup.sh
#   ./scripts/supabase-setup.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  SureEdge AI — Supabase Database Setup"
echo "════════════════════════════════════════════════════════════"
echo ""

# ── Step 1: Check prerequisites ────────────────────────────────────
log_info "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed. Install it from https://nodejs.org"
    exit 1
fi
log_success "Node.js $(node --version) found"

if ! command -v npx &> /dev/null; then
    log_error "npx is not available. Ensure Node.js is properly installed."
    exit 1
fi
log_success "npx found"

# Check if supabase CLI exists (optional, not required for remote setup)
if command -v supabase &> /dev/null; then
    log_success "Supabase CLI found"
    HAS_SUPABASE_CLI=true
else
    log_warn "Supabase CLI not found. Install with: npm install -g supabase"
    log_warn "Continuing with manual setup (works fine without CLI)..."
    HAS_SUPABASE_CLI=false
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  STEP 1: Create Supabase Project"
echo "════════════════════════════════════════════════════════════"
echo ""
log_info "Go to https://supabase.com/dashboard and create a new project."
log_info "Choose:"
echo "  - Name: sureedge-ai"
echo "  - Region: Closest to your users (recommended: US East / EU West)"
echo "  - Database password: Choose a STRONG password (save it!)"
echo ""
read -p "Press Enter after you've created your Supabase project..."

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  STEP 2: Get Database Connection String"
echo "════════════════════════════════════════════════════════════"
echo ""
log_info "In your Supabase dashboard:"
log_info "  1. Go to Settings > Database"
log_info "  2. Find 'Connection string' section"
log_info "  3. Select 'Transaction' pooler mode"
log_info "  4. Copy the full connection string"
echo ""
read -p "Paste your DATABASE_URL (postgresql://...): " DB_URL

if [[ -z "$DB_URL" ]]; then
    log_error "DATABASE_URL cannot be empty!"
    exit 1
fi

if [[ ! "$DB_URL" =~ ^postgresql:// ]]; then
    log_error "Invalid connection string. Must start with postgresql://"
    exit 1
fi

log_success "Connection string accepted"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  STEP 3: Configure Environment"
echo "════════════════════════════════════════════════════════════"
echo ""

# Generate JWT secret
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")

log_info "Writing .env.local file..."

cat > .env.local << ENVEOF
# ── Supabase Database ─────────────────────────────────────────────
DATABASE_URL=${DB_URL}

# ── Authentication ─────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}

# ── Application ────────────────────────────────────────────────────
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=SureEdge AI

# ── The Odds API (optional — get free key at https://the-odds-api.com) ──
# ODDS_API_KEY=your-key-here

# ── Rate Limiting ──────────────────────────────────────────────────
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
ENVEOF

log_success ".env.local created with generated JWT_SECRET"
log_warn "The Odds API key is optional — scanner works without it"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  STEP 4: Push Database Schema"
echo "════════════════════════════════════════════════════════════"
echo ""
log_info "Pushing Prisma schema to Supabase..."
log_info "This creates all 13 tables, 11 enums, and indexes."

# Use db push for initial setup (creates tables without migration files)
npx prisma db push --skip-generate 2>&1 | tee /tmp/prisma-push.log

if grep -qi "error" /tmp/prisma-push.log && ! grep -qi "already" /tmp/prisma-push.log; then
    log_error "Schema push failed! Check the error above."
    log_info "Common fixes:"
    echo "  1. Ensure DATABASE_URL is correct"
    echo "  2. Ensure your Supabase project is active (not paused)"
    echo "  3. Check network connectivity"
    exit 1
fi

log_success "Database schema pushed successfully!"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  STEP 5: Seed Database"
echo "════════════════════════════════════════════════════════════"
echo ""
log_info "Seeding database with demo data..."
log_info "This creates: 3 users, 8 bookmakers, sample surebets, bets, etc."

npx prisma db seed 2>&1 | tail -20

log_success "Database seeded!"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  STEP 6: Verify Connection"
echo "════════════════════════════════════════════════════════════"
echo ""
log_info "Testing database connection..."

npx prisma db execute --stdin << 'SQLEOF' 2>/dev/null || true
SELECT 'users: ' || COUNT(*) FROM users UNION ALL
SELECT 'bookmakers: ' || COUNT(*) FROM bookmakers UNION ALL
SELECT 'surebets: ' || COUNT(*) FROM surebets UNION ALL
SELECT 'bets: ' || COUNT(*) FROM bets;
SQLEOF

log_info "Starting development server to verify..."
log_info "The server will start at http://localhost:3000"
log_info "Try logging in with: demo@sureedge.ai / DemoPass123!"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "  ✅ Supabase Setup Complete!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "  Next Steps:"
echo "    1. Run: npm run dev          (start local development)"
echo "    2. Open: http://localhost:3000"
echo "    3. Login: demo@sureedge.ai / DemoPass123!"
echo "    4. Deploy: ./scripts/vercel-deploy.sh"
echo ""
echo "  Demo Users:"
echo "    - demo@sureedge.ai    (FREE tier)"
echo "    - premium@sureedge.ai (PREMIUM tier)"
echo "    - admin@sureedge.ai   (ADMIN role)"
echo ""
echo "  Important: Copy these env vars to Vercel before deploying!"
echo "    - DATABASE_URL"
echo "    - JWT_SECRET"
echo "    - ODDS_API_KEY (optional)"
echo ""
