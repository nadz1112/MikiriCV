import { Router, Request, Response } from 'express';
import { skillNormalizer } from '../modules/skills/skill-dictionary.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const skills = skillNormalizer.getAllCanonicalSkills();
  res.json({
    success: true,
    data: skills,
  });
});

export default router;
