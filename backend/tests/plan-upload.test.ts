import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ subscription: vi.fn(), extract: vi.fn(), readFile: vi.fn(), unlink: vi.fn(), rename: vi.fn(), findIdempotency: vi.fn(), createIdempotency: vi.fn(), finishIdempotency: vi.fn(), create: vi.fn() }));
vi.mock('fs/promises', () => ({ default: { readFile: mocks.readFile, unlink: mocks.unlink, rename: mocks.rename } }));
vi.mock('../src/services/subscription.service.js', async (importOriginal) => ({ ...await importOriginal<object>(), getUserSubscription: mocks.subscription }));
vi.mock('../src/modules/candidates/text-extractor.js', () => ({ ExtractorFactory: { create: () => ({ extractDocument: mocks.extract }) } }));
vi.mock('../src/modules/candidates/candidate.repository.js', async (importOriginal) => ({
  ...await importOriginal<object>(),
  CandidateRepository: class { findIdempotency = mocks.findIdempotency; createIdempotency = mocks.createIdempotency; finishIdempotency = mocks.finishIdempotency; create = mocks.create; },
}));
import { candidateService } from '../src/services/candidate.service.js';
const file = { originalname: 'cv.pdf', path: 'temp-cv.pdf', mimetype: 'application/pdf', size: 20 } as Express.Multer.File;
const user = { id: 'hr', role: 'ENTERPRISE' as const, tokenVersion: 0, mustChangePassword: false };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.subscription.mockResolvedValue({ name: 'FREE', bulk: false, maxPages: 2, maxCharacters: 3000 });
  mocks.readFile.mockResolvedValue(Buffer.from('%PDF-sample'));
  mocks.unlink.mockResolvedValue(undefined);
  mocks.rename.mockResolvedValue(undefined);
  mocks.findIdempotency.mockResolvedValue(null);
  mocks.createIdempotency.mockResolvedValue({});
});
it('blocks FREE bulk before processing and removes all temporary files', async () => {
  await expect(candidateService.upload([file, { ...file, path: 'second.pdf' }], 'key', user)).rejects.toMatchObject({ code: 'PLUS_REQUIRED' });
  expect(mocks.unlink).toHaveBeenCalledWith('temp-cv.pdf');
  expect(mocks.unlink).toHaveBeenCalledWith('second.pdf');
  expect(mocks.extract).not.toHaveBeenCalled();
});
it.each([{ text: 'a'.repeat(3001), pageCount: 1 }, { text: 'React experience', pageCount: 3 }])('rejects oversized FREE documents after extraction', async (document) => {
  mocks.extract.mockResolvedValue(document);
  const result = await candidateService.upload([file], 'key', user);
  expect(result).toMatchObject({ status: 422, body: { errors: [{ code: 'PLAN_DOCUMENT_LIMIT' }] } });
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.unlink).toHaveBeenCalledWith(expect.stringContaining('cv.pdf'));
});
