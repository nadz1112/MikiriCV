import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { CreateJobDto, UpdateJobDto, JobStats, JobScoreDistribution } from '../types/index.js';
import type { AuthUser } from '../middlewares/auth.middleware.js';
import type { Prisma } from '@prisma/client';
import { AppError } from '../common/errors/app-error.js';
import { CVTEST_DEFAULT_WEIGHTS } from '../modules/evaluation/score-calculator.js';
import { getUserSubscription } from './subscription.service.js';
import { idempotencyRepository } from '../modules/common/idempotency.repository.js';

function hasCustomEvaluationWeights(config: unknown): boolean {
  if (!config || typeof config !== 'object') return false;
  const weights = (config as { weights?: Record<string, unknown> }).weights;
  if (!weights || typeof weights !== 'object') return false;
  return (Object.keys(CVTEST_DEFAULT_WEIGHTS) as Array<keyof typeof CVTEST_DEFAULT_WEIGHTS>).some(
    (key) => typeof weights[key] === 'number' && weights[key] !== CVTEST_DEFAULT_WEIGHTS[key],
  );
}

export function buildJobScope(user: AuthUser) {
  return user.role === 'ADMIN' ? {} : { createdById: user.id };
}

export class JobService {
  async getAllJobs(user: AuthUser) {
    return prisma.jobDescription.findMany({
      where: buildJobScope(user),
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { matchResults: true },
        },
        ...(user.role === 'ADMIN' ? {
          createdBy: { select: { id: true, fullName: true, email: true } },
        } : {}),
      },
    });
  }

  async getJobById(id: string, user: AuthUser | string) {
    const ownerId = typeof user === 'string' ? user : (user.role === 'ADMIN' ? undefined : user.id);
    const scope = typeof user === 'string' ? { ownerId } : buildJobScope(user);
    const job = typeof prisma.jobDescription.findFirst === 'function'
      ? await prisma.jobDescription.findFirst({
          where: { id, ...scope },
          include: {
            _count: {
              select: { matchResults: true },
            },
            ...(typeof user !== 'string' && user.role === 'ADMIN'
              ? { createdBy: { select: { id: true, fullName: true, email: true } } }
              : {}),
          },
        })
      : await (prisma.jobDescription.findUnique as any)({
          where: { id, ...(ownerId ? { ownerId } : {}) },
          ...(typeof user !== 'string' && user.role === 'ADMIN' ? {
            include: { createdBy: { select: { id: true, fullName: true, email: true } } },
          } : {}),
        });

    if (!job) {
      throw Object.assign(new Error('Không tìm thấy Job Description'), { status: 404, code: 'JOB_NOT_FOUND' });
    }

    return job;
  }

  async getJobStats(id: string, user?: AuthUser | string): Promise<JobStats> {
    if (user) {
      await this.getJobById(id, user);
    }

    const job = await prisma.jobDescription.findUnique({
      where: { id },
      include: {
        matchResults: {
          select: {
            id: true,
            score: true,
          },
        },
      },
    });

    if (!job) {
      throw Object.assign(new Error(`Không tìm thấy Job Description với ID: ${id}`), { status: 404, code: 'JOB_NOT_FOUND' });
    }

    const matchResults = job.matchResults;
    const totalEvaluated = matchResults.length;

    const under50 = matchResults.filter((m) => m.score < 50).length;
    const range50to70 = matchResults.filter((m) => m.score >= 50 && m.score <= 70).length;
    const range71to85 = matchResults.filter((m) => m.score > 70 && m.score <= 85).length;
    const over85 = matchResults.filter((m) => m.score > 85).length;

    const qualifiedCount = matchResults.filter((m) => m.score >= 70).length;
    const qualifiedRate = totalEvaluated > 0 ? Math.round((qualifiedCount / totalEvaluated) * 100) : 0;
    const avgScore = totalEvaluated > 0 ? Math.round(matchResults.reduce((acc, curr) => acc + curr.score, 0) / totalEvaluated) : 0;
    const topScore = totalEvaluated > 0 ? Math.max(...matchResults.map((m) => m.score)) : 0;
    const lowestScore = totalEvaluated > 0 ? Math.min(...matchResults.map((m) => m.score)) : 0;

    const buckets: JobScoreDistribution[] = [
      {
        range: '< 50',
        label: 'Dưới 50',
        count: under50,
        percentage: totalEvaluated > 0 ? Math.round((under50 / totalEvaluated) * 100) : 0,
      },
      {
        range: '50 - 70',
        label: '50 - 70',
        count: range50to70,
        percentage: totalEvaluated > 0 ? Math.round((range50to70 / totalEvaluated) * 100) : 0,
      },
      {
        range: '71 - 85',
        label: '70 - 85',
        count: range71to85,
        percentage: totalEvaluated > 0 ? Math.round((range71to85 / totalEvaluated) * 100) : 0,
      },
      {
        range: '> 85',
        label: 'Trên 85',
        count: over85,
        percentage: totalEvaluated > 0 ? Math.round((over85 / totalEvaluated) * 100) : 0,
      },
    ];

    return {
      jobId: job.id,
      jobTitle: job.title,
      totalEvaluated,
      qualifiedCount,
      qualifiedRate,
      avgScore,
      topScore,
      lowestScore,
      distribution: {
        under50,
        range50to70,
        range71to85,
        over85,
      },
      buckets,
    };
  }

  async createJob(data: CreateJobDto, user: AuthUser, idempotencyKey?: string) {
    if (user.role !== 'ADMIN' && hasCustomEvaluationWeights(data.evaluationConfig)) {
      const subscription = await getUserSubscription(user.id);
      if (subscription.name !== 'PLUS') {
        throw new AppError(
          403,
          'PLUS_REQUIRED',
          'Tùy chỉnh trọng số 6 nhóm tiêu chí dành cho gói PLUS. Gói FREE sử dụng bộ trọng số tiêu chuẩn.',
        );
      }
    }

    const endpoint = '/api/jobs';
    const requestHash = idempotencyKey
      ? crypto.createHash('sha256').update(JSON.stringify({ userId: user.id, data })).digest('hex')
      : null;

    if (idempotencyKey && requestHash) {
      const existingRecord = await idempotencyRepository.findByKey(idempotencyKey);
      if (existingRecord) {
        if (existingRecord.endpoint !== endpoint || existingRecord.requestHash !== requestHash) {
          throw new AppError(422, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency-Key đã được dùng cho nội dung khác');
        }
        if (existingRecord.statusCode === null) {
          throw new AppError(409, 'REQUEST_IN_PROGRESS', 'Yêu cầu tạo Job Description đang được xử lý');
        }
        return (existingRecord.responseBody as { data: unknown }).data as Awaited<
          ReturnType<typeof prisma.jobDescription.create>
        >;
      }
      try {
        await idempotencyRepository.createPending({
          key: idempotencyKey,
          endpoint,
          requestHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
      } catch (error) {
        if ((error as { code?: string }).code === 'P2002') {
          throw new AppError(409, 'REQUEST_IN_PROGRESS', 'Yêu cầu tạo Job Description đang được xử lý');
        }
        throw error;
      }
    }

    try {
      const created = await prisma.jobDescription.create({
        data: {
          title: data.title,
          description: data.description,
          requiredSkills: data.requiredSkills,
          minExperience: data.minExperience ?? 0,
          preferredSkills: data.preferredSkills ?? [],
          evaluationConfig: data.evaluationConfig as Prisma.InputJsonValue | undefined,
          ownerId: user.id,
          createdById: user.id,
        },
      });
      if (idempotencyKey) {
        await idempotencyRepository
          .complete(idempotencyKey, 201, { success: true, data: created } as unknown as Prisma.InputJsonValue)
          .catch(() => undefined);
      }
      return created;
    } catch (error) {
      if (idempotencyKey) {
        await idempotencyRepository.remove(idempotencyKey).catch(() => undefined);
      }
      throw error;
    }
  }

  async updateJob(
    id: string,
    data: UpdateJobDto,
    user: AuthUser,
    options?: { unmodifiedSince?: string },
  ) {
    const existing = await this.getJobById(id, user);
    if (options?.unmodifiedSince) {
      const baseTime = new Date(options.unmodifiedSince).getTime();
      const updatedTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      if (Number.isFinite(baseTime) && updatedTime > baseTime) {
        throw new AppError(
          409,
          'CONFLICT',
          'Job Description đã được cập nhật trên thiết bị khác. Vui lòng tải lại trước khi lưu.',
        );
      }
    }
    if (user.role !== 'ADMIN' && hasCustomEvaluationWeights(data.evaluationConfig)) {
      const subscription = await getUserSubscription(user.id);
      if (subscription.name !== 'PLUS') {
        throw new AppError(
          403,
          'PLUS_REQUIRED',
          'Tùy chỉnh trọng số 6 nhóm tiêu chí dành cho gói PLUS. Gói FREE sử dụng bộ trọng số tiêu chuẩn.',
        );
      }
    }
    return prisma.jobDescription.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        requiredSkills: data.requiredSkills,
        minExperience: data.minExperience,
        preferredSkills: data.preferredSkills ?? [],
        evaluationConfig: data.evaluationConfig as Prisma.InputJsonValue | undefined,
      },
      include: {
        _count: {
          select: { matchResults: true },
        },
      },
    });
  }

  async deleteJob(id: string, user: AuthUser) {
    await this.getJobById(id, user);
    return prisma.jobDescription.delete({
      where: { id },
    });
  }
}

export const jobService = new JobService();
