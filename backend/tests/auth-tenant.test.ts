import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';

const db = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    jobDescription: { findMany: vi.fn(), findUnique: vi.fn() },
    candidate: { findMany: vi.fn(), findUnique: vi.fn() },
    matchResult: { upsert: vi.fn() },
  },
}));
vi.mock('../src/config/database.js', () => ({ prisma: db.prisma }));

describe('authentication and tenant access', () => {
  let auth: typeof import('../src/services/auth.service.js');
  let jobs: typeof import('../src/services/job.service.js').jobService;
  let candidates: typeof import('../src/services/candidate.service.js').candidateService;
  let matching: typeof import('../src/services/matching.service.js').matchingService;

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-different-32chars';
    process.env.COOKIE_SECURE = 'false';
    auth = await import('../src/services/auth.service.js');
    ({ jobService: jobs } = await import('../src/services/job.service.js'));
    ({ candidateService: candidates } = await import('../src/services/candidate.service.js'));
    ({ matchingService: matching } = await import('../src/services/matching.service.js'));
  }, 30000);
  beforeEach(() => vi.clearAllMocks());

  it('accepts valid credentials and returns a safe user without a password hash', async () => {
    const passwordHash = await bcrypt.hash('Correct123', 10);
    const user = { id: 'u1', email: 'hr@example.com', fullName: 'HR', companyName: 'Acme', role: 'ENTERPRISE' as const, isActive: true, mustChangePassword: false, tokenVersion: 0, failedLoginCount: 0, lockedUntil: null, lastLoginAt: null, createdAt: new Date(), updatedAt: new Date(), passwordHash };
    db.prisma.user.findUnique.mockResolvedValue(user);
    db.prisma.user.update.mockResolvedValue({ ...user, lastLoginAt: new Date() });
    const result = await auth.login(' HR@example.com ', 'Correct123');
    expect(result.user).toMatchObject({ id: 'u1', role: 'ENTERPRISE' });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.tokens.access).toEqual(expect.any(String));
  });

  it('uses the same credential error for an unknown email and records failures for existing users', async () => {
    const passwordHash = await bcrypt.hash('Correct123', 10);
    const user = { id: 'u1', email: 'hr@example.com', fullName: 'HR', companyName: 'Acme', role: 'ENTERPRISE' as const, isActive: true, mustChangePassword: false, tokenVersion: 0, failedLoginCount: 4, lockedUntil: null, lastLoginAt: null, createdAt: new Date(), updatedAt: new Date(), passwordHash };
    db.prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(auth.login('missing@example.com', 'Wrong123')).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng' });
    db.prisma.user.findUnique.mockResolvedValueOnce(user); db.prisma.user.update.mockResolvedValue(user);
    await expect(auth.login(user.email, 'Wrong123')).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    expect(db.prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ failedLoginCount: 5, lockedUntil: expect.any(Date) }) }));
  });

  it('rejects disabled accounts and rotates the refresh token version', async () => {
    const user = { id: 'u2', email: 'hr2@example.com', fullName: 'HR', companyName: 'Acme', role: 'ENTERPRISE' as const, isActive: false, mustChangePassword: false, tokenVersion: 2, failedLoginCount: 0, lockedUntil: null, lastLoginAt: null, createdAt: new Date(), updatedAt: new Date(), passwordHash: 'unused' };
    db.prisma.user.findUnique.mockResolvedValueOnce(user);
    await expect(auth.login(user.email, 'Correct123')).rejects.toMatchObject({ status: 403, code: 'ACCOUNT_DISABLED' });
    const active = { ...user, isActive: true };
    db.prisma.user.findUnique.mockResolvedValueOnce(active);
    db.prisma.user.update.mockResolvedValue(active);
    const initial = auth.issueTokens(active);
    const rotated = await auth.refresh(initial.refresh);
    expect(db.prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { tokenVersion: { increment: 1 } } }));
    expect(rotated.tokens.refresh).not.toBe(initial.refresh);
  });

  it('returns 404 for a job outside the requesting tenant', async () => {
    db.prisma.jobDescription.findUnique.mockResolvedValue(null);
    await expect(jobs.getJobById('job-b', 'tenant-a')).rejects.toMatchObject({ status: 404 });
    expect(db.prisma.jobDescription.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'job-b', ownerId: 'tenant-a' } }));
  });

  it('adds ownerId to candidate listing and rejects an out of tenant candidate', async () => {
    db.prisma.candidate.findMany.mockResolvedValue([]);
    await candidates.getFilteredCandidates({}, 'tenant-a');
    expect(db.prisma.candidate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: 'tenant-a' } }));
    db.prisma.candidate.findUnique.mockResolvedValue(null);
    await expect(candidates.getCandidateById('candidate-b', 'tenant-a')).rejects.toMatchObject({ status: 404 });
  });

  it('checks tenant ownership before running matching', async () => {
    db.prisma.jobDescription.findUnique.mockResolvedValue(null);
    await expect(matching.runMatching({ jobDescriptionId: 'job-b', candidateIds: ['candidate-b'] }, 'tenant-a')).rejects.toMatchObject({ status: 404 });
    expect(db.prisma.jobDescription.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'job-b', ownerId: 'tenant-a' } }));
  });
});
