import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../middlewares/auth.middleware.js';
import { getAdminDashboard } from '../services/admin-dashboard.service.js';
import { prisma } from '../config/database.js';
import { subscriptionDto } from '../services/subscription.service.js';
import { AppError } from '../common/errors/app-error.js';
import { auditedChange } from '../services/billing-management.service.js';
import { subscriptionEnd } from '../services/subscription-period.js';

const router = Router();
const dashboardQuery = z.object({ range: z.enum(['7d', '30d', 'all']).default('7d'), companyId: z.string().min(1).max(100).optional(), from: z.string().date().optional(), to: z.string().date().optional() }).refine((v) => (!v.from && !v.to) || Boolean(v.from && v.to && v.from <= v.to && new Date(v.to).getTime() - new Date(v.from).getTime() <= 366 * 86400000), 'Khoảng ngày không hợp lệ hoặc vượt 366 ngày');
router.use(requireRole('ADMIN'));
router.patch('/companies/:id/subscription', async (req, res, next) => {
  try {
    const { operationKey, reason, ...body } = z.object({ plan: z.enum(['FREE', 'PLUS']), billingCycle: z.enum(['MONTHLY', 'YEARLY']), startsAt: z.string().datetime().optional(), operationKey: z.string().uuid(), reason: z.string().trim().min(3).max(500) }).parse(req.body);
    await auditedChange(req.user!.id, operationKey, 'COMPANY_PLAN', req.params.id, body, reason, async (tx) => {
      await tx.$queryRaw`SELECT id FROM companies WHERE id = ${req.params.id} FOR UPDATE`;
      await tx.$queryRaw`SELECT name FROM service_plans WHERE name = ${body.plan} FOR SHARE`;
      const start = body.startsAt ? new Date(body.startsAt) : new Date();
      const end = subscriptionEnd(body.plan, body.billingCycle, start);
      if (end && end <= new Date()) throw new AppError(400, 'INVALID_SUBSCRIPTION_START', 'Ngày bắt đầu khiến gói đã hết hạn. Vui lòng chọn lại.');
      return tx.company.update({ where: { id: req.params.id }, data: { plan: body.plan, billingCycle: body.plan === 'FREE' ? 'MONTHLY' : body.billingCycle, subscriptionStartedAt: start, subscriptionEndsAt: end } });
    });
    res.json({ success: true, data: await subscriptionDto(await prisma.company.findUniqueOrThrow({ where: { id: req.params.id } })) });
  } catch (error) {
    next((error as { code?: string }).code === 'P2025' ? new AppError(404, 'COMPANY_NOT_FOUND', 'Không tìm thấy doanh nghiệp') : error);
  }
});
router.get('/dashboard', async (req, res, next) => {
  try {
    const { range, companyId, from, to } = dashboardQuery.parse(req.query);
    res.json({ success: true, data: await getAdminDashboard(range, companyId, from && to ? { from, to } : undefined) });
  } catch (error) { next(error); }
});
export default router;
