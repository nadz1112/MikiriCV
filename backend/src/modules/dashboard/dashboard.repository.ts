import { prisma } from '../../config/database.js';
import type { AuthUser } from '../../middlewares/auth.middleware.js';
import { candidateListSelect } from '../candidates/candidate.repository.js';

export const jobScope = (user: AuthUser) => user.role === 'ADMIN'
  ? {} : { ownerId: user.id, createdById: user.id };
export const candidateScope = (user: AuthUser) => user.role === 'ADMIN'
  ? {} : { ownerId: user.id };
export const matchScope = (user: AuthUser) => ({
  candidate: candidateScope(user), jobDescription: jobScope(user),
});

export class DashboardRepository {
  async stats(user: AuthUser) {
    const where = matchScope(user);
    const [totalJobs, totalCandidates, totalMatches, qualifiedMatches, average, recent] = await prisma.$transaction([
      prisma.jobDescription.count({ where: jobScope(user) }),
      prisma.candidate.count({ where: candidateScope(user) }),
      prisma.matchResult.count({ where }),
      prisma.matchResult.count({ where: { ...where, score: { gte: 70 } } }),
      prisma.matchResult.aggregate({ where, _avg: { score: true } }),
      prisma.matchResult.findMany({ where, take: 5, orderBy: { createdAt: 'desc' },
        select: { id: true, score: true, createdAt: true,
          candidate: { select: { fullName: true } }, jobDescription: { select: { title: true } } } }),
    ]);
    return { totalJobs, totalCandidates, totalMatches, qualifiedMatches, average, recent };
  }

  findJob(id: string, user: AuthUser) {
    return prisma.jobDescription.findFirst({ where: { id, ...jobScope(user) },
      include: { matchResults: { where: matchScope(user), orderBy: [{ score: 'desc' }, { id: 'asc' }],
        include: { candidate: { select: candidateListSelect } } } } });
  }
}
