import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
const mocks = vi.hoisted(() => ({ user: { findUnique: vi.fn() }, candidate: { findUnique: vi.fn(), deleteMany: vi.fn() }, unlink: vi.fn() }));
vi.mock('../src/config/database.js', () => ({ prisma: mocks }));
vi.mock('fs/promises', () => ({ default: { unlink: mocks.unlink } }));
let server: Server; let base: string; let cookie: string;
beforeAll(async () => {
  Object.assign(process.env, { DATABASE_URL: 'postgresql://test:test@localhost/test', JWT_ACCESS_SECRET: 'test-access-secret-with-at-least-32-characters', JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-different-32chars', COOKIE_SECURE: 'false' });
  const { createApp } = await import('../src/app.js');
  const { issueTokens } = await import('../src/services/auth.service.js');
  cookie = `accessToken=${issueTokens({ id: 'owner', role: 'ENTERPRISE', tokenVersion: 0 }).access}`;
  server = createApp().listen(0, '127.0.0.1'); await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/candidates/cv`;
});
afterAll(() => new Promise<void>((resolve) => { if (server) server.close(() => resolve()); else resolve(); }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.findUnique.mockResolvedValue({ id: 'owner', role: 'ENTERPRISE', tokenVersion: 0, isActive: true, mustChangePassword: false });
  mocks.candidate.findUnique.mockResolvedValue({ id: 'cv', fileUrl: '/uploads/private-cv.pdf' });
  mocks.candidate.deleteMany.mockResolvedValue({ count: 1 });
  mocks.unlink.mockResolvedValue(undefined);
});
const remove = () => fetch(base, { method: 'DELETE', headers: { Cookie: cookie, 'X-Requested-With': 'CVMikiri' } });
it('does not touch the file when database deletion fails', async () => {
  mocks.candidate.deleteMany.mockRejectedValue(new Error('Database unavailable'));
  expect((await remove()).status).toBe(500);
  expect(mocks.unlink).not.toHaveBeenCalled();
});
it('keeps API success when file cleanup fails and emits only a non-personal warning', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    mocks.unlink.mockRejectedValue(new Error('private path and personal data'));
    const response = await remove();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true });
    expect(mocks.candidate.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(mocks.unlink.mock.invocationCallOrder[0]);
    expect(warning).toHaveBeenCalledExactlyOnceWith('CANDIDATE_FILE_DELETE_FAILED');
  } finally { warning.mockRestore(); }
});
