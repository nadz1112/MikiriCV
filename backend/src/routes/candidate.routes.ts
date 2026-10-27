import { Router } from 'express';
import { candidateController } from '../controllers/candidate.controller.js';
import { upload } from '../middlewares/upload.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { env } from '../config/env.js';
import { candidateFileParamsSchema, candidateFileQuerySchema, candidatePaginationSchema, uploadHeadersSchema } from '../modules/candidates/candidate.schema.js';

const router = Router();
router.post('/upload', validateRequest({}), (req, _res, next) => {
  const parsed = uploadHeadersSchema.safeParse({ idempotencyKey: req.get('Idempotency-Key') });
  if (!parsed.success) { next(parsed.error); return; }
  next();
}, upload.array('files', env.MAX_FILES_PER_REQUEST), (req, res, next) => candidateController.uploadCandidates(req, res, next));
router.get('/', validateRequest({ query: candidatePaginationSchema }), (req, res, next) => candidateController.getCandidates(req, res, next));
router.get('/:id/file', validateRequest({ params: candidateFileParamsSchema, query: candidateFileQuerySchema }), (req, res, next) => candidateController.getCandidateFile(req, res, next));

export default router;
