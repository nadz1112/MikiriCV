import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcrypt';

const db = vi.hoisted(() => {
  const idempotencyStore = new Map<string, {
    key: string;
    endpoint: string;
    requestHash: string;
    statusCode: number | null;
    responseBody: unknown;
    expiresAt: Date;
  }>();
  return {
    idempotencyStore,
    prisma: {
      user: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
      },
      jobDescription: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      idempotencyKey: {
        findUnique: vi.fn(async ({ where }: { where: { key: string } }) => idempotencyStore.get(where.key) ?? null),
        create: vi.fn(async ({ data }: { data: { key: string; endpoint: string; requestHash: string; expiresAt: Date } }) => {
          const row = { ...data, statusCode: null, responseBody: null };
          idempotencyStore.set(data.key, row);
          return row;
        }),
        update: vi.fn(async ({ where, data }: { where: { key: string }; data: { statusCode: number; responseBody: unknown } }) => {
          const existing = idempotencyStore.get(where.key);
          if (!existing) throw new Error('missing');
          const updated = { ...existing, ...data };
          idempotencyStore.set(where.key, updated);
          return updated;
        }),
        deleteMany: vi.fn(async ({ where }: { where: { key: string } }) => {
          const deleted = idempotencyStore.delete(where.key) ? 1 : 0;
          return { count: deleted };
        }),
      },
    },
  };
});

vi.mock('../src/config/database.js', () => ({ prisma: db.prisma }));

