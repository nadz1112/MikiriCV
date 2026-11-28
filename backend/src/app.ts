import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { randomUUID } from 'crypto';
import apiRouter from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { env } from './config/env.js';
import { requireCsrf } from './middlewares/auth.middleware.js';

export function createApp(): Express {
  const app = express();
  const allowedOrigins = Array.from(
    new Set(
      `${env.CORS_ORIGIN},${env.MOBILE_CORS_ORIGINS}`
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
  app.use((req, res, next) => {
    const incomingId = req.get('X-Request-Id')?.trim();
    const requestId = incomingId || randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  });
  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Client-Platform',
        'X-Request-Id',
        'Idempotency-Key',
        'X-Unmodified-Since',
      ],
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(requireCsrf);
  app.use('/api', apiRouter);
  app.use(errorHandler);
  return app;
}
