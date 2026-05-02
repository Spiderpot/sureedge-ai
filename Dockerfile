# SureEdge AI — Production Dockerfile
# Fixes:
#   - Missing output: standalone in next.config.ts (now fixed)
#   - deps stage used --omit=dev which stripped Prisma CLI → build failed
#   - No healthcheck, no security patches, no non-root user enforcement

# ─── Stage 1: Base ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache libc6-compat openssl && \
    rm -rf /var/cache/apk/*
WORKDIR /app

# ─── Stage 2: Dependencies (ALL deps — Prisma CLI needs devDeps) ──────────────
FROM base AS deps
COPY package.json package-lock.json* ./
# DO NOT use --omit=dev here — prisma generate (devDep) runs in builder
RUN npm ci

# ─── Stage 3: Builder ──────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Prisma needs a dummy DATABASE_URL at build time to generate the client
# It will NOT connect to this URL — only used for code generation
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

RUN npx prisma generate
RUN npm run build
# Verify standalone output was actually generated
RUN test -f .next/standalone/server.js || (echo "ERROR: .next/standalone/server.js not found. Ensure output: 'standalone' is in next.config.ts" && exit 1)

# ─── Stage 4: Production runner (minimal image) ─────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Security: patch alpine packages
RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache wget openssl && \
    rm -rf /var/cache/apk/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 --ingroup nodejs nextjs

# Copy standalone build artifacts
COPY --from=builder --chown=nextjs:nodejs /app/public                 ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone        ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static            ./.next/static
# Prisma client needed at runtime for DB queries
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma   ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma   ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma                  ./prisma

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -q --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
