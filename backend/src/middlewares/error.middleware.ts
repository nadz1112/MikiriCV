import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { randomUUID } from 'crypto';
import multer from 'multer';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const requestId = randomUUID();
  if (err instanceof multer.MulterError) {
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    const tooMany = err.code === 'LIMIT_FILE_COUNT';
    const code = tooLarge ? 'FILE_TOO_LARGE' : tooMany ? 'TOO_MANY_FILES' : 'UPLOAD_INVALID';
    const message = tooLarge ? 'Tệp vượt quá dung lượng tối đa cho phép' : tooMany ? 'Vượt quá số lượng tệp cho một lần tải lên' : 'Yêu cầu tải tệp không hợp lệ';
    res.status(tooLarge ? 413 : 400).json({ success: false, error: { code, message }, requestId });
    return;
  }
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
