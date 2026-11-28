import { prisma } from '../config/database.js';
import { AppError } from '../common/errors/app-error.js';
import { getAccountQuota } from './token-billing.service.js';

export const PLANS = {
  FREE: { name: 'FREE', maxPages: 2, maxCharacters: 3000 },
  PLUS: { name: 'PLUS', maxPages: 6, maxCharacters: 12000 },
} as const;
export type PlanName = keyof typeof PLANS;
export function vietnamMonth(now = new Date()) {
  const local = new Date(now.getTime() + 7 * 3600000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1));
}
export async function getPlans() {
  return (await prisma.servicePlan.findMany({ orderBy: { name: 'asc' } })).map((config) => ({ ...PLANS[config.name as PlanName], ...config, bulk: config.maxCvPerCall > 1 }));
}
export async function subscriptionDto(company: { id: string; plan: string; billingCycle: string; subscriptionStartedAt?: Date; subscriptionEndsAt?: Date | null }) {
  const features = PLANS[company.plan as PlanName];
  if (!features) throw new AppError(500, 'INVALID_PLAN', 'Cấu hình gói dịch vụ không hợp lệ');
  const config = await prisma.servicePlan.findUniqueOrThrow({ where: { name: company.plan } });
  return { ...features, ...config, name: features.name, companyId: company.id, billingCycle: company.billingCycle, bulk: config.maxCvPerCall > 1,
    startsAt: company.subscriptionStartedAt?.toISOString(), endsAt: company.subscriptionEndsAt?.toISOString() ?? null };
}
export async function getUserSubscription(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { company: true } });
  if (!user?.company) throw new AppError(409, 'COMPANY_REQUIRED', 'Tài khoản chưa được gán doanh nghiệp. Vui lòng liên hệ quản trị viên.');
  return { ...await subscriptionDto(user.company), ...await getAccountQuota(userId) };
}
export function checkDocuments(plan: { maxPages: number; maxCharacters: number }, documents: Array<{ rawText: string; pageCount?: number | null }>) {
  if (documents.some((doc) => Array.from(doc.rawText).length > plan.maxCharacters || (doc.pageCount != null && doc.pageCount > plan.maxPages))) {
    throw new AppError(422, 'PLAN_DOCUMENT_LIMIT', `Gói hiện tại hỗ trợ tối đa ${plan.maxPages} trang PDF / ${plan.maxCharacters.toLocaleString('vi-VN')} ký tự mỗi CV.`);
  }
}
// Validate batch size; actual token holds belong to individual provider calls.
export async function reserveAnalyses(userId: string, count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 300) throw new AppError(400, 'INVALID_ANALYSIS_COUNT', 'Cần chọn từ 1 đến 300 CV hợp lệ');
  const subscription = await getUserSubscription(userId);
  if (count > subscription.maxCvPerCall) throw new AppError(403, 'PLAN_BATCH_LIMIT', `Gói ${subscription.name} cho phép tối đa ${subscription.maxCvPerCall} CV mỗi lần gọi.`);
  if (subscription.remaining <= 0) throw new AppError(429, 'TOKEN_QUOTA_EXCEEDED', 'Tài khoản đã hết token trong chu kỳ hiện tại.');
  return { ...subscription, reserved: count, monthDate: new Date(subscription.periodStart) };
}
// Compatibility for queued jobs created before token billing. No company CV pool
// is mutated: token reservations are settled/released by reservation ID.
export async function refundAnalyses(_ticket: { companyId: string; monthDate: Date }, _count: number) {}
