ALTER TABLE "companies" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'FREE',
  ADD COLUMN "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN "quotaMonth" DATE,
  ADD COLUMN "monthlyUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "companies" ADD CONSTRAINT "companies_plan_check" CHECK ("plan" IN ('FREE', 'PLUS')),
  ADD CONSTRAINT "companies_cycle_check" CHECK ("billingCycle" IN ('MONTHLY', 'YEARLY')),
  ADD CONSTRAINT "companies_usage_check" CHECK ("monthlyUsed" >= 0);
ALTER TABLE "candidates" ADD COLUMN "pageCount" INTEGER;
ALTER TABLE "match_results" ADD COLUMN "highlights" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "skillAnalysis" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "redFlags" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "interviewQuestions" TEXT[] NOT NULL DEFAULT '{}';
-- Preserve successful analyses already performed in the current Vietnam month.
UPDATE "companies" SET "quotaMonth" = date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
UPDATE "companies" AS company SET "monthlyUsed" = usage.used
FROM (SELECT "companyId", count(*)::integer AS used FROM "ai_usage"
  WHERE "succeeded" = true AND "day" >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
  GROUP BY "companyId") usage WHERE company.id = usage."companyId";