describe('cross-platform auth and offline job sync', () => {
  let server: Server;
  let base: string;
  let passwordHash: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-different-32chars';
    process.env.COOKIE_SECURE = 'false';
    passwordHash = await bcrypt.hash('Correct123', 10);
    const { createApp } = await import('../src/app.js');
    server = createApp().listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  }, 60000);

  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        if (!server) {
          resolve();
          return;
        }
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );

  beforeEach(() => {
    vi.clearAllMocks();
    db.idempotencyStore.clear();
  });

  const makeUser = (overrides: Partial<{ tokenVersion: number; isActive: boolean }> = {}) => ({
    id: 'hr-1',
    email: 'hr@example.com',
    fullName: 'HR Mẫu',
    companyName: 'Mikiri Corp',
    companyId: 'comp-1',
    role: 'ENTERPRISE' as const,
    isActive: overrides.isActive ?? true,
    mustChangePassword: false,
    tokenVersion: overrides.tokenVersion ?? 0,
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    passwordHash,
  });

  it('keeps web login free of body tokens while supporting mobile-native Bearer auth and tokenVersion revocation', async () => {
    const user = makeUser();
    db.prisma.user.findUnique.mockResolvedValue(user);
    db.prisma.user.findUniqueOrThrow.mockResolvedValue(user);
    db.prisma.user.update.mockResolvedValue(user);

    const webRes = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'CVMikiri' },
      body: JSON.stringify({ email: 'hr@example.com', password: 'Correct123' }),
    });
    expect(webRes.status).toBe(200);
    const webBody = (await webRes.json()) as { data: { user: unknown; tokens?: unknown } };
    expect(webBody.data.tokens).toBeUndefined();

    const mobileRes = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'CVMikiri',
        'X-Client-Platform': 'mobile-native',
      },
      body: JSON.stringify({ email: 'hr@example.com', password: 'Correct123' }),
    });
    expect(mobileRes.status).toBe(200);
    const mobileBody = (await mobileRes.json()) as {
      data: { user: { id: string }; tokens?: { accessToken: string; refreshToken: string } };
    };
    expect(mobileBody.data.tokens?.accessToken).toEqual(expect.any(String));
    expect(mobileBody.data.tokens?.refreshToken).toEqual(expect.any(String));

    const meRes = await fetch(`${base}/auth/me`, {
      headers: {
        Authorization: `Bearer ${mobileBody.data.tokens!.accessToken}`,
        'X-Client-Platform': 'mobile-native',
      },
    });
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as { data: { user: { id: string } } };
    expect(meBody.data.user.id).toBe('hr-1');

    // Revoke by bumping tokenVersion (e.g. after logout or password change)
    db.prisma.user.findUnique.mockResolvedValue(makeUser({ tokenVersion: 1 }));
    const revokedRes = await fetch(`${base}/auth/me`, {
      headers: {
        Authorization: `Bearer ${mobileBody.data.tokens!.accessToken}`,
        'X-Client-Platform': 'mobile-native',
      },
    });
    expect(revokedRes.status).toBe(401);
  });

  it('deduplicates repeated POST /api/jobs with the same Idempotency-Key', async () => {
    const user = makeUser();
    db.prisma.user.findUnique.mockResolvedValue(user);
    const createdJob = {
      id: 'jd-sync-1',
      title: 'Senior Backend Developer',
      description: 'Xây dựng hệ thống API hiệu năng cao',
      requiredSkills: ['Node.js', 'TypeScript'],
      minExperience: 3,
      preferredSkills: [],
      ownerId: user.id,
      createdById: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.prisma.jobDescription.create.mockResolvedValue(createdJob);

    const loginRes = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'CVMikiri',
        'X-Client-Platform': 'mobile-native',
      },
      body: JSON.stringify({ email: 'hr@example.com', password: 'Correct123' }),
    });
    const { data: authData } = (await loginRes.json()) as {
      data: { tokens: { accessToken: string } };
    };

    const payload = {
      title: 'Senior Backend Developer',
      description: 'Xây dựng hệ thống API hiệu năng cao',
      requiredSkills: ['Node.js', 'TypeScript'],
      minExperience: 3,
    };
    const headers = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'CVMikiri',
      Authorization: `Bearer ${authData.tokens.accessToken}`,
      'Idempotency-Key': '11111111-1111-4111-8111-111111111111',
    };

    const first = await fetch(`${base}/jobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    expect(first.status).toBe(201);

    const second = await fetch(`${base}/jobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    expect(second.status).toBe(201);
    expect(db.prisma.jobDescription.create).toHaveBeenCalledTimes(1);
    const secondBody = (await second.json()) as { data: { id: string } };
    expect(secondBody.data.id).toBe('jd-sync-1');
  });

  it('returns 409 CONFLICT when PUT /api/jobs/:id sends an older X-Unmodified-Since', async () => {
    const user = makeUser();
    db.prisma.user.findUnique.mockResolvedValue(user);
    db.prisma.jobDescription.findFirst.mockResolvedValue({
      id: 'jd-1',
      title: 'Existing JD',
      description: 'Updated recently on server',
      requiredSkills: ['React'],
      minExperience: 2,
      ownerId: user.id,
      createdById: user.id,
      createdAt: new Date('2026-11-25T10:00:00.000Z'),
      updatedAt: new Date('2026-11-25T12:00:00.000Z'),
    });

    const loginRes = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'CVMikiri',
        'X-Client-Platform': 'mobile-native',
      },
      body: JSON.stringify({ email: 'hr@example.com', password: 'Correct123' }),
    });
    const { data: authData } = (await loginRes.json()) as {
      data: { tokens: { accessToken: string } };
    };

    const res = await fetch(`${base}/jobs/jd-1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'CVMikiri',
        Authorization: `Bearer ${authData.tokens.accessToken}`,
        'X-Unmodified-Since': '2026-11-25T11:00:00.000Z',
      },
      body: JSON.stringify({
        title: 'Offline edit title',
        description: 'Offline edit description text',
        requiredSkills: ['React'],
        minExperience: 2,
      }),
    });

    expect(res.status).toBe(409);
    const errBody = (await res.json()) as { error: { code: string; message: string } };
    expect(errBody.error.code).toBe('CONFLICT');
    expect(errBody.error.message).toContain('thiết bị khác');
    expect(db.prisma.jobDescription.update).not.toHaveBeenCalled();
  });
});
