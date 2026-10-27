import { prisma } from '../config/database.js';

async function main() {
  const result = await prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  console.log(`Đã xóa ${result.count} khóa idempotency hết hạn.`);
}

main().finally(() => prisma.$disconnect());
