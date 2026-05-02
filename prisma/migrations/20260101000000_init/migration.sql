-- SureEdge AI — Initial Production Migration
-- Generated for schema v2.4.1
-- Includes: User security fields, RefreshToken, Transaction FK relation

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FREE', 'PRO', 'ENTERPRISE', 'ADMIN');
CREATE TYPE "BetStatus" AS ENUM ('PENDING', 'PLACED', 'WON', 'LOST', 'CANCELLED', 'REFUNDED');
CREATE TYPE "AlertType" AS ENUM ('SUREBET', 'ODDS_DROP', 'LIMIT_REACHED', 'ACCOUNT_FLAGGED', 'SYSTEM');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PAST_DUE', 'CANCELLED');
CREATE TYPE "AutoBetStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');

-- CreateTable: users with brute-force protection fields
CREATE TABLE "User" (
    "id"               TEXT NOT NULL,
    "email"            TEXT NOT NULL,
    "name"             TEXT,
    "passwordHash"     TEXT NOT NULL,
    "role"             "UserRole" NOT NULL DEFAULT 'FREE',
    "balance"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalProfit"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive"         BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil"      TIMESTAMP(3),
    "lastLogin"        TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateTable: refresh tokens
CREATE TABLE "RefreshToken" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateTable: bookmakers
CREATE TABLE "Bookmaker" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "logoUrl"     TEXT,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "reliability" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "maxStake"    DOUBLE PRECISION,
    "minStake"    DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "minOdds"     DOUBLE PRECISION,
    "country"     TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Bookmaker_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Bookmaker_name_key" ON "Bookmaker"("name");

-- CreateTable: sport events
CREATE TABLE "SportEvent" (
    "id"         TEXT NOT NULL,
    "sport"      TEXT NOT NULL,
    "league"     TEXT,
    "homeTeam"   TEXT NOT NULL,
    "awayTeam"   TEXT NOT NULL,
    "startTime"  TIMESTAMP(3) NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'upcoming',
    "externalId" TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SportEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SportEvent_externalId_key" ON "SportEvent"("externalId");
CREATE INDEX "SportEvent_sport_idx" ON "SportEvent"("sport");
CREATE INDEX "SportEvent_startTime_idx" ON "SportEvent"("startTime");
CREATE INDEX "SportEvent_status_idx" ON "SportEvent"("status");

-- CreateTable: odds
CREATE TABLE "Odds" (
    "id"           TEXT NOT NULL,
    "bookmakerId"  TEXT NOT NULL,
    "eventId"      TEXT NOT NULL,
    "market"       TEXT NOT NULL DEFAULT 'h2h',
    "outcome"      TEXT NOT NULL,
    "odds"         DOUBLE PRECISION NOT NULL,
    "previousOdds" DOUBLE PRECISION,
    "timestamp"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Odds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Odds_eventId_bookmakerId_idx" ON "Odds"("eventId", "bookmakerId");
CREATE INDEX "Odds_timestamp_idx" ON "Odds"("timestamp");

-- CreateTable: surebets
CREATE TABLE "Surebet" (
    "id"            TEXT NOT NULL,
    "userId"        TEXT,
    "eventId"       TEXT NOT NULL,
    "profit"        DOUBLE PRECISION NOT NULL,
    "roi"           DOUBLE PRECISION NOT NULL,
    "arbPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence"    DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "status"        TEXT NOT NULL DEFAULT 'active',
    "expiresAt"     TIMESTAMP(3) NOT NULL,
    "detectedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcomes"      TEXT NOT NULL,
    CONSTRAINT "Surebet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Surebet_status_idx" ON "Surebet"("status");
CREATE INDEX "Surebet_expiresAt_idx" ON "Surebet"("expiresAt");

-- CreateTable: bets
CREATE TABLE "Bet" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "surebetId"    TEXT,
    "bookmakerId"  TEXT NOT NULL,
    "eventId"      TEXT NOT NULL,
    "stake"        DOUBLE PRECISION NOT NULL,
    "odds"         DOUBLE PRECISION NOT NULL,
    "potentialWin" DOUBLE PRECISION NOT NULL,
    "status"       "BetStatus" NOT NULL DEFAULT 'PENDING',
    "placedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt"    TIMESTAMP(3),
    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Bet_userId_idx" ON "Bet"("userId");
CREATE INDEX "Bet_status_idx" ON "Bet"("status");
CREATE INDEX "Bet_placedAt_idx" ON "Bet"("placedAt");

-- CreateTable: alerts
CREATE TABLE "Alert" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "type"      "AlertType" NOT NULL,
    "title"     TEXT NOT NULL,
    "message"   TEXT NOT NULL,
    "isRead"    BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Alert_userId_idx" ON "Alert"("userId");
CREATE INDEX "Alert_isRead_idx" ON "Alert"("isRead");

-- CreateTable: subscriptions
CREATE TABLE "Subscription" (
    "id"               TEXT NOT NULL,
    "userId"           TEXT NOT NULL,
    "plan"             "UserRole" NOT NULL DEFAULT 'PRO',
    "status"           "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "stripeId"         TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable: auto-bet rules
CREATE TABLE "AutoBetRule" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "sport"     TEXT,
    "minProfit" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "maxStake"  DOUBLE PRECISION NOT NULL DEFAULT 100,
    "status"    "AutoBetStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AutoBetRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable: prediction logs
CREATE TABLE "PredictionLog" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "eventId"      TEXT NOT NULL,
    "prediction"   TEXT NOT NULL,
    "actualResult" TEXT,
    "confidence"   DOUBLE PRECISION NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PredictionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: transactions (with proper FK)
CREATE TABLE "Transaction" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "type"        TEXT NOT NULL,
    "amount"      DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "status"      TEXT NOT NULL DEFAULT 'completed',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- AddForeignKey constraints
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Odds" ADD CONSTRAINT "Odds_bookmakerId_fkey"
    FOREIGN KEY ("bookmakerId") REFERENCES "Bookmaker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Odds" ADD CONSTRAINT "Odds_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "SportEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Surebet" ADD CONSTRAINT "Surebet_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Surebet" ADD CONSTRAINT "Surebet_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "SportEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Bet" ADD CONSTRAINT "Bet_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Bet" ADD CONSTRAINT "Bet_surebetId_fkey"
    FOREIGN KEY ("surebetId") REFERENCES "Surebet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Bet" ADD CONSTRAINT "Bet_bookmakerId_fkey"
    FOREIGN KEY ("bookmakerId") REFERENCES "Bookmaker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AutoBetRule" ADD CONSTRAINT "AutoBetRule_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PredictionLog" ADD CONSTRAINT "PredictionLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
