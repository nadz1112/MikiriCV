import type { AuthUser } from '../middlewares/auth.middleware.js';
import { AppError } from '../common/errors/app-error.js';
import { DashboardRepository } from '../modules/dashboard/dashboard.repository.js';
import { toCandidateListItemDto } from '../modules/candidates/candidate.mapper.js';

const repository = new DashboardRepository();
export class DashboardService {
  async getDashboardStats(user: AuthUser) {
    const { totalJobs, totalCandidates, totalMatches, qualifiedMatches, average, recent } = await repository.stats(user);
    return { totalJobs, totalCandidates, totalMatches, qualifiedMatches,
      qualifiedRate: totalMatches ? Math.round(qualifiedMatches / totalMatches * 100) : 0,
      avgScore: Math.round(average._avg.score ?? 0),
      recentEvaluations: recent.map(item => ({ id: item.id, score: item.score, createdAt: item.createdAt,
        candidateName: item.candidate.fullName, jobTitle: item.jobDescription.title })) };
  }

  async getLeaderboard(id: string, user: AuthUser) {
    const job = await repository.findJob(id, user);
    if (!job) throw new AppError(404, 'JOB_NOT_FOUND', 'Không tìm thấy Job Description');
    return { ...job, matchResults: job.matchResults.map(match => ({ ...match,
      candidate: toCandidateListItemDto(match.candidate, user.role === 'ADMIN') })) };
  }

  async getJobStats(id: string, user: AuthUser) {
    const job = await this.getLeaderboard(id, user);
    const scores = job.matchResults.map(match => match.score);
    const totalEvaluated = scores.length;
    const distribution = {
      under50: scores.filter(score => score < 50).length,
      range50to70: scores.filter(score => score >= 50 && score <= 70).length,
      range71to85: scores.filter(score => score > 70 && score <= 85).length,
      over85: scores.filter(score => score > 85).length,
    };
    const qualifiedCount = scores.filter(score => score >= 70).length;
    const percentage = (count: number) => totalEvaluated ? Math.round(count / totalEvaluated * 100) : 0;
    return { jobId: job.id, jobTitle: job.title, totalEvaluated, qualifiedCount,
      qualifiedRate: percentage(qualifiedCount),
      avgScore: totalEvaluated ? Math.round(scores.reduce((sum, score) => sum + score, 0) / totalEvaluated) : 0,
      topScore: totalEvaluated ? scores[0] : 0, lowestScore: totalEvaluated ? scores[totalEvaluated - 1] : 0,
      distribution,
      buckets: [
        { range: '< 50', label: 'Dưới 50', count: distribution.under50 },
        { range: '50 - 70', label: '50 - 70', count: distribution.range50to70 },
        { range: '71 - 85', label: '71 - 85', count: distribution.range71to85 },
        { range: '> 85', label: 'Trên 85', count: distribution.over85 },
      ].map(bucket => ({ ...bucket, percentage: percentage(bucket.count) })) };
  }
}
export const dashboardService = new DashboardService();
