import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { randomUUID } from 'crypto';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const requestId = randomUUID();
  if (err instanceof ZodError) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Dữ liệu đầu vào không hợp lệ', details: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })) }, requestId });
    return;
  }
  const error = err as { status?: number; code?: string; message?: string };
  const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
  const message = status === 500 ? 'Đã xảy ra lỗi nội bộ máy chủ' : error.message || 'Yêu cầu không hợp lệ';
  if (status === 500) console.error(`[${requestId}] API error`, err);
  res.status(status).json({ success: false, error: { code: error.code || 'INTERNAL_ERROR', message }, requestId });
}
