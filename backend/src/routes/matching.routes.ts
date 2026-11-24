import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { env } from '../config/env.js';
import { matchingController } from '../controllers/matching.controller.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { requireRole } from '../middlewares/auth.middleware.js';

const router = Router();
const matchingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skip: () => env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Bạn thao tác AI Matching quá nhanh, vui lòng thử lại sau.' },
      requestId: req.requestId || randomUUID(),
    });
  },
});

const runMatchingSchema = z.object({
  jobDescriptionId: z.string().min(1, 'ID của Job Description là bắt buộc'),
  candidateIds: z.array(z.string()).min(1, 'Cần chọn ít nhất 1 ứng viên để chấm điểm'),
});

router.post('/run', requireRole('ENTERPRISE'), matchingLimiter, validateRequest({ body: runMatchingSchema }), (req, res, next) =>
  matchingController.runMatching(req, res, next)
);

router.get('/leaderboard/:jobDescriptionId', (req, res, next) =>
  matchingController.getLeaderboard(req, res, next)
);

export default router;
