import { Router } from 'express';
import jobRoutes from './job.routes.js';
import candidateRoutes from './candidate.routes.js';
import matchingRoutes from './matching.routes.js';

const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'CVMikiri Backend API',
    time: new Date().toISOString(),
  });
});

apiRouter.use('/jobs', jobRoutes);
apiRouter.use('/candidates', candidateRoutes);
apiRouter.use('/matching', matchingRoutes);

export default apiRouter;
