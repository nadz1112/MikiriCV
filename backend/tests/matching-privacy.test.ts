import { tokenMocks, setupTokenMocks } from './helpers/token-billing.mock.js';
vi.mock('../src/services/token-billing.service.js', () => tokenMocks);
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    jobDescription: { findFirst: vi.fn() },
    candidate: { findMany: vi.fn() },
    matchResult: { upsert: vi.fn() },
    aiUsage: { create: vi.fn(), update: vi.fn() },
  },
  generateContent: vi.fn(),
}));
vi.mock('../src/config/database.js', () => ({ prisma: mocks.prisma }));
vi.mock('../src/config/gemini.js', () => ({ geminiModel: { generateContent: mocks.generateContent, countTokens: async () => ({ totalTokens: 100 }) } }));
vi.mock('../src/services/subscription.service.js', async (importOriginal) => ({
  ...await importOriginal<object>(),
  reserveAnalyses: vi.fn(async (_id: string, count: number) => ({ name: 'FREE', companyId: 'company-a', reserved: count, monthDate: new Date(), maxPages: 2, maxCharacters: 3000 })),
  refundAnalyses: vi.fn(),
  getUserSubscription: tokenMocks.subscription,
}));
import { matchingService } from '../src/services/matching.service.js';
import { reserveAnalyses, refundAnalyses } from '../src/services/subscription.service.js';

const dto = { jobDescriptionId: 'jd', candidateIds: ['cv'] };
const valid = { score: 80, summary: 'Đánh giá dựa trên kỹ năng và kinh nghiệm đã trích xuất.', matchedSkills: ['React'], missingSkills: [], highlights: ['Kỹ năng React', 'Kinh nghiệm 3 năm', 'Cần xác minh chiều sâu kỹ năng'] };
beforeEach(() => {
  vi.resetAllMocks();
  setupTokenMocks('FREE');
  mocks.prisma.jobDescription.findFirst.mockResolvedValue({ id: 'jd', title: 'Developer', requiredSkills: ['React'], minExperience: 2, description: 'Build applications' });
  mocks.prisma.candidate.findMany.mockResolvedValue([{
    id: 'cv', fullName: 'Private Person', email: 'secret@example.com', phone: '0901234567',
    rawText: 'Private Person, address 123 Secret Street', fileName: 'Private Person.pdf', pageCount: 1,
    skills: ['reactjs', 'secret@example.com', 'Private Person'], yearsOfExperience: 3, extractionStatus: 'SUCCESS',
  }]);
  mocks.generateContent.mockResolvedValue({ response: { text: () => JSON.stringify(valid) } });
  mocks.prisma.matchResult.upsert.mockResolvedValue({ id: 'match', candidateId: 'cv', jobDescriptionId: 'jd', createdAt: new Date(), ...valid });
  mocks.prisma.aiUsage.create.mockResolvedValue({});
});

