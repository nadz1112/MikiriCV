import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() }, company: { findUniqueOrThrow: vi.fn(), update: vi.fn(), updateMany: vi.fn() }, $queryRaw: vi.fn(), $transaction: vi.fn() }));
vi.mock('../src/config/database.js', () => ({ prisma: db }));
import { checkDocuments, refundAnalyses, reserveAnalyses, subscriptionDto, vietnamMonth, PLANS } from '../src/services/subscription.service.js';
const company = () => ({ id: 'co', plan: 'FREE', billingCycle: 'MONTHLY', quotaMonth: vietnamMonth(), monthlyUsed: 0 });
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((callback) => callback(db));
  db.user.findUnique.mockResolvedValue({ companyId: 'co' });
  db.company.findUniqueOrThrow.mockResolvedValue(company());
});
describe('company monthly analysis limits', () => {
  it('reserves the final FREE slot while locking the shared company counter', async () => {
    db.company.findUniqueOrThrow.mockResolvedValue({ ...company(), monthlyUsed: 9 });
    const ticket = await reserveAnalyses('hr', 1);
    expect(ticket).toMatchObject({ companyId: 'co', reserved: 1, remaining: 1, name: 'FREE' });
    expect(db.$queryRaw.mock.calls[0][0].join('')).toContain('FOR UPDATE');
    expect(db.company.update).toHaveBeenCalledWith({ where: { id: 'co' }, data: { quotaMonth: vietnamMonth(), monthlyUsed: 10 } });
  });
  it('blocks exhausted quota and does not reset it when changing plans', async () => {
    db.company.findUniqueOrThrow.mockResolvedValue({ ...company(), monthlyUsed: 10 });
    await expect(reserveAnalyses('hr', 1)).rejects.toMatchObject({ code: 'MONTHLY_LIMIT_REACHED', status: 429 });
    expect(db.company.update).not.toHaveBeenCalled();
    expect(subscriptionDto({ ...company(), plan: 'PLUS', monthlyUsed: 10 })).toMatchObject({ used: 10, remaining: 290 });
  });
  it('blocks FREE bulk and allows exactly 300 PLUS analyses', async () => {
    await expect(reserveAnalyses('hr', 2)).rejects.toMatchObject({ code: 'PLUS_REQUIRED' });
    db.company.findUniqueOrThrow.mockResolvedValue({ ...company(), plan: 'PLUS' });
    await expect(reserveAnalyses('hr', 300)).resolves.toMatchObject({ reserved: 300, monthlyLimit: 300 });
    await expect(reserveAnalyses('hr', 301)).rejects.toMatchObject({ code: 'INVALID_ANALYSIS_COUNT' });
  });
  it('resets a previous month and groups month boundaries in Vietnam time', async () => {
    db.company.findUniqueOrThrow.mockResolvedValue({ ...company(), quotaMonth: new Date('2020-01-01Z'), monthlyUsed: 300 });
    await expect(reserveAnalyses('hr', 1)).resolves.toMatchObject({ used: 0, remaining: 10 });
    expect(vietnamMonth(new Date('2026-11-30T17:00:00Z')).toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });
  it('refunds unused slots only in the reserved month and never goes negative', async () => {
    await refundAnalyses({ companyId: 'co', monthDate: vietnamMonth() }, 2);
    expect(db.company.updateMany).toHaveBeenCalledWith({ where: { id: 'co', quotaMonth: vietnamMonth(), monthlyUsed: { gte: 2 } }, data: { monthlyUsed: { decrement: 2 } } });
  });
  it('fails closed when HR has no company', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(reserveAnalyses('foreign', 1)).rejects.toMatchObject({ code: 'COMPANY_REQUIRED' });
    expect(db.company.update).not.toHaveBeenCalled();
  });
  it('enforces page and Unicode character limits for both tiers', () => {
    expect(() => checkDocuments(PLANS.FREE, [{ rawText: 'a'.repeat(3000), pageCount: 2 }])).not.toThrow();
    expect(() => checkDocuments(PLANS.FREE, [{ rawText: 'a'.repeat(3001) }])).toThrow();
    expect(() => checkDocuments(PLANS.FREE, [{ rawText: 'short', pageCount: 3 }])).toThrow();
    expect(() => checkDocuments(PLANS.PLUS, [{ rawText: '😀'.repeat(12000), pageCount: 6 }])).not.toThrow();
    expect(() => checkDocuments(PLANS.PLUS, [{ rawText: 'short', pageCount: 7 }])).toThrow();
    expect(() => checkDocuments(PLANS.PLUS, [{ rawText: 'a'.repeat(12001) }])).toThrow();
  });
});
