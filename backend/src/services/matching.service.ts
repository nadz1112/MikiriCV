import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import { RunMatchingDto } from '../types/index.js';
import { AppError } from '../common/errors/app-error.js';
import type { AuthUser } from '../middlewares/auth.middleware.js';
import { toMatchResultDto } from '../modules/candidates/candidate.mapper.js';
import { geminiMatchingProvider, type AIMatchingProvider } from '../modules/matching/ai-matching-provider.js';
import { evaluateCandidateWithAi, safeMatchingCandidateSelect } from '../modules/matching/evaluate-candidate.js';
import { matchingJobRunner } from '../modules/matching/matching-job.runner.js';

function formatMatchingJobDto(job: {
  id: string;
  jobDescriptionId: string;
  status: string;
  total: number;
  processed: number;
  failed: number;
  cancelRequested: boolean;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  items?: Array<{
    id: string;
    candidateId: string;
    status: string;
    attempts: number;
    errorCode: string | null;
    errorMessage: string | null;
    finishedAt: Date | null;
    candidate?: { id: string; fullName: string };
  }>;
}) {
  return {
    id: job.id,
    jobDescriptionId: job.jobDescriptionId,
    status: job.status,
    total: job.total,
    processed: job.processed,
    failed: job.failed,
    cancelRequested: job.cancelRequested,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt ? job.startedAt.toISOString() : null,
    finishedAt: job.finishedAt ? job.finishedAt.toISOString() : null,
    ...(job.items
      ? {
          items: job.items.map((item) => ({
            id: item.id,
            candidateId: item.candidateId,
            candidateName: item.candidate?.fullName ?? 'Ứng viên',
            status: item.status,
            attempts: item.attempts,
            errorCode: item.errorCode,
            errorMessage: item.errorMessage,
            finishedAt: item.finishedAt ? item.finishedAt.toISOString() : null,
          })),
        }
      : {}),
  };
}

export class MatchingService {
  constructor(
    private readonly aiProvider: AIMatchingProvider = geminiMatchingProvider,
    private readonly runner: { enqueue(jobId: string): void } = matchingJobRunner,
  ) {}

  async runMatching(dto: RunMatchingDto, ownerId?: string) {
    const { jobDescriptionId } = dto;
    const candidateIds = [...new Set(dto.candidateIds)];

    if (candidateIds.length > env.SYNC_MATCH_MAX) {
      throw new AppError(422, 'SYNC_BATCH_TOO_LARGE', 'Số ứng viên vượt giới hạn xử lý trực tiếp, hãy dùng chế độ chạy nền');
    }

    const jobWhere = { id: jobDescriptionId, ...(ownerId ? { ownerId } : {}) };
    const job =
      typeof prisma.jobDescription.findFirst === 'function'
        ? await prisma.jobDescription.findFirst({ where: jobWhere })
        : await (prisma.jobDescription.findUnique as any)({ where: jobWhere });

    if (!job) {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Không tìm thấy Job Description');
    }

    const candidates = await prisma.candidate.findMany({
      where: {
        id: { in: candidateIds },
        ...(ownerId ? { ownerId } : {}),
      },
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
    });

    if (candidates.length !== candidateIds.length) {
      throw new AppError(404, 'CANDIDATE_NOT_FOUND', 'Không tìm thấy một hoặc nhiều ứng viên hợp lệ');
    }

    if (candidates.some((candidate) => candidate.extractionStatus === 'FAILED')) {
      throw new AppError(422, 'CV_EXTRACTION_FAILED', 'Có CV chưa trích xuất được nội dung. Vui lòng kiểm tra lại hồ sơ đã chọn.');
    }

    const results = [];
    for (const candidate of candidates) {
      const matchDto = await evaluateCandidateWithAi(job, candidate, this.aiProvider, ownerId);
      results.push(matchDto);
    }

    return results;
  }

