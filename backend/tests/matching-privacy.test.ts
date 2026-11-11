import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    jobDescription: { findFirst: vi.fn() },
    candidate: { findMany: vi.fn() },
    matchResult: { upsert: vi.fn() },
  },
  generateContent: vi.fn(),
}));
vi.mock('../src/config/database.js', () => ({ prisma: mocks.prisma }));
vi.mock('../src/config/gemini.js', () => ({ geminiModel: { generateContent: mocks.generateContent } }));
import { matchingService } from '../src/services/matching.service.js';

const dto = { jobDescriptionId: 'jd', candidateIds: ['cv'] };
const valid = { score: 80, summary: 'Đánh giá dựa trên kỹ năng và kinh nghiệm đã trích xuất.', matchedSkills: ['React'], missingSkills: [] };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.prisma.jobDescription.findFirst.mockResolvedValue({ id: 'jd', title: 'Developer', requiredSkills: ['React'], minExperience: 2, description: 'Build applications' });
  mocks.prisma.candidate.findMany.mockResolvedValue([{
    id: 'cv', fullName: 'Private Person', email: 'secret@example.com', phone: '0901234567',
    rawText: 'Private Person, address 123 Secret Street', fileName: 'Private Person.pdf',
    skills: ['reactjs', 'secret@example.com', 'Private Person'], yearsOfExperience: 3, extractionStatus: 'SUCCESS',
  }]);
  mocks.generateContent.mockResolvedValue({ response: { text: () => JSON.stringify(valid) } });
  mocks.prisma.matchResult.upsert.mockResolvedValue({ id: 'match', ...valid });
});

describe('matching privacy and integrity', () => {
  it('sends only canonical skills and experience, and scopes every requested ID', async () => {
    await matchingService.runMatching(dto, 'owner');
    const prompt = mocks.generateContent.mock.calls[0][0];
    for (const secret of ['Private Person', 'secret@example.com', '0901234567', 'Secret Street', '.pdf']) {
      expect(prompt).not.toContain(secret);
    }
    expect(prompt).toContain('"skills":["React"]');
    expect(prompt).toContain('"yearsOfExperience":3');
    expect(mocks.prisma.jobDescription.findFirst).toHaveBeenCalledWith({ where: { id: 'jd', ownerId: 'owner' } });
    expect(mocks.prisma.candidate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['cv'] }, ownerId: 'owner' } }));
  });

  it('rejects deleted or foreign IDs before calling the provider', async () => {
    mocks.prisma.candidate.findMany.mockResolvedValue([]);
    await expect(matchingService.runMatching(dto, 'owner')).rejects.toMatchObject({ code: 'CANDIDATE_NOT_FOUND' });
    expect(mocks.generateContent).not.toHaveBeenCalled();
  });

  it.each(['not json', '{}', JSON.stringify({ ...valid, score: 101 }), JSON.stringify({ ...valid, matchedSkills: [12] })])('rejects malformed provider output without saving a plausible score: %s', async (response) => {
    mocks.generateContent.mockResolvedValue({ response: { text: () => response } });
    await expect(matchingService.runMatching(dto, 'owner')).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
    expect(mocks.prisma.matchResult.upsert).not.toHaveBeenCalled();
  });

  it('keeps provider failures visible', async () => {
    mocks.generateContent.mockRejectedValue({ status: 429 });
    await expect(matchingService.runMatching(dto, 'owner')).rejects.toMatchObject({ code: 'AI_RATE_LIMIT', status: 429 });
    expect(mocks.prisma.matchResult.upsert).not.toHaveBeenCalled();
  });

  it('reports Gemini billing restrictions clearly instead of a generic provider failure', async () => {
    mocks.generateContent.mockRejectedValue({ status: 403, message: 'The Gemini API free tier is not available for this project. Please set up billing to upgrade to the paid tier.' });
    await expect(matchingService.runMatching(dto, 'owner')).rejects.toMatchObject({ code: 'AI_BILLING_REQUIRED', status: 502 });
    expect(mocks.prisma.matchResult.upsert).not.toHaveBeenCalled();
  });

  it('does not mislabel a database failure as an AI provider failure', async () => {
    const failure = Object.assign(new Error('Database unavailable'), { code: 'P1001' });
    mocks.prisma.matchResult.upsert.mockRejectedValue(failure);
    await expect(matchingService.runMatching(dto, 'owner')).rejects.toBe(failure);
  });

  it('reports deletion during AI scoring as a data change', async () => {
    mocks.prisma.matchResult.upsert.mockRejectedValue({ code: 'P2003' });
    await expect(matchingService.runMatching(dto, 'owner')).rejects.toMatchObject({ code: 'MATCHING_DATA_CHANGED', status: 409 });
  });
});
