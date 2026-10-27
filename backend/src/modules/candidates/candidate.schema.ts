import { z } from 'zod';

export const uploadHeadersSchema = z.object({ idempotencyKey: z.string().uuid('Idempotency-Key phải là UUID') });
export const candidatePaginationSchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(500).default(50) });
export const candidateFileParamsSchema = z.object({ id: z.string().uuid('Mã ứng viên không hợp lệ') });
export const candidateFileQuerySchema = z.object({ download: z.enum(['0', '1']).optional() });
