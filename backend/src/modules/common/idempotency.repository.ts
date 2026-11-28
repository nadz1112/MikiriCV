import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';

/** Repository wrapping IdempotencyKey persistence for offline sync retries. */
export class IdempotencyRepository {
  findByKey(key: string) {
    return prisma.idempotencyKey.findUnique({ where: { key } });
  }

  createPending(data: Prisma.IdempotencyKeyCreateInput) {
    return prisma.idempotencyKey.create({ data });
  }

  complete(key: string, statusCode: number, responseBody: Prisma.InputJsonValue) {
    return prisma.idempotencyKey.update({
      where: { key },
      data: { statusCode, responseBody },
    });
  }

  remove(key: string) {
    return prisma.idempotencyKey.deleteMany({ where: { key } });
  }
}

export const idempotencyRepository = new IdempotencyRepository();
