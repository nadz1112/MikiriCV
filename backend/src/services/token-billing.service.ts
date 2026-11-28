import { randomUUID } from 'crypto';
import { Prisma, type TokenWallet } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../common/errors/app-error.js';
import { resolveAiPrice } from './ai-pricing.service.js';

export function quotaDto(w: TokenWallet) {
  return { walletId: w.id, tokenLimit: Math.max(0, w.baseLimit + w.adjustment), baseLimit: w.baseLimit, adjustment: w.adjustment,
    used: w.used, reservedTokens: w.reserved, remaining: Math.max(0, w.baseLimit + w.adjustment - w.used - w.reserved),
    periodStart: w.periodStart.toISOString(), periodEnd: w.periodEnd.toISOString() };
}
export function quotaPeriod(anchor: Date, days: number, now = new Date()) {
  const duration = days * 86400000;
  const start = new Date(anchor.getTime() + Math.max(0, Math.floor((now.getTime() - anchor.getTime()) / duration)) * duration);
  return { start, end: new Date(start.getTime() + duration) };
}
export async function lockAccount(tx: Prisma.TransactionClient, userId: string, requireUsable = false) {
  const initial = await tx.user.findUnique({ where: { id: userId }, select: { companyId: true } });
  if (!initial?.companyId) throw new AppError(409, 'COMPANY_REQUIRED', 'Tài khoản chưa thuộc doanh nghiệp');
  await tx.$queryRaw`SELECT id FROM companies WHERE id = ${initial.companyId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, include: { company: true } });
  if (user.companyId !== initial.companyId) throw new AppError(409, 'ACCOUNT_CHANGED', 'Doanh nghiệp đã thay đổi. Vui lòng thử lại.');
  if (user.role !== 'ENTERPRISE' || (requireUsable && !user.isActive)) throw new AppError(403, 'ACCOUNT_DISABLED', 'Tài khoản không được sử dụng AI');
  const company = user.company!;
  await tx.$queryRaw`SELECT name FROM service_plans WHERE name = ${company.plan} FOR SHARE`;
  const config = await tx.servicePlan.findUniqueOrThrow({ where: { name: company.plan } });
  if (requireUsable && (company.subscriptionStartedAt > new Date() || (company.subscriptionEndsAt && company.subscriptionEndsAt <= new Date()))) throw new AppError(403, 'SUBSCRIPTION_EXPIRED', 'Gói dịch vụ chưa có hiệu lực hoặc đã hết hạn');
  let wallet = await tx.tokenWallet.findFirst({ where: { userId, companyId: company.id, periodEnd: { gt: new Date() } }, orderBy: { periodStart: 'desc' } });
  if (wallet) {
    await tx.$queryRaw`SELECT id FROM token_wallets WHERE id = ${wallet.id} FOR UPDATE`;
    wallet = await tx.tokenWallet.findUniqueOrThrow({ where: { id: wallet.id } });
  }
  if (!wallet) {
    const previous = await tx.tokenWallet.findFirst({ where: { userId, companyId: company.id }, orderBy: { periodStart: 'desc' } });
    const period = quotaPeriod(previous?.periodEnd ?? company.subscriptionStartedAt, config.cycleDays);
    wallet = await tx.tokenWallet.create({ data: { userId, companyId: company.id, periodStart: period.start, periodEnd: period.end, baseLimit: config.tokenLimit, planVersion: `${config.name}:${config.version}` } });
    await tx.tokenLedger.create({ data: { walletId: wallet.id, kind: 'GRANT', amount: config.tokenLimit, operationKey: `grant:${wallet.id}`, reason: `Gói ${config.name}, phiên bản ${config.version}` } });
  } else if (wallet.planVersion !== `${config.name}:${config.version}`) {
    const delta = config.tokenLimit - wallet.baseLimit;
    wallet = await tx.tokenWallet.update({ where: { id: wallet.id }, data: { baseLimit: config.tokenLimit, planVersion: `${config.name}:${config.version}` } });
    await tx.tokenLedger.create({ data: { walletId: wallet.id, kind: 'PLAN_CHANGE', amount: delta, operationKey: `plan:${wallet.id}:${randomUUID()}`, reason: `Gói ${config.name}, phiên bản ${config.version}` } });
  }
  return { wallet, company, config };
}
export async function getAccountQuota(userId: string, expectedCompanyId?: string) {
  return prisma.$transaction(async (tx) => {
    const { wallet, company } = await lockAccount(tx, userId);
    if (expectedCompanyId && company.id !== expectedCompanyId) throw new AppError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã chuyển doanh nghiệp. Vui lòng tải lại.');
    return quotaDto(wallet);
  });
}
export async function reserveTokens(userId: string, amount: number, model: string, operationKey: string, expected?: { companyId: string; plan: string; maxOutputTokens: number }) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new AppError(500, 'INVALID_RESERVATION', 'Hạn mức tạm giữ không hợp lệ');
  return prisma.$transaction(async (tx) => {
    const { wallet, company, config } = await lockAccount(tx, userId, true);
    if (expected && (company.id !== expected.companyId || config.name !== expected.plan || config.maxOutputTokens !== expected.maxOutputTokens)) throw new AppError(409, 'PLAN_CHANGED', 'Gói dịch vụ đã thay đổi. Vui lòng tạo lại yêu cầu.');
    if (await tx.tokenReservation.findUnique({ where: { operationKey } })) throw new AppError(409, 'AI_REQUEST_ALREADY_PROCESSED', 'Lần gọi đã được ghi nhận; kiểm tra kết quả hoặc đối soát trước khi gọi lại.');
    const remaining = wallet.baseLimit + wallet.adjustment - wallet.used - wallet.reserved;
    if (remaining < amount) throw new AppError(429, 'TOKEN_QUOTA_EXCEEDED', `Tài khoản còn ${Math.max(0, remaining)} token, cần tạm giữ ${amount} token cho lần gọi này.`);
    const price = await resolveAiPrice(tx, model);
    const reservation = await tx.tokenReservation.create({ data: { walletId: wallet.id, operationKey, amount, model, priceVersion: price.version, priceSnapshot: price.snapshot ? { ...price.snapshot } : undefined } });
    await tx.tokenWallet.update({ where: { id: wallet.id }, data: { reserved: { increment: amount } } });
    await tx.tokenLedger.create({ data: { walletId: wallet.id, kind: 'RESERVE', amount, operationKey: `reserve:${reservation.id}`, reason: 'Tạm giữ trước khi gọi AI' } });
    return reservation;
  });
}
// Use the same company -> user -> wallet order as reservation creation.
// AI usage inserts also take foreign-key locks on company/user rows.
async function lockReservationWallet(tx: Prisma.TransactionClient, walletId: string) {
  const wallet = await tx.tokenWallet.findUniqueOrThrow({ where: { id: walletId } });
  await tx.$queryRaw`SELECT id FROM companies WHERE id = ${wallet.companyId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${wallet.userId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM token_wallets WHERE id = ${walletId} FOR UPDATE`;
}
export async function startReservation(id: string) {
  await prisma.$transaction(async (tx) => {
    const initial = await tx.tokenReservation.findUniqueOrThrow({ where: { id } });
    await lockReservationWallet(tx, initial.walletId);
    const claimed = await tx.tokenReservation.updateMany({ where: { id, status: 'HELD' }, data: { status: 'STARTED' } });
    if (claimed.count !== 1) throw new AppError(409, 'AI_REQUEST_ALREADY_PROCESSED', 'Lần gọi đã được xử lý');
    const wallet = await tx.tokenWallet.findUniqueOrThrow({ where: { id: initial.walletId } });
    const user = await tx.user.findUnique({ where: { id: wallet.userId }, select: { id: true } });
    await tx.aiUsage.create({ data: { reservationId: id, enterpriseId: user?.id, companyId: wallet.companyId, model: initial.model,
      priceVersion: initial.priceVersion, priceSnapshot: initial.priceSnapshot ?? undefined,
      succeeded: false, day: new Date(new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)) } });
  });
}
export type TokenUsage = { inputTokens: number | null; outputTokens: number | null; thinkingTokens?: number | null; totalTokens?: number | null };
export function actualTokens(u: TokenUsage) {
  if (u.thinkingTokens == null && u.totalTokens == null) throw new AppError(502, 'AI_USAGE_MISSING', 'Provider chưa trả tổng token; lần gọi đang chờ đối soát.');
  const values = [u.inputTokens, u.outputTokens, u.thinkingTokens ?? 0];
  if (values.some((v) => v == null || !Number.isSafeInteger(v) || v < 0)) throw new AppError(502, 'AI_USAGE_MISSING', 'Provider chưa trả đủ thông tin token; lần gọi đang chờ đối soát.');
  const sum = values.reduce<number>((a, b) => a + b!, 0);
  if (u.totalTokens != null && (!Number.isSafeInteger(u.totalTokens) || u.totalTokens < sum)) throw new AppError(502, 'AI_USAGE_INVALID', 'Provider trả thông tin token không hợp lệ');
  const total = Math.max(sum, u.totalTokens ?? sum);
  if (total > 1000000000) throw new AppError(502, 'AI_USAGE_INVALID', 'Token vượt giới hạn lưu trữ');
  return total;
}
export async function settleTokens(id: string, usage: TokenUsage, succeeded: boolean, actorId?: string, reason = 'Quyết toán token thực tế do provider trả về') {
  const total = actualTokens(usage);
  return prisma.$transaction(async (tx) => {
    const initial = await tx.tokenReservation.findUniqueOrThrow({ where: { id } });
    await lockReservationWallet(tx, initial.walletId);
    const r = await tx.tokenReservation.findUniqueOrThrow({ where: { id } });
    if (['SETTLED', 'RELEASED'].includes(r.status)) return;
    if (actorId && r.status !== 'UNKNOWN' && !(Date.now() - r.updatedAt.getTime() > 600000)) throw new AppError(409, 'RESERVATION_ACTIVE', 'Lần gọi đang xử lý, chưa thể đối soát');
    const w = await tx.tokenWallet.findUniqueOrThrow({ where: { id: r.walletId } });
    const price = r.priceSnapshot as { input: string; output: string; thinking: string } | null;
    const thinking = usage.thinkingTokens ?? Math.max(0, total - usage.inputTokens! - usage.outputTokens!);
    const cost = price ? new Prisma.Decimal(price.input).mul(usage.inputTokens!).add(new Prisma.Decimal(price.output).mul(usage.outputTokens!)).add(new Prisma.Decimal(price.thinking).mul(thinking)).div(1000000) : null;
    const user = await tx.user.findUnique({ where: { id: w.userId }, select: { id: true } });
    const usageData = { enterpriseId: user?.id, companyId: w.companyId, model: r.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, thinkingTokens: thinking, totalTokens: total, actualCostUsd: cost, priceVersion: r.priceVersion, priceSnapshot: r.priceSnapshot ?? undefined, succeeded };
    await tx.aiUsage.upsert({ where: { reservationId: id }, create: { ...usageData, reservationId: id, day: new Date(new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)) }, update: usageData });
    await tx.tokenWallet.update({ where: { id: w.id }, data: { reserved: { decrement: r.amount }, used: { increment: total } } });
    await tx.tokenReservation.update({ where: { id }, data: { status: 'SETTLED' } });
    await tx.tokenLedger.create({ data: { walletId: w.id, kind: 'SETTLE', amount: total, actorId, operationKey: `settle:${id}`, reason } });
    await tx.tokenLedger.create({ data: { walletId: w.id, kind: 'RELEASE', amount: r.amount, actorId, operationKey: `release:${id}`, reason: 'Giải phóng tạm giữ sau quyết toán' } });
  });
}
export async function releaseTokens(id: string, reason: string, actorId?: string) {
  return prisma.$transaction(async (tx) => {
    const initial = await tx.tokenReservation.findUniqueOrThrow({ where: { id } });
    await lockReservationWallet(tx, initial.walletId);
    const r = await tx.tokenReservation.findUniqueOrThrow({ where: { id } });
    if (['SETTLED', 'RELEASED'].includes(r.status)) return;
    if (actorId && r.status !== 'UNKNOWN' && !(Date.now() - r.updatedAt.getTime() > 600000)) throw new AppError(409, 'RESERVATION_ACTIVE', 'Lần gọi đang xử lý, chưa thể đối soát');
    await tx.tokenWallet.update({ where: { id: r.walletId }, data: { reserved: { decrement: r.amount } } });
    await tx.tokenReservation.update({ where: { id }, data: { status: 'RELEASED' } });
    await tx.tokenLedger.create({ data: { walletId: r.walletId, kind: 'RELEASE', amount: r.amount, actorId, operationKey: `release:${id}`, reason } });
    const w = await tx.tokenWallet.findUniqueOrThrow({ where: { id: r.walletId } });
    const user = await tx.user.findUnique({ where: { id: w.userId }, select: { id: true } });
    const noExecution = { inputTokens: 0, outputTokens: 0, thinkingTokens: 0, totalTokens: 0, actualCostUsd: new Prisma.Decimal(0), succeeded: false };
    await tx.aiUsage.upsert({ where: { reservationId: id }, create: { ...noExecution, reservationId: id, enterpriseId: user?.id, companyId: w.companyId, model: r.model, priceVersion: r.priceVersion, priceSnapshot: r.priceSnapshot ?? undefined, day: new Date(new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)) }, update: noExecution });
  });
}
export async function markUncertain(id: string) {
  await prisma.tokenReservation.updateMany({ where: { id, status: { in: ['STARTED', 'HELD'] } }, data: { status: 'UNKNOWN' } });
}
export async function adjustTokens(userId: string, actorId: string, amount: number, reason: string, operationKey: string) {
  return prisma.$transaction(async (tx) => {
    const { wallet } = await lockAccount(tx, userId);
    const key = `adjust:${actorId}:${operationKey}`;
    const existing = await tx.tokenLedger.findUnique({ where: { operationKey: key } });
    if (existing) {
      if (existing.walletId !== wallet.id || existing.amount !== amount || existing.reason !== reason) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Mã thao tác đã được sử dụng với nội dung khác');
      return quotaDto(wallet);
    }
    if (wallet.baseLimit + wallet.adjustment + amount < wallet.used + wallet.reserved || wallet.baseLimit + wallet.adjustment + amount > 2000000000) throw new AppError(409, 'TOKEN_ADJUSTMENT_INVALID', 'Không thể thu hồi token đã sử dụng/đang tạm giữ hoặc vượt giới hạn lưu trữ');
    const updated = await tx.tokenWallet.update({ where: { id: wallet.id }, data: { adjustment: { increment: amount } } });
    await tx.tokenLedger.create({ data: { walletId: wallet.id, actorId, kind: 'ADJUST', amount, reason, operationKey: key } });
    return quotaDto(updated);
  });
}
