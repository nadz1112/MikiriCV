import { prisma } from '../config/database.js';
import { CreateJobDto, UpdateJobDto, JobStats, JobScoreDistribution } from '../types/index.js';

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

  async getJobStats(id: string): Promise<JobStats> {
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
      throw new Error(`Không tìm thấy Job Description với ID: ${id}`);
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

