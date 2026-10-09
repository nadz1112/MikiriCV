import { prisma } from '../config/database.js';
import { CreateJobDto, UpdateJobDto } from '../types/index.js';

export class JobService {
  async getAllJobs(ownerId?: string) {
    return prisma.jobDescription.findMany({
      where: ownerId ? { ownerId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { matchResults: true },
        },
      },
    });
  }

  async getJobById(id: string, ownerId?: string) {
    const job = await prisma.jobDescription.findUnique({
      where: { id, ...(ownerId ? { ownerId } : {}) },
      include: {
        matchResults: {
          include: {
            candidate: true,
          },
          orderBy: { score: 'desc' },
        },
      },
    });

    if (!job) {
      throw Object.assign(new Error('Không tìm thấy Job Description'), { status: 404, code: 'JOB_NOT_FOUND' });
      throw new Error(`Không tìm thấy Job Description với ID: ${id}`);
    }

    return job;
  }

  async createJob(data: CreateJobDto, ownerId: string) {
    return prisma.jobDescription.create({
      data: {
        title: data.title,
        description: data.description,
        requiredSkills: data.requiredSkills,
        minExperience: data.minExperience ?? 0,
        ownerId,
      },
    });
  }

  async updateJob(id: string, data: UpdateJobDto, ownerId?: string) {
    await this.getJobById(id, ownerId);
    return prisma.jobDescription.update({
      where: { id },
      data,
    });
  }

  async deleteJob(id: string, ownerId?: string) {
    await this.getJobById(id, ownerId);
    return prisma.jobDescription.delete({
      where: { id },
    });
  }
}

export const jobService = new JobService();
