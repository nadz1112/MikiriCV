import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000').transform((v) => parseInt(v, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL là bắt buộc'),
  GEMINI_API_KEY: z.string().default('YOUR_GEMINI_API_KEY_HERE'),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  MAX_FILE_SIZE_MB: z.string().default('10').transform((v) => parseInt(v, 10)),
  UPLOAD_DIR: z.string().default('./uploads'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Cấu hình biến môi trường không hợp lệ:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
