import { prisma } from '../config/database.js';
import { DashboardStats } from '../types/index.js';
import type { AuthUser } from '../middlewares/auth.middleware.js';

export class DashboardService {
  async getDashboardStats(user?: AuthUser): Promise<DashboardStats> {
    const isEnterprise = user && user.role === 'ENTERPRISE';
    const jobScope = isEnterprise ? { ownerId: user.id } : {};
    const candidateScope = isEnterprise ? { ownerId: user.id } : {};
    const matchScope = isEnterprise ? { candidate: { ownerId: user.id } } : {};

    const [
      totalJobs,
      totalCandidates,
      totalMatches,
      qualifiedMatches,
      avgScoreResult,
      recentEvaluations,
    ] = await Promise.all([
      prisma.jobDescription.count({ where: jobScope }),
      prisma.candidate.count({ where: candidateScope }),
      prisma.matchResult.count({ where: matchScope }),
      prisma.matchResult.count({
        where: {
          ...matchScope,
          score: {
            gte: 70,
          },
        },
      }),
      prisma.matchResult.aggregate({
        where: matchScope,
        _avg: {
          score: true,
        },
      }),
      prisma.matchResult.findMany({
        where: matchScope,
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

