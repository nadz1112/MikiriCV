import { mkdtemp, writeFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  candidateFindUnique: vi.fn(),
  candidateUpdate: vi.fn(),
}));

vi.mock('../src/config/database.js', () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    candidate: {
      findUnique: mocks.candidateFindUnique,
      update: mocks.candidateUpdate,
    },
  },
}));

function buildSamplePdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 40 720 Td (${text}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let d = '%PDF-1.4\n';
  const offsets = [0];
  objs.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(d));
    d += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(d);
  d += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
    + offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
    + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(d, 'ascii');
}

describe('POST /api/candidates/:id/reextract', () => {
  let server: Server;
  let base: string;
  let uploadDir: string;
  let issueTokens: typeof import('../src/services/auth.service.js').issueTokens;

  beforeAll(async () => {
    uploadDir = await mkdtemp(path.join(os.tmpdir(), 'mikiricv-reextract-'));
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-different-32chars';
    process.env.COOKIE_SECURE = 'false';
    process.env.UPLOAD_DIR = uploadDir;
    const { createApp } = await import('../src/app.js');
    ({ issueTokens } = await import('../src/services/auth.service.js'));
    server = createApp().listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  }, 60000);

  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    if (uploadDir) await rm(uploadDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function headers(role: 'ADMIN' | 'ENTERPRISE') {
    const user = { id: 'hr-1', role, tokenVersion: 0, isActive: true, mustChangePassword: false };
    mocks.userFindUnique.mockResolvedValue(user);
    return { Cookie: `accessToken=${issueTokens(user).access}`, 'X-Requested-With': 'CVMikiri' };
  }

  it('re-extracts stored PDF successfully and returns updated candidate detail', async () => {
    const candId = '11111111-1111-4111-8111-111111111111';
    const pdfPath = path.join(uploadDir, 'stored-cv.pdf');
    await writeFile(pdfPath, buildSamplePdf('Nguyen Van An - Email: an@example.com Phone: 0987654321 Experience: 3 years NodeJS'));

    const existing = {
      id: candId,
      ownerId: 'hr-1',
      fullName: 'stored-cv',
      email: null,
      phone: null,
      rawText: '',
      skills: [],
      yearsOfExperience: 0,
      education: null,
      fileName: 'CV_Nguyen_Van_An.pdf',
      fileUrl: pdfPath,
      extractionStatus: 'FAILED',
      extractionMessage: 'failed',
      createdAt: new Date('2026-11-24T00:00:00Z'),
    };
    const updatedDetail = {
      ...existing,
      fullName: 'Nguyen Van An',
      email: 'an@example.com',
      phone: '0987654321',
      rawText: 'Nguyen Van An - Email: an@example.com Phone: 0987654321 Experience: 3 years NodeJS',
      skills: ['Node.js'],
      yearsOfExperience: 3,
      extractionStatus: 'SUCCESS',
      extractionMessage: null,
      matchResults: [],
    };

    mocks.candidateFindUnique
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(updatedDetail);
    mocks.candidateUpdate.mockResolvedValue(updatedDetail);

    const res = await fetch(`${base}/candidates/${candId}/reextract`, { method: 'POST', headers: headers('ENTERPRISE') });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.extractionStatus).toBe('SUCCESS');
    expect(body.data.skills).toEqual(['Node.js']);
    expect(mocks.candidateUpdate).toHaveBeenCalledTimes(1);
  });

  it('returns 409 FILE_NOT_FOUND when original file is missing on disk', async () => {
    const candId = '22222222-2222-4222-8222-222222222222';
    mocks.candidateFindUnique.mockResolvedValueOnce({
      id: candId,
      ownerId: 'hr-1',
      fileName: 'missing.pdf',
      fileUrl: path.join(uploadDir, 'does-not-exist.pdf'),
    });

    const res = await fetch(`${base}/candidates/${candId}/reextract`, { method: 'POST', headers: headers('ENTERPRISE') });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('FILE_NOT_FOUND');
  });

  it('rejects ADMIN with 403 FORBIDDEN', async () => {
    const candId = '33333333-3333-4333-8333-333333333333';
    const res = await fetch(`${base}/candidates/${candId}/reextract`, { method: 'POST', headers: headers('ADMIN') });
    expect(res.status).toBe(403);
  });
});

