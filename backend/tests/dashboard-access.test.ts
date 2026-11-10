import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';

const mocks = vi.hoisted(() => ({
  unlink: vi.fn(),
  prisma: {
    user: { findUnique: vi.fn() },
    candidate: { count: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    jobDescription: { count: vi.fn(), findFirst: vi.fn() },
    matchResult: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn((queries: unknown[]) => Promise.all(queries)),
  },
}));
vi.mock('../src/config/database.js', () => ({ prisma: mocks.prisma }));
vi.mock('fs/promises', async importOriginal => ({
  ...await importOriginal<typeof import('fs/promises')>(),
  default: { ...await importOriginal<typeof import('fs/promises')>(), unlink: mocks.unlink },
}));

const candidateId = '10000000-0000-4000-8000-000000000001';
const jobId = '20000000-0000-4000-8000-000000000001';
const tenant = { id: 'tenant-a', role: 'ENTERPRISE' as const, tokenVersion: 0, mustChangePassword: false };
const safeCandidate = { id: candidateId, fullName: 'Ứng viên A', email: null, phone: null,
  skills: ['React'], yearsOfExperience: 3, education: null, fileName: 'cv.pdf',
  extractionStatus: 'SUCCESS', extractionMessage: null, createdAt: new Date(),
  rawText: 'PRIVATE CV', searchText: 'private search', fileUrl: 'D:/private/cv.pdf', contentHash: 'private hash' };
let server: Server;
let base: string;
let service: typeof import('../src/services/candidate.service.js').candidateService;

async function request(url: string, options: RequestInit = {}, role: 'ADMIN' | 'ENTERPRISE' = 'ENTERPRISE') {
  const token = jwt.sign({ role, tokenVersion: 0 }, process.env.JWT_ACCESS_SECRET!, { subject: tenant.id });
  mocks.prisma.user.findUnique.mockResolvedValue({ ...tenant, role, isActive: true });
  return fetch(base + url, { ...options, headers: { Cookie: `accessToken=${token}`, 'X-Requested-With': 'CVMikiri', ...options.headers } });
}

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_ACCESS_SECRET = 'dashboard-access-secret-with-at-least-32-characters';
  process.env.JWT_REFRESH_SECRET = 'dashboard-refresh-secret-that-is-different-32chars';
  process.env.COOKIE_SECURE = 'false';
  const { createApp } = await import('../src/app.js');
  ({ candidateService: service } = await import('../src/services/candidate.service.js'));
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
}, 30000);
afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.candidate.count.mockResolvedValue(75);
  mocks.prisma.jobDescription.count.mockResolvedValue(2);
  mocks.prisma.matchResult.count.mockResolvedValue(0);
  mocks.prisma.matchResult.aggregate.mockResolvedValue({ _avg: { score: null } });
  mocks.prisma.matchResult.findMany.mockResolvedValue([]);
  mocks.unlink.mockResolvedValue(undefined);
});

