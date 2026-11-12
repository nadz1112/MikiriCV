import { prisma } from '../config/database.js';
import { env } from '../config/env.js';

export type DashboardRange = '7d' | '30d' | 'all';
const DAY_MS = 86_400_000;
// Calendar days in Vietnam, stored as UTC dates for database grouping.
export function vietnamDay(now = new Date()): Date {
  const local = new Date(now.getTime() + 7 * 3_600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

export async function getAdminDashboard(range: DashboardRange) {
  const today = vietnamDay();
  const start = range === 'all' ? undefined : new Date(today.getTime() - (range === '7d' ? 6 : 29) * DAY_MS);
  const usageWhere = { ...(start ? { day: { gte: start, lte: today } } : {}) };
  const [users, totalJobs, totalCandidates, failedCandidates, scores, enterprises, jobsByOwner, cvsByOwner, matchesByOwner, usage, daily, usageByOwner, callsWithoutTokenData] = await Promise.all([
    prisma.user.groupBy({ by: ['isActive'], _count: { _all: true } }),
    prisma.jobDescription.count(),
    prisma.candidate.count(),
    prisma.candidate.count({ where: { extractionStatus: 'FAILED' } }),
    prisma.matchResult.groupBy({ by: ['score'], _count: { _all: true } }),
    prisma.user.findMany({ where: { role: 'ENTERPRISE' }, select: { id: true, fullName: true, companyName: true, lastLoginAt: true } }),
    prisma.jobDescription.groupBy({ by: ['ownerId'], _count: { _all: true } }),
    prisma.candidate.groupBy({ by: ['ownerId'], _count: { _all: true } }),
    prisma.matchResult.groupBy({ by: ['candidateId'], _count: { _all: true } }),
    prisma.aiUsage.aggregate({ where: usageWhere, _sum: { inputTokens: true, outputTokens: true }, _count: { _all: true, inputTokens: true, outputTokens: true } }),
    prisma.aiUsage.groupBy({ by: ['day'], where: usageWhere, _sum: { inputTokens: true, outputTokens: true }, _count: { _all: true }, orderBy: { day: 'asc' } }),
    prisma.aiUsage.groupBy({ by: ['enterpriseId'], where: usageWhere, _sum: { inputTokens: true, outputTokens: true }, _count: { _all: true } }),
    prisma.aiUsage.count({ where: { ...usageWhere, OR: [{ inputTokens: null }, { outputTokens: null }] } }),
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
  const inputRate = env.AI_INPUT_USD_PER_MILLION_TOKENS;
  const outputRate = env.AI_OUTPUT_USD_PER_MILLION_TOKENS;
  const estimate = (input: number, output: number) => inputRate === undefined || outputRate === undefined ? null : (input * inputRate + output * outputRate) / 1_000_000;
  const dailyMap = new Map(daily.map((row) => [row.day.toISOString().slice(0, 10), row]));
  const dates = start ? Array.from({ length: range === '7d' ? 7 : 30 }, (_, index) => new Date(start.getTime() + index * DAY_MS).toISOString().slice(0, 10)) : [...dailyMap.keys()];
  const distribution = [
    { label: '<50', count: 0 }, { label: '50–70', count: 0 }, { label: '>70–85', count: 0 }, { label: '>85', count: 0 },
  ];
  for (const row of scores) distribution[row.score < 50 ? 0 : row.score <= 70 ? 1 : row.score <= 85 ? 2 : 3].count += row._count._all;
  const jobs = new Map(jobsByOwner.map((row) => [row.ownerId, row._count._all]));
  const cvs = new Map(cvsByOwner.map((row) => [row.ownerId, row._count._all]));
  const tokens = new Map(usageByOwner.map((row) => [row.enterpriseId, row]));
  const active = users.find((row) => row.isActive)?._count._all ?? 0;
  const locked = users.find((row) => !row.isActive)?._count._all ?? 0;
  const inputTokens = usage._sum.inputTokens ?? 0;
  const outputTokens = usage._sum.outputTokens ?? 0;
  return {
    range,
    overview: { totalUsers: active + locked, activeUsers: active, lockedUsers: locked, totalJobs, totalCandidates, failedCandidates, totalMatches: scores.reduce((sum, row) => sum + row._count._all, 0) },
    distribution,
    ai: {
      inputTokens, outputTokens, estimatedCostUsd: estimate(inputTokens, outputTokens), inputRate: inputRate ?? null, outputRate: outputRate ?? null,
      calls: usage._count._all, callsWithoutTokenData,
      daily: dates.map((date) => {
        const row = dailyMap.get(date);
        const input = row?._sum.inputTokens ?? 0;
        const output = row?._sum.outputTokens ?? 0;
        return { date, inputTokens: input, outputTokens: output, calls: row?._count._all ?? 0, estimatedCostUsd: estimate(input, output) };
      }),
    },
    enterprises: enterprises.map((enterprise) => ({
      ...enterprise, jobCount: jobs.get(enterprise.id) ?? 0, candidateCount: cvs.get(enterprise.id) ?? 0, matchCount: matches.get(enterprise.id) ?? 0,
      inputTokens: tokens.get(enterprise.id)?._sum.inputTokens ?? 0, outputTokens: tokens.get(enterprise.id)?._sum.outputTokens ?? 0,
    })),
  };
}
