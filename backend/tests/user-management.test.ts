vi.mock('../src/services/company.service.js', () => ({ checkedCompanyMembership: async () => ({ connect: { id: 'company-id' } }) }));
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const mocks = vi.hoisted(() => ({ user: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }, unlink: vi.fn() }));
vi.mock('../src/config/database.js', () => ({ prisma: { user: mocks.user, $transaction: async (callback) => callback({ user: mocks.user }) } }));
vi.mock('fs/promises', () => ({ default: { unlink: mocks.unlink } }));
interface User {
  id: string; email: string; fullName: string; companyName: string | null; role: 'ADMIN' | 'ENTERPRISE';
  passwordHash: string; isActive: boolean; mustChangePassword: boolean; tokenVersion: number;
  lastLoginAt: Date | null; createdAt: Date; failedLoginCount: number; lockedUntil: Date | null;
}
let users: Map<string, User>;
let server: Server;
let base: string;
let issueTokens: typeof import('../src/services/auth.service.js').issueTokens;
const passwordHash = bcrypt.hashSync('Current123', 10);
beforeAll(async () => {
  Object.assign(process.env, { DATABASE_URL: 'postgresql://test:test@localhost/test', JWT_ACCESS_SECRET: 'test-access-secret-with-at-least-32-characters', JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-different-32chars', COOKIE_SECURE: 'false', BCRYPT_ROUNDS: '10' });
  const { createApp } = await import('../src/app.js');
  ({ issueTokens } = await import('../src/services/auth.service.js'));
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => new Promise<void>((resolve) => { if (server) server.close(() => resolve()); else resolve(); }));
beforeEach(() => {
  vi.resetAllMocks();
  users = new Map(['admin', 'other-admin', 'hr'].map((id) => [id, { id, email: `${id}@example.test`, fullName: 'Tài khoản mẫu', companyName: 'Công ty mẫu', role: id === 'hr' ? 'ENTERPRISE' : 'ADMIN', passwordHash, isActive: true, mustChangePassword: false, tokenVersion: 0, lastLoginAt: null, createdAt: new Date(), failedLoginCount: 0, lockedUntil: null }]));
  mocks.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string; email?: string } }) => {
    const user = where.id ? users.get(where.id) : [...users.values()].find((value) => value.email === where.email);
    return user ? { ...user, _count: { jobs: 2, candidates: 3 }, candidates: [{ fileUrl: 'uploads/cv.pdf' }] } : null;
  });
  mocks.user.findUniqueOrThrow.mockImplementation(async (args: { where: { id: string } }) => {
    const user = await mocks.user.findUnique(args);
    if (!user) throw new Error('USER_NOT_FOUND');
    return user;
  });
  mocks.user.create.mockImplementation(async ({ data }: { data: Omit<User, 'id'> }) => {
    expect(data).not.toHaveProperty('password');
    const user = { ...data, id: 'new-user', createdAt: new Date(), lastLoginAt: null, isActive: true };
    users.set(user.id, user);
    return user;
  });
  mocks.user.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Partial<Omit<User, 'tokenVersion'>> & { tokenVersion?: { increment: number } } }) => {
    const user = users.get(where.id)!;
    const { tokenVersion, ...changes } = data;
    const updated = { ...user, ...changes, tokenVersion: user.tokenVersion + (tokenVersion?.increment ?? 0) };
    users.set(user.id, updated);
    return updated;
  });
  mocks.user.delete.mockImplementation(async ({ where }: { where: { id: string } }) => { const user = users.get(where.id); users.delete(where.id); return user; });
  mocks.unlink.mockResolvedValue(undefined);
});
function cookie(id = 'admin') { return `accessToken=${issueTokens(users.get(id)!).access}`; }
async function request(method: string, path: string, body?: unknown, token = cookie()) {
  return fetch(base + path, { method, headers: { Cookie: token, 'Content-Type': 'application/json', 'X-Requested-With': 'CVMikiri' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
function expectSafe(body: unknown) { expect(JSON.stringify(body)).not.toMatch(/"(password|passwordHash|tokenVersion)":/); }

describe('enterprise account administration over HTTP with a mocked database', () => {
  it.each([
    ['1345679', 'Mật khẩu tạm cần ít nhất 8 ký tự'],
    ['13456789', 'Mật khẩu tạm phải có ít nhất một chữ cái (A–Z)'],
    ['abcdefgh', 'Mật khẩu tạm phải có ít nhất một chữ số'],
  ])('rejects invalid temporary passwords with a Vietnamese field error: %s', async (password, message) => {
    const response = await request('POST', '/users', { email: 'new@example.test', fullName: 'Người dùng', companyName: 'Công ty', password });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR', details: expect.arrayContaining([{ field: 'password', message }]) } });
    expect(mocks.user.create).not.toHaveBeenCalled();
  });
  it('creates a forced-password-change enterprise without persisting plaintext or accepting an injected role', async () => {
    const response = await request('POST', '/users', { email: 'NEW@example.test', fullName: 'Người dùng', companyName: 'Công ty', password: 'Temporary123', role: 'ADMIN' });
    expect(response.status).toBe(201);
    const body = await response.json(); expectSafe(body);
    expect(body.data).toMatchObject({ email: 'new@example.test', role: 'ENTERPRISE', mustChangePassword: true });
    const data = mocks.user.create.mock.calls[0][0].data;
    expect(await bcrypt.compare('Temporary123', data.passwordHash)).toBe(true);
    expect(data.company).toEqual({ connect: { id: 'company-id' } });
  });
  it('rejects duplicate email with a Vietnamese 409', async () => {
    const response = await request('POST', '/users', { email: 'hr@example.test', fullName: 'HR', companyName: 'Công ty', password: 'Temporary123' });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Email đã tồn tại' } });
    expect(mocks.user.create).not.toHaveBeenCalled();
  });
  it('edits profile fields without changing role', async () => {
    const response = await request('PUT', '/users/hr', { fullName: 'Tên mới', companyName: 'Công ty mới', role: 'ADMIN' });
    expect(response.status).toBe(200); const body = await response.json(); expectSafe(body);
    expect(body.data).toMatchObject({ fullName: 'Tên mới', companyName: 'Công ty mới', role: 'ENTERPRISE' });
  });
  it('locks and unlocks while keeping old access tokens invalid', async () => {
    const old = cookie('hr');
    expect((await request('PATCH', '/users/hr/status', { isActive: false })).status).toBe(200);
    expect((await request('GET', '/auth/me', undefined, old)).status).toBe(401);
    expect((await request('PATCH', '/users/hr/status', { isActive: true })).status).toBe(200);
    expect((await request('GET', '/auth/me', undefined, old)).status).toBe(401);
    expect((await request('GET', '/auth/me', undefined, cookie('hr'))).status).toBe(200);
  });
  it('resets the password, invalidates existing sessions and requires a password change', async () => {
    const old = cookie('hr');
    const response = await request('POST', '/users/hr/reset-password', { password: 'Reset12345' });
    expect(response.status).toBe(200); const body = await response.json(); expectSafe(body);
    expect(body.data.mustChangePassword).toBe(true);
    expect((await request('GET', '/auth/me', undefined, old)).status).toBe(401);
    expect(await bcrypt.compare('Reset12345', users.get('hr')!.passwordHash)).toBe(true);
  });
  it('delegates account cascades to database deletion and then removes the associated files', async () => {
    const response = await request('DELETE', '/users/hr');
    expect(response.status).toBe(200);
    expect(mocks.user.delete).toHaveBeenCalledWith({ where: { id: 'hr' } });
    expect(mocks.unlink).toHaveBeenCalledOnce();
    expect(mocks.user.delete.mock.invocationCallOrder[0]).toBeLessThan(mocks.unlink.mock.invocationCallOrder[0]);
  });
  it.each([['PATCH', '/users/admin/status', { isActive: false }], ['DELETE', '/users/admin', undefined]])('prevents self administration: %s %s', async (method, path, body) => {
    expect((await request(method, path, body)).status).toBe(409);
    expect(mocks.user.update).not.toHaveBeenCalled(); expect(mocks.user.delete).not.toHaveBeenCalled();
  });
  it.each([['PUT', { fullName: 'Tên', companyName: 'Công ty' }, ''], ['PATCH', { isActive: false }, '/status'], ['POST', { password: 'Reset12345' }, '/reset-password'], ['DELETE', undefined, '']])('cannot manage another admin: %s', async (method, body, suffix) => {
    expect((await request(method, '/users/other-admin' + suffix, body)).status).toBe(404);
    expect(mocks.user.update).not.toHaveBeenCalled(); expect(mocks.user.delete).not.toHaveBeenCalled();
  });
});
