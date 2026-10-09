import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { randomUUID } from 'crypto';

export interface AuthUser { id: string; role: 'ADMIN' | 'ENTERPRISE'; tokenVersion: number; mustChangePassword: boolean }
declare global { namespace Express { interface Request { user?: AuthUser } } }

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.accessToken as string | undefined;
    if (!token) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Vui lòng đăng nhập để tiếp tục' }, requestId: randomUUID() }); return; }
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    if (typeof payload.sub !== 'string' || !['ADMIN', 'ENTERPRISE'].includes(String(payload.role))) throw new Error('invalid');
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, tokenVersion: true, isActive: true, mustChangePassword: true } });
    if (!user || !user.isActive || user.tokenVersion !== payload.tokenVersion || user.role !== payload.role) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Vui lòng đăng nhập để tiếp tục' }, requestId: randomUUID() }); return;
    }
    req.user = user;
    if (user.mustChangePassword && !['/auth/me', '/auth/change-password', '/auth/logout', '/me', '/change-password', '/logout'].includes(req.path)) {
      res.status(403).json({ success: false, error: { code: 'PASSWORD_CHANGE_REQUIRED', message: 'Vui lòng đổi mật khẩu để tiếp tục' }, requestId: randomUUID() }); return;
    }
    next();
  } catch (error) {
    const expired = error instanceof jwt.TokenExpiredError;
    res.status(401).json({ success: false, error: { code: expired ? 'TOKEN_EXPIRED' : 'UNAUTHENTICATED', message: expired ? 'Phiên đăng nhập đã hết hạn' : 'Vui lòng đăng nhập để tiếp tục' }, requestId: randomUUID() });
  }
}

export function requireRole(...roles: Array<'ADMIN' | 'ENTERPRISE'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) { res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Bạn không có quyền thực hiện thao tác này' }, requestId: randomUUID() }); return; }
    next();
  };
}

export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('X-Requested-With') !== 'CVMikiri') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Yêu cầu không hợp lệ' }, requestId: randomUUID() }); return;
  }
  next();
}
