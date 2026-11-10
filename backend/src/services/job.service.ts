import { prisma } from '../config/database.js';
import { CreateJobDto, UpdateJobDto } from '../types/index.js';
import type { AuthUser } from '../middlewares/auth.middleware.js';

export function buildJobScope(user: AuthUser) {
  return user.role === 'ADMIN' ? {} : { ownerId: user.id, createdById: user.id };
}

export class JobService {
  async getAllJobs(user: AuthUser) {
    return prisma.jobDescription.findMany({
      where: buildJobScope(user),
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { matchResults: { where: user.role === 'ADMIN' ? {} : { candidate: { ownerId: user.id } } } },
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
    const job = prisma.jobDescription.findUnique
      ? await (prisma.jobDescription.findUnique as any)({
          where: { id, ...scope },
          ...(typeof user !== 'string' && user.role === 'ADMIN' ? {
            include: { createdBy: { select: { id: true, fullName: true, email: true } } },
          } : {}),
        })
      : await prisma.jobDescription.findFirst({
          where: { id, ...scope },
        });

    if (!job) {
      throw Object.assign(new Error('Không tìm thấy Job Description'), { status: 404, code: 'JOB_NOT_FOUND' });
    }

    return job;
  }

  async createJob(data: CreateJobDto, user: AuthUser) {
    return prisma.jobDescription.create({
      data: {
        title: data.title,
        description: data.description,
        requiredSkills: data.requiredSkills,
        minExperience: data.minExperience ?? 0,
        ownerId: user.id,
        createdById: user.id,
      },
    });
  }

  async updateJob(id: string, data: UpdateJobDto, user: AuthUser) {
    await this.getJobById(id, user);
    return prisma.jobDescription.update({
      where: { id, ...(typeof user === 'string' ? { ownerId: user } : buildJobScope(user)) },
      data,
    });
  }

  async deleteJob(id: string, user: AuthUser) {
    await this.getJobById(id, user);
    return prisma.jobDescription.delete({
      where: { id, ...(typeof user === 'string' ? { ownerId: user } : buildJobScope(user)) },
    });
  }
}

export const jobService = new JobService();
