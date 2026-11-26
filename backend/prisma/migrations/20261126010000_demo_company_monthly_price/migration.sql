-- Authorized demo assumptions: 70,000 VND operating cost, free Gemini, 30% margin.
-- Preserve any price already customized by an administrator.
WITH updated AS (
  UPDATE "service_plans" SET "monthlyPriceVnd" = 100000, "version" = "version" + 1
  WHERE "name" = 'PLUS' AND "monthlyPriceVnd" = 299000
  RETURNING "name", "monthlyPriceVnd", "version"
)
INSERT INTO "billing_audit" ("id", "actorId", "action", "targetId", "before", "after", "reason", "operationKey", "createdAt")
SELECT 'demo-company-price-20261126', 'SYSTEM_MIGRATION', 'PLAN_CONFIG', "name",
  '{"monthlyPriceVnd":299000}'::jsonb,
  jsonb_build_object('monthlyPriceVnd', "monthlyPriceVnd", 'version', "version", 'operatingCostAssumptionVnd', 70000, 'marginAssumptionPercent', 30),
  'Giá demo theo doanh nghiệp/tháng: giả định vận hành 70.000đ, Gemini miễn phí, biên lợi nhuận 30%; chưa phải chi phí vận hành đã đo.',
  'demo-company-price-20261126', CURRENT_TIMESTAMP
FROM updated;
