import { Router } from 'express';
import { z } from 'zod';
import { jobController } from '../controllers/job.controller.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

const weightField = z.number().int('Trọng số phải là số nguyên').min(0, 'Trọng số tối thiểu là 0').max(100, 'Trọng số tối đa là 100');
const evaluationConfigSchema = z.object({
  weights: z.object({
    skill_matching: weightField,
    experience_relevance: weightField,
    project_achievement: weightField,
    soft_skills: weightField,
    education_certification: weightField,
    cv_quality: weightField,
  }).refine(
    (weights) => Object.values(weights).reduce((sum, value) => sum + value, 0) === 100,
    { message: 'Tổng trọng số 6 nhóm tiêu chí phải đúng bằng 100' },
  ).optional(),
}).optional();

const createJobSchema = z.object({
  title: z.string().trim().min(5, 'Tiêu đề công việc phải có ít nhất 5 ký tự').max(150, 'Tiêu đề công việc không được vượt quá 150 ký tự'),
  description: z.string().trim().min(10, 'Mô tả công việc phải có ít nhất 10 ký tự'),
  requiredSkills: z.array(z.string().trim().min(1, 'Kỹ năng không được để trống')).min(1, 'Cần ít nhất 1 kỹ năng yêu cầu'),
  minExperience: z.number().int().min(0).max(30).default(0),
  preferredSkills: z.array(z.string().trim().min(1)).optional(),
  evaluationConfig: evaluationConfigSchema,
});

// PUT replaces the JD and uses the same complete validation rules as creation.
const updateJobSchema = createJobSchema;

router.get('/', (req, res, next) => jobController.getAllJobs(req, res, next));
router.get('/:id/stats', (req, res, next) => jobController.getJobStats(req, res, next));
router.get('/:id', (req, res, next) => jobController.getJobById(req, res, next));
router.post('/', requireRole('ENTERPRISE'), validateRequest({ body: createJobSchema }), (req, res, next) => jobController.createJob(req, res, next));
router.put('/:id', validateRequest({ body: updateJobSchema }), (req, res, next) => jobController.updateJob(req, res, next));
router.delete('/:id', (req, res, next) => jobController.deleteJob(req, res, next));

export default router;
