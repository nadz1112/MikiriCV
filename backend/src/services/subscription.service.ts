import { prisma } from '../config/database.js';
import { AppError } from '../common/errors/app-error.js';

export const PLANS = {
  FREE: { name: 'FREE', monthlyLimit: 10, maxPages: 2, maxCharacters: 3000, bulk: false, monthlyPriceVnd: 0, yearlyMonthlyPriceVnd: 0 },
  PLUS: { name: 'PLUS', monthlyLimit: 300, maxPages: 6, maxCharacters: 12000, bulk: true, monthlyPriceVnd: 299000, yearlyMonthlyPriceVnd: 249000 },
} as const;
export type PlanName = keyof typeof PLANS;
export function vietnamMonth(now = new Date()) {
  const local = new Date(now.getTime() + 7 * 3600000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1));
}
export function subscriptionDto(company: { id: string; plan: string; billingCycle: string; monthlyUsed: number; quotaMonth: Date | null }) {
  const plan = PLANS[company.plan as PlanName];
  if (!plan) throw new AppError(500, 'INVALID_PLAN', 'Cấu hình gói dịch vụ không hợp lệ');
  const month = vietnamMonth();
  const used = company.quotaMonth?.getTime() === month.getTime() ? company.monthlyUsed : 0;
  return { companyId: company.id, ...plan, billingCycle: company.billingCycle, used, remaining: Math.max(0, plan.monthlyLimit - used), month: month.toISOString().slice(0, 10) };
}
export async function getUserSubscription(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { company: true } });
  if (!user?.company) throw new AppError(409, 'COMPANY_REQUIRED', 'Tài khoản chưa được gán doanh nghiệp. Vui lòng liên hệ quản trị viên.');
  return subscriptionDto(user.company);
}
export function checkDocuments(plan: Pick<typeof PLANS.FREE | typeof PLANS.PLUS, 'maxPages' | 'maxCharacters'>, documents: Array<{ rawText: string; pageCount?: number | null }>) {
  if (documents.some((doc) => Array.from(doc.rawText).length > plan.maxCharacters || (doc.pageCount != null && doc.pageCount > plan.maxPages))) {
    throw new AppError(422, 'PLAN_DOCUMENT_LIMIT', `Gói hiện tại hỗ trợ tối đa ${plan.maxPages} trang PDF / ${plan.maxCharacters.toLocaleString('vi-VN')} ký tự mỗi CV. Vui lòng rút gọn hồ sơ hoặc nâng gói.`);
  }
}
export async function reserveAnalyses(userId: string, count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 300) throw new AppError(400, 'INVALID_ANALYSIS_COUNT', 'Cần chọn từ 1 đến 300 CV hợp lệ');
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { companyId: true } });
    if (!user?.companyId) throw new AppError(409, 'COMPANY_REQUIRED', 'Tài khoản chưa được gán doanh nghiệp');
    // Lock the shared company counter so concurrent HR requests cannot overspend.
    await tx.$queryRaw`SELECT "id" FROM "companies" WHERE "id" = ${user.companyId} FOR UPDATE`;
    const company = await tx.company.findUniqueOrThrow({ where: { id: user.companyId } });
    const subscription = subscriptionDto(company);
    if (!subscription.bulk && count > 1) throw new AppError(403, 'PLUS_REQUIRED', 'Gói FREE xử lý từng CV đơn lẻ. Vui lòng chọn 1 CV hoặc nâng gói PLUS.');
    if (count > subscription.remaining) throw new AppError(429, 'MONTHLY_LIMIT_REACHED', `Doanh nghiệp còn ${subscription.remaining}/${subscription.monthlyLimit} lượt trong tháng. Hạn mức dùng chung cho tất cả HR.`);
    const month = vietnamMonth();
    await tx.company.update({ where: { id: company.id }, data: { quotaMonth: month, monthlyUsed: subscription.used + count } });
    return { ...subscription, monthDate: month, reserved: count };
  });
}
export async function refundAnalyses(ticket: { companyId: string; monthDate: Date }, count: number) {
  if (count <= 0) return;
  await prisma.company.updateMany({ where: { id: ticket.companyId, quotaMonth: ticket.monthDate, monthlyUsed: { gte: count } }, data: { monthlyUsed: { decrement: count } } });
}
