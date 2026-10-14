import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { changePassword, issueTokens, login, publicUser, refresh } from '../services/auth.service.js';
import { prisma } from '../config/database.js';
import { randomUUID } from 'crypto';

const router = Router();
const cookieBase = { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'lax' as const };
const accessCookie = (res: import('express').Response, tokens: { access: string; refresh: string }) => {
  res.cookie('accessToken', tokens.access, { ...cookieBase, path: '/' });
  res.cookie('refreshToken', tokens.refresh, { ...cookieBase, path: '/api/auth' });
};
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, handler: (_req, res) => { res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Bạn thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.' }, requestId: randomUUID() }); } });

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const data = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const result = await login(data.email, data.password);
    accessCookie(res, result.tokens);
    res.json({ success: true, data: { user: result.user } });
  } catch (err) { next(err); }
});
router.post('/refresh', async (req, res) => {
  try {
    const result = await refresh(req.cookies?.refreshToken);
    accessCookie(res, result.tokens);
    res.json({ success: true, data: { user: result.user } });
  } catch {
    res.clearCookie('accessToken', { path: '/', ...cookieBase });
    res.clearCookie('refreshToken', { path: '/api/auth', ...cookieBase });
    res.status(401).json({ success: false, error: { code: 'TOKEN_EXPIRED', message: 'Phiên đăng nhập đã hết hạn' }, requestId: randomUUID() });
  }
});
router.get('/me', authenticate, async (req, res, next) => {
  try { const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } }); res.json({ success: true, data: { user: publicUser(user) } }); } catch (err) { next(err); }
});
router.post('/logout', authenticate, async (req, res, next) => {
  try { await prisma.user.update({ where: { id: req.user!.id }, data: { tokenVersion: { increment: 1 } } }); } catch (err) { next(err); return; }
  res.clearCookie('accessToken', { path: '/', ...cookieBase });
  res.clearCookie('refreshToken', { path: '/api/auth', ...cookieBase });
  res.json({ success: true, data: null });
});
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const data = z.object({ currentPassword: z.string(), newPassword: z.string() }).parse(req.body);
    const user = await changePassword(req.user!.id, data.currentPassword, data.newPassword);
    const tokens = issueTokens(user);
    accessCookie(res, tokens);
    res.json({ success: true, data: { user: publicUser(user) } });
  } catch (err) { next(err); }
});
export default router;