describe('dashboard and candidate access over HTTP', () => {
  it('requires authentication for stats, detail and deletion', async () => {
    for (const [url, method] of [['/dashboard/stats', 'GET'], [`/candidates/${candidateId}`, 'GET'], [`/candidates/${candidateId}`, 'DELETE']]) {
      const response = await fetch(base + url, { method, headers: { 'X-Requested-With': 'CVMikiri' } });
      expect(response.status).toBe(401);
    }
    expect(mocks.prisma.candidate.delete).not.toHaveBeenCalled();
  });

  it('scopes aggregate queries by tenant and computes empty scores safely', async () => {
    const response = await request('/dashboard/stats');
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ totalCandidates: 75, totalMatches: 0, avgScore: 0, qualifiedRate: 0 });
    expect(mocks.prisma.candidate.count).toHaveBeenCalledWith({ where: { ownerId: tenant.id } });
    expect(mocks.prisma.jobDescription.count).toHaveBeenCalledWith({ where: { ownerId: tenant.id, createdById: tenant.id } });
    expect(mocks.prisma.matchResult.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: {
      candidate: { ownerId: tenant.id }, jobDescription: { ownerId: tenant.id, createdById: tenant.id },
    } }));
  });

  it('lets admins see global totals', async () => {
    expect((await request('/dashboard/stats', {}, 'ADMIN')).status).toBe(200);
    expect(mocks.prisma.candidate.count).toHaveBeenCalledWith({ where: {} });
    expect(mocks.prisma.jobDescription.count).toHaveBeenCalledWith({ where: {} });
  });

  it('returns 404 for inaccessible jobs and filters both sides of leaderboard matches', async () => {
    mocks.prisma.jobDescription.findFirst.mockResolvedValue(null);
    expect((await request(`/jobs/${jobId}/stats`)).status).toBe(404);
    expect((await request(`/matching/leaderboard/${jobId}`)).status).toBe(404);
    expect(mocks.prisma.jobDescription.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: jobId, ownerId: tenant.id, createdById: tenant.id },
      include: { matchResults: expect.objectContaining({ where: {
        candidate: { ownerId: tenant.id }, jobDescription: { ownerId: tenant.id, createdById: tenant.id },
      } }) },
    }));
  });

  it('keeps raw CV and storage fields out of leaderboard responses and handles bucket boundaries', async () => {
    const scores = [100, 86, 85, 71, 70, 50, 49];
    mocks.prisma.jobDescription.findFirst.mockResolvedValue({ id: jobId, title: 'Developer',
      matchResults: scores.map((score, index) => ({ id: String(index), candidateId, jobDescriptionId: jobId, score,
        summary: 'Nhận xét', matchedSkills: [], missingSkills: [], candidate: safeCandidate })) });
    const leaderboard = await (await request(`/matching/leaderboard/${jobId}`)).json();
    const candidate = leaderboard.data.matchResults[0].candidate;
    for (const field of ['rawText', 'searchText', 'fileUrl', 'contentHash']) expect(candidate).not.toHaveProperty(field);
    const stats = (await (await request(`/jobs/${jobId}/stats`)).json()).data;
    expect(stats.distribution).toEqual({ under50: 1, range50to70: 2, range71to85: 2, over85: 2 });
    expect(stats.qualifiedCount).toBe(5);
  });

  it('returns authorized detail without storage metadata and denies another tenant', async () => {
    mocks.prisma.candidate.findFirst.mockResolvedValue({ ...safeCandidate, matchResults: [] });
    const data = (await (await request(`/candidates/${candidateId}`)).json()).data;
    expect(data.rawText).toBe('PRIVATE CV');
    for (const field of ['fileUrl', 'searchText', 'contentHash']) expect(data).not.toHaveProperty(field);
    expect(mocks.prisma.candidate.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: candidateId, ownerId: tenant.id } }));
    mocks.prisma.candidate.findFirst.mockResolvedValue(null);
    expect((await request(`/candidates/${candidateId}`)).status).toBe(404);
  });

  it('cannot delete another tenant record or unlink its file', async () => {
    mocks.prisma.candidate.delete.mockRejectedValue({ code: 'P2025' });
    expect((await request(`/candidates/${candidateId}`, { method: 'DELETE' })).status).toBe(404);
    expect(mocks.prisma.candidate.delete).toHaveBeenCalledWith(expect.objectContaining({ where: { id: candidateId, ownerId: tenant.id } }));
    expect(mocks.unlink).not.toHaveBeenCalled();
  });

  it('deletes the database first, then cleans only files inside UPLOAD_DIR', async () => {
    mocks.prisma.candidate.delete.mockResolvedValue({ fileUrl: '/uploads/test.pdf' });
    expect((await request(`/candidates/${candidateId}`, { method: 'DELETE' })).status).toBe(200);
    expect(mocks.prisma.candidate.delete.mock.invocationCallOrder[0]).toBeLessThan(mocks.unlink.mock.invocationCallOrder[0]);
    mocks.unlink.mockClear();
    mocks.prisma.candidate.delete.mockResolvedValue({ fileUrl: 'C:/outside/secret.pdf' });
    await service.deleteCandidate(candidateId, tenant);
    expect(mocks.unlink).not.toHaveBeenCalled();
  });

  it('validates IDs and checks job access before candidate score filtering', async () => {
    expect((await request('/candidates/not-a-uuid')).status).toBe(400);
    expect((await request('/jobs/not-a-uuid/stats')).status).toBe(400);
    mocks.prisma.jobDescription.findFirst.mockResolvedValue(null);
    expect((await request(`/candidates?jobId=${jobId}`)).status).toBe(404);
    expect(mocks.prisma.candidate.findMany).not.toHaveBeenCalled();
  });

  it('preserves FR2 upload idempotency validation and private file ownership checks', async () => {
    const upload = await request('/candidates/upload', { method: 'POST' });
    expect(upload.status).toBe(400);
    expect((await upload.json()).error.code).toBe('VALIDATION_ERROR');
    mocks.prisma.candidate.findUnique.mockResolvedValue(null);
    expect((await request(`/candidates/${candidateId}/file`)).status).toBe(404);
    expect(mocks.prisma.candidate.findUnique).toHaveBeenCalledWith({ where: { id: candidateId, ownerId: tenant.id } });
  });
});
