import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { getAdminDashboard } from '../services/admin-dashboard.service.js';

const router = Router();
const dashboardQuery = z.object({ range: z.enum(['7d', '30d', 'all'], { message: 'Khoảng thời gian phải là 7d, 30d hoặc all' }).default('7d') });
router.use(requireRole('ADMIN'));
router.get('/dashboard', validateRequest({ query: dashboardQuery }), async (req, res, next) => {
  try {
    const { range } = dashboardQuery.parse(req.query);
    res.json({ success: true, data: await getAdminDashboard(range) });
  } catch (error) { next(error); }
});
export default router;
