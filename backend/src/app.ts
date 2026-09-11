import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import apiRouter from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { env } from './config/env.js';

export function createApp(): Express {
  const app = express();

  // Middleware cơ bản
  app.use(cors({
    origin: '*', // Cho phép frontend gọi
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Phục vụ tệp CV tĩnh tải lên
  const uploadsPath = path.resolve(process.cwd(), env.UPLOAD_DIR);
  app.use('/uploads', express.static(uploadsPath));

  // Gắn API Routes
  app.use('/api', apiRouter);

  // Middleware xử lý lỗi toàn cục
  app.use(errorHandler);

  return app;
}
