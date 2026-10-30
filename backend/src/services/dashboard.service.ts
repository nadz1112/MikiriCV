import { prisma } from '../config/database.js';
import { DashboardStats } from '../types/index.js';

export class DashboardService {
  async getDashboardStats(): Promise<DashboardStats> {
    const [
      totalJobs,
      totalCandidates,
      totalMatches,
      qualifiedMatches,
      avgScoreResult,
      recentEvaluations,
    ] = await Promise.all([
      prisma.jobDescription.count(),
      prisma.candidate.count(),
      prisma.matchResult.count(),
      prisma.matchResult.count({
        where: {
          score: {
            gte: 70,
          },
        },
      }),
      prisma.matchResult.aggregate({
        _avg: {
          score: true,
        },
      }),
      prisma.matchResult.findMany({
        take: 5,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          candidate: {
            select: {
              fullName: true,
            },
          },
          jobDescription: {
            select: {
              title: true,
            },
          },
        },
      }),
    ]);

    const qualifiedRate =
      totalMatches > 0 ? Math.round((qualifiedMatches / totalMatches) * 100) : 0;
    const avgScore = avgScoreResult._avg.score
      ? Math.round(avgScoreResult._avg.score)
      : 0;

    return {
      totalJobs,
      totalCandidates,
      totalMatches,
      qualifiedMatches,
      qualifiedRate,
      avgScore,
      recentEvaluations: recentEvaluations.map((item) => ({
        id: item.id,
        candidateName: item.candidate?.fullName || 'Ứng viên',
        jobTitle: item.jobDescription?.title || 'Vị trí tuyển dụng',
        score: item.score,
        createdAt: item.createdAt,
      })),
    };
  }
}

export const dashboardService = new DashboardService();
