import { Router } from 'express';
import bcrypt from 'bcrypt';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { requireRole } from '../middlewares/auth.middleware.js';
import { toAdminUserDto as safeUser } from '../common/mappers/user.mapper.js';
import { companyMembership } from '../services/company.service.js';

const router = Router();
router.use(requireRole('ADMIN'));
const failure = (error: string, status: number, message: string) => Object.assign(new Error(message), { status, code: error });
const temporaryPasswordSchema = z.string()
  .min(8, 'Mật khẩu tạm cần ít nhất 8 ký tự')
  .regex(/[A-Za-z]/, 'Mật khẩu tạm phải có ít nhất một chữ cái (A–Z)')
  .regex(/\d/, 'Mật khẩu tạm phải có ít nhất một chữ số');

router.get('/companies', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }) });
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1); const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const q = String(req.query.search || '').trim(); const status = req.query.isActive;
    const where = { role: 'ENTERPRISE' as const, ...(status === 'true' || status === 'false' ? { isActive: status === 'true' } : {}), ...(q ? { OR: [{ email: { contains: q, mode: 'insensitive' as const } }, { fullName: { contains: q, mode: 'insensitive' as const } }, { companyName: { contains: q, mode: 'insensitive' as const } }] } : {}) };
    const [users, total] = await Promise.all([prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: { _count: { select: { jobs: true, candidates: true } } } }), prisma.user.count({ where })]);
    res.json({ success: true, data: users.map(({ passwordHash: _hash, tokenVersion: _version, failedLoginCount: _failedCount, _count, ...user }) => ({ ...safeUser(user), jobCount: _count.jobs, candidateCount: _count.candidates })), total, page, limit });
  } catch (err) { next(err); }
});
router.post('/', async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email(), fullName: z.string().trim().min(1), companyName: z.string().trim().min(1), password: temporaryPasswordSchema }).parse(req.body);
    const email = body.email.trim().toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) throw failure('EMAIL_ALREADY_EXISTS', 409, 'Email đã tồn tại');
    const { password, ...profile } = body;
    const user = await prisma.user.create({ data: { ...profile, company: companyMembership(profile.companyName), email, passwordHash: await bcrypt.hash(password, env.BCRYPT_ROUNDS), role: 'ENTERPRISE', mustChangePassword: true } });
    res.status(201).json({ success: true, data: safeUser(user) });
  } catch (err) { next(err); }
});
router.get('/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, include: { _count: { select: { jobs: true, candidates: true } } } });
    if (!user || user.role !== 'ENTERPRISE') throw failure('USER_NOT_FOUND', 404, 'Không tìm thấy tài khoản');
    const { passwordHash: _hash, tokenVersion: _version, failedLoginCount: _failed, _count, ...safe } = user;
    res.json({ success: true, data: { ...safeUser(safe), jobCount: _count.jobs, candidateCount: _count.candidates } });
  } catch (err) { next(err); }
});
router.put('/:id', async (req, res, next) => {
  try {
    const body = z.object({ fullName: z.string().trim().min(1), companyName: z.string().trim().min(1) }).parse(req.body);
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { role: true } });
    if (!target || target.role !== 'ENTERPRISE') throw failure('USER_NOT_FOUND', 404, 'Không tìm thấy tài khoản');
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { ...body, company: companyMembership(body.companyName) } });
    res.json({ success: true, data: safeUser(user) });
  } catch (err) { next(err); }
});
router.patch('/:id/status', async (req, res, next) => {
  try {
    if (req.params.id === req.user!.id) throw failure('CANNOT_MODIFY_SELF', 409, 'Không thể tự khóa tài khoản của bạn');
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { role: true } });
    if (!target || target.role !== 'ENTERPRISE') throw failure('USER_NOT_FOUND', 404, 'Không tìm thấy tài khoản');
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { isActive, ...(isActive ? {} : { tokenVersion: { increment: 1 } }) } });
    res.json({ success: true, data: safeUser(user) });
  } catch (err) { next(err); }
});
router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const { password } = z.object({ password: temporaryPasswordSchema }).parse(req.body);
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { role: true } });
    if (!target || target.role !== 'ENTERPRISE') throw failure('USER_NOT_FOUND', 404, 'Không tìm thấy tài khoản');
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash: await bcrypt.hash(password, env.BCRYPT_ROUNDS), mustChangePassword: true, tokenVersion: { increment: 1 } } });
    res.json({ success: true, data: safeUser(user) });
  } catch (err) { next(err); }
});
router.delete('/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user!.id) throw failure('CANNOT_MODIFY_SELF', 409, 'Không thể xóa tài khoản của bạn');
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, include: { candidates: { select: { fileUrl: true } } } });
    if (!user || user.role !== 'ENTERPRISE') throw failure('USER_NOT_FOUND', 404, 'Không tìm thấy tài khoản');
    await prisma.user.delete({ where: { id: user.id } });
    await Promise.all(user.candidates.map(async ({ fileUrl }) => { try { await fs.unlink(path.resolve(process.cwd(), fileUrl.replace(/^\//, ''))); } catch { /* Database deletion remains authoritative. */ } }));
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
export default router;
