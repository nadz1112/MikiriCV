import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/stats', (req, res, next) =>
  dashboardController.getStats(req, res, next)
);

export default router;