describe('matching privacy and integrity', () => {
  it('requires the expanded PLUS report and refunds an invalid response', async () => {
    tokenMocks.subscription.mockResolvedValue({ name: 'PLUS', companyId: 'company-a', maxOutputTokens: 8192 });
    vi.mocked(reserveAnalyses).mockResolvedValueOnce({ name: 'PLUS', companyId: 'company-a', reserved: 1, monthDate: new Date(), maxPages: 6, maxCharacters: 12000 } as Awaited<ReturnType<typeof reserveAnalyses>>);
    await expect(matchingService.runMatching(dto, 'owner')).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
    expect(mocks.prisma.matchResult.upsert).not.toHaveBeenCalled();
    expect(refundAnalyses).toHaveBeenCalledWith(expect.objectContaining({ companyId: 'company-a' }), 1);
  });
  it('saves the PLUS report and only refunds unfinished CVs when a bulk call fails', async () => {
    const report = { ...valid, skillAnalysis: ['React: có kỹ năng phù hợp'], redFlags: [], interviewQuestions: ['Giải thích hooks?', 'Tối ưu render thế nào?', 'Kiểm thử component thế nào?'] };
    const candidate = { id: 'cv', skills: ['React'], yearsOfExperience: 3, rawText: 'React', pageCount: 1, extractionStatus: 'SUCCESS' };
    mocks.prisma.candidate.findMany.mockResolvedValue([candidate, { ...candidate, id: 'cv2' }]);
    tokenMocks.subscription.mockResolvedValue({ name: 'PLUS', companyId: 'company-a', maxOutputTokens: 8192 });
    vi.mocked(reserveAnalyses).mockResolvedValueOnce({ name: 'PLUS', companyId: 'company-a', reserved: 2, monthDate: new Date(), maxPages: 6, maxCharacters: 12000 } as Awaited<ReturnType<typeof reserveAnalyses>>);
    mocks.generateContent.mockResolvedValueOnce({ response: { text: () => JSON.stringify(report) } }).mockRejectedValueOnce({ status: 429 });
    await expect(matchingService.runMatching({ ...dto, candidateIds: ['cv', 'cv2'] }, 'owner')).rejects.toMatchObject({ code: 'AI_RATE_LIMIT' });
    expect(mocks.prisma.matchResult.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.matchResult.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ highlights: report.highlights, skillAnalysis: report.skillAnalysis, interviewQuestions: report.interviewQuestions }) }));
    expect(refundAnalyses).toHaveBeenCalledWith(expect.objectContaining({ companyId: 'company-a' }), 1);
  });
  it.each([true, false])('records the company and HR for AI calls, succeeded=%s', async (succeeded) => {
    mocks.prisma.jobDescription.findFirst.mockResolvedValue({ id: 'jd', ownerId: 'owner', owner: { companyId: 'company-a' }, title: 'Developer', requiredSkills: [], minExperience: 0, description: 'Build apps' });
    if (succeeded) await matchingService.runMatching(dto, 'owner');
    else {
      mocks.generateContent.mockRejectedValue({ status: 429 });
      await expect(matchingService.runMatching(dto, 'owner')).rejects.toMatchObject({ code: 'AI_RATE_LIMIT' });
    }
    if (succeeded) expect(tokenMocks.settleTokens).toHaveBeenCalled();
    else expect(tokenMocks.releaseTokens).toHaveBeenCalled();
  });
  it('sends only canonical skills and experience, and scopes every requested ID', async () => {
    await matchingService.runMatching(dto, 'owner');
    const prompt = mocks.generateContent.mock.calls[0][0].contents[0].parts[0].text;
    for (const secret of ['Private Person', 'secret@example.com', '0901234567', 'Secret Street', '.pdf']) {
      expect(prompt).not.toContain(secret);
    }
    expect(prompt).toContain('"skills":["React"]');
    expect(prompt).toContain('"yearsOfExperience":3');
    expect(mocks.prisma.jobDescription.findFirst).toHaveBeenCalledWith({ where: { id: 'jd', ownerId: 'owner' }, include: { owner: { select: { companyId: true } } } });
    expect(mocks.prisma.candidate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['cv'] }, ownerId: 'owner' } }));
  });

  it('redacts PII patterns if they are accidentally present in JD text', async () => {
    mocks.prisma.jobDescription.findFirst.mockResolvedValue({
      id: 'jd',
      title: 'Developer',
      description: 'Liên hệ hr@example.com hoặc 0901234567',
      requiredSkills: ['React'],
      minExperience: 2,
    });
    await matchingService.runMatching(dto, 'owner');
    const prompt = mocks.generateContent.mock.calls[0][0].contents[0].parts[0].text;
    expect(prompt).not.toContain('hr@example.com');
    expect(prompt).not.toContain('0901234567');
    expect(prompt).toContain('[email đã ẩn]');
    expect(prompt).toContain('[số điện thoại đã ẩn]');
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
