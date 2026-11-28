import { subscriptionEnd } from '../src/services/subscription-period.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { spawnSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// Opt-in: creates a fresh isolated PostgreSQL schema and drops only that schema.
describe.skipIf(process.env.RUN_BILLING_INTEGRATION !== '1')('token billing with PostgreSQL transactions and HTTP authorization', () => {
  let db: PrismaClient;
  let adminDb: PrismaClient;
  let billing: typeof import('../src/services/token-billing.service.js');
  let pricingEnv: typeof import('../src/config/env.js').env;
  let server: Server;
  let base: string;
  let tokens: typeof import('../src/services/auth.service.js').issueTokens;
  let provider: typeof import('../src/modules/matching/ai-matching-provider.js').geminiMatchingProvider;
  const schema = `billing_test_${randomUUID().replaceAll('-', '')}`;
  let a: string, b: string, foreign: string, admin: string, company: string, jd: string, cv: string;
  beforeAll(async () => {
    dotenv.config({ path: '.env', override: true });
    const source = process.env.BILLING_TEST_DATABASE_URL ?? process.env.DATABASE_URL!;
    const url = new URL(source);
    adminDb = new PrismaClient({ datasources: { db: { url: source } } });
    await adminDb.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    url.searchParams.set('schema', schema);
    process.env.DATABASE_URL = url.toString();
    process.env.NODE_ENV = 'test';
    const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env: { ...process.env }, encoding: 'utf8', timeout: 60000, windowsHide: true });
    if (result.status !== 0) throw new Error(`Test migrations failed: ${result.stderr}`);
    ({ prisma: db } = await import('../src/config/database.js'));
    await db.servicePlan.createMany({ data: [{ name: 'FREE', tokenLimit: 100000, maxCvPerCall: 1 }, { name: 'PLUS', tokenLimit: 3000000, maxCvPerCall: 200 }] });
    billing = await import('../src/services/token-billing.service.js');
    ({ env: pricingEnv } = await import('../src/config/env.js'));
    ({ geminiMatchingProvider: provider } = await import('../src/modules/matching/ai-matching-provider.js'));
    ({ issueTokens: tokens } = await import('../src/services/auth.service.js'));
    const { createApp } = await import('../src/app.js');
    server = createApp().listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  }, 90000);
  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await db?.$disconnect();
    if (adminDb) {
      if (!/^billing_test_[a-f0-9]{32}$/.test(schema)) throw new Error('Invalid test schema');
      await adminDb.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await adminDb.$disconnect();
    }
  });
  beforeEach(async () => {
    vi.restoreAllMocks();
    pricingEnv.AI_BILLING_MODE = 'FREE';
    await db.servicePlan.update({ where: { name: 'FREE' }, data: { tokenLimit: 10000, cycleDays: 30, maxCvPerCall: 2, maxOutputTokens: 1024, version: { increment: 1 } } });
    const companyName = `Billing ${randomUUID()}`;
    const co = await db.company.create({ data: { name: companyName, key: companyName.toLowerCase() } }); company = co.id;
    const other = await db.company.create({ data: { name: 'Other company', key: randomUUID() } });
    const createUser = (companyId: string | null, role: 'ENTERPRISE' | 'ADMIN' = 'ENTERPRISE') => db.user.create({ data: { email: `${randomUUID()}@example.test`, fullName: 'Test account', passwordHash: 'unused', role, companyId } });
    a = (await createUser(company)).id; b = (await createUser(company)).id;
    foreign = (await createUser(other.id)).id; admin = (await createUser(null, 'ADMIN')).id;
    jd = (await db.jobDescription.create({ data: { ownerId: a, title: 'Developer', description: 'Build React apps', requiredSkills: ['React'] } })).id;
    cv = (await db.candidate.create({ data: { ownerId: a, fullName: 'Private candidate', skills: ['React'], rawText: 'Private CV text', fileName: 'private.docx', fileUrl: '/private/file.docx' } })).id;
    vi.spyOn(provider, 'countInputTokens').mockResolvedValue(100);
    vi.spyOn(provider, 'generateEvaluation').mockResolvedValue({ inputTokens: 100, outputTokens: 50, thinkingTokens: 20, totalTokens: 170, rawText: JSON.stringify({ score: 80, summary: 'Phù hợp', matchedSkills: ['React'], missingSkills: [], highlights: ['Kỹ năng React', 'Cần xác minh kinh nghiệm', 'Phù hợp kỹ năng yêu cầu'] }) });
  });
  const headers = (id: string, role: 'ADMIN' | 'ENTERPRISE' = 'ENTERPRISE') => ({ 'Content-Type': 'application/json', 'X-Requested-With': 'CVMikiri', Cookie: `accessToken=${tokens({ id, role, tokenVersion: 0 }).access}` });
  const request = (id: string, path: string, method = 'GET', body?: unknown, role: 'ADMIN' | 'ENTERPRISE' = 'ENTERPRISE', key?: string) => fetch(`${base}${path}`, { method, headers: { ...headers(id, role), ...(key ? { 'Idempotency-Key': key } : {}) }, body: body ? JSON.stringify(body) : undefined });

  it('gives each HR the full plan balance and rejects concurrent overspending for only that HR', async () => {
    const initial = await billing.getAccountQuota(a);
    expect(initial).toMatchObject({ tokenLimit: 10000, remaining: 10000, used: 0 });
    const results = await Promise.allSettled([billing.reserveTokens(a, 6500, 'test', randomUUID()), billing.reserveTokens(a, 6500, 'test', randomUUID())]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason.code).toBe('TOKEN_QUOTA_EXCEEDED');
    expect(await billing.getAccountQuota(a)).toMatchObject({ remaining: 3500, reservedTokens: 6500 });
    expect(await billing.getAccountQuota(b)).toMatchObject({ remaining: 10000, reservedTokens: 0 });
  });
  it('settles actual thinking tokens once, releases the hold, and keeps the price snapshot immutable', async () => {
    pricingEnv.AI_BILLING_MODE = 'PAID';
    const price = await db.aiPrice.create({ data: { model: 'priced-model', inputUsd: 2, outputUsd: 4, thinkingUsd: 6 } });
    const hold = await billing.reserveTokens(a, 2000, 'priced-model', randomUUID());
    await db.aiPrice.create({ data: { model: 'priced-model', inputUsd: 20, outputUsd: 40, thinkingUsd: 60 } });
    await billing.startReservation(hold.id);
    const usage = { inputTokens: 100, outputTokens: 50, thinkingTokens: 20, totalTokens: 170 };
    await Promise.all([billing.settleTokens(hold.id, usage, true), billing.settleTokens(hold.id, usage, true)]);
    expect(await billing.getAccountQuota(a)).toMatchObject({ used: 170, reservedTokens: 0, remaining: 9830 });
    const recorded = await db.aiUsage.findUniqueOrThrow({ where: { reservationId: hold.id } });
    expect(recorded.priceVersion).toBe(price.id);
    expect(recorded.actualCostUsd?.toString()).toBe('0.00048');
    expect(await db.tokenLedger.count({ where: { operationKey: `settle:${hold.id}` } })).toBe(1);
    await expect(billing.reserveTokens(a, 2000, 'priced-model', hold.operationKey)).rejects.toMatchObject({ code: 'AI_REQUEST_ALREADY_PROCESSED' });
  });
  it('keeps ambiguous calls reserved and reconciles without double refund', async () => {
    const hold = await billing.reserveTokens(a, 2000, 'test', randomUUID());
    await billing.startReservation(hold.id); await billing.markUncertain(hold.id);
    expect(await billing.getAccountQuota(a)).toMatchObject({ remaining: 8000 });
    await Promise.all([billing.releaseTokens(hold.id, 'Provider confirmed no execution', admin), billing.releaseTokens(hold.id, 'Repeated receipt', admin)]);
    expect(await billing.getAccountQuota(a)).toMatchObject({ remaining: 10000, reservedTokens: 0 });
    expect(await db.aiUsage.count({ where: { reservationId: hold.id } })).toBe(1);
  });
  it('rolls back usage, ledger and balance together when settlement cannot persist', async () => {
    const hold = await billing.reserveTokens(a, 2000, 'test', randomUUID());
    await billing.startReservation(hold.id);
    // Force a ledger constraint failure after the usage and balance writes.
    const conflict = await db.tokenLedger.create({ data: { walletId: hold.walletId, kind: 'TEST_CONFLICT', amount: 0, operationKey: `settle:${hold.id}`, reason: 'Transaction rollback test' } });
    await expect(billing.settleTokens(hold.id, { inputTokens: 100, outputTokens: 50, thinkingTokens: 0 }, true)).rejects.toBeTruthy();
    expect(await billing.getAccountQuota(a)).toMatchObject({ used: 0, reservedTokens: 2000, remaining: 8000 });
    expect(await db.aiUsage.findUnique({ where: { reservationId: hold.id } })).toMatchObject({ totalTokens: null, succeeded: false });
    await db.tokenLedger.delete({ where: { id: conflict.id } });
  });
  it('applies idempotent individual grants and refuses to revoke committed tokens', async () => {
    const key = randomUUID();
    await Promise.all([billing.adjustTokens(a, admin, 1000, 'Support grant', key), billing.adjustTokens(a, admin, 1000, 'Support grant', key)]);
    expect(await billing.getAccountQuota(a)).toMatchObject({ tokenLimit: 11000 });
    await billing.reserveTokens(a, 10000, 'test', randomUUID());
    await expect(billing.adjustTokens(a, admin, -2000, 'Revoke unused', randomUUID())).rejects.toMatchObject({ code: 'TOKEN_ADJUSTMENT_INVALID' });
    expect(await billing.getAccountQuota(b)).toMatchObject({ tokenLimit: 10000 });
  });
  it('settles late responses against the original period, without charging the new cycle', async () => {
    const hold = await billing.reserveTokens(a, 2000, 'test', randomUUID());
    await db.tokenWallet.update({ where: { id: hold.walletId }, data: { periodStart: new Date(Date.now() - 31 * 86400000), periodEnd: new Date(Date.now() - 86400000) } });
    const next = await billing.getAccountQuota(a);
    expect(next.walletId).not.toBe(hold.walletId);
    await billing.settleTokens(hold.id, { inputTokens: 100, outputTokens: 50, thinkingTokens: 0 }, true);
    expect(await billing.getAccountQuota(a)).toMatchObject({ used: 0, remaining: 10000 });
  });
  it('replays HTTP receipts without calling AI or charging again and rejects changed payloads', async () => {
    const key = randomUUID(); const body = { jobDescriptionId: jd, candidateIds: [cv] };
    const first = await request(a, '/matching/run', 'POST', body, 'ENTERPRISE', key);
    expect(first.status).toBe(200); const result = await first.json();
    const replay = await request(a, '/matching/run', 'POST', body, 'ENTERPRISE', key);
    expect(await replay.json()).toEqual(result);
    expect(provider.generateEvaluation).toHaveBeenCalledTimes(1);
    expect(await billing.getAccountQuota(a)).toMatchObject({ used: 170 });
    expect((await request(a, '/matching/run', 'POST', { ...body, candidateIds: [cv, randomUUID()] }, 'ENTERPRISE', key)).status).toBe(409);
  });
  it('enforces ownership for every selected ID and refuses insufficient tokens before generation', async () => {
    const stolen = await request(foreign, '/matching/run', 'POST', { jobDescriptionId: jd, candidateIds: [cv] });
    expect(stolen.status).toBe(404);
    const ownJob = await db.jobDescription.create({ data: { ownerId: foreign, title: 'Other JD', description: 'Other', requiredSkills: [] } });
    expect((await request(foreign, '/matching/run', 'POST', { jobDescriptionId: ownJob.id, candidateIds: [cv] })).status).toBe(404);
    await billing.reserveTokens(a, 9500, 'test', randomUUID());
    const rejected = await request(a, '/matching/run', 'POST', { jobDescriptionId: jd, candidateIds: [cv] });
    expect((await rejected.json()).error.code).toBe('TOKEN_QUOTA_EXCEEDED');
    expect(provider.generateEvaluation).not.toHaveBeenCalled();
  });
  it('processes multiple selected PLUS CVs in one job and charges only their owner', async () => {
    await db.company.update({ where: { id: company }, data: { plan: 'PLUS' } });
    vi.mocked(provider.generateEvaluation).mockResolvedValue({ inputTokens: 100, outputTokens: 50, thinkingTokens: 20, totalTokens: 170, rawText: JSON.stringify({ score: 80, summary: 'Phù hợp', matchedSkills: ['React'], missingSkills: [], highlights: ['React', 'Kinh nghiệm liên quan', 'Cần xác minh dự án'], skillAnalysis: ['Có kỹ năng React'], redFlags: ['Cần xác minh kinh nghiệm'], interviewQuestions: ['Bạn tổ chức component thế nào?', 'Bạn quản lý trạng thái thế nào?', 'Bạn kiểm thử thế nào?'] }) });
    const second = await db.candidate.create({ data: { ownerId: a, fullName: 'Second candidate', skills: ['React'], rawText: 'React developer', fileName: 'second.docx', fileUrl: '/private/second.docx' } });
    const extra = await db.candidate.create({ data: { ownerId: a, fullName: 'Unselected candidate', skills: [], rawText: 'Not selected', fileName: 'extra.docx', fileUrl: '/private/extra.docx' } });
    const created = await request(a, '/matching/jobs', 'POST', { jobDescriptionId: jd, candidateIds: [cv, second.id] });
    expect(created.status).toBe(202);
    const { data: job } = await created.json();
    await vi.waitFor(async () => {
      const finished = await db.matchingJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(finished).toMatchObject({ status: 'COMPLETED', total: 2, processed: 2, failed: 0 });
    }, { timeout: 10000 });
    expect(provider.generateEvaluation).toHaveBeenCalledTimes(2);
    expect(await db.matchResult.count({ where: { candidateId: extra.id } })).toBe(0);
    expect(await billing.getAccountQuota(a)).toMatchObject({ used: 340, reservedTokens: 0 });
    expect(await billing.getAccountQuota(b)).toMatchObject({ used: 0, reservedTokens: 0 });
  }, 20000);
  it('paginates each admin history independently with ten entries', async () => {
    for (let i = 0; i < 12; i++) {
      const held = await billing.reserveTokens(a, 10, 'test', randomUUID());
      await billing.settleTokens(held.id, { inputTokens: 1, outputTokens: 1, thinkingTokens: 0 }, true);
    }
    for (let i = 0; i < 12; i++) await billing.reserveTokens(a, 10, 'test', randomUUID());
    const wallet = await db.tokenWallet.findFirstOrThrow({ where: { userId: a } });
    await db.tokenLedger.createMany({ data: Array.from({ length: 12 }, () => ({ walletId: wallet.id, kind: 'PLAN_CHANGE', amount: 0, operationKey: randomUUID(), reason: 'Pagination fixture' })) });
    const get = async (query: string) => (await (await request(admin, `/admin/users/${a}/token-history${query}`, 'GET', undefined, 'ADMIN')).json()).data;
    const first = await get('');
    expect(first.usage).toHaveLength(10);
    expect(first.ledger).toHaveLength(10);
    expect(first.reservations).toHaveLength(10);
    expect(first.reservationTotal).toBe(12);
    expect(first.ledgerTotal).toBe(13);
    const second = await get('?page=2');
    expect(second.usage).toHaveLength(2);
    expect(second.ledger).toEqual(first.ledger);
    expect(second.reservations).toEqual(first.reservations);
    const others = await get('?ledgerPage=2&reservationPage=2');
    expect(others.usage).toEqual(first.usage);
    expect(others.ledger).toHaveLength(3);
    expect(others.reservations).toHaveLength(2);
    expect((await request(admin, `/admin/users/${a}/token-history?ledgerPage=0`, 'GET', undefined, 'ADMIN')).status).toBe(400);
  });
  it('returns only the callers balance and history and retains admin access to other accounts', async () => {
    const holdA = await billing.reserveTokens(a, 2000, 'test', randomUUID());
    const holdB = await billing.reserveTokens(b, 2000, 'test', randomUUID());
    const holdForeign = await billing.reserveTokens(foreign, 2000, 'test', randomUUID());
    await billing.settleTokens(holdA.id, { inputTokens: 50, outputTokens: 20, thinkingTokens: 0 }, true);
    await billing.settleTokens(holdB.id, { inputTokens: 100, outputTokens: 20, thinkingTokens: 0 }, true);
    await billing.settleTokens(holdForeign.id, { inputTokens: 200, outputTokens: 20, thinkingTokens: 0 }, true);
    const summary = await (await request(a, '/subscription/company')).json();
    expect(summary.data).not.toHaveProperty('accounts');
    expect(summary.data).toMatchObject({ used: 70, remaining: 9930 });
    expect(JSON.stringify(summary)).not.toContain('Private CV text');
    expect(JSON.stringify(summary)).not.toContain('/private/file.docx');
    const history = await (await request(a, '/subscription/history')).json();
    expect(history.data.entries).toHaveLength(1);
    expect(history.data.entries[0].tokensUsed).toBe(70);
    expect(history.data).not.toHaveProperty('ledger');
    expect(history.data).not.toHaveProperty('reservations');
    for (const other of [b, foreign]) {
      expect((await request(a, `/subscription/history?userId=${other}`)).status).toBe(400);
      expect((await request(a, `/admin/users/${other}/token-history`)).status).toBe(403);
      const balance = await (await request(a, `/subscription/balance?userId=${other}`)).json();
      expect(balance.data).toMatchObject({ used: 70, remaining: 9930 });
      const adminHistory = await (await request(admin, `/admin/users/${other}/token-history`, 'GET', undefined, 'ADMIN')).json();
      expect(adminHistory.data.usage).toHaveLength(1);
      expect(adminHistory.data.usage[0].enterpriseId).toBe(other);
    }
    const adminSummary = await (await request(admin, `/admin/companies/${company}/tokens`, 'GET', undefined, 'ADMIN')).json();
    expect(adminSummary.data.accounts.map((u: { id: string }) => u.id).sort()).toEqual([a, b].sort());
    expect((await request(a, `/admin/users/${foreign}/tokens`, 'POST', { amount: 1, reason: 'test', operationKey: randomUUID() })).status).toBe(403);
    expect((await request(a, `/admin/companies/${company}/tokens`)).status).toBe(403);
  });
  it('labels the callers usage with the owned JD and supplies a personal average', async () => {
    expect((await request(a, '/matching/run', 'POST', { jobDescriptionId: jd, candidateIds: [cv] })).status).toBe(200);
    const history = await (await request(a, '/subscription/history')).json();
    expect(history.data.entries[0]).toMatchObject({ jobTitle: 'Developer', cvCount: 1, tokensUsed: 170 });
    expect(history.data.estimate).toMatchObject({ source: 'PERSONAL_HISTORY', averageTokensPerCv: 170, sampleCount: 1 });
    expect(JSON.stringify(history)).not.toContain('Private candidate');
    expect(JSON.stringify(history)).not.toContain('Private CV text');
    expect(JSON.stringify(history)).not.toContain('actualCostUsd');
  });
  it('paginates only personal usage and reads the configured plan comparison', async () => {
    await db.aiUsage.createMany({ data: Array.from({ length: 22 }, () => ({ enterpriseId: a, companyId: company, model: 'test', totalTokens: 30, succeeded: true, day: new Date() })) });
    const first = await (await request(a, '/subscription/history?page=1')).json();
    const second = await (await request(a, '/subscription/history?page=2')).json();
    expect(first.data.entries).toHaveLength(20); expect(second.data.entries).toHaveLength(2);
    expect(first.data.total).toBe(22);
    const plans = await (await request(a, '/subscription/plans')).json();
    expect(plans.data.find((p: { name: string }) => p.name === 'FREE')).toMatchObject({ tokenLimit: 10000, maxCvPerCall: 2 });
    expect(first.data.entries[0].jobTitle).toBeNull();
  });
  it('persists provider failures and missing usage as failures while accounting for malformed paid output', async () => {
    vi.mocked(provider.generateEvaluation).mockResolvedValueOnce({ rawText: 'invalid JSON', inputTokens: 100, outputTokens: 50, thinkingTokens: 0 });
    const body = { jobDescriptionId: jd, candidateIds: [cv] };
    const invalid = await request(a, '/matching/run', 'POST', body);
    expect((await invalid.json()).error.code).toBe('AI_INVALID_RESPONSE');
    expect(await billing.getAccountQuota(a)).toMatchObject({ used: 150, reservedTokens: 0 });
    expect(await db.matchResult.count({ where: { candidateId: cv } })).toBe(0);
    vi.mocked(provider.generateEvaluation).mockRejectedValueOnce({ name: 'TimeoutError' });
    const timeout = await request(a, '/matching/run', 'POST', body);
    expect((await timeout.json()).error.code).toBe('AI_TIMEOUT');
    expect(await billing.getAccountQuota(a)).toMatchObject({ used: 150, reservedTokens: 1124 });
    vi.mocked(provider.generateEvaluation).mockResolvedValueOnce({ rawText: '{}', inputTokens: null, outputTokens: null });
    expect((await (await request(a, '/matching/run', 'POST', body)).json()).error.code).toBe('AI_USAGE_MISSING');
    expect(await billing.getAccountQuota(a)).toMatchObject({ used: 150, reservedTokens: 2248 });
  });
  it('keeps the captured free price when billing mode changes before settlement', async () => {
    const hold = await billing.reserveTokens(a, 2000, 'test', randomUUID());
    pricingEnv.AI_BILLING_MODE = 'PAID';
    await billing.settleTokens(hold.id, { inputTokens: 100, outputTokens: 50, thinkingTokens: 20 }, true);
    expect((await db.aiUsage.findUniqueOrThrow({ where: { reservationId: hold.id } })).actualCostUsd?.toString()).toBe('0');
  });
  it('exposes the configured monthly company fee without multiplying it by HR count', async () => {
    expect((await request(admin, `/admin/users/${a}/tokens`, 'POST', { amount: 1000, reason: 'Individual override', operationKey: randomUUID() }, 'ADMIN')).status).toBe(410);
    const original = await billing.getAccountQuota(a);
    const startsAt = new Date(Date.now() - 86400000).toISOString();
    const endsAt = new Date(Date.now() + 30 * 86400000).toISOString();
    expect((await request(admin, `/admin/companies/${company}/subscription`, 'PATCH', { plan: 'PLUS', billingCycle: 'MONTHLY', startsAt, endsAt, operationKey: randomUUID(), reason: 'Set subscription dates' }, 'ADMIN')).status).toBe(200);
    expect(await billing.getAccountQuota(a)).toMatchObject({ periodStart: original.periodStart, periodEnd: original.periodEnd, used: original.used });
    expect((await db.company.findUniqueOrThrow({ where: { id: company } })).subscriptionStartedAt.toISOString()).toBe(startsAt);
    expect((await db.company.findUniqueOrThrow({ where: { id: company } })).subscriptionEndsAt?.toISOString()).toBe(subscriptionEnd('PLUS', 'MONTHLY', new Date(startsAt))?.toISOString());
    expect((await request(admin, `/admin/companies/${company}/subscription`, 'PATCH', { plan: 'PLUS', billingCycle: 'MONTHLY', startsAt: '2000-01-01T00:00:00.000Z', endsAt, operationKey: randomUUID(), reason: 'Invalid dates' }, 'ADMIN')).status).toBe(400);
    const body = { monthlyPriceVnd: 143000, tokenLimit: 3000000, cycleDays: 30, maxCvPerCall: 200, maxOutputTokens: 8192, operationKey: randomUUID(), reason: 'Monthly company price' };
    expect((await request(admin, '/admin/plans/PLUS', 'PUT', body, 'ADMIN')).status).toBe(200);
    expect((await request(admin, `/admin/companies/${company}/subscription`, 'PATCH', { plan: 'PLUS', billingCycle: 'MONTHLY', endsAt: null, operationKey: randomUUID(), reason: 'Upgrade company' }, 'ADMIN')).status).toBe(200);
    for (const user of [a, b]) {
      const subscription = await (await request(user, '/subscription')).json();
      expect(subscription.data).toMatchObject({ monthlyPriceVnd: 143000, tokenLimit: 3000000 });
      expect(subscription.data).not.toHaveProperty('maxAccounts');
    }
    expect((await request(admin, '/admin/plans/FREE', 'PUT', { ...body, monthlyPriceVnd: 1, operationKey: randomUUID() }, 'ADMIN')).status).toBe(400);
  });
  it('audits plan changes once and allows more accounts than the former FREE limit', async () => {
    const config = await db.servicePlan.findUniqueOrThrow({ where: { name: 'FREE' } });
    const operationKey = randomUUID();
    const body = { tokenLimit: 20000, cycleDays: 7, maxCvPerCall: 1, maxOutputTokens: 2048, operationKey, reason: 'New plan configuration' };
    expect((await request(admin, '/admin/plans/FREE', 'PUT', body, 'ADMIN')).status).toBe(200);
    expect((await request(admin, '/admin/plans/FREE', 'PUT', body, 'ADMIN')).status).toBe(200);
    expect((await db.servicePlan.findUniqueOrThrow({ where: { name: 'FREE' } })).version).toBe(config.version + 1);
    expect(await billing.getAccountQuota(a)).toMatchObject({ tokenLimit: 20000 });
    const co = await db.company.findUniqueOrThrow({ where: { id: company } });
    for (let i = 0; i < 2; i++) {
      expect((await request(admin, '/users', 'POST', { email: `${randomUUID()}@example.test`, fullName: 'Additional HR', companyName: co.name, password: 'Temporary123' }, 'ADMIN')).status).toBe(201);
    }
    expect(await db.user.count({ where: { companyId: company } })).toBe(4);
    expect((await request(admin, `/admin/companies/${company}/subscription`, 'PATCH', { plan: 'FREE', billingCycle: 'MONTHLY', endsAt: null, operationKey: randomUUID(), reason: 'No account limit on plan changes' }, 'ADMIN')).status).toBe(200);
  });
  it('records zero Gemini cost on free tier even if a paid price exists, without changing personal token usage', async () => {
    await db.aiPrice.create({ data: { model: 'test-free', inputUsd: 2, outputUsd: 4, thinkingUsd: 6 } });
    const hold = await billing.reserveTokens(a, 2000, 'test-free', randomUUID());
    await billing.settleTokens(hold.id, { inputTokens: 100, outputTokens: 50, thinkingTokens: 20 }, true);
    const usage = await db.aiUsage.findUniqueOrThrow({ where: { reservationId: hold.id } });
    expect(usage.actualCostUsd?.toString()).toBe('0');
    expect(usage.priceVersion).toBe('gemini-free-tier');
    expect(await billing.getAccountQuota(a)).toMatchObject({ used: 170, remaining: 9830 });
    expect((await request(admin, '/admin/prices', 'POST', { model: 'test-free', inputUsd: 10, outputUsd: 20, reason: 'Unnecessary free-tier price', operationKey: randomUUID() }, 'ADMIN')).status).toBe(409);
    const info = await (await request(admin, '/admin/ai-billing', 'GET', undefined, 'ADMIN')).json();
    expect(info.data).toMatchObject({ billingMode: 'FREE', inputUsd: '0', outputUsd: '0' });
  });
  it('keeps unknown paid costs nullable and gives thinking tokens the Gemini output price', async () => {
    pricingEnv.AI_BILLING_MODE = 'PAID';
    const hold = await billing.reserveTokens(a, 2000, 'no-price-model', randomUUID());
    await billing.settleTokens(hold.id, { inputTokens: 100, outputTokens: 50, thinkingTokens: 20 }, true);
    expect((await db.aiUsage.findUniqueOrThrow({ where: { reservationId: hold.id } })).actualCostUsd).toBeNull();
    const body = { model: pricingEnv.GEMINI_MODEL, inputUsd: 0.75, outputUsd: 3.75, thinkingUsd: 99, reason: 'Official output price includes thinking', operationKey: randomUUID() };
    expect((await request(admin, '/admin/prices', 'POST', body, 'ADMIN')).status).toBe(200);
    const configured = await db.aiPrice.findFirstOrThrow({ where: { model: body.model }, orderBy: { createdAt: 'desc' } });
    expect(configured.thinkingUsd.toString()).toBe('3.75');
  });
});
