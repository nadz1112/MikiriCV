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

const createMatchingJobSchema = z.object({
  jobDescriptionId: z.string().uuid('ID của Job Description không hợp lệ'),
  candidateIds: z.array(z.string().uuid('ID ứng viên không hợp lệ')).min(1, 'Cần chọn ít nhất 1 ứng viên để chấm điểm').max(200, 'Tối đa 200 ứng viên mỗi tiến trình'),
});

const jobIdParamsSchema = z.object({
  id: z.string().uuid('Mã tiến trình đánh giá không hợp lệ'),
});

const getJobQuerySchema = z.object({
  include: z.enum(['items']).optional(),
});

router.post('/run', requireRole('ENTERPRISE'), matchingLimiter, validateRequest({ body: runMatchingSchema }), (req, res, next) =>
  matchingController.runMatching(req, res, next)
);

router.post('/jobs', requireRole('ENTERPRISE'), matchingLimiter, validateRequest({ body: createMatchingJobSchema }), (req, res, next) =>
  matchingController.createMatchingJob(req, res, next)
);

router.get('/jobs/:id', validateRequest({ params: jobIdParamsSchema, query: getJobQuerySchema }), (req, res, next) =>
  matchingController.getMatchingJob(req, res, next)
);

router.post('/jobs/:id/cancel', requireRole('ENTERPRISE'), validateRequest({ params: jobIdParamsSchema }), (req, res, next) =>
  matchingController.cancelMatchingJob(req, res, next)
);

router.get('/leaderboard/:jobDescriptionId', (req, res, next) =>
  matchingController.getLeaderboard(req, res, next)
);

export default router;
