import { Router } from 'express';
import { z } from 'zod';
import { matchingController } from '../controllers/matching.controller.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { requireRole } from '../middlewares/auth.middleware.js';
import { exportComparison } from '../services/report-export.service.js';

const router = Router();
router.post('/export', requireRole('ENTERPRISE'), async (req, res, next) => {
  try {
    const body = z.object({ jobId: z.string().min(1), candidateIds: z.array(z.string().min(1)).min(1).max(300), format: z.enum(['excel', 'print']) }).parse(req.body);
    const report = await exportComparison(req.user!.id, body.jobId, body.candidateIds, body.format);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `attachment; filename="candidate-comparison.${body.format === 'excel' ? 'xlsx' : 'html'}"`);
    res.type(body.format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/html').send(report);
  } catch (error) { next(error); }
});

const runMatchingSchema = z.object({
  jobDescriptionId: z.string().min(1, 'ID của Job Description là bắt buộc'),
  candidateIds: z.array(z.string().min(1)).min(1, 'Cần chọn ít nhất 1 ứng viên để chấm điểm').max(300, 'Tối đa 300 CV mỗi lần chấm'),
});

router.post('/run', requireRole('ENTERPRISE'), validateRequest({ body: runMatchingSchema }), (req, res, next) =>
  matchingController.runMatching(req, res, next)
);

router.get('/leaderboard/:jobDescriptionId', (req, res, next) =>
  matchingController.getLeaderboard(req, res, next)
);

export default router;
