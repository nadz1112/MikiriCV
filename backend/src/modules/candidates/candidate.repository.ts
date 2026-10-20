import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';

export class CandidateRepository {
  create(data: Prisma.CandidateCreateInput) { return prisma.candidate.create({ data }); }
  findPage(where: Prisma.CandidateWhereInput, skip: number, take: number) {
    return prisma.$transaction([prisma.candidate.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, select: candidateListSelect }), prisma.candidate.count({ where })]);
  }
  findOwned(id: string, ownerId?: string) { return prisma.candidate.findFirst({ where: { id, ...(ownerId ? { ownerId } : {}) } }); }
  findIdempotency(key: string) { return prisma.idempotencyKey.findUnique({ where: { key } }); }
  createIdempotency(data: Prisma.IdempotencyKeyCreateInput) { return prisma.idempotencyKey.create({ data }); }
  finishIdempotency(key: string, statusCode: number, responseBody: Prisma.InputJsonValue) { return prisma.idempotencyKey.update({ where: { key }, data: { statusCode, responseBody } }); }
}

export const candidateListSelect = {
  id: true, fullName: true, email: true, phone: true, skills: true, yearsOfExperience: true,
  education: true, fileName: true, extractionStatus: true, extractionMessage: true, createdAt: true,
  uploadedBy: { select: { id: true, fullName: true, email: true } },
  owner: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.CandidateSelect;
