import { Router } from 'express';
import { z } from 'zod';
import { jobController } from '../controllers/job.controller.js';
import { validateRequest } from '../middlewares/validate.middleware.js';

const router = Router();

const createJobSchema = z.object({
  title: z.string().trim().min(5, 'Tiêu đề công việc phải có ít nhất 5 ký tự').max(150, 'Tiêu đề công việc không được vượt quá 150 ký tự'),
  description: z.string().trim().min(10, 'Mô tả công việc phải có ít nhất 10 ký tự'),
  requiredSkills: z.array(z.string().trim().min(1, 'Kỹ năng không được để trống')).min(1, 'Cần ít nhất 1 kỹ năng yêu cầu'),
  minExperience: z.number().int().min(0).max(30).default(0),
});

// PUT replaces the JD and uses the same complete validation rules as creation.
const updateJobSchema = createJobSchema;

router.get('/', (req, res, next) => jobController.getAllJobs(req, res, next));
router.get('/:id', (req, res, next) => jobController.getJobById(req, res, next));
router.post('/', validateRequest({ body: createJobSchema }), (req, res, next) => jobController.createJob(req, res, next));
router.put('/:id', validateRequest({ body: updateJobSchema }), (req, res, next) => jobController.updateJob(req, res, next));
router.delete('/:id', (req, res, next) => jobController.deleteJob(req, res, next));

export default router;
