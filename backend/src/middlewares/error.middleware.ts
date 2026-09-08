import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiResponse } from '../types/index.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response<ApiResponse>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  console.error('🔥 Global Error Handler:', err);

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Dữ liệu đầu vào không hợp lệ',
      errors: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  if (err instanceof Error) {
    res.status(500).json({
      success: false,
      message: err.message || 'Đã xảy ra lỗi nội bộ máy chủ',
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: 'Lỗi không xác định từ hệ thống',
  });
}
