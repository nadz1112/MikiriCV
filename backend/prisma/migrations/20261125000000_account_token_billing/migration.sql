-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "subscriptionEndsAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ai_usage" ADD COLUMN     "actualCostUsd" DECIMAL(20,10),
ADD COLUMN     "priceSnapshot" JSONB,
ADD COLUMN     "priceVersion" TEXT,
ADD COLUMN     "reservationId" TEXT,
ADD COLUMN     "thinkingTokens" INTEGER,
ADD COLUMN     "totalTokens" INTEGER;

-- CreateTable
CREATE TABLE "service_plans" (
    "name" TEXT NOT NULL,
    "tokenLimit" INTEGER NOT NULL,
    "cycleDays" INTEGER NOT NULL DEFAULT 30,
    "maxAccounts" INTEGER NOT NULL,
    "maxCvPerCall" INTEGER NOT NULL,
    "maxOutputTokens" INTEGER NOT NULL DEFAULT 8192,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_plans_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "token_wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "baseLimit" INTEGER NOT NULL,
    "adjustment" INTEGER NOT NULL DEFAULT 0,
    "used" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "planVersion" TEXT NOT NULL,

    CONSTRAINT "token_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_ledger" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "actorId" TEXT,
    "operationKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_reservations" (
    "id" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "model" TEXT NOT NULL,
    "priceVersion" TEXT,
    "priceSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "token_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prices" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputUsd" DECIMAL(18,8) NOT NULL,
    "outputUsd" DECIMAL(18,8) NOT NULL,
    "thinkingUsd" DECIMAL(18,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_audit" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matching_requests" (
    "key" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "statusCode" INTEGER,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matching_requests_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "token_wallets_companyId_userId_idx" ON "token_wallets"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "token_wallets_userId_companyId_periodStart_key" ON "token_wallets"("userId", "companyId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "token_ledger_operationKey_key" ON "token_ledger"("operationKey");

-- CreateIndex
CREATE INDEX "token_ledger_walletId_createdAt_idx" ON "token_ledger"("walletId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "token_reservations_operationKey_key" ON "token_reservations"("operationKey");

-- CreateIndex
CREATE INDEX "token_reservations_status_createdAt_idx" ON "token_reservations"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ai_prices_model_createdAt_idx" ON "ai_prices"("model", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "billing_audit_operationKey_key" ON "billing_audit"("operationKey");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_reservationId_key" ON "ai_usage"("reservationId");

-- AddForeignKey
ALTER TABLE "token_ledger" ADD CONSTRAINT "token_ledger_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "token_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_reservations" ADD CONSTRAINT "token_reservations_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "token_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "service_plans" ("name", "tokenLimit", "cycleDays", "maxAccounts", "maxCvPerCall", "maxOutputTokens", "version", "updatedAt") VALUES
  ('FREE', 100000, 30, 3, 1, 4096, 1, CURRENT_TIMESTAMP),
  ('PLUS', 3000000, 30, 20, 200, 8192, 1, CURRENT_TIMESTAMP);

ALTER TABLE "service_plans" ADD CONSTRAINT "service_plan_bounds" CHECK (
  "name" IN ('FREE', 'PLUS') AND "tokenLimit" BETWEEN 1000 AND 1000000000 AND "cycleDays" BETWEEN 1 AND 366
  AND "maxAccounts" BETWEEN 1 AND 1000 AND "maxCvPerCall" BETWEEN 1 AND 200 AND "maxOutputTokens" BETWEEN 1024 AND 32768);
ALTER TABLE "token_wallets" ADD CONSTRAINT "wallet_counters" CHECK ("used" >= 0 AND "reserved" >= 0 AND "baseLimit" >= 0 AND "periodEnd" > "periodStart");
ALTER TABLE "token_reservations" ADD CONSTRAINT "reservation_state" CHECK ("amount" > 0 AND "status" IN ('HELD', 'STARTED', 'SETTLED', 'RELEASED', 'UNKNOWN'));
ALTER TABLE "ai_prices" ADD CONSTRAINT "price_nonnegative" CHECK ("inputUsd" >= 0 AND "outputUsd" >= 0 AND "thinkingUsd" >= 0);
