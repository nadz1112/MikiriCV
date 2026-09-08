import { Router } from 'express';
import { candidateController } from '../controllers/candidate.controller.js';
import { upload } from '../middlewares/upload.middleware.js';

const router = Router();

// Upload danh sách CV (multipart/form-data)
router.post('/upload', upload.array('files', 20), (req, res, next) =>
  candidateController.uploadCandidates(req, res, next)
);

// Lọc và lấy danh sách ứng viên (hỗ trợ query: search, skills, minExp)
router.get('/', (req, res, next) => candidateController.getCandidates(req, res, next));

// Xem chi tiết ứng viên
router.get('/:id', (req, res, next) => candidateController.getCandidateById(req, res, next));

// Xóa ứng viên
router.delete('/:id', (req, res, next) => candidateController.deleteCandidate(req, res, next));

export default router;
