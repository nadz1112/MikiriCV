import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';

const fakeHash = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.5w2okqf0wZ5V5gV7X4R0Jj3W7F6T5yK';
export const publicUser = (user: { id: string; email: string; fullName: string; companyName: string | null; role: 'ADMIN' | 'ENTERPRISE'; isActive: boolean; mustChangePassword: boolean; lastLoginAt: Date | null }) => ({
  id: user.id, email: user.email, fullName: user.fullName, companyName: user.companyName, role: user.role, isActive: user.isActive, mustChangePassword: user.mustChangePassword, lastLoginAt: user.lastLoginAt,
});

export function issueTokens(user: { id: string; role: 'ADMIN' | 'ENTERPRISE'; tokenVersion: number }) {
  const payload = { role: user.role, tokenVersion: user.tokenVersion };
  return {
    access: jwt.sign(payload, env.JWT_ACCESS_SECRET, { subject: user.id, expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] }),
    refresh: jwt.sign(payload, env.JWT_REFRESH_SECRET, { subject: user.id, expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] }),
  };
}

export async function login(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) { await bcrypt.compare(password, fakeHash); throw Object.assign(new Error('Email hoặc mật khẩu không đúng'), { status: 401, code: 'INVALID_CREDENTIALS' }); }
  if (!user.isActive) throw Object.assign(new Error('Tài khoản đã bị khóa, vui lòng liên hệ quản trị viên'), { status: 403, code: 'ACCOUNT_DISABLED' });
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw Object.assign(new Error(`Tài khoản tạm khóa. Vui lòng thử lại sau ${minutes} phút`), { status: 429, code: 'ACCOUNT_TEMP_LOCKED' });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const count = user.failedLoginCount + 1;
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: count, lockedUntil: count >= env.LOGIN_MAX_ATTEMPTS ? new Date(Date.now() + env.LOGIN_LOCK_MINUTES * 60000) : null } });
    throw Object.assign(new Error('Email hoặc mật khẩu không đúng'), { status: 401, code: 'INVALID_CREDENTIALS' });
  }
  const updated = await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  return { user: publicUser(updated), tokens: issueTokens(updated) };
}

export async function refresh(token: string) {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
  if (typeof payload.sub !== 'string') throw new Error('invalid');
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive || user.tokenVersion !== payload.tokenVersion || user.role !== payload.role) throw new Error('invalid');
  await prisma.user.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } } });
  const fresh = { ...user, tokenVersion: user.tokenVersion + 1 };
  return { tokens: issueTokens(fresh), user: publicUser(fresh) };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw Object.assign(new Error('Mật khẩu hiện tại không đúng'), { status: 400, code: 'INVALID_CREDENTIALS' });
  if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) throw Object.assign(new Error('Mật khẩu cần ít nhất 8 ký tự, gồm chữ và số'), { status: 400, code: 'WEAK_PASSWORD' });
  return prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS), mustChangePassword: false, tokenVersion: { increment: 1 } } });
}
