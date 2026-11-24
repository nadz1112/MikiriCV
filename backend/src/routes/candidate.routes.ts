import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';
import { candidateController } from '../controllers/candidate.controller.js';
import { upload } from '../middlewares/upload.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { env } from '../config/env.js';
import { requireRole } from '../middlewares/auth.middleware.js';
import { candidateFileParamsSchema, candidateFileQuerySchema, listCandidatesQuery, uploadHeadersSchema } from '../modules/candidates/candidate.schema.js';

const router = Router();
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skip: () => env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Bạn tải lên CV quá nhanh, vui lòng thử lại sau.' },
      requestId: req.requestId || randomUUID(),
    });
  },
});
router.post('/upload', requireRole('ENTERPRISE'), uploadLimiter, validateRequest({}), (req, _res, next) => {
  const parsed = uploadHeadersSchema.safeParse({ idempotencyKey: req.get('Idempotency-Key') });
  if (!parsed.success) { next(parsed.error); return; }
  next();
}, upload.array('files', env.MAX_FILES_PER_REQUEST), (req, res, next) => candidateController.uploadCandidates(req, res, next));
router.get('/', validateRequest({ query: listCandidatesQuery }), (req, res, next) => candidateController.getCandidates(req, res, next));
router.get('/:id/file', validateRequest({ params: candidateFileParamsSchema, query: candidateFileQuerySchema }), (req, res, next) => candidateController.getCandidateFile(req, res, next));
router.get('/:id', (req, res, next) => candidateController.getCandidateById(req, res, next));
router.post('/:id/reextract', requireRole('ENTERPRISE'), validateRequest({ params: candidateFileParamsSchema }), (req, res, next) => candidateController.reextractCandidate(req, res, next));
router.delete('/:id', (req, res, next) => candidateController.deleteCandidate(req, res, next));

export default router;
