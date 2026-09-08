import { Router } from 'express';
import { z } from 'zod';
import { matchingController } from '../controllers/matching.controller.js';
import { validateRequest } from '../middlewares/validate.middleware.js';

const router = Router();

const runMatchingSchema = z.object({
  jobDescriptionId: z.string().min(1, 'ID của Job Description là bắt buộc'),
  candidateIds: z.array(z.string()).min(1, 'Cần chọn ít nhất 1 ứng viên để chấm điểm'),
});

router.post('/run', validateRequest({ body: runMatchingSchema }), (req, res, next) =>
  matchingController.runMatching(req, res, next)
);

router.get('/leaderboard/:jobDescriptionId', (req, res, next) =>
  matchingController.getLeaderboard(req, res, next)
);

export default router;
