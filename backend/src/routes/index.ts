import { Router } from 'express';
import jobRoutes from './job.routes.js';
import candidateRoutes from './candidate.routes.js';
import matchingRoutes from './matching.routes.js';
import authRoutes from './auth.routes.js';
import skillRoutes from './skill.routes.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import userRoutes from './user.routes.js';
import dashboardRoutes from './dashboard.routes.js';

const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'CVMikiri Backend API',
    time: new Date().toISOString(),
  });
});

apiRouter.use('/auth', authRoutes);
apiRouter.use('/skills', skillRoutes);
apiRouter.use(authenticate);
apiRouter.use('/users', userRoutes);

apiRouter.use('/jobs', jobRoutes);
apiRouter.use('/candidates', candidateRoutes);
apiRouter.use('/matching', matchingRoutes);
apiRouter.use('/dashboard', dashboardRoutes);


export default apiRouter;
