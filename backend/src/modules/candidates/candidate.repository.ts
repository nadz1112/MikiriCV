import { prisma } from '../../config/database.js';
import { ExtractionStatus, Prisma } from '@prisma/client';
import { SkillNormalizer } from '../skills/skill-dictionary.js';
import { normalizeForSearch } from '../../common/utils/normalize-for-search.js';
import { CandidateListItemRaw } from './candidate.mapper.js';

export interface CandidateFilter {
  keyword?: string;
  skills: string[];
  skillMode: 'any' | 'all';
  minExp?: number;
  extractionStatus?: ExtractionStatus;
  ownerId?: string;
}

export function toWhere(f: CandidateFilter, normalizer: SkillNormalizer): Prisma.CandidateWhereInput {
  const parts: Prisma.CandidateWhereInput[] = [];

  if (f.ownerId) {
    parts.push({ ownerId: f.ownerId });
  }

  if (f.keyword) {
    parts.push({
      searchText: {
        contains: normalizeForSearch(f.keyword),
      },
    });
  }

  if (f.minExp != null) {
    parts.push({
      yearsOfExperience: {
        gte: f.minExp,
      },
    });
  }

  if (f.skills.length > 0) {
    const normalizedSkills = f.skills
      .map((s) => normalizer.normalize(s) || s.trim())
      .filter(Boolean);

    if (normalizedSkills.length > 0) {
      parts.push({
        skills: f.skillMode === 'all'
          ? { hasEvery: normalizedSkills }
          : { hasSome: normalizedSkills },
      });
    }
  }

  if (f.extractionStatus) {
    parts.push({ extractionStatus: f.extractionStatus });
  }

  if (parts.length === 1 && f.ownerId) {
    return { ownerId: f.ownerId };
  }

  if (parts.length === 0) {
    return {};
  }

  return { AND: parts };
}

export const candidateListSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  skills: true,
  yearsOfExperience: true,
  education: true,
  fileName: true,
  extractionStatus: true,
  extractionMessage: true,
  createdAt: true,
  uploadedBy: { select: { id: true, fullName: true, email: true } },
  owner: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.CandidateSelect;

export class CandidateRepository {
  create(data: Prisma.CandidateCreateInput) {
    return prisma.candidate.create({ data });
  }

  async findPage(
    where: Prisma.CandidateWhereInput,
    skip: number,
    take: number,
    orderBy: Prisma.CandidateOrderByWithRelationInput = { createdAt: 'desc' },
    jobId?: string,
  ): Promise<[CandidateListItemRaw[], number]> {
    const select = {
      ...candidateListSelect,
      ...(jobId
        ? {
            matchResults: {
              where: { jobDescriptionId: jobId },
              select: { score: true },
            },
          }
        : {}),
    };

    if (typeof prisma.candidate?.count === 'function' && typeof prisma.$transaction === 'function') {
      const [items, total] = await prisma.$transaction([
        prisma.candidate.findMany({
          where,
          skip,
          take,
          orderBy,
          select,
        }),
        prisma.candidate.count({ where }),
      ]);
      return [items as CandidateListItemRaw[], total];
    }

    const items = await prisma.candidate.findMany({
      where,
      skip,
      take,
      orderBy,
      select,
    });
    return [items as CandidateListItemRaw[], items.length];
  }

  findOwned(id: string, ownerId?: string) {
    if (typeof (prisma.candidate as any)?.findUnique === 'function') {
      return (prisma.candidate as any).findUnique({ where: { id, ...(ownerId ? { ownerId } : {}) } });
    }
    return prisma.candidate.findFirst({ where: { id, ...(ownerId ? { ownerId } : {}) } });
  }

  findDetail(id: string, ownerId?: string) {
    const where = {
      id,
      ...(ownerId ? { ownerId } : {}),
    };
    const include = {
      matchResults: {
        include: {
          jobDescription: {
            select: {
              id: true,
              title: true,
              minExperience: true,
              requiredSkills: true,
            },
          },
        },
        orderBy: { score: 'desc' as const },
      },
    };

    if (typeof (prisma.candidate as any)?.findUnique === 'function') {
      return (prisma.candidate as any).findUnique({ where, include });
    }
    if (typeof (prisma.candidate as any)?.findFirst === 'function') {
      return prisma.candidate.findFirst({ where, include });
    }
    return null;
  }

  delete(id: string, ownerId?: string) {
    const where: Prisma.CandidateWhereInput = {
      id,
      ...(ownerId ? { ownerId } : {}),
    };
    return prisma.candidate.deleteMany({
      where,
    });
  }

  findIdempotency(key: string) {
    return prisma.idempotencyKey.findUnique({ where: { key } });
  }

  createIdempotency(data: Prisma.IdempotencyKeyCreateInput) {
    return prisma.idempotencyKey.create({ data });
  }

  finishIdempotency(key: string, statusCode: number, responseBody: Prisma.InputJsonValue) {
    return prisma.idempotencyKey.update({ where: { key }, data: { statusCode, responseBody } });
  }
}
