import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import apiRouter from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { env } from './config/env.js';
import { requireCsrf } from './middlewares/auth.middleware.js';

export function createApp(): Express {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((value) => value.trim()), credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(requireCsrf);
  app.use('/api', apiRouter);
  app.use(errorHandler);
  return app;
}
