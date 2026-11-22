import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const mocks = vi.hoisted(() => ({ user: { findUnique: vi.fn() }, candidate: { findUnique: vi.fn(), findMany: vi.fn() }, jobDescription: { findFirst: vi.fn() } }));
vi.mock('../src/config/database.js', () => ({ prisma: mocks }));
const now = new Date('2026-11-17T00:00:00Z');
const unsafeUser = { id: 'owner', fullName: 'Người tải', email: 'test@example.test', companyName: 'Công ty', passwordHash: 'hidden', tokenVersion: 4 };
const candidate = { id: 'cv', fullName: 'Ứng viên', email: null, phone: null, skills: ['React'], yearsOfExperience: 2, education: null, fileName: 'cv.pdf', extractionStatus: 'SUCCESS', extractionMessage: null, rawText: 'CV riêng tư', createdAt: now, fileUrl: '/private/cv.pdf', searchText: 'private', contentHash: 'private', uploadedBy: unsafeUser,
  matchResults: [{ id: 'match', candidateId: 'cv', jobDescriptionId: 'jd', score: 80, summary: 'Phù hợp', matchedSkills: ['React'], missingSkills: [], createdAt: now, updatedAt: now, jobDescription: { title: 'Developer' } }] };
let server: Server;
let base: string;
let issueTokens: typeof import('../src/services/auth.service.js').issueTokens;
beforeAll(async () => {
  Object.assign(process.env, { DATABASE_URL: 'postgresql://test:test@localhost/test', JWT_ACCESS_SECRET: 'test-access-secret-with-at-least-32-characters', JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-different-32chars', COOKIE_SECURE: 'false' });
  const { createApp } = await import('../src/app.js');
  ({ issueTokens } = await import('../src/services/auth.service.js'));
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => new Promise<void>((resolve) => { if (server) server.close(() => resolve()); else resolve(); }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.candidate.findUnique.mockResolvedValue(candidate);
  mocks.candidate.findMany.mockResolvedValue([candidate]);
  mocks.jobDescription.findFirst.mockResolvedValue({ id: 'jd', matchResults: candidate.matchResults.map((match) => ({ ...match, candidate })) });
});
it.each(['ADMIN', 'ENTERPRISE'] as const)('allowlists candidate responses for %s, including nested identities', async (role) => {
  const user = { id: 'owner', role, tokenVersion: 0, isActive: true, mustChangePassword: false };
  mocks.user.findUnique.mockResolvedValue(user);
  for (const path of ['/candidates/cv', '/candidates', '/matching/leaderboard/jd']) {
    const response = await fetch(base + path, { headers: { Cookie: `accessToken=${issueTokens(user).access}` } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toMatch(/"(fileUrl|searchText|contentHash|passwordHash|tokenVersion)":/);
    if (path === '/candidates/cv') {
      expect(body.data.rawText).toBe('CV riêng tư');
      expect(body.data.matchResults[0]).toMatchObject({ jobDescriptionId: 'jd', jobTitle: 'Developer', evaluatedAt: now.toISOString(), summary: 'Phù hợp' });
    } else expect(JSON.stringify(body)).not.toContain('"rawText":');
  }
});
it('allowlists upload and user DTOs even if their source objects contain private fields', async () => {
  const { toCandidateUploadDto } = await import('../src/modules/candidates/candidate.mapper.js');
  const { toAdminUserDto } = await import('../src/common/mappers/user.mapper.js');
  expect(JSON.stringify(toCandidateUploadDto(candidate))).not.toMatch(/"(fileUrl|searchText|contentHash|rawText)":/);
  expect(JSON.stringify(toAdminUserDto({ ...unsafeUser, role: 'ENTERPRISE', isActive: true, mustChangePassword: false, lastLoginAt: null, createdAt: now }))).not.toMatch(/"(passwordHash|tokenVersion)":/);
});
