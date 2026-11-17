ALTER TABLE "match_results"
  ADD COLUMN "inputTokens" INTEGER,
  ADD COLUMN "outputTokens" INTEGER,
  ADD COLUMN "updatedAt" TIMESTAMP(3);

CREATE TABLE "ai_usage" (
  "id" TEXT NOT NULL,
  "enterpriseId" TEXT,
  "model" TEXT NOT NULL,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "succeeded" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "day" DATE NOT NULL,
  CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_usage_day_idx" ON "ai_usage"("day");
CREATE INDEX "ai_usage_enterpriseId_day_idx" ON "ai_usage"("enterpriseId", "day");
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_enterpriseId_fkey"
  FOREIGN KEY ("enterpriseId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
