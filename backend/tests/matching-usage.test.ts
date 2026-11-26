import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenMocks, setupTokenMocks } from './helpers/token-billing.mock.js';
import { AppError } from '../src/common/errors/app-error.js';
const db = vi.hoisted(() => ({ matchResult: { upsert: vi.fn() }, aiUsage: { update: vi.fn() }, jobDescription: {}, candidate: {} }));
vi.mock('../src/config/database.js', () => ({ prisma: db }));
vi.mock('../src/services/token-billing.service.js', () => tokenMocks);
vi.mock('../src/services/subscription.service.js', () => ({ getUserSubscription: tokenMocks.subscription }));
import { evaluateCandidateWithAi } from '../src/modules/matching/evaluate-candidate.js';
const job = { id: 'jd', ownerId: 'hr', title: 'JD', description: '', minExperience: 0, requiredSkills: [] };
const candidate = { id: 'cv', fullName: 'Candidate', skills: ['React'], yearsOfExperience: 3, extractionStatus: 'SUCCESS' };
const valid = { score: 75, summary: 'Phù hợp', matchedSkills: [], missingSkills: [], highlights: ['React', 'Experience', 'Verify skills'] };
const provider = { modelName: 'test-model', promptVersion: 'v1', countInputTokens: vi.fn(), generateEvaluation: vi.fn() };
beforeEach(() => {
  vi.resetAllMocks(); setupTokenMocks();
  provider.countInputTokens.mockResolvedValue(100);
  provider.generateEvaluation.mockResolvedValue({ inputTokens: 100, outputTokens: 20, thinkingTokens: 10, totalTokens: 130, rawText: JSON.stringify(valid) });
  db.matchResult.upsert.mockResolvedValue({ id: 'result', candidateId: 'cv', jobDescriptionId: 'jd', createdAt: new Date(), ...valid });
});
const evaluate = () => evaluateCandidateWithAi(job, candidate, provider, 'hr', 'FREE', 'company-a', 'request-key');
describe('provider token accounting', () => {
  it('reserves input plus bounded output, settles actual usage before saving the report', async () => {
    await evaluate();
    expect(tokenMocks.reserveTokens).toHaveBeenCalledWith('hr', 8292, 'test-model', 'request-key', { companyId: 'company-a', plan: 'FREE', maxOutputTokens: 8192 });
    expect(provider.generateEvaluation).toHaveBeenCalledWith(expect.any(String), 'FREE', 8192);
    expect(tokenMocks.settleTokens).toHaveBeenCalledWith('reservation-1', expect.objectContaining({ totalTokens: 130, thinkingTokens: 10 }), false);
    expect(tokenMocks.settleTokens.mock.invocationCallOrder[0]).toBeLessThan(db.matchResult.upsert.mock.invocationCallOrder[0]);
    expect(db.aiUsage.update).toHaveBeenCalledWith({ where: { reservationId: 'reservation-1' }, data: { succeeded: true } });
  });
  it('rejects insufficient quota before calling the provider', async () => {
    tokenMocks.reserveTokens.mockRejectedValue(new AppError(429, 'TOKEN_QUOTA_EXCEEDED', 'No tokens'));
    await expect(evaluate()).rejects.toMatchObject({ code: 'TOKEN_QUOTA_EXCEEDED' });
    expect(provider.generateEvaluation).not.toHaveBeenCalled();
  });
  it('keeps ambiguous failures on hold without creating a plausible score or refund', async () => {
    provider.generateEvaluation.mockRejectedValue({ name: 'TimeoutError' });
    await expect(evaluate()).rejects.toMatchObject({ code: 'AI_TIMEOUT' });
    expect(tokenMocks.markUncertain).toHaveBeenCalledWith('reservation-1');
    expect(tokenMocks.releaseTokens).not.toHaveBeenCalled(); expect(db.matchResult.upsert).not.toHaveBeenCalled();
  });
  it('releases rejected provider requests while preserving the provider error', async () => {
    provider.generateEvaluation.mockRejectedValue({ status: 403, message: 'Free tier unavailable, set up billing' });
    tokenMocks.releaseTokens.mockRejectedValue(new Error('database unavailable'));
    await expect(evaluate()).rejects.toMatchObject({ code: 'AI_BILLING_REQUIRED' });
    expect(tokenMocks.releaseTokens).toHaveBeenCalled();
  });
  it.each(['invalid JSON', '{}', JSON.stringify({ ...valid, score: 101 })])('accounts known usage for invalid output: %s', async (rawText) => {
    provider.generateEvaluation.mockResolvedValue({ rawText, inputTokens: 100, outputTokens: 20 });
    await expect(evaluate()).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
    expect(tokenMocks.settleTokens).toHaveBeenCalled(); expect(db.matchResult.upsert).not.toHaveBeenCalled();
    expect(tokenMocks.releaseTokens).not.toHaveBeenCalled();
  });
  it('holds missing metadata for reconciliation and does not save a report', async () => {
    tokenMocks.settleTokens.mockRejectedValue(new AppError(502, 'AI_USAGE_MISSING', 'Missing usage'));
    await expect(evaluate()).rejects.toMatchObject({ code: 'AI_USAGE_MISSING' });
    expect(tokenMocks.markUncertain).toHaveBeenCalled(); expect(db.matchResult.upsert).not.toHaveBeenCalled();
  });
  it('keeps settlement persistence failures visible and never pretends the call succeeded', async () => {
    tokenMocks.settleTokens.mockRejectedValue(new Error('Database unavailable'));
    await expect(evaluate()).rejects.toMatchObject({ code: 'TOKEN_SETTLEMENT_FAILED' });
    expect(db.matchResult.upsert).not.toHaveBeenCalled();
  });
});
