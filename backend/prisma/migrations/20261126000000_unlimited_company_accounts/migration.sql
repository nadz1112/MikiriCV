-- Remove the plan's account-count setting. User accounts and their balances are preserved.
ALTER TABLE "service_plans" DROP CONSTRAINT IF EXISTS "service_plan_bounds";
ALTER TABLE "service_plans" DROP COLUMN "maxAccounts";
ALTER TABLE "service_plans" ADD COLUMN "monthlyPriceVnd" INTEGER NOT NULL DEFAULT 0;
UPDATE "service_plans" SET "monthlyPriceVnd" = 299000 WHERE "name" = 'PLUS';
ALTER TABLE "service_plans" ADD CONSTRAINT "service_plan_price_bounds" CHECK ("monthlyPriceVnd" BETWEEN 0 AND 100000000 AND ("name" <> 'FREE' OR "monthlyPriceVnd" = 0));
ALTER TABLE "service_plans" ADD CONSTRAINT "service_plan_bounds" CHECK (
  "name" IN ('FREE', 'PLUS') AND "tokenLimit" BETWEEN 1000 AND 1000000000
  AND "cycleDays" BETWEEN 1 AND 366 AND "maxCvPerCall" BETWEEN 1 AND 200
  AND "maxOutputTokens" BETWEEN 1024 AND 32768
);
