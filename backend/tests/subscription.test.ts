import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() }, servicePlan: { findUniqueOrThrow: vi.fn() }, company: { update: vi.fn() } }));
const quota = vi.hoisted(() => vi.fn());
vi.mock('../src/config/database.js', () => ({ prisma: db }));
vi.mock('../src/services/token-billing.service.js', () => ({ getAccountQuota: quota }));
import { checkDocuments, reserveAnalyses, subscriptionDto, PLANS } from '../src/services/subscription.service.js';
beforeEach(() => {
  vi.clearAllMocks();
  db.user.findUnique.mockResolvedValue({ company: { id: 'co', plan: 'FREE', billingCycle: 'MONTHLY' } });
  db.servicePlan.findUniqueOrThrow.mockResolvedValue({ name: 'FREE', tokenLimit: 100000, cycleDays: 30, maxCvPerCall: 1 });
  quota.mockResolvedValue({ used: 300, remaining: 99700, reservedTokens: 0, periodStart: '2026-11-01T00:00:00Z' });
});
describe('enterprise plan with individual token balances', () => {
  it('validates batch size against configured plan without mutating a shared company pool', async () => {
    expect(await reserveAnalyses('hr-a', 1)).toMatchObject({ used: 300, remaining: 99700, name: 'FREE' });
    expect(quota).toHaveBeenCalledWith('hr-a');
    expect(db.company.update).not.toHaveBeenCalled();
    await expect(reserveAnalyses('hr-a', 2)).rejects.toMatchObject({ code: 'PLAN_BATCH_LIMIT' });
    db.servicePlan.findUniqueOrThrow.mockResolvedValue({ name: 'FREE', tokenLimit: 100000, cycleDays: 7, maxCvPerCall: 5 });
    await expect(reserveAnalyses('hr-a', 5)).resolves.toMatchObject({ reserved: 5, cycleDays: 7 });
  });
  it('returns TOKEN_QUOTA_EXCEEDED for the exhausted account', async () => {
    quota.mockResolvedValue({ used: 100000, remaining: 0, periodStart: '2026-11-01T00:00:00Z' });
    await expect(reserveAnalyses('hr-a', 1)).rejects.toMatchObject({ code: 'TOKEN_QUOTA_EXCEEDED', status: 429 });
  });
  it('does not expose a company-wide used or remaining balance', async () => {
    const dto = await subscriptionDto({ id: 'co', plan: 'FREE', billingCycle: 'MONTHLY' });
    expect(dto).not.toHaveProperty('used'); expect(dto).not.toHaveProperty('remaining');
    expect(dto).toMatchObject({ tokenLimit: 100000, maxCvPerCall: 1 });
  });
  it('fails closed for accounts without a company', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(reserveAnalyses('foreign', 1)).rejects.toMatchObject({ code: 'COMPANY_REQUIRED' });
  });
  it('keeps PDF page and Unicode character limits for both plans', () => {
    expect(() => checkDocuments(PLANS.FREE, [{ rawText: 'a'.repeat(3000), pageCount: 2 }])).not.toThrow();
    expect(() => checkDocuments(PLANS.FREE, [{ rawText: 'a'.repeat(3001) }])).toThrow();
    expect(() => checkDocuments(PLANS.FREE, [{ rawText: 'short', pageCount: 3 }])).toThrow();
    expect(() => checkDocuments(PLANS.PLUS, [{ rawText: '😀'.repeat(12000), pageCount: 6 }])).not.toThrow();
    expect(() => checkDocuments(PLANS.PLUS, [{ rawText: 'short', pageCount: 7 }])).toThrow();
  });
});
