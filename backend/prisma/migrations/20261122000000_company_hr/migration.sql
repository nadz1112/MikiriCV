CREATE TABLE "companies" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "companies_key_key" ON "companies"("key");
ALTER TABLE "users" ADD COLUMN "companyId" TEXT;
ALTER TABLE "ai_usage" ADD COLUMN "companyId" TEXT;

-- Existing accounts with the same trimmed, case-insensitive company name
-- become members of one company. Unnamed accounts stay separate.
INSERT INTO "companies" ("id", "name", "key")
SELECT md5(company_key), min(company_name), company_key FROM (
  SELECT COALESCE(NULLIF(trim("companyName"), ''), "fullName") AS company_name,
    CASE WHEN NULLIF(trim("companyName"), '') IS NULL THEN 'account:' || "id"
      ELSE lower(regexp_replace(trim("companyName"), '\s+', ' ', 'g')) END AS company_key
  FROM "users" WHERE "role" = 'ENTERPRISE'
) existing GROUP BY company_key;

UPDATE "users" SET "companyId" = md5(CASE
  WHEN NULLIF(trim("companyName"), '') IS NULL THEN 'account:' || "id"
  ELSE lower(regexp_replace(trim("companyName"), '\s+', ' ', 'g')) END)
WHERE "role" = 'ENTERPRISE';
UPDATE "ai_usage" AS usage SET "companyId" = users."companyId"
FROM "users" AS users WHERE usage."enterpriseId" = users."id";
CREATE INDEX "users_companyId_idx" ON "users"("companyId");
CREATE INDEX "ai_usage_companyId_day_idx" ON "ai_usage"("companyId", "day");
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
