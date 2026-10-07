import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const config = z.object({ SEED_ADMIN_EMAIL: z.string().email(), SEED_ADMIN_PASSWORD: z.string().min(8).regex(/[A-Za-z]/).regex(/\d/), BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12) }).parse(process.env);
const prisma = new PrismaClient();
async function main() {
  const email = config.SEED_ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(config.SEED_ADMIN_PASSWORD, config.BCRYPT_ROUNDS);
  await prisma.user.upsert({ where: { email }, update: {}, create: { email, passwordHash, fullName: 'Quản trị viên', role: 'ADMIN' } });
  console.info('Đã bảo đảm tài khoản ADMIN được tạo.');
}
main().finally(() => prisma.$disconnect());
