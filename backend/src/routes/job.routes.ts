import { Router } from 'express';
import { z } from 'zod';
import { jobController } from '../controllers/job.controller.js';
import { validateRequest } from '../middlewares/validate.middleware.js';

const router = Router();

const createJobSchema = z.object({
  title: z.string().min(3, 'Tiêu đề công việc phải có ít nhất 3 ký tự'),
  description: z.string().min(10, 'Mô tả công việc phải có ít nhất 10 ký tự'),
  requiredSkills: z.array(z.string()).min(1, 'Phải có ít nhất 1 kỹ năng yêu cầu'),
  minExperience: z.number().int().nonnegative().optional(),
});

const updateJobSchema = createJobSchema.partial();

router.get('/', (req, res, next) => jobController.getAllJobs(req, res, next));
router.get('/:id', (req, res, next) => jobController.getJobById(req, res, next));
router.post('/', validateRequest({ body: createJobSchema }), (req, res, next) => jobController.createJob(req, res, next));
router.put('/:id', validateRequest({ body: updateJobSchema }), (req, res, next) => jobController.updateJob(req, res, next));
router.delete('/:id', (req, res, next) => jobController.deleteJob(req, res, next));

export default router;