  async createMatchingJob(dto: RunMatchingDto, ownerId: string) {
    const { jobDescriptionId } = dto;
    const candidateIds = [...new Set(dto.candidateIds)];

    const job = await prisma.jobDescription.findFirst({
      where: { id: jobDescriptionId, ownerId },
      select: { id: true },
    });
    if (!job) {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Không tìm thấy Job Description');
    }

    const candidates = await prisma.candidate.findMany({
      where: { id: { in: candidateIds }, ownerId },
      select: { id: true, extractionStatus: true },
    });
    if (candidates.length !== candidateIds.length) {
      throw new AppError(404, 'CANDIDATE_NOT_FOUND', 'Không tìm thấy một hoặc nhiều ứng viên hợp lệ');
    }

    const byId = new Map(candidates.map((c) => [c.id, c]));
    const now = new Date();
    let skippedCount = 0;
    const itemCreates = candidateIds.map((candidateId) => {
      const candidate = byId.get(candidateId)!;
      if (candidate.extractionStatus === 'FAILED') {
        skippedCount++;
        return {
          candidateId,
          status: 'SKIPPED' as const,
          attempts: 0,
          errorCode: 'CANDIDATE_NOT_READABLE',
          errorMessage: 'CV chưa đọc được nội dung nên không thể chấm điểm',
          finishedAt: now,
        };
      }
      return {
        candidateId,
        status: 'PENDING' as const,
        attempts: 0,
      };
    });

    const allSkipped = skippedCount === candidateIds.length;
    const created = await prisma.matchingJob.create({
      data: {
        jobDescriptionId,
        ownerId,
        status: allSkipped ? 'COMPLETED' : 'QUEUED',
        total: candidateIds.length,
        processed: skippedCount,
        failed: 0,
        finishedAt: allSkipped ? now : null,
        items: {
          create: itemCreates,
        },
      },
      include: {
        items: {
          orderBy: { id: 'asc' },
          include: {
            candidate: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    if (!allSkipped) {
      this.runner.enqueue(created.id);
    }

    return formatMatchingJobDto(created);
  }

  async getMatchingJob(jobId: string, user: AuthUser, includeItems = false) {
    const where = {
      id: jobId,
      ...(user.role === 'ADMIN' ? {} : { ownerId: user.id }),
    };

    const job = await prisma.matchingJob.findFirst({
      where,
      include: includeItems
        ? {
            items: {
              orderBy: { id: 'asc' },
              include: {
                candidate: { select: { id: true, fullName: true } },
              },
            },
          }
        : undefined,
    });

    if (!job) {
      throw new AppError(404, 'MATCHING_JOB_NOT_FOUND', 'Không tìm thấy tiến trình đánh giá');
    }

    return formatMatchingJobDto(job);
  }

  async cancelMatchingJob(jobId: string, ownerId: string) {
    const job = await prisma.matchingJob.findFirst({
      where: { id: jobId, ownerId },
    });
    if (!job) {
      throw new AppError(404, 'MATCHING_JOB_NOT_FOUND', 'Không tìm thấy tiến trình đánh giá');
    }

    if (['COMPLETED', 'CANCELLED', 'FAILED'].includes(job.status)) {
      throw new AppError(409, 'MATCHING_JOB_NOT_CANCELLABLE', 'Tiến trình đã kết thúc, không thể hủy');
    }

    if (job.status === 'QUEUED') {
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
      const cancelled = await prisma.matchingJob.update({
        where: { id: jobId },
        data: {
          cancelRequested: true,
          status: 'CANCELLED',
          finishedAt: now,
          ...(skipped.count > 0 ? { processed: { increment: skipped.count } } : {}),
        },
      });
      return formatMatchingJobDto(cancelled);
    }

    const updated = await prisma.matchingJob.update({
      where: { id: jobId },
      data: { cancelRequested: true },
    });
    return formatMatchingJobDto(updated);
  }

  async getLeaderboardByJobId(jobDescriptionId: string, ownerId?: string) {
    const jobWhere = { id: jobDescriptionId, ...(ownerId ? { ownerId } : {}) };
    const include = {
      matchResults: {
        include: {
          candidate: {
            select: safeMatchingCandidateSelect,
          },
        },
        orderBy: { score: 'desc' as const },
      },
    };

    const job =
      typeof prisma.jobDescription.findFirst === 'function'
        ? await prisma.jobDescription.findFirst({
            where: jobWhere,
            include,
          })
        : await (prisma.jobDescription.findUnique as any)({
            where: jobWhere,
            include,
          });

    if (!job) {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Không tìm thấy Job Description');
    }

    return { ...job, matchResults: job.matchResults.map(toMatchResultDto) };
  }
}

export const matchingService = new MatchingService();
