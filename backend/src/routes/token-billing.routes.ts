import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { requireRole } from '../middlewares/auth.middleware.js';
import { AppError } from '../common/errors/app-error.js';
import { getPlans } from '../services/subscription.service.js';
import { adjustTokens, releaseTokens, settleTokens } from '../services/token-billing.service.js';
import { auditedChange, billingHistory, companyTokenSummary } from '../services/billing-management.service.js';
import { getAiBillingInfo } from '../services/ai-pricing.service.js';
import { env } from '../config/env.js';

const router = Router();
router.use(requireRole('ADMIN'));
const receipt = { operationKey: z.string().uuid(), reason: z.string().trim().min(3).max(500) };
router.get('/ai-billing', async (_req, res, next) => {
  try { res.json({ success: true, data: await getAiBillingInfo() }); } catch (error) { next(error); }
});
router.get('/billing-audit', async (req, res, next) => {
  try {
    const page = z.coerce.number().int().min(1).max(100000).default(1).parse(req.query.page);
    const [data, total] = await Promise.all([prisma.billingAudit.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * 30, take: 30 }), prisma.billingAudit.count()]);
    res.json({ success: true, data, total, page });
  } catch (error) { next(error); }
});
router.get('/plans', async (_req, res, next) => {
  try { res.json({ success: true, data: await getPlans() }); } catch (error) { next(error); }
});
router.put('/plans/:name', async (req, res, next) => {
  try {
    const name = z.enum(['FREE', 'PLUS']).parse(req.params.name);
    const { operationKey, reason, ...config } = z.object({ ...receipt, monthlyPriceVnd: z.number().int().min(0).max(100000000).optional(), tokenLimit: z.number().int().min(1000).max(1000000000), cycleDays: z.number().int().min(1).max(366), maxCvPerCall: z.number().int().min(1).max(200), maxOutputTokens: z.number().int().min(1024).max(32768) }).parse(req.body);
    if (name === 'FREE' && config.monthlyPriceVnd !== undefined && config.monthlyPriceVnd !== 0) throw new AppError(400, 'FREE_PLAN_PRICE_INVALID', 'Gói FREE có giá dịch vụ bằng 0.');
    await auditedChange(req.user!.id, operationKey, 'PLAN_CONFIG', name, config, reason, (tx) => tx.servicePlan.update({ where: { name }, data: { ...config, version: { increment: 1 } } }));
    res.json({ success: true, data: await getPlans() });
  } catch (error) { next(error); }
});
router.get('/companies/:id/tokens', async (req, res, next) => {
  try { res.json({ success: true, data: await companyTokenSummary(req.params.id) }); } catch (error) { next(error); }
});
router.get('/users/:id/token-history', async (req, res, next) => {
  try { res.json({ success: true, data: await billingHistory(req.params.id, z.coerce.number().int().min(1).max(100000).default(1).parse(req.query.page)) }); } catch (error) { next(error); }
});
router.post('/users/:id/tokens', async (req, res, next) => {
  try {
    const body = z.object({ ...receipt, amount: z.number().int().min(-1000000000).max(1000000000).refine((n) => n !== 0) }).parse(req.body);
    res.json({ success: true, data: await adjustTokens(req.params.id, req.user!.id, body.amount, body.reason, body.operationKey) });
  } catch (error) { next(error); }
});
router.get('/prices', async (_req, res, next) => {
  try { res.json({ success: true, data: await prisma.aiPrice.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }) }); } catch (error) { next(error); }
});
router.post('/prices', async (req, res, next) => {
  try {
    if (env.AI_BILLING_MODE === 'FREE') throw new AppError(409, 'FREE_TIER_PRICE_AUTOMATIC', 'Gemini đang cấu hình miễn phí. Chi phí các lần gọi mới tự động bằng 0, không cần nhập đơn giá.');
    const { operationKey, reason, ...rates } = z.object({ ...receipt, model: z.string().trim().min(1).max(100), inputUsd: z.number().finite().min(0).max(10000), outputUsd: z.number().finite().min(0).max(10000) }).parse(req.body);
    const price = { ...rates, thinkingUsd: rates.outputUsd };
    await auditedChange(req.user!.id, operationKey, 'PRICE_VERSION', price.model, price, reason, (tx) => tx.aiPrice.create({ data: price }));
    res.json({ success: true });
  } catch (error) { next(error); }
});
router.post('/reservations/:id/reconcile', async (req, res, next) => {
  try {
    const body = z.object({ reason: z.string().trim().min(3).max(500), action: z.enum(['release', 'settle']), inputTokens: z.number().int().nonnegative().max(1000000000).optional(), outputTokens: z.number().int().nonnegative().max(1000000000).optional(), thinkingTokens: z.number().int().nonnegative().max(1000000000).default(0) }).parse(req.body);
    const reservation = await prisma.tokenReservation.findUnique({ where: { id: req.params.id } });
    if (!reservation) throw new AppError(404, 'RESERVATION_NOT_FOUND', 'Không tìm thấy lần gọi');
    // Active requests cannot be reconciled out from under an in-flight provider call.
    if (reservation.status !== 'UNKNOWN' && !(['STARTED', 'HELD'].includes(reservation.status) && Date.now() - reservation.updatedAt.getTime() > 10 * 60000)) throw new AppError(409, 'RESERVATION_ACTIVE', 'Chỉ đối soát lần gọi chưa rõ kết quả đã dừng xử lý');
    if (body.action === 'release') await releaseTokens(reservation.id, body.reason, req.user!.id);
    else {
      if (body.inputTokens == null || body.outputTokens == null) throw new AppError(400, 'USAGE_REQUIRED', 'Cần token thực tế để đối soát');
      await settleTokens(reservation.id, { inputTokens: body.inputTokens, outputTokens: body.outputTokens, thinkingTokens: body.thinkingTokens }, false, req.user!.id, body.reason);
    }
    res.json({ success: true });
  } catch (error) { next(error); }
});
export default router;
