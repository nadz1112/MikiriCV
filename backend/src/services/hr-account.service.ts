import { prisma } from '../config/database.js';
import { AppError } from '../common/errors/app-error.js';
import { getPlans, getUserSubscription } from './subscription.service.js';

// Response projections only: all balance calculations remain in the existing service.
export async function getOwnSubscription(userId: string) {
  const subscription = await getUserSubscription(userId);
  return {
    companyId: subscription.companyId, name: subscription.name, billingCycle: subscription.billingCycle,
    startsAt: subscription.startsAt, endsAt: subscription.endsAt, cycleDays: subscription.cycleDays,
    monthlyPriceVnd: subscription.monthlyPriceVnd, maxCvPerCall: subscription.maxCvPerCall,
    maxPages: subscription.maxPages, maxCharacters: subscription.maxCharacters, bulk: subscription.bulk,
    tokenLimit: subscription.tokenLimit, used: subscription.used, remaining: subscription.remaining,
    reservedTokens: subscription.reservedTokens, periodStart: subscription.periodStart, periodEnd: subscription.periodEnd,
  };
}

export async function getOwnBalance(userId: string) {
  const s = await getUserSubscription(userId);
  return { tokenLimit: s.tokenLimit, used: s.used, remaining: s.remaining, reservedTokens: s.reservedTokens, periodStart: s.periodStart, periodEnd: s.periodEnd };
}

export async function getHrPlanCatalog() {
  return (await getPlans()).map((p) => ({ name: p.name, tokenLimit: p.tokenLimit, cycleDays: p.cycleDays,
    monthlyPriceVnd: p.monthlyPriceVnd, maxCvPerCall: p.maxCvPerCall, maxPages: p.maxPages, maxCharacters: p.maxCharacters }));
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

// Usage is recorded once per CV. Resolve JD labels only through records owned by
// this caller; legacy/failed receipts without a JD stay explicitly unavailable.
export async function getOwnUsageHistory(userId: string, page: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true, role: true } });
  if (!user?.companyId || user.role !== 'ENTERPRISE') throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản');
  const where = { enterpriseId: userId, companyId: user.companyId };
  const pageSize = 20;
  const [usage, total, average] = await Promise.all([
    prisma.aiUsage.findMany({ where, select: { id: true, createdAt: true, reservationId: true, totalTokens: true, succeeded: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.aiUsage.count({ where }),
    prisma.aiUsage.aggregate({ where: { ...where, succeeded: true, totalTokens: { gt: 0 } }, _avg: { totalTokens: true }, _count: { _all: true } }),
  ]);
  const reservations = await prisma.tokenReservation.findMany({
    where: { id: { in: usage.flatMap((u) => u.reservationId ? [u.reservationId] : []) }, wallet: { userId, companyId: user.companyId } },
    select: { id: true, operationKey: true },
  });
  const items = await prisma.matchingJobItem.findMany({
    where: { id: { in: reservations.filter((r) => r.operationKey.startsWith('item:')).map((r) => r.operationKey.slice(5)) },
      job: { ownerId: userId, jobDescription: { ownerId: userId } } },
    select: { id: true, job: { select: { jobDescription: { select: { id: true, title: true } } } } },
  });
  const itemJobs = new Map(items.map((item) => [item.id, item.job.jobDescription]));
  const requestKeys = reservations.map((r) => r.operationKey.slice(0, r.operationKey.lastIndexOf(':'))).filter((key) => key.startsWith(`${userId}:/run:`));
  const receipts = await prisma.matchingRequest.findMany({ where: { key: { in: requestKeys } }, select: { key: true, response: true } });
  const receiptJobs = new Map<string, string>();
  for (const receipt of receipts) {
    const body = record(receipt.response);
    const results: unknown[] = Array.isArray(body?.data) ? body.data : [];
    const ids = [...new Set(results.map((result) => record(result)?.jobDescriptionId).filter((id): id is string => typeof id === 'string'))];
    if (ids.length === 1) receiptJobs.set(receipt.key, ids[0]);
  }
  const jobs = await prisma.jobDescription.findMany({ where: { id: { in: [...receiptJobs.values()] }, ownerId: userId }, select: { id: true, title: true } });
  const byJobId = new Map(jobs.map((job) => [job.id, job]));
  const byReservation = new Map(reservations.map((r) => {
    const job = r.operationKey.startsWith('item:') ? itemJobs.get(r.operationKey.slice(5))
      : byJobId.get(receiptJobs.get(r.operationKey.slice(0, r.operationKey.lastIndexOf(':'))) ?? '');
    return [r.id, job] as const;
  }));
  return {
    entries: usage.map((u) => ({ id: u.id, createdAt: u.createdAt.toISOString(), jobTitle: u.reservationId ? byReservation.get(u.reservationId)?.title ?? null : null,
      cvCount: 1, tokensUsed: u.totalTokens, succeeded: u.succeeded })),
    total, page, pageSize,
    estimate: { averageTokensPerCv: Math.ceil(average._avg.totalTokens ?? 2000), sampleCount: average._count._all, source: average._avg.totalTokens != null ? 'PERSONAL_HISTORY' : 'DEFAULT' },
  };
}
