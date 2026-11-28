export function companyMembership(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ');
  return {
    connectOrCreate: {
      where: { key: normalized.toLowerCase() },
      create: { name: normalized, key: normalized.toLowerCase() },
    },
  };
}
import type { Prisma } from '@prisma/client';

export async function checkedCompanyMembership(tx: Prisma.TransactionClient, name: string, _excludeUserId?: string) {
  const normalized = name.trim().replace(/\s+/g, ' ');
  const company = await tx.company.upsert({ where: { key: normalized.toLowerCase() }, create: { name: normalized, key: normalized.toLowerCase() }, update: {} });
  await tx.$queryRaw`SELECT id FROM companies WHERE id = ${company.id} FOR UPDATE`;
  return { connect: { id: company.id } };
}
