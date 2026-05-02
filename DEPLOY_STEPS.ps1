# SureEdge AI — Complete Deploy Guide
# From zero to LIVE in ~15 minutes
# Run each section one at a time in PowerShell / VS Code Terminal
# ════════════════════════════════════════════════════

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 1 — DOWNLOAD & EXTRACT THE PROJECT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Create project directory
New-Item -ItemType Directory -Force -Path "C:\Projects\sureedge-ai"
Set-Location "C:\Projects\sureedge-ai"

# IMPORTANT: Download SureEdge_AI_v2.4.1_ReadyToDeploy.tar.gz from the chat
# and place it in C:\Projects\sureedge-ai\ then run:
tar -xzf SureEdge_AI_v2.4.1_ReadyToDeploy.tar.gz

# Move contents up one level (the archive creates a sureedge-clean folder)
Copy-Item -Path "sureedge-clean\*" -Destination "." -Recurse -Force
Remove-Item -Recurse -Force "sureedge-clean"
Remove-Item "SureEdge_AI_v2.4.1_ReadyToDeploy.tar.gz"

# Verify files exist
Test-Path "src\app\page.tsx"   # Should return True
Test-Path "prisma\schema.prisma"  # Should return True
Test-Path "package.json"       # Should return True


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 2 — CREATE NEON DATABASE (FREE)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 1. Open browser: https://console.neon.tech
# 2. Sign up with GitHub
# 3. Click "Create Project"
# 4. Name: sureedge-ai  |  Region: US East  |  Click Create
# 5. Wait 30 seconds for database to provision
# 6. Copy the connection string — it looks like:
#    postgresql://neondb_owner:AbCdEf@ep-cool-name.us-east-2.aws.neon.tech/neondb?sslmode=require
#
# WRITE IT DOWN — you need it in Phase 4


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 3 — PUSH TO GITHUB
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Set-Location "C:\Projects\sureedge-ai"

# Initialize Git
git init
git add .
git commit -m "SureEdge AI v2.4.1 — ready to deploy"

# Create repo on GitHub FIRST:
#   1. Open https://github.com/new
#   2. Repository name: sureedge-ai
#   3. Set to PRIVATE (recommended)
#   4. Do NOT check "Add a README"
#   5. Click "Create repository"
# Then come back here and run (replace YOUR_USERNAME):

git remote add origin https://github.com/YOUR_USERNAME/sureedge-ai.git
git branch -M main
git push -u origin main

# If git asks for login, use GitHub token:
#   1. Go to https://github.com/settings/tokens
#   2. Generate new token (classic)
#   3. Check "repo" scope
#   4. Use token as password when prompted


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 4 — DEPLOY TO VERCEL (FREE)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 1. Open browser: https://vercel.com
# 2. Sign up with GitHub (same account as above)
# 3. Click "Add New..." → "Project"
# 4. Find "sureedge-ai" in the list → Click "Import"
# 5. Configure Project:
#    - Framework Preset: Next.js (auto-detected)
#    - Root Directory: . (leave default)
#
# 6. EXPAND "Environment Variables" section
#    Add these EXACTLY:
#
#    Name:                    Value:
#    ──────────────────────────────────────────────────────
#    DATABASE_URL             <PASTE YOUR NEON CONNECTION STRING HERE>
#    DIRECT_URL               <SAME NEON CONNECTION STRING>
#    JWT_SECRET               <GENERATE ONE — see below>
#    NODE_ENV                 production
#    NEXT_PUBLIC_APP_URL      https://sureedge-ai.vercel.app  (update after deploy)
#    NEXT_PUBLIC_APP_NAME     SureEdge AI
#
# 7. Generate JWT_SECRET:
#    Open a NEW terminal and run:
#      node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
#    Copy the output and paste it as JWT_SECRET value
#
# 8. Click "Deploy"
# 9. Wait 2-3 minutes...
# 10. 🎉 YOUR APP IS LIVE at https://sureedge-ai-xxx.vercel.app
#
# 11. Copy your live URL — update NEXT_PUBLIC_APP_URL if needed
#     Vercel Dashboard → Settings → Environment Variables → Edit → Update URL → Save → Redeploy


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 5 — SEED THE DATABASE (CREATE TABLES + DEMO DATA)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Install Vercel CLI
npm i -g vercel

# Login to Vercel (opens browser)
vercel login

# Link to your project
Set-Location "C:\Projects\sureedge-ai"
vercel link

# Pull environment variables from Vercel to your local machine
vercel env pull .env.local

# Push database schema to Neon (creates all tables)
npx prisma db push

# Seed demo data (creates users, bookmakers, sample data)
npx prisma db seed

# ✅ DONE! Open your Vercel URL and test:
#    - Landing page should load
#    - Click "Start Free Trial" → Login page
#    - Click "Try Demo Account" (demo@sureedge.ai / demo123)
#    - Dashboard with KPIs, scanner, analytics


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 6 — CUSTOM DOMAIN (OPTIONAL, FREE ON VERCEL)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 1. Buy a domain (Namecheap, GoDaddy, etc.) — ~$10/year
#    Recommended: sureedge.ai or surebet.ai
#
# 2. In Vercel Dashboard → your project → Settings → Domains
#    Add your domain
#
# 3. Update DNS at your domain registrar:
#    Type    Name       Value
#    ────────────────────────────────────
#    A       @          76.76.21.21
#    CNAME   www        cname.vercel-dns.com
#
# 4. Wait 5-30 minutes for DNS to propagate
# 5. SSL is automatic — no setup needed
# 6. Update NEXT_PUBLIC_APP_URL in Vercel env vars


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DAILY COMMANDS (FOR LOCAL DEVELOPMENT)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# If you want to work locally:
# Start PostgreSQL + Redis via Docker:
docker run -d --name sureedge-db -p 5432:5432 -e POSTGRES_USER=sureedge -e POSTGRES_PASSWORD=sureedge_dev_123 -e POSTGRES_DB=sureedge_dev -v sureedge_pgdata:/var/lib/postgresql/data postgres:16-alpine

docker run -d --name sureedge-redis -p 6379:6379 redis:7-alpine redis-server --requirepass redis_dev_123

# Update .env for local dev (not .env.local which is for Vercel)
# Make sure DATABASE_URL points to localhost, not Neon

# Install dependencies & run:
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev

# Open http://localhost:3000


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# IF YOU GET ERRORS — PASTE THEM IN THE CHAT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Common fixes:
# git push fails → use GitHub Personal Access Token as password
# prisma db push fails → check DATABASE_URL in .env.local matches Neon
# blank page on Vercel → check Vercel build logs for errors
# login doesn't work → make sure JWT_SECRET is set in Vercel env vars
# "module not found" → run npm install then redeploy
