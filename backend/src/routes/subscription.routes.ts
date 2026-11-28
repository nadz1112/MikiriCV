import { Router } from 'express';
import { requireRole } from '../middlewares/auth.middleware.js';
import { getOwnSubscription, getOwnBalance, getOwnUsageHistory, getHrPlanCatalog } from '../services/hr-account.service.js';
import { z } from 'zod';
const router = Router();
router.get('/company', requireRole('ENTERPRISE'), async (req, res, next) => {
  try {
    res.json({ success: true, data: await getOwnSubscription(req.user!.id) });
  } catch (error) { next(error); }
});
router.get('/history', requireRole('ENTERPRISE'), async (req, res, next) => {
  try {
    const { page } = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict().parse(req.query);
    res.json({ success: true, data: await getOwnUsageHistory(req.user!.id, page) });
  }
  catch (error) { next(error); }
});
router.get('/balance', requireRole('ENTERPRISE'), async (req, res, next) => {
  try { res.json({ success: true, data: await getOwnBalance(req.user!.id) }); }
  catch (error) { next(error); }
});
router.get('/plans', requireRole('ENTERPRISE'), async (_req, res, next) => {
  try { res.json({ success: true, data: await getHrPlanCatalog() }); }
  catch (error) { next(error); }
});
router.get('/', requireRole('ENTERPRISE'), async (req, res, next) => {
  try { res.json({ success: true, data: await getOwnSubscription(req.user!.id) }); }
  catch (error) { next(error); }
});
export default router;
