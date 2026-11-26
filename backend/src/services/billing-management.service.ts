import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../common/errors/app-error.js';
import { getAccountQuota } from './token-billing.service.js';
import { subscriptionDto } from './subscription.service.js';
import { isDeepStrictEqual } from 'node:util';

export async function companyTokenSummary(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError(404, 'COMPANY_NOT_FOUND', 'Không tìm thấy doanh nghiệp');
  const users = await prisma.user.findMany({ where: { companyId, role: 'ENTERPRISE' }, select: { id: true, fullName: true, isActive: true }, orderBy: { createdAt: 'asc' } });
  // Sequential short transactions avoid exhausting the connection pool on large companies.
  const accounts = [];
  for (const user of users) accounts.push({ ...user, quota: await getAccountQuota(user.id, companyId) });
  return { companyId, companyName: company.name, subscription: await subscriptionDto(company), accounts };
}

export async function billingHistory(userId: string, page = 1, ledgerPage = 1, reservationPage = 1) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true, role: true } });
  if (!user?.companyId || user.role !== 'ENTERPRISE') throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản');
  const where = { wallet: { userId, companyId: user.companyId } };
  const skip = (page - 1) * 10;
  const ledgerWhere: Prisma.TokenLedgerWhereInput = { ...where, kind: { in: ['GRANT', 'PLAN_CHANGE', 'ADJUST'] } };
  const reservationWhere: Prisma.TokenReservationWhereInput = { ...where, status: { in: ['UNKNOWN', 'STARTED', 'HELD'] } };
  const [ledger, usage, reservations, ledgerTotal, usageTotal, reservationTotal] = await Promise.all([
    prisma.tokenLedger.findMany({ where: ledgerWhere, include: { wallet: { select: { periodStart: true, periodEnd: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (ledgerPage - 1) * 10, take: 10 }),
    prisma.aiUsage.findMany({ where: { enterpriseId: userId, companyId: user.companyId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take: 10 }),
    prisma.tokenReservation.findMany({ where: reservationWhere, select: { id: true, amount: true, status: true, model: true, createdAt: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (reservationPage - 1) * 10, take: 10 }),
    prisma.tokenLedger.count({ where: ledgerWhere }),
    prisma.aiUsage.count({ where: { enterpriseId: userId, companyId: user.companyId } }),
    prisma.tokenReservation.count({ where: reservationWhere }),
  ]);
  const periods = await prisma.tokenReservation.findMany({ where: { id: { in: usage.flatMap((entry) => entry.reservationId ? [entry.reservationId] : []) } }, select: { id: true, wallet: { select: { periodStart: true, periodEnd: true } } } });
  return { ledger, usage: usage.map((entry) => ({ ...entry, period: periods.find((r) => r.id === entry.reservationId)?.wallet ?? null })), reservations, ledgerTotal, usageTotal, reservationTotal, page, ledgerPage, reservationPage, pageSize: 10 };
}

// A durable audit record doubles as the idempotency receipt for admin writes.
export async function auditedChange(actorId: string, operationKey: string, action: string, targetId: string, after: Prisma.InputJsonObject, reason: string,
  change: (tx: Prisma.TransactionClient) => Promise<unknown>) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${actorId}:${operationKey}`}))::text`;
    const key = `admin:${actorId}:${operationKey}`;
    const existing = await tx.billingAudit.findUnique({ where: { operationKey: key } });
    if (existing) {
      if (existing.action !== action || existing.targetId !== targetId || existing.reason !== reason || !isDeepStrictEqual(existing.after, JSON.parse(JSON.stringify(after)))) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Mã thao tác đã dùng với nội dung khác');
      return;
    }
    if (action === 'COMPANY_PLAN') await tx.$queryRaw`SELECT id FROM companies WHERE id = ${targetId} FOR UPDATE`;
    if (action === 'PLAN_CONFIG') await tx.$queryRaw`SELECT name FROM service_plans WHERE name = ${targetId} FOR UPDATE`;
    const before = action === 'PLAN_CONFIG' ? await tx.servicePlan.findUnique({ where: { name: targetId } }) : action === 'COMPANY_PLAN' ? await tx.company.findUnique({ where: { id: targetId } }) : null;
    await change(tx);
    await tx.billingAudit.create({ data: { actorId, action, targetId, after, before: before ? JSON.parse(JSON.stringify(before)) : undefined, reason, operationKey: key } });
  });
}
