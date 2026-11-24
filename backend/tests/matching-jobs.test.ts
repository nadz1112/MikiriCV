import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    jobDescription: { findFirst: vi.fn(), update: vi.fn() },
    candidate: { findMany: vi.fn(), update: vi.fn() },
    matchingJob: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    matchingJobItem: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    matchResult: { upsert: vi.fn() },
    aiUsage: { create: vi.fn() },
  },
  generateContent: vi.fn(),
}));

vi.mock('../src/config/database.js', () => ({ prisma: mocks.prisma }));
vi.mock('../src/config/gemini.js', () => ({ geminiModel: { generateContent: mocks.generateContent } }));

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
  });

  it('rejects sync matching batches exceeding SYNC_MATCH_MAX', async () => {
    const service = new MatchingService(undefined, { enqueue: vi.fn() });
    const ids = Array.from({ length: 11 }, (_, idx) => `00000000-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`);
    await expect(service.runMatching({ jobDescriptionId: 'jd-1', candidateIds: ids }, 'hr-1')).rejects.toMatchObject({
      status: 422,
      code: 'SYNC_BATCH_TOO_LARGE',
    });
  });

  it('creates an async job, skips FAILED candidates, and enqueues runner', async () => {
    const enqueue = vi.fn();
    const service = new MatchingService(undefined, { enqueue });
    mocks.prisma.jobDescription.findFirst.mockResolvedValue({ id: 'jd-1' });
    mocks.prisma.candidate.findMany.mockResolvedValue([
      { id: 'c1', extractionStatus: 'SUCCESS' },
      { id: 'c2', extractionStatus: 'FAILED' },
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
    expect(enqueue).toHaveBeenCalledWith('job-1');
  });

  it('enforces tenant isolation and cancellable states on jobs', async () => {
    const service = new MatchingService(undefined, { enqueue: vi.fn() });
    mocks.prisma.matchingJob.findFirst.mockResolvedValue(null);
    await expect(service.getMatchingJob('job-1', { id: 'hr-2', role: 'ENTERPRISE', tokenVersion: 0, mustChangePassword: false }, true))
      .rejects.toMatchObject({ status: 404, code: 'MATCHING_JOB_NOT_FOUND' });

    mocks.prisma.matchingJob.findFirst.mockResolvedValue({
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
  });

  it('processes batch with partial failure visibility and cancellation between batches', async () => {
    const aiProvider = {
      modelName: 'gemini-3.6-flash',
      promptVersion: 'cvtest-1.0',
      generateEvaluation: vi.fn()
        .mockResolvedValueOnce({
          rawText: JSON.stringify({ score: 85, summary: 'Phù hợp', matchedSkills: ['Node.js'], missingSkills: [] }),
          inputTokens: 100,
          outputTokens: 30,
        })
        .mockRejectedValueOnce({ status: 429 }),
    };
    const runner = new MatchingJobRunner(aiProvider);

    mocks.prisma.matchingJob.findUnique
      .mockResolvedValueOnce({ id: 'job-1', status: 'QUEUED', startedAt: null, cancelRequested: false })
      .mockResolvedValueOnce({
        id: 'job-1',
        ownerId: 'hr-1',
        cancelRequested: false,
        jobDescription: { id: 'jd-1', ownerId: 'hr-1', title: 'Backend', description: 'Build APIs', requiredSkills: ['Node.js'], minExperience: 2 },
      })
      .mockResolvedValueOnce({
        id: 'job-1',
        ownerId: 'hr-1',
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
    expect(mocks.prisma.matchingJob.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'job-1' },
      data: expect.objectContaining({ status: 'CANCELLED' }),
    }));
    expect(mocks.prisma.matchResult.upsert).toHaveBeenCalledTimes(1);
  });
});

