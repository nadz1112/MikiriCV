import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const tokenPrice = z.preprocess(
  (value) => typeof value === 'string' && !value.trim() ? undefined : value,
  z.coerce.number().finite().nonnegative().optional(),
);

const envSchema = z.object({
  PORT: z.string().default('4000').transform((v) => parseInt(v, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL là bắt buộc'),
  GEMINI_API_KEY: z.string().default('YOUR_GEMINI_API_KEY_HERE'),
  GEMINI_MODEL: z.string().default('gemini-3.6-flash'),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  SYNC_MATCH_MAX: z.coerce.number().int().min(1).max(100).default(10),
  MATCH_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(3),
  MATCH_BATCH_DELAY_MS: z.coerce.number().int().min(0).max(10000).default(500),
  AI_BILLING_MODE: z.enum(['FREE', 'PAID']).default('FREE'),
  AI_DEMO_INPUT_VND_PER_MILLION_TOKENS: z.coerce.number().finite().nonnegative().default(10000),
  AI_DEMO_OUTPUT_VND_PER_MILLION_TOKENS: z.coerce.number().finite().nonnegative().default(30000),
  AI_INPUT_USD_PER_MILLION_TOKENS: tokenPrice,
  AI_OUTPUT_USD_PER_MILLION_TOKENS: tokenPrice,
  MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(10),
  MAX_FILES_PER_REQUEST: z.coerce.number().int().positive().max(100).default(20),
  UPLOAD_DIR: z.string().default('./uploads'),
  STORAGE_DRIVER: z.enum(['local', 'cloudinary']).default('local'),
  CLOUDINARY_CLOUD_NAME: z.string().trim().optional(),
  CLOUDINARY_API_KEY: z.string().trim().optional(),
  CLOUDINARY_API_SECRET: z.string().trim().optional(),
  CLOUDINARY_FOLDER: z.string().trim().min(1).default('mikiricv/cvs'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  MOBILE_CORS_ORIGINS: z.string().default('capacitor://localhost,https://localhost,http://localhost'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET ph\u1ea3i c\u00f3 \u00edt nh\u1ea5t 32 k\u00fd t\u1ef1'),
  JWT_ACCESS_EXPIRES_IN: z.string().regex(/^\d+(s|m|h|d)$/).default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET ph\u1ea3i c\u00f3 \u00edt nh\u1ea5t 32 k\u00fd t\u1ef1'),
  JWT_REFRESH_EXPIRES_IN: z.string().regex(/^\d+(s|m|h|d)$/).default('7d'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.STORAGE_DRIVER === 'cloudinary' && data.NODE_ENV !== 'test') {
    if (!data.CLOUDINARY_CLOUD_NAME) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['CLOUDINARY_CLOUD_NAME'], message: 'CLOUDINARY_CLOUD_NAME là bắt buộc khi STORAGE_DRIVER=cloudinary' });
    }
    if (!data.CLOUDINARY_API_KEY) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['CLOUDINARY_API_KEY'], message: 'CLOUDINARY_API_KEY là bắt buộc khi STORAGE_DRIVER=cloudinary' });
    }
    if (!data.CLOUDINARY_API_SECRET) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['CLOUDINARY_API_SECRET'], message: 'CLOUDINARY_API_SECRET là bắt buộc khi STORAGE_DRIVER=cloudinary' });
    }
  }
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Cấu hình biến môi trường không hợp lệ:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;

if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
  console.error('JWT_ACCESS_SECRET v\u00e0 JWT_REFRESH_SECRET ph\u1ea3i kh\u00e1c nhau');
  process.exit(1);
}
if (env.NODE_ENV === 'production' && !env.COOKIE_SECURE) {
  console.error('COOKIE_SECURE phải bật trong production (HTTPS)');
  process.exit(1);
}
