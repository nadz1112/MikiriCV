import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { subscriptionDto } from './subscription.service.js';

export type DashboardRange = '7d' | '30d' | 'all';
const DAY_MS = 86_400_000;
// Calendar days in Vietnam, stored as UTC dates for database grouping.
export function vietnamDay(now = new Date()): Date {
  const local = new Date(now.getTime() + 7 * 3_600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

export async function getAdminDashboard(range: DashboardRange, companyId?: string) {
  const companies = await prisma.company.findMany({ select: { id: true, name: true, plan: true, billingCycle: true, quotaMonth: true, monthlyUsed: true } });
  if (companyId && !companies.some((company) => company.id === companyId)) {
    throw Object.assign(new Error('Không tìm thấy doanh nghiệp'), { status: 404, code: 'COMPANY_NOT_FOUND' });
  }
  const today = vietnamDay();
  const start = range === 'all' ? undefined : new Date(today.getTime() - (range === '7d' ? 6 : 29) * DAY_MS);
  const periodWhere = { ...(start ? { day: { gte: start, lte: today } } : {}) };
  const usageWhere = { ...periodWhere, ...(companyId ? { companyId } : {}) };
  const [users, totalJobs, totalCandidates, failedCandidates, scores, enterprises, jobsByOwner, cvsByOwner, matchesByOwner, usage, daily, usageByOwner, callsWithoutTokenData, earliestUsage] = await Promise.all([
    prisma.user.groupBy({ by: ['isActive'], _count: { _all: true } }),
    prisma.jobDescription.count(),
    prisma.candidate.count(),
    prisma.candidate.count({ where: { extractionStatus: 'FAILED' } }),
    prisma.matchResult.groupBy({ by: ['score'], _count: { _all: true } }),
    prisma.user.findMany({ where: { role: 'ENTERPRISE' }, select: { id: true, fullName: true, email: true, isActive: true, companyId: true, companyName: true, lastLoginAt: true } }),
    prisma.jobDescription.groupBy({ by: ['ownerId'], _count: { _all: true } }),
    prisma.candidate.groupBy({ by: ['ownerId'], _count: { _all: true } }),
    prisma.matchResult.groupBy({ by: ['candidateId'], _count: { _all: true } }),
    prisma.aiUsage.aggregate({ where: usageWhere, _sum: { inputTokens: true, outputTokens: true }, _count: { _all: true, inputTokens: true, outputTokens: true } }),
    prisma.aiUsage.groupBy({ by: ['day'], where: usageWhere, _sum: { inputTokens: true, outputTokens: true }, _count: { _all: true }, orderBy: { day: 'asc' } }),
    prisma.aiUsage.groupBy({ by: ['enterpriseId', 'companyId'], where: periodWhere, _sum: { inputTokens: true, outputTokens: true }, _count: { _all: true } }),
    prisma.aiUsage.count({ where: { ...usageWhere, OR: [{ inputTokens: null }, { outputTokens: null }] } }),
    prisma.aiUsage.findFirst({ ...(companyId ? { where: { companyId } } : {}), orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
  ]);
  // Resolve only IDs and ownership for grouped matching counts; never read CV content.
  const candidateOwners = matchesByOwner.length ? await prisma.candidate.findMany({
    where: { id: { in: matchesByOwner.map((row) => row.candidateId) } }, select: { id: true, ownerId: true },
  }) : [];
  const ownerByCandidate = new Map(candidateOwners.map((row) => [row.id, row.ownerId]));
  const matches = new Map<string, number>();
  for (const row of matchesByOwner) {
    const owner = ownerByCandidate.get(row.candidateId);
    if (owner) matches.set(owner, (matches.get(owner) ?? 0) + row._count._all);
  }
  const inputRate = env.AI_BILLING_MODE === 'FREE' ? 0 : env.AI_INPUT_USD_PER_MILLION_TOKENS;
  const demoInputRate = env.AI_DEMO_INPUT_VND_PER_MILLION_TOKENS;
  const demoOutputRate = env.AI_DEMO_OUTPUT_VND_PER_MILLION_TOKENS;
  // Demo accounting is independent of the provider tier and enterprise plan.
  // Keep fractional dong so small calls and grouped totals remain visible and additive.
  const simulate = (input: number, output: number) => (input * demoInputRate + output * demoOutputRate) / 1_000_000;
  const outputRate = env.AI_BILLING_MODE === 'FREE' ? 0 : env.AI_OUTPUT_USD_PER_MILLION_TOKENS;
  const estimate = (input: number, output: number) => inputRate === undefined || outputRate === undefined ? null : (input * inputRate + output * outputRate) / 1_000_000;
  const dailyMap = new Map(daily.map((row) => [row.day.toISOString().slice(0, 10), row]));
  const dates = start ? Array.from({ length: range === '7d' ? 7 : 30 }, (_, index) => new Date(start.getTime() + index * DAY_MS).toISOString().slice(0, 10)) : [...dailyMap.keys()];
  const distribution = [
    { label: '<50', count: 0 }, { label: '50–70', count: 0 }, { label: '>70–85', count: 0 }, { label: '>85', count: 0 },
  ];
  for (const row of scores) distribution[row.score < 50 ? 0 : row.score <= 70 ? 1 : row.score <= 85 ? 2 : 3].count += row._count._all;
  const jobs = new Map(jobsByOwner.map((row) => [row.ownerId, row._count._all]));
  const cvs = new Map(cvsByOwner.map((row) => [row.ownerId, row._count._all]));
  const active = users.find((row) => row.isActive)?._count._all ?? 0;
  const locked = users.find((row) => !row.isActive)?._count._all ?? 0;
  const inputTokens = usage._sum.inputTokens ?? 0;
  const outputTokens = usage._sum.outputTokens ?? 0;
  const activity = enterprises.map((enterprise) => {
    const ownerUsage = usageByOwner.filter((row) => row.enterpriseId === enterprise.id && row.companyId === enterprise.companyId);
    const input = ownerUsage.reduce((sum, row) => sum + (row._sum.inputTokens ?? 0), 0);
    const output = ownerUsage.reduce((sum, row) => sum + (row._sum.outputTokens ?? 0), 0);
    return {
      ...enterprise, jobCount: jobs.get(enterprise.id) ?? 0, candidateCount: cvs.get(enterprise.id) ?? 0,
      matchCount: matches.get(enterprise.id) ?? 0, inputTokens: input, outputTokens: output,
      calls: ownerUsage.reduce((sum, row) => sum + row._count._all, 0), estimatedCostUsd: estimate(input, output), simulatedCostVnd: simulate(input, output),
    };
  });
  const companyActivity = companies.map((company) => {
    const members = activity.filter((hr) => hr.companyId === company.id);
    const companyUsage = usageByOwner.filter((row) => row.companyId === company.id);
    const input = companyUsage.reduce((sum, row) => sum + (row._sum.inputTokens ?? 0), 0);
    const output = companyUsage.reduce((sum, row) => sum + (row._sum.outputTokens ?? 0), 0);
    const lastLogin = members.map((hr) => hr.lastLoginAt).filter((date): date is Date => date !== null).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    return {
      id: company.id, companyName: company.name, fullName: company.name, lastLoginAt: lastLogin,
      subscription: subscriptionDto(company),
      hrCount: members.length, members,
      jobCount: members.reduce((sum, hr) => sum + hr.jobCount, 0),
      candidateCount: members.reduce((sum, hr) => sum + hr.candidateCount, 0),
      matchCount: members.reduce((sum, hr) => sum + hr.matchCount, 0),
      inputTokens: input, outputTokens: output,
      calls: companyUsage.reduce((sum, row) => sum + row._count._all, 0), estimatedCostUsd: estimate(input, output), simulatedCostVnd: simulate(input, output),
    };
  });
  // Legacy calls whose account was deleted before companies existed cannot be attributed.
  const deletedUsage = usageByOwner.filter((row) => !row.companyId);
  const deletedInput = deletedUsage.reduce((sum, row) => sum + (row._sum.inputTokens ?? 0), 0);
  const deletedOutput = deletedUsage.reduce((sum, row) => sum + (row._sum.outputTokens ?? 0), 0);
  return {
    range,
    companyId: companyId ?? null,
    aiUsageSince: earliestUsage?.createdAt.toISOString() ?? null,
    overview: { totalUsers: active + locked, activeUsers: active, lockedUsers: locked, totalJobs, totalCandidates, failedCandidates, totalMatches: scores.reduce((sum, row) => sum + row._count._all, 0) },
    distribution,
    ai: {
      billingMode: env.AI_BILLING_MODE,
      simulatedCostVnd: simulate(inputTokens, outputTokens), demoInputRate, demoOutputRate,
      inputTokens, outputTokens, estimatedCostUsd: estimate(inputTokens, outputTokens), inputRate: inputRate ?? null, outputRate: outputRate ?? null,
      calls: usage._count._all, callsWithoutTokenData,
      daily: dates.map((date) => {
        const row = dailyMap.get(date);
        const input = row?._sum.inputTokens ?? 0;
        const output = row?._sum.outputTokens ?? 0;
        return { date, inputTokens: input, outputTokens: output, calls: row?._count._all ?? 0, estimatedCostUsd: estimate(input, output), simulatedCostVnd: simulate(input, output) };
      }),
    },
    enterprises: [...companyActivity, ...(deletedUsage.length ? [{
      id: null, fullName: 'Tài khoản đã xóa', companyName: 'Tài khoản đã xóa', lastLoginAt: null,
      jobCount: 0, candidateCount: 0, matchCount: 0, inputTokens: deletedInput, outputTokens: deletedOutput,
      hrCount: 0, members: [],
      calls: deletedUsage.reduce((sum, row) => sum + row._count._all, 0), estimatedCostUsd: estimate(deletedInput, deletedOutput),
      simulatedCostVnd: simulate(deletedInput, deletedOutput),
    }] : [])],
  };
}
