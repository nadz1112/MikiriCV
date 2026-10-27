CREATE TYPE "ExtractionStatus" AS ENUM ('SUCCESS', 'WARNING', 'FAILED');

ALTER TABLE "candidates"
  ALTER COLUMN "rawText" SET DEFAULT '',
  ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'SUCCESS',
  ADD COLUMN "extractionMessage" TEXT,
  ADD COLUMN "contentHash" TEXT,
  ADD COLUMN "uploadedById" TEXT;

CREATE INDEX "candidates_createdAt_idx" ON "candidates"("createdAt" DESC);
CREATE INDEX "candidates_yearsOfExperience_idx" ON "candidates"("yearsOfExperience");
CREATE INDEX "candidates_skills_idx" ON "candidates" USING GIN ("skills");
CREATE INDEX "candidates_contentHash_idx" ON "candidates"("contentHash");
CREATE INDEX "candidates_uploadedById_idx" ON "candidates"("uploadedById");
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "idempotency_keys" (
  "key" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "statusCode" INTEGER,
  "responseBody" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "idempotency_keys_expiresAt_idx" ON "idempotency_keys"("expiresAt");
