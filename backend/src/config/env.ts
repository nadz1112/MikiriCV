import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000').transform((v) => parseInt(v, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL là bắt buộc'),
  GEMINI_API_KEY: z.string().default('YOUR_GEMINI_API_KEY_HERE'),
  GEMINI_MODEL: z.string().default('gemini-3.5-flash'),
  MAX_FILE_SIZE_MB: z.string().default('10').transform((v) => parseInt(v, 10)),
  UPLOAD_DIR: z.string().default('./uploads'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
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
