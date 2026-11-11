import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
  prisma: {
    jobDescription: { findUnique: vi.fn() }, candidate: { findMany: vi.fn() },
    matchResult: { upsert: vi.fn() }, aiUsage: { create: vi.fn() },
  },
}));
vi.mock('../src/config/database.js', () => ({ prisma: mocks.prisma }));
vi.mock('../src/config/gemini.js', () => ({ geminiModel: { generateContent: mocks.generateContent } }));
describe('matching usage history', () => {
  let service: typeof import('../src/services/matching.service.js').matchingService;
  const dto = { jobDescriptionId: 'jd', candidateIds: ['cv'] };
  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-different-32chars';
    process.env.COOKIE_SECURE = 'false';
    ({ matchingService: service } = await import('../src/services/matching.service.js'));
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.jobDescription.findUnique.mockResolvedValue({ id: 'jd', ownerId: 'hr', title: 'JD', description: '', minExperience: 0, requiredSkills: [] });
    mocks.prisma.candidate.findMany.mockResolvedValue([{ id: 'cv', fullName: 'Ứng viên mẫu', rawText: 'Nội dung mẫu', skills: ['React'], yearsOfExperience: 3, extractionStatus: 'SUCCESS' }]);
    mocks.prisma.matchResult.upsert.mockResolvedValue({ id: 'result', score: 75 });
    mocks.prisma.aiUsage.create.mockResolvedValue({});
    mocks.generateContent.mockResolvedValue({ response: { usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20 }, text: () => JSON.stringify({ score: 75, summary: 'Phù hợp', matchedSkills: [], missingSkills: [] }) } });
  });
  it('records every call when the same result is evaluated again', async () => {
    await service.runMatching(dto, 'hr');
    await service.runMatching(dto, 'hr');
    expect(mocks.prisma.aiUsage.create).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.aiUsage.create).toHaveBeenCalledWith({ data: expect.objectContaining({ enterpriseId: 'hr', inputTokens: 100, outputTokens: 20, succeeded: true, day: expect.any(Date) }) });
    expect(mocks.prisma.matchResult.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ inputTokens: 100, outputTokens: 20, updatedAt: expect.any(Date) }) }));
    expect(mocks.prisma.candidate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['cv'] }, ownerId: 'hr' } }));
  });
  it('keeps missing provider token counts nullable', async () => {
    mocks.generateContent.mockResolvedValue({ response: { text: () => JSON.stringify({ score: 75, summary: 'Phù hợp', matchedSkills: [], missingSkills: [] }) } });
    await service.runMatching(dto, 'hr');
    expect(mocks.prisma.aiUsage.create).toHaveBeenCalledWith({ data: expect.objectContaining({ inputTokens: null, outputTokens: null }) });
  });
  it('returns a failure without saving a plausible score when the provider fails', async () => {
    mocks.generateContent.mockRejectedValue(new Error('provider unavailable'));
    await expect(service.runMatching(dto, 'hr')).rejects.toMatchObject({ status: 502, code: 'AI_PROVIDER_ERROR' });
    expect(mocks.prisma.matchResult.upsert).not.toHaveBeenCalled();
    expect(mocks.prisma.aiUsage.create).toHaveBeenCalledWith({ data: expect.objectContaining({ succeeded: false, inputTokens: null, outputTokens: null }) });
  });
  it.each(['invalid json', '{}', '{"score":101,"summary":"x","matchedSkills":[],"missingSkills":[]}'])('rejects invalid AI output and retains known usage: %s', async (text) => {
    mocks.generateContent.mockResolvedValue({ response: { usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20 }, text: () => text } });
    await expect(service.runMatching(dto, 'hr')).rejects.toMatchObject({ status: 502, code: 'AI_INVALID_RESPONSE' });
    expect(mocks.prisma.matchResult.upsert).not.toHaveBeenCalled();
    expect(mocks.prisma.aiUsage.create).toHaveBeenCalledWith({ data: expect.objectContaining({ succeeded: false, inputTokens: 100, outputTokens: 20 }) });
  });

  it('preserves the provider billing error if usage recording also fails', async () => {
    mocks.generateContent.mockRejectedValue({ status: 403, message: 'The Gemini API free tier is not available. Set up billing.' });
    mocks.prisma.aiUsage.create.mockRejectedValue(new Error('usage unavailable'));
    await expect(service.runMatching(dto, 'hr')).rejects.toMatchObject({ code: 'AI_BILLING_REQUIRED', status: 502 });
    expect(mocks.prisma.matchResult.upsert).not.toHaveBeenCalled();
  });

  it('reports failed usage recording after a saved match without pretending scoring failed', async () => {
    mocks.prisma.aiUsage.create.mockRejectedValue(new Error('usage unavailable'));
    await expect(service.runMatching(dto, 'hr')).rejects.toMatchObject({ code: 'AI_USAGE_RECORDING_FAILED', status: 500 });
    expect(mocks.prisma.matchResult.upsert).toHaveBeenCalledTimes(1);
  });
});
