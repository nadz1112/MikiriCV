import { tokenMocks, setupTokenMocks } from './helpers/token-billing.mock.js';
vi.mock('../src/services/token-billing.service.js', () => tokenMocks);
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    jobDescription: { findFirst: vi.fn(), update: vi.fn() },
    candidate: { findMany: vi.fn(), update: vi.fn() },
    matchingJob: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    matchingJobItem: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    matchResult: { upsert: vi.fn() },
    aiUsage: { create: vi.fn(), update: vi.fn() },
  },
  generateContent: vi.fn(),
  reserveAnalyses: vi.fn(),
  refundAnalyses: vi.fn(),
  checkDocuments: vi.fn(),
}));

vi.mock('../src/config/database.js', () => ({ prisma: mocks.prisma }));
vi.mock('../src/config/gemini.js', () => ({ geminiModel: { generateContent: mocks.generateContent, countTokens: async () => ({ totalTokens: 100 }) } }));
vi.mock('../src/services/subscription.service.js', () => ({
  reserveAnalyses: mocks.reserveAnalyses,
  refundAnalyses: mocks.refundAnalyses,
  getUserSubscription: tokenMocks.subscription,
  checkDocuments: mocks.checkDocuments,
}));

describe('async matching jobs and runner', () => {
  let MatchingService: typeof import('../src/services/matching.service.js').MatchingService;
  let MatchingJobRunner: typeof import('../src/modules/matching/matching-job.runner.js').MatchingJobRunner;

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-different-32chars';
    process.env.COOKIE_SECURE = 'false';
    ({ MatchingService } = await import('../src/services/matching.service.js'));
    ({ MatchingJobRunner } = await import('../src/modules/matching/matching-job.runner.js'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  setupTokenMocks('PLUS');
  tokenMocks.subscription.mockResolvedValue({ name: 'PLUS', companyId: 'company-1', maxOutputTokens: 8192 });
    mocks.reserveAnalyses.mockResolvedValue({
      companyId: 'company-1',
      name: 'PLUS',
      monthDate: new Date('2026-11-01T00:00:00Z'),
      maxPages: 6,
      maxCharacters: 12000,
      bulk: true,
      monthlyLimit: 300,
      used: 0,
      remaining: 300,
      reserved: 1,
    });
    mocks.refundAnalyses.mockResolvedValue(undefined);
    mocks.checkDocuments.mockReturnValue(undefined);
  });

  it('rejects sync matching batches exceeding SYNC_MATCH_MAX', async () => {
    const service = new MatchingService(undefined, { enqueue: vi.fn() });
    const ids = Array.from({ length: 11 }, (_, idx) => `00000000-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`);
    await expect(service.runMatching({ jobDescriptionId: 'jd-1', candidateIds: ids }, 'hr-1')).rejects.toMatchObject({
      status: 422,
      code: 'SYNC_BATCH_TOO_LARGE',
    });
  });

  it('creates an async job, skips FAILED candidates, reserves pending quota, and enqueues runner', async () => {
    const enqueue = vi.fn();
    const service = new MatchingService(undefined, { enqueue });
    mocks.prisma.jobDescription.findFirst.mockResolvedValue({ id: 'jd-1' });
    mocks.prisma.candidate.findMany.mockResolvedValue([
      { id: 'c1', extractionStatus: 'SUCCESS', rawText: 'Node.js 3 năm', pageCount: 1, fileName: 'c1.pdf', fileUrl: '/uploads/c1.pdf' },
      { id: 'c2', extractionStatus: 'FAILED', rawText: '', pageCount: null, fileName: 'c2.pdf', fileUrl: '/uploads/c2.pdf' },
    ]);
    mocks.prisma.matchingJob.create.mockResolvedValue({
      id: 'job-1',
      jobDescriptionId: 'jd-1',
      status: 'QUEUED',
      total: 2,
      processed: 1,
      failed: 0,
      cancelRequested: false,
      errorMessage: null,
      createdAt: new Date('2026-11-24T00:00:00Z'),
      startedAt: null,
      finishedAt: null,
      items: [
        { id: 'i1', candidateId: 'c1', status: 'PENDING', attempts: 0, errorCode: null, errorMessage: null, finishedAt: null, candidate: { id: 'c1', fullName: 'An' } },
        { id: 'i2', candidateId: 'c2', status: 'SKIPPED', attempts: 0, errorCode: 'CANDIDATE_NOT_READABLE', errorMessage: 'CV chưa đọc được nội dung nên không thể chấm điểm', finishedAt: new Date(), candidate: { id: 'c2', fullName: 'Binh' } },
      ],
    });

    const job = await service.createMatchingJob({ jobDescriptionId: 'jd-1', candidateIds: ['c1', 'c2'] }, 'hr-1');
    expect(job.status).toBe('QUEUED');
    expect(job.processed).toBe(1);
    expect(mocks.reserveAnalyses).toHaveBeenCalledWith('hr-1', 1);
    expect(mocks.checkDocuments).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.matchingJob.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        companyId: 'company-1',
        planName: 'PLUS',
        quotaMonth: expect.any(Date),
      }),
    }));
    expect(enqueue).toHaveBeenCalledWith('job-1');
  });

  it('refunds reserved quota if checkDocuments rejects when creating matching job', async () => {
    const enqueue = vi.fn();
    const service = new MatchingService(undefined, { enqueue });
    mocks.prisma.jobDescription.findFirst.mockResolvedValue({ id: 'jd-1' });
    mocks.prisma.candidate.findMany.mockResolvedValue([
      { id: 'c1', extractionStatus: 'SUCCESS', rawText: 'x'.repeat(4000), pageCount: 3, fileName: 'c1.pdf', fileUrl: '/uploads/c1.pdf' },
    ]);
    mocks.checkDocuments.mockImplementationOnce(() => {
      throw Object.assign(new Error('Vượt giới hạn trang'), { status: 422, code: 'PLAN_DOCUMENT_LIMIT' });
    });

    await expect(service.createMatchingJob({ jobDescriptionId: 'jd-1', candidateIds: ['c1'] }, 'hr-1')).rejects.toMatchObject({
      status: 422,
      code: 'PLAN_DOCUMENT_LIMIT',
    });
    expect(mocks.refundAnalyses).toHaveBeenCalledWith(expect.objectContaining({ companyId: 'company-1' }), 1);
    expect(mocks.prisma.matchingJob.create).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('enforces tenant isolation, cancellable states, and refunds skipped items on queued cancel', async () => {
    const service = new MatchingService(undefined, { enqueue: vi.fn() });
    mocks.prisma.matchingJob.findFirst.mockResolvedValue(null);
    await expect(service.getMatchingJob('job-1', { id: 'hr-2', role: 'ENTERPRISE', tokenVersion: 0, mustChangePassword: false }, true))
      .rejects.toMatchObject({ status: 404, code: 'MATCHING_JOB_NOT_FOUND' });

    mocks.prisma.matchingJob.findFirst.mockResolvedValueOnce({
      id: 'job-1',
      jobDescriptionId: 'jd-1',
      status: 'COMPLETED',
      total: 2,
      processed: 2,
      failed: 0,
      cancelRequested: false,
      errorMessage: null,
      createdAt: new Date(),
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    await expect(service.cancelMatchingJob('job-1', 'hr-1')).rejects.toMatchObject({
      status: 409,
      code: 'MATCHING_JOB_NOT_CANCELLABLE',
    });

    const quotaMonth = new Date('2026-11-01T00:00:00Z');
    mocks.prisma.matchingJob.findFirst.mockResolvedValueOnce({
      id: 'job-2',
      jobDescriptionId: 'jd-1',
      status: 'QUEUED',
      companyId: 'company-1',
      quotaMonth,
    });
    mocks.prisma.matchingJobItem.updateMany.mockResolvedValueOnce({ count: 2 });
    mocks.prisma.matchingJob.update.mockResolvedValueOnce({
      id: 'job-2',
      jobDescriptionId: 'jd-1',
      status: 'CANCELLED',
      total: 2,
      processed: 2,
      failed: 0,
      cancelRequested: true,
      errorMessage: null,
      createdAt: new Date(),
      startedAt: null,
      finishedAt: new Date(),
    });
    const cancelled = await service.cancelMatchingJob('job-2', 'hr-1');
    expect(cancelled.status).toBe('CANCELLED');
    expect(mocks.refundAnalyses).toHaveBeenCalledWith({ companyId: 'company-1', monthDate: quotaMonth }, 2);
  });

  it('processes batch with partial failure visibility, company accounting, and quota refunds', async () => {
    const aiProvider = {
      modelName: 'gemini-3.6-flash',
      promptVersion: 'cvtest-1.0',
      countInputTokens: vi.fn().mockResolvedValue(100),
      generateEvaluation: vi.fn()
        .mockResolvedValueOnce({
          rawText: JSON.stringify({
            score: 85,
            summary: 'Phù hợp',
            matchedSkills: ['Node.js'],
            missingSkills: [],
            highlights: ['Node.js', 'REST API', '3 năm kinh nghiệm'],
            skillAnalysis: ['Node.js: đáp ứng tốt'],
            redFlags: ['Cần xác minh quy mô hệ thống'],
            interviewQuestions: ['Q1?', 'Q2?', 'Q3?'],
          }),
          inputTokens: 100,
          outputTokens: 30,
        })
        .mockRejectedValueOnce({ status: 429 }),
    };
    const runner = new MatchingJobRunner(aiProvider);
    const quotaMonth = new Date('2026-11-01T00:00:00Z');

    mocks.prisma.matchingJob.findUnique
      .mockResolvedValueOnce({ id: 'job-1', status: 'QUEUED', startedAt: null, cancelRequested: false, companyId: 'company-1', quotaMonth })
      .mockResolvedValueOnce({
        id: 'job-1',
        ownerId: 'hr-1',
        companyId: 'company-1',
        planName: 'PLUS',
        quotaMonth,
        cancelRequested: false,
        jobDescription: { id: 'jd-1', ownerId: 'hr-1', title: 'Backend', description: 'Build APIs', requiredSkills: ['Node.js'], minExperience: 2 },
      })
      .mockResolvedValueOnce({
        id: 'job-1',
        ownerId: 'hr-1',
        companyId: 'company-1',
        planName: 'PLUS',
        quotaMonth,
        cancelRequested: true,
        jobDescription: { id: 'jd-1', ownerId: 'hr-1', title: 'Backend', description: 'Build APIs', requiredSkills: ['Node.js'], minExperience: 2 },
      });

    mocks.prisma.matchingJobItem.findMany.mockResolvedValueOnce([
      {
        id: 'item-1',
        attempts: 0,
        candidate: { id: 'c1', fullName: 'An', rawText: 'Node.js 3 năm', skills: ['Node.js'], yearsOfExperience: 3, extractionStatus: 'SUCCESS' },
      },
      {
        id: 'item-2',
        attempts: 0,
        candidate: { id: 'c2', fullName: 'Binh', rawText: 'Node.js 2 năm', skills: ['Node.js'], yearsOfExperience: 2, extractionStatus: 'SUCCESS' },
      },
    ]);

    mocks.prisma.matchResult.upsert.mockResolvedValue({
      id: 'm1',
      candidateId: 'c1',
      jobDescriptionId: 'jd-1',
      score: 85,
      summary: 'Phù hợp',
      matchedSkills: ['Node.js'],
      missingSkills: [],
      createdAt: new Date(),
    });
    mocks.prisma.matchingJobItem.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.matchingJob.update.mockResolvedValue({});
    mocks.prisma.matchingJobItem.update.mockResolvedValue({});
    mocks.prisma.aiUsage.create.mockResolvedValue({});

    await runner.processJob('job-1');

    expect(mocks.prisma.matchingJobItem.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'item-1' },
      data: expect.objectContaining({ status: 'DONE' }),
    }));
    expect(mocks.prisma.matchingJobItem.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'item-2' },
      data: expect.objectContaining({ status: 'FAILED', errorCode: 'AI_RATE_LIMIT' }),
    }));
    expect(tokenMocks.settleTokens).toHaveBeenCalled();
    expect(tokenMocks.reserveTokens).toHaveBeenCalledWith('hr-1', expect.any(Number), expect.any(String), 'item:item-1', expect.any(Object));
    expect(mocks.prisma.matchingJob.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'job-1' },
      data: expect.objectContaining({ status: 'CANCELLED' }),
    }));
    expect(mocks.refundAnalyses).toHaveBeenCalledTimes(2);
    expect(mocks.refundAnalyses).toHaveBeenCalledWith({ companyId: 'company-1', monthDate: quotaMonth }, 1);
    expect(mocks.prisma.matchResult.upsert).toHaveBeenCalledTimes(1);
  });
});

