import { EventEmitter } from 'events';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { toAiError } from '../../utils/ai-error.js';
import { geminiMatchingProvider, type AIMatchingProvider } from './ai-matching-provider.js';
import { evaluateCandidateWithAi } from './evaluate-candidate.js';

export class MatchingJobRunner extends EventEmitter {
  private running = false;
  private readonly queue: string[] = [];

  constructor(private readonly aiProvider: AIMatchingProvider = geminiMatchingProvider) {
    super();
  }

  enqueue(jobId: string): void {
    if (!this.queue.includes(jobId)) {
      this.queue.push(jobId);
    }
    void this.drain();
  }

  async resumePending(): Promise<void> {
    await prisma.matchingJob.updateMany({
      where: { status: 'RUNNING' },
      data: { status: 'QUEUED' },
    });
    const queued = await prisma.matchingJob.findMany({
      where: { status: 'QUEUED' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    for (const job of queued) {
      this.enqueue(job.id);
    }
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length > 0) {
        const nextId = this.queue.shift()!;
        await this.processJob(nextId);
      }
    } finally {
      this.running = false;
    }
  }

  async processJob(jobId: string): Promise<void> {
    const initialJob = await prisma.matchingJob.findUnique({
      where: { id: jobId },
      select: { id: true, status: true, startedAt: true, cancelRequested: true },
    });
    if (!initialJob || ['COMPLETED', 'CANCELLED', 'FAILED'].includes(initialJob.status)) {
      return;
    }

    if (initialJob.cancelRequested) {
      await this.finalizeCancelledJob(jobId);
      return;
    }

    await prisma.matchingJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', startedAt: initialJob.startedAt ?? new Date() },
    });
    this.emit('progress', { jobId });

    try {
      while (true) {
        const job = await prisma.matchingJob.findUnique({
          where: { id: jobId },
          include: {
            jobDescription: true,
          },
        });
        if (!job) return;

        if (job.cancelRequested) {
          await this.finalizeCancelledJob(jobId);
          return;
        }

        const batch = await prisma.matchingJobItem.findMany({
          where: { jobId, status: 'PENDING' },
          orderBy: { id: 'asc' },
          take: env.MATCH_CONCURRENCY,
          include: {
            candidate: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                fileName: true,
                rawText: true,
                skills: true,
                yearsOfExperience: true,
                extractionStatus: true,
              },
            },
          },
        });

        if (batch.length === 0) {
          await prisma.matchingJob.update({
            where: { id: jobId },
            data: { status: 'COMPLETED', finishedAt: new Date() },
          });
          this.emit('progress', { jobId });
          return;
        }

        await Promise.allSettled(
          batch.map(async (item) => {
            const now = new Date();
            if (item.candidate.extractionStatus === 'FAILED') {
              await prisma.matchingJobItem.update({
                where: { id: item.id },
                data: {
                  status: 'SKIPPED',
                  attempts: item.attempts + 1,
                  errorCode: 'CANDIDATE_NOT_READABLE',
                  errorMessage: 'CV chưa đọc được nội dung nên không thể chấm điểm',
                  finishedAt: now,
                },
              });
              await prisma.matchingJob.update({
                where: { id: jobId },
                data: { processed: { increment: 1 } },
              });
              return;
            }

            try {
              await evaluateCandidateWithAi(job.jobDescription, item.candidate, this.aiProvider, job.ownerId);
              await prisma.matchingJobItem.update({
                where: { id: item.id },
                data: {
                  status: 'DONE',
                  attempts: item.attempts + 1,
                  errorCode: null,
                  errorMessage: null,
                  finishedAt: new Date(),
                },
              });
              await prisma.matchingJob.update({
                where: { id: jobId },
                data: { processed: { increment: 1 } },
              });
            } catch (err) {
              const failure = toAiError(err);
              await prisma.matchingJobItem.update({
                where: { id: item.id },
                data: {
                  status: 'FAILED',
                  attempts: item.attempts + 1,
                  errorCode: failure.code,
                  errorMessage: failure.message,
                  finishedAt: new Date(),
                },
              });
              await prisma.matchingJob.update({
                where: { id: jobId },
                data: {
                  processed: { increment: 1 },
                  failed: { increment: 1 },
                },
              });
            }
          }),
        );

        this.emit('progress', { jobId });

        if (env.NODE_ENV !== 'test' && env.MATCH_BATCH_DELAY_MS > 0) {
          await new Promise((resolve) => setTimeout(resolve, env.MATCH_BATCH_DELAY_MS));
        }
      }
    } catch (error) {
      await prisma.matchingJob.updateMany({
        where: { id: jobId, status: { in: ['QUEUED', 'RUNNING'] } },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Tiến trình đánh giá gặp sự cố hệ thống',
          finishedAt: new Date(),
        },
      });
      this.emit('progress', { jobId });
    }
  }

  private async finalizeCancelledJob(jobId: string): Promise<void> {
    const now = new Date();
    const skipped = await prisma.matchingJobItem.updateMany({
      where: { jobId, status: 'PENDING' },
      data: {
        status: 'SKIPPED',
        errorCode: 'JOB_CANCELLED',
        errorMessage: 'Đã hủy theo yêu cầu',
        finishedAt: now,
      },
    });
    await prisma.matchingJob.update({
      where: { id: jobId },
      data: {
        status: 'CANCELLED',
        finishedAt: now,
        ...(skipped.count > 0 ? { processed: { increment: skipped.count } } : {}),
      },
    });
    this.emit('progress', { jobId });
  }
}

export const matchingJobRunner = new MatchingJobRunner();

