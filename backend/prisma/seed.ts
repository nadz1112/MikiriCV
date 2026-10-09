import 'dotenv/config';
import bcrypt from 'bcrypt';
import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const config = z.object({ SEED_ADMIN_EMAIL: z.string().email(), SEED_ADMIN_PASSWORD: z.string().min(8).regex(/[A-Za-z]/).regex(/\d/), SEED_DEMO_PASSWORD: z.string().min(8).regex(/[A-Za-z]/).regex(/\d/).optional(), BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12), UPLOAD_DIR: z.string().default('./uploads'), NODE_ENV: z.enum(['development', 'production', 'test']).default('development') }).parse(process.env);
const prisma = new PrismaClient();
async function main() {
  const email = config.SEED_ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(config.SEED_ADMIN_PASSWORD, config.BCRYPT_ROUNDS);
  await prisma.user.upsert({ where: { email }, update: {}, create: { email, passwordHash, fullName: 'Quản trị viên', role: 'ADMIN' } });
  console.info('Đã bảo đảm tài khoản ADMIN được tạo.');
  if (config.NODE_ENV !== 'production' && config.SEED_DEMO_PASSWORD) {
    const demoPasswordHash = await bcrypt.hash(config.SEED_DEMO_PASSWORD, config.BCRYPT_ROUNDS);
    const demos = [
      { email: 'hr.alpha@example.test', fullName: 'HR Alpha', companyName: 'Alpha Demo' },
      { email: 'hr.beta@example.test', fullName: 'HR Beta', companyName: 'Beta Demo' },
    ];
    const pdfPath = path.resolve(process.cwd(), config.UPLOAD_DIR, 'seed-demo-cv.pdf');
    await fs.mkdir(path.dirname(pdfPath), { recursive: true });
    await fs.writeFile(pdfPath, makeDemoPdf());
    for (const demo of demos) {
      const user = await prisma.user.upsert({ where: { email: demo.email }, update: {}, create: { ...demo, passwordHash: demoPasswordHash, role: 'ENTERPRISE', mustChangePassword: true } });
      if (!(await prisma.jobDescription.findFirst({ where: { ownerId: user.id } }))) {
        await prisma.jobDescription.create({ data: { ownerId: user.id, title: 'Chuyên viên tuyển dụng (demo)', description: 'Quản lý quy trình tuyển dụng, sàng lọc hồ sơ và phối hợp với các bộ phận.', requiredSkills: ['tuyển dụng', 'giao tiếp', 'nhân sự'], minExperience: 1 } });
      }
      if (!(await prisma.candidate.findFirst({ where: { ownerId: user.id } }))) {
        await prisma.candidate.create({ data: { ownerId: user.id, fullName: `Ứng viên ${demo.companyName}`, email: `candidate@${demo.email.split('@')[0]}.test`, rawText: 'Hồ sơ demo: có kinh nghiệm tuyển dụng, giao tiếp và quản lý quy trình nhân sự.', skills: ['tuyển dụng', 'giao tiếp'], yearsOfExperience: 2, education: 'Đại học (dữ liệu demo)', fileName: 'seed-demo-cv.pdf', fileUrl: '/uploads/seed-demo-cv.pdf' } });
      }
    }
    console.info('Đã tạo tài khoản và dữ liệu ENTERPRISE mẫu cho môi trường development/test.');
  }
}
main().finally(() => prisma.$disconnect());

function makeDemoPdf(): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length 68 >>\nstream\nBT /F1 16 Tf 72 720 Td (CVMikiri sample CV - demo data only) Tj ET\nendstream',
  ];
  let document = '%PDF-1.4\n'; const offsets = [0];
  for (let index = 0; index < objects.length; index++) { offsets.push(Buffer.byteLength(document)); document += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`; }
  const xrefOffset = Buffer.byteLength(document);
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(document, 'ascii');
}
