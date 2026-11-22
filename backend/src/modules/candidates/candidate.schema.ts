import { z } from 'zod';

export const uploadHeadersSchema = z.object({
  idempotencyKey: z.string().uuid('Idempotency-Key phải là UUID'),
});

export const listCandidatesQuery = z.object({
  search: z.string().trim().optional(),
  enterpriseId: z.string().uuid('Mã doanh nghiệp phải là UUID hợp lệ').optional(),
  skills: z.string().optional().transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [])),
  skillMode: z.enum(['any', 'all'], { message: 'skillMode phải là "any" hoặc "all"' }).default('any'),
  minExp: z.coerce
    .number()
    .int({ message: 'Số năm kinh nghiệm phải là số nguyên' })
    .min(0, 'Số năm kinh nghiệm tối thiểu là 0')
    .max(30, 'Số năm kinh nghiệm tối đa là 30')
    .optional(),
  extractionStatus: z.enum(['SUCCESS', 'WARNING', 'FAILED'], { message: 'Trạng thái trích xuất không hợp lệ' }).optional(),
  jobId: z.string().uuid('Mã Job Description phải là UUID hợp lệ').optional(),
  page: z.coerce.number().int({ message: 'Số trang phải là số nguyên' }).min(1, 'Số trang tối thiểu là 1').default(1),
  limit: z.coerce.number().int({ message: 'Số lượng phải là số nguyên' }).min(1, 'Số lượng tối thiểu là 1').max(500, 'Số lượng tối đa là 500').default(50),
  sort: z.enum(['createdAt', 'yearsOfExperience', 'fullName'], { message: 'Kiểu sắp xếp không hợp lệ' }).default('createdAt'),
});

export type ListCandidatesQuery = z.infer<typeof listCandidatesQuery>;

export const candidatePaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

export const candidateFileParamsSchema = z.object({
  id: z.string().uuid('Mã ứng viên không hợp lệ'),
});

export const candidateFileQuerySchema = z.object({
  download: z.enum(['0', '1']).optional(),
});
