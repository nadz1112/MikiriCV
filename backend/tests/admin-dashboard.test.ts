import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
  jobDescription: { count: vi.fn(), groupBy: vi.fn() },
  candidate: { count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
  matchResult: { groupBy: vi.fn() },
  aiUsage: { aggregate: vi.fn(), groupBy: vi.fn(), count: vi.fn() },
}));
vi.mock('../src/config/database.js', () => ({ prisma: db }));

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
    db.user.groupBy.mockResolvedValue([{ isActive: true, _count: { _all: 2 } }, { isActive: false, _count: { _all: 1 } }]);
    db.user.findMany.mockResolvedValue([{ id: 'hr', fullName: 'Nhân sự mẫu', companyName: 'Công ty mẫu', lastLoginAt: null }]);
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
      ? [{ enterpriseId: 'hr', _sum: { inputTokens: 1000, outputTokens: 500 }, _count: { _all: 3 } }] : []));
    db.aiUsage.count.mockResolvedValue(1);
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
    db.aiUsage.aggregate.mockResolvedValue({ _sum: { inputTokens: null, outputTokens: null }, _count: { _all: 0, inputTokens: 0, outputTokens: 0 } });
    db.aiUsage.count.mockResolvedValue(0);
    db.user.findMany.mockResolvedValue([]);
    const response = await fetch(base, { headers: headers() });
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ ai: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 }, enterprises: [] });
  });
  it('groups calendar days using Vietnam time', async () => {
    const { vietnamDay } = await import('../src/services/admin-dashboard.service.js');
    expect(vietnamDay(new Date('2026-11-10T18:00:00Z')).toISOString()).toBe('2026-11-11T00:00:00.000Z');
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
