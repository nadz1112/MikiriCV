import { createHash, randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AppError } from '../common/errors/app-error.js';

// Durable records are intentionally separate from expiring upload keys.
export async function matchingIdempotency(req: Request, res: Response, next: NextFunction) {
  const supplied = req.get('Idempotency-Key');
  if (supplied && !/^[\w-]{8,100}$/.test(supplied)) return next(new AppError(400, 'INVALID_IDEMPOTENCY_KEY', 'Mã yêu cầu không hợp lệ'));
  const key = `${req.user!.id}:${req.path}:${supplied ?? randomUUID()}`;
  const hash = createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
  try {
    try { await prisma.matchingRequest.create({ data: { key, hash } }); }
    catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const existing = await prisma.matchingRequest.findUniqueOrThrow({ where: { key } });
      if (existing.hash !== hash) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Mã yêu cầu đã dùng với nội dung khác');
      if (!existing.statusCode) throw new AppError(409, 'REQUEST_IN_PROGRESS', 'Yêu cầu đang xử lý hoặc cần đối soát. Kiểm tra kết quả trước khi gửi yêu cầu mới.');
      res.status(existing.statusCode).json(existing.response); return;
    }
    res.locals.matchingOperationKey = key;
    const sendJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      const statusCode = res.statusCode;
      void prisma.matchingRequest.update({ where: { key }, data: { statusCode, response: JSON.parse(JSON.stringify(body)) } })
        .then(() => { sendJson(body); })
        .catch(() => { res.status(500); sendJson({ success: false, error: { code: 'BILLING_RECEIPT_FAILED', message: 'Không thể lưu biên nhận. Kiểm tra kết quả trước khi gọi lại.' } }); });
      return res;
    }) as typeof res.json;
    next();
  } catch (error) { next(error); }
}
