import { Router } from 'express';
import { requireRole } from '../middlewares/auth.middleware.js';
import { getUserSubscription, PLANS } from '../services/subscription.service.js';
const router = Router();
router.get('/', requireRole('ENTERPRISE'), async (req, res, next) => {
  try { res.json({ success: true, data: await getUserSubscription(req.user!.id), plans: PLANS }); }
  catch (error) { next(error); }
});
export default router;
