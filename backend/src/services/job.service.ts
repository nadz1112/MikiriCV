import { prisma } from '../config/database.js';
import { CreateJobDto, UpdateJobDto } from '../types/index.js';

export class JobService {
  async getAllJobs() {
    return prisma.jobDescription.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { matchResults: true },
        },
      },
    });
  }

  async getJobById(id: string) {
    const job = await prisma.jobDescription.findUnique({
      where: { id },
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
      throw new Error(`Không tìm thấy Job Description với ID: ${id}`);
    }

    return job;
  }

  async createJob(data: CreateJobDto) {
    return prisma.jobDescription.create({
      data: {
        title: data.title,
        description: data.description,
        requiredSkills: data.requiredSkills,
        minExperience: data.minExperience ?? 0,
      },
    });
  }

  async updateJob(id: string, data: UpdateJobDto) {
    await this.getJobById(id);
    return prisma.jobDescription.update({
      where: { id },
      data,
    });
  }

  async deleteJob(id: string) {
    await this.getJobById(id);
    return prisma.jobDescription.delete({
      where: { id },
    });
  }
}

export const jobService = new JobService();
