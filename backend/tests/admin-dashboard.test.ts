import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const db = vi.hoisted(() => ({
  company: { findMany: vi.fn() },
  user: { findUnique: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
  jobDescription: { count: vi.fn(), groupBy: vi.fn() },
  candidate: { count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
  matchResult: { groupBy: vi.fn() },
  aiUsage: { aggregate: vi.fn(), groupBy: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
}));
vi.mock('../src/config/database.js', () => ({ prisma: db }));
const planFields = { plan: 'FREE', billingCycle: 'MONTHLY', quotaMonth: null, monthlyUsed: 0 };

describe('GET /api/admin/dashboard', () => {
  let server: Server;
  let base: string;
  let issueTokens: typeof import('../src/services/auth.service.js').issueTokens;
  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-different-32chars';
    process.env.COOKIE_SECURE = 'false';
    process.env.AI_INPUT_USD_PER_MILLION_TOKENS = '2';
    process.env.AI_BILLING_MODE = 'PAID';
    process.env.AI_OUTPUT_USD_PER_MILLION_TOKENS = '4';
    const { createApp } = await import('../src/app.js');
    ({ issueTokens } = await import('../src/services/auth.service.js'));
    server = createApp().listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/dashboard`;
  }, 60000);
  afterAll(() => new Promise<void>((resolve, reject) => { if (!server) { resolve(); return; } server.close((error) => error ? reject(error) : resolve()); }));
  beforeEach(() => {
    vi.clearAllMocks();
    db.company.findMany.mockResolvedValue([{ ...planFields, id: 'company-a', name: 'Công ty mẫu' }]);
    db.user.groupBy.mockResolvedValue([{ isActive: true, _count: { _all: 2 } }, { isActive: false, _count: { _all: 1 } }]);
    db.user.findMany.mockResolvedValue([{ id: 'hr', fullName: 'Nhân sự mẫu', email: 'hr@example.test', isActive: true, companyId: 'company-a', companyName: 'Công ty mẫu', lastLoginAt: null }]);
    db.jobDescription.count.mockResolvedValue(3);
    db.jobDescription.groupBy.mockResolvedValue([{ ownerId: 'hr', _count: { _all: 3 } }]);
    db.candidate.count.mockImplementation((args?: { where?: { extractionStatus?: string } }) => Promise.resolve(args?.where ? 1 : 8));
    db.candidate.groupBy.mockResolvedValue([{ ownerId: 'hr', _count: { _all: 8 } }]);
    db.candidate.findMany.mockResolvedValue([{ id: 'cv', ownerId: 'hr' }]);
    db.matchResult.groupBy.mockImplementation((args: { by: string[] }) => Promise.resolve(args.by[0] === 'score'
      ? [49, 50, 70, 71, 85, 86].map((score) => ({ score, _count: { _all: 1 } }))
      : [{ candidateId: 'cv', _count: { _all: 6 } }]));
    db.aiUsage.aggregate.mockResolvedValue({ _sum: { inputTokens: 1000, outputTokens: 500 }, _count: { _all: 3, inputTokens: 2, outputTokens: 2 } });
    db.aiUsage.groupBy.mockImplementation((args: { by: string[] }) => Promise.resolve(args.by[0] === 'enterpriseId'
      ? [{ enterpriseId: 'hr', companyId: 'company-a', _sum: { inputTokens: 1000, outputTokens: 500 }, _count: { _all: 3 } }] : []));
    db.aiUsage.count.mockResolvedValue(1);
    db.aiUsage.findFirst.mockResolvedValue({ createdAt: new Date('2026-01-01T00:00:00Z') });
  });
  function headers(role: 'ADMIN' | 'ENTERPRISE' = 'ADMIN') {
    const user = { id: 'user', role, tokenVersion: 0, isActive: true, mustChangePassword: false };
    db.user.findUnique.mockResolvedValue(user);
    return { Cookie: `accessToken=${issueTokens(user).access}` };
  }
  it('requires authentication', async () => {
    expect((await fetch(base)).status).toBe(401);
  });
  it('rejects HR', async () => {
    const response = await fetch(base, { headers: headers('ENTERPRISE') });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ success: false, error: { code: 'FORBIDDEN' } });
    expect(db.aiUsage.aggregate).not.toHaveBeenCalled();
  });
  it.each(['bad', '7d&range=all'])('validates range %s', async (range) => {
    const response = await fetch(`${base}?range=${range}`, { headers: headers() });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' }, requestId: expect.any(String) });
  });
  it.each(['7d', '30d', 'all'])('returns complete aggregates for %s', async (range) => {
    const response = await fetch(`${base}?range=${range}`, { headers: headers() });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.overview).toEqual({ totalUsers: 3, activeUsers: 2, lockedUsers: 1, totalJobs: 3, totalCandidates: 8, failedCandidates: 1, totalMatches: 6 });
    expect(body.data.distribution.map((row: { count: number }) => row.count)).toEqual([1, 2, 2, 1]);
    expect(body.data.ai).toMatchObject({ inputTokens: 1000, outputTokens: 500, estimatedCostUsd: 0.004, calls: 3, callsWithoutTokenData: 1 });
    expect(body.data.ai.daily).toHaveLength(range === '7d' ? 7 : range === '30d' ? 30 : 0);
    expect(body.data.enterprises[0]).toMatchObject({ jobCount: 3, candidateCount: 8, matchCount: 6, inputTokens: 1000 });
    expect(JSON.stringify(body)).not.toMatch(/rawText|searchText|fileUrl|passwordHash/);
    expect(db.aiUsage.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: range === 'all' ? {} : { day: { gte: expect.any(Date), lte: expect.any(Date) } } }));
  });
  it('tolerates empty and legacy data without tokens', async () => {
    db.aiUsage.findFirst.mockResolvedValue(null);
    db.aiUsage.aggregate.mockResolvedValue({ _sum: { inputTokens: null, outputTokens: null }, _count: { _all: 0, inputTokens: 0, outputTokens: 0 } });
    db.aiUsage.count.mockResolvedValue(0);
    db.user.findMany.mockResolvedValue([]);
    db.company.findMany.mockResolvedValue([]);
    db.aiUsage.groupBy.mockResolvedValue([]);
    const response = await fetch(base, { headers: headers() });
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ aiUsageSince: null, ai: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 }, enterprises: [] });
  });
  it('groups calendar days using Vietnam time', async () => {
    const { vietnamDay } = await import('../src/services/admin-dashboard.service.js');
    expect(vietnamDay(new Date('2026-11-10T18:00:00Z')).toISOString()).toBe('2026-11-11T00:00:00.000Z');
  });
  it('combines multiple HR accounts and keeps deleted-HR usage in company totals', async () => {
    db.company.findMany.mockResolvedValue([{ ...planFields, id: 'company-a', name: 'Alpha' }, { ...planFields, id: 'company-b', name: 'Beta' }]);
    db.user.findMany.mockResolvedValue([
      { id: 'hr', fullName: 'HR A', email: 'a@example.test', companyId: 'company-a', isActive: true, lastLoginAt: null },
      { id: 'hr2', fullName: 'HR B', email: 'b@example.test', companyId: 'company-a', isActive: false, lastLoginAt: null },
      { id: 'hr3', fullName: 'HR C', email: 'c@example.test', companyId: 'company-b', isActive: true, lastLoginAt: null },
    ]);
    db.aiUsage.groupBy.mockImplementation((args: { by: string[] }) => Promise.resolve(args.by[0] === 'enterpriseId' ? [
      { enterpriseId: 'hr', companyId: 'company-a', _sum: { inputTokens: 100, outputTokens: 10 }, _count: { _all: 1 } },
      { enterpriseId: 'hr2', companyId: 'company-a', _sum: { inputTokens: 200, outputTokens: 20 }, _count: { _all: 2 } },
      { enterpriseId: null, companyId: 'company-a', _sum: { inputTokens: 50, outputTokens: null }, _count: { _all: 1 } },
      { enterpriseId: 'hr3', companyId: 'company-b', _sum: { inputTokens: 900, outputTokens: 90 }, _count: { _all: 9 } },
    ] : []));
    const response = await fetch(base, { headers: headers() });
    const { data } = await response.json();
    expect(response.status).toBe(200);
    expect(data.enterprises[0]).toMatchObject({ id: 'company-a', hrCount: 2, inputTokens: 350, outputTokens: 30, calls: 4 });
    expect(data.enterprises[0].members.map((hr: { id: string }) => hr.id)).toEqual(['hr', 'hr2']);
    expect(data.enterprises[1]).toMatchObject({ id: 'company-b', hrCount: 1, inputTokens: 900 });
    expect(JSON.stringify(data)).not.toMatch(/rawText|searchText|fileUrl|passwordHash/);
  });
  it('scopes AI totals, daily chart, missing-token calls and start date to the selected company', async () => {
    const response = await fetch(base + '?range=all&companyId=company-a', { headers: headers() });
    expect(response.status).toBe(200);
    expect(db.aiUsage.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: 'company-a' } }));
    expect(db.aiUsage.groupBy).toHaveBeenCalledWith(expect.objectContaining({ by: ['day'], where: { companyId: 'company-a' } }));
    expect(db.aiUsage.count).toHaveBeenCalledWith({ where: { companyId: 'company-a', OR: [{ inputTokens: null }, { outputTokens: null }] } });
    expect(db.aiUsage.findFirst).toHaveBeenCalledWith({ where: { companyId: 'company-a' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
  });
  it('rejects unknown company IDs', async () => {
    const response = await fetch(base + '?companyId=missing', { headers: headers() });
    expect(response.status).toBe(404);
    expect(db.aiUsage.aggregate).not.toHaveBeenCalled();
  });
  it('retains deleted accounts in activity totals and returns the global earliest usage date', async () => {
    db.aiUsage.groupBy.mockImplementation((args: { by: string[] }) => Promise.resolve(args.by[0] === 'enterpriseId' ? [
      { enterpriseId: 'hr', companyId: 'company-a', _sum: { inputTokens: 600, outputTokens: 300 }, _count: { _all: 2 } },
      { enterpriseId: null, _sum: { inputTokens: 400, outputTokens: 200 }, _count: { _all: 1 } },
    ] : []));
    const response = await fetch(base + '?range=7d', { headers: headers() });
    const { data } = await response.json();
    expect(response.status).toBe(200);
    expect(data.aiUsageSince).toBe('2026-01-01T00:00:00.000Z');
    expect(db.aiUsage.findFirst).toHaveBeenCalledWith({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
    expect(data.enterprises.find((row: { id: string | null }) => row.id === null)).toMatchObject({ fullName: 'Tài khoản đã xóa', inputTokens: 400, outputTokens: 200, calls: 1 });
    const totals = data.enterprises.reduce((sum: { input: number; output: number; calls: number; cost: number }, row: { inputTokens: number; outputTokens: number; calls: number; estimatedCostUsd: number }) => ({ input: sum.input + row.inputTokens, output: sum.output + row.outputTokens, calls: sum.calls + row.calls, cost: sum.cost + row.estimatedCostUsd }), { input: 0, output: 0, calls: 0, cost: 0 });
    expect(totals).toMatchObject({ input: data.ai.inputTokens, output: data.ai.outputTokens, calls: data.ai.calls });
    expect(totals.cost).toBeCloseTo(data.ai.estimatedCostUsd);
  });
  it('reports zero free-tier costs for real token usage, including every company and day', async () => {
    const { env } = await import('../src/config/env.js');
    const previous = env.AI_BILLING_MODE;
    try {
      env.AI_BILLING_MODE = 'FREE';
      const response = await fetch(base, { headers: headers() });
      expect(response.status).toBe(200);
      const { data } = await response.json();
      expect(data.ai).toMatchObject({ billingMode: 'FREE', inputTokens: 1000, outputTokens: 500, estimatedCostUsd: 0, inputRate: 0, outputRate: 0 });
      expect(data.ai).toMatchObject({ simulatedCostVnd: 25, demoInputRate: 10000, demoOutputRate: 30000 });
      expect(data.enterprises[0].simulatedCostVnd).toBe(25);
      expect(data.enterprises[0].members[0].simulatedCostVnd).toBe(25);
      expect(data.ai.daily.every((day: { estimatedCostUsd: number }) => day.estimatedCostUsd === 0)).toBe(true);
      expect(data.enterprises.every((company: { estimatedCostUsd: number }) => company.estimatedCostUsd === 0)).toBe(true);
      expect(data.enterprises[0].members[0].estimatedCostUsd).toBe(0);
    } finally { env.AI_BILLING_MODE = previous; }
  });
  it('returns an unknown cost when prices are not configured', async () => {
    const { env } = await import('../src/config/env.js');
    const input = env.AI_INPUT_USD_PER_MILLION_TOKENS;
    const output = env.AI_OUTPUT_USD_PER_MILLION_TOKENS;
    try {
      env.AI_INPUT_USD_PER_MILLION_TOKENS = undefined;
      env.AI_OUTPUT_USD_PER_MILLION_TOKENS = undefined;
      const response = await fetch(base, { headers: headers() });
      expect(response.status).toBe(200);
      expect((await response.json()).data.ai.estimatedCostUsd).toBeNull();
    } finally {
      env.AI_INPUT_USD_PER_MILLION_TOKENS = input;
      env.AI_OUTPUT_USD_PER_MILLION_TOKENS = output;
    }
  });
});
