import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), runMatching: vi.fn(), upload: vi.fn(), leaderboard: vi.fn() }));
vi.mock('../src/config/database.js', () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock('../src/services/matching.service.js', () => ({ matchingService: { runMatching: mocks.runMatching, getLeaderboardByJobId: mocks.leaderboard } }));
vi.mock('../src/services/candidate.service.js', () => ({ candidateService: { upload: mocks.upload } }));

describe('admin and HR write permissions', () => {
  let server: Server;
  let base: string;
  let issueTokens: typeof import('../src/services/auth.service.js').issueTokens;
  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-different-32chars';
    process.env.COOKIE_SECURE = 'false';
    const { createApp } = await import('../src/app.js');
    ({ issueTokens } = await import('../src/services/auth.service.js'));
    server = createApp().listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  }, 60000);
  afterAll(() => new Promise<void>((resolve, reject) => { if (!server) { resolve(); return; } server.close((error) => error ? reject(error) : resolve()); }));
  function headers(role: 'ADMIN' | 'ENTERPRISE') {
    const user = { id: 'user', role, tokenVersion: 0, isActive: true, mustChangePassword: false };
    mocks.findUnique.mockResolvedValue(user);
    return { Cookie: `accessToken=${issueTokens(user).access}`, 'X-Requested-With': 'CVMikiri', 'Content-Type': 'application/json' };
  }
  it.each(['/candidates/upload', '/matching/run'])('rejects ADMIN at %s before body or file processing', async (path) => {
    const response = await fetch(`${base}${path}`, { method: 'POST', headers: headers('ADMIN'), body: '{}' });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ success: false, error: { code: 'FORBIDDEN', message: 'Bạn không có quyền thực hiện thao tác này' }, requestId: expect.any(String) });
    expect(mocks.runMatching).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('allows HR to run matching with its own scope', async () => {
    mocks.runMatching.mockResolvedValue([]);
    const body = { jobDescriptionId: 'jd', candidateIds: ['cv'] };
    const response = await fetch(`${base}/matching/run`, { method: 'POST', headers: headers('ENTERPRISE'), body: JSON.stringify(body) });
    expect(response.status).toBe(200);
    expect(mocks.runMatching).toHaveBeenCalledWith(body, 'user');
  });
  it('allows HR through the upload role guard to file validation', async () => {
    const response = await fetch(`${base}/candidates/upload`, { method: 'POST', headers: { ...headers('ENTERPRISE'), 'Idempotency-Key': '11111111-1111-4111-8111-111111111111' }, body: '{}' });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'NO_FILES' } });
  });
  it('keeps the leaderboard readable by ADMIN', async () => {
    mocks.leaderboard.mockResolvedValue({ id: 'jd', matchResults: [] });
    const response = await fetch(`${base}/matching/leaderboard/jd`, { headers: headers('ADMIN') });
    expect(response.status).toBe(200);
  });
});
