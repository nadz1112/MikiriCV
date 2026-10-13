import { prisma } from '../config/database.js';
import { CreateJobDto, UpdateJobDto } from '../types/index.js';
import type { AuthUser } from '../middlewares/auth.middleware.js';

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

  async getJobById(id: string, user: AuthUser) {
    const job = await prisma.jobDescription.findFirst({
      where: { id, ...buildJobScope(user) },
      ...(user.role === 'ADMIN' ? {
        include: { createdBy: { select: { id: true, fullName: true, email: true } } },
      } : {}),
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
      where: { id, ...buildJobScope(user) },
      data,
    });
  }

  async deleteJob(id: string, user: AuthUser) {
    await this.getJobById(id, user);
    return prisma.jobDescription.delete({
      where: { id, ...buildJobScope(user) },
    });
  }
}

export const jobService = new JobService();
