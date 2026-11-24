import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { getAdminDashboard } from '../services/admin-dashboard.service.js';
import { prisma } from '../config/database.js';
import { subscriptionDto } from '../services/subscription.service.js';
import { AppError } from '../common/errors/app-error.js';

const router = Router();
const dashboardQuery = z.object({ range: z.enum(['7d', '30d', 'all'], { message: 'Khoảng thời gian phải là 7d, 30d hoặc all' }).default('7d'), companyId: z.string().min(1).max(100).optional() });
router.use(requireRole('ADMIN'));
router.patch('/companies/:id/subscription', async (req, res, next) => {
  try {
    const body = z.object({ plan: z.enum(['FREE', 'PLUS']), billingCycle: z.enum(['MONTHLY', 'YEARLY']) }).parse(req.body);
    const company = await prisma.company.update({ where: { id: req.params.id }, data: { ...body, billingCycle: body.plan === 'FREE' ? 'MONTHLY' : body.billingCycle } });
    res.json({ success: true, data: subscriptionDto(company) });
  } catch (error) {
    next((error as { code?: string }).code === 'P2025' ? new AppError(404, 'COMPANY_NOT_FOUND', 'Không tìm thấy doanh nghiệp') : error);
  }
});
router.get('/dashboard', validateRequest({ query: dashboardQuery }), async (req, res, next) => {
  try {
    const { range, companyId } = dashboardQuery.parse(req.query);
    res.json({ success: true, data: await getAdminDashboard(range, companyId) });
  } catch (error) { next(error); }
});
export default router;
