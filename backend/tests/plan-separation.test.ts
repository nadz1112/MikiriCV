import { tokenMocks, setupTokenMocks } from './helpers/token-billing.mock.js';
vi.mock('../src/services/token-billing.service.js', () => tokenMocks);
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    servicePlan: { findUniqueOrThrow: vi.fn(async ({ where }) => ({ name: where.name, tokenLimit: 100000, cycleDays: 30, maxCvPerCall: where.name === 'FREE' ? 1 : 200, maxOutputTokens: 8192 })) },
    jobDescription: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    candidate: { update: vi.fn() },
    matchResult: { upsert: vi.fn() },
    aiUsage: { create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../src/config/database.js', () => ({ prisma: mocks.prisma }));
vi.mock('../src/config/gemini.js', () => ({
  geminiModel: { generateContent: vi.fn() },
  geminiFreeModel: { generateContent: vi.fn() },
}));

import { evaluateCandidateWithAi } from '../src/modules/matching/evaluate-candidate.js';
import { toMatchResultDto } from '../src/modules/candidates/candidate.mapper.js';
import { jobService } from '../src/services/job.service.js';
import type { AIMatchingProvider } from '../src/modules/matching/ai-matching-provider.js';

const job = {
  id: 'jd-1',
  ownerId: 'hr-1',
  title: 'Backend Node.js Developer',
  description: 'Phát triển REST API bằng Node.js và PostgreSQL.',
  requiredSkills: ['Node.js', 'PostgreSQL'],
  minExperience: 2,
  evaluationConfig: {
    weights: {
      skill_matching: 40,
      experience_relevance: 20,
      project_achievement: 15,
      soft_skills: 10,
      education_certification: 10,
      cv_quality: 5,
    },
  },
};

const candidate = {
  id: 'cv-1',
  fullName: 'Nguyễn Văn An',
  email: 'an@example.com',
  phone: '0987654321',
  fileName: 'CV_An.pdf',
  rawText: 'Kinh nghiệm 3 năm Node.js, PostgreSQL, REST API.',
  skills: ['Node.js', 'PostgreSQL'],
  yearsOfExperience: 3,
  extractionStatus: 'SUCCESS',
};

beforeEach(() => {
  vi.clearAllMocks();
  setupTokenMocks();
  mocks.prisma.user.findUnique.mockResolvedValue({ company: { id: 'company-1', plan: 'FREE', billingCycle: 'MONTHLY' } });
  mocks.prisma.jobDescription.update.mockResolvedValue({});
  mocks.prisma.candidate.update.mockResolvedValue({});
  mocks.prisma.aiUsage.create.mockResolvedValue({});
  mocks.prisma.matchResult.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
    id: 'match-1',
    createdAt: new Date('2026-11-25T00:00:00Z'),
    ...create,
  }));
});

describe('FREE vs PLUS plan separation', () => {
  it('runs FREE mode with compact prompt/schema, 3 highlights, and zero deep PLUS fields', async () => {
    const provider: AIMatchingProvider = {
      modelName: 'gemini-3.6-flash',
      promptVersion: 'cvtest-1.0',
      countInputTokens: vi.fn().mockResolvedValue(100),
      generateEvaluation: vi.fn().mockResolvedValue({
        rawText: JSON.stringify({
          score: 82,
          summary: 'Ứng viên phù hợp vị trí Backend Node.js.',
          matchedSkills: ['Node.js', 'PostgreSQL'],
          missingSkills: [],
          highlights: [
            '3 năm kinh nghiệm Node.js và PostgreSQL',
            'Thành thạo phát triển REST API',
            'Đáp ứng đầy đủ kỹ năng cốt lõi',
          ],
        }),
        inputTokens: 120,
        outputTokens: 60,
      }),
    };

    const result = await evaluateCandidateWithAi(job, candidate, provider, 'hr-1', 'FREE', 'company-1');

    expect(provider.generateEvaluation).toHaveBeenCalledWith(
      expect.stringContaining('ĐÁNH GIÁ CƠ BẢN (Gói FREE)'),
      'FREE', 8192,
    );
    expect(mocks.prisma.matchResult.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        promptVersion: 'free-1.0',
        scoreBreakdown: Prisma.DbNull,
        requirementsAnalysis: Prisma.DbNull,
        careerPotential: Prisma.DbNull,
        skillAnalysis: [],
        redFlags: [],
        interviewQuestions: [],
      }),
    }));
    expect(result.score).toBe(82);
    expect(result.highlights).toHaveLength(3);
    expect(result.skillAnalysis).toEqual([]);
    expect(result.redFlags).toEqual([]);
    expect(result.interviewQuestions).toEqual([]);
    expect(result.scoreBreakdown).toBeUndefined();
    expect(result.requirementsAnalysis).toBeUndefined();
    expect(result.careerPotential).toBeUndefined();
  });

  it('runs PLUS mode with full CVTest prompt, custom weights, and deep report fields', async () => {
    const provider: AIMatchingProvider = {
      modelName: 'gemini-3.6-flash',
      promptVersion: 'cvtest-1.0',
      countInputTokens: vi.fn().mockResolvedValue(100),
      generateEvaluation: vi.fn().mockResolvedValue({
        rawText: JSON.stringify({
          score: 10,
          summary: 'Đánh giá chuyên sâu gói PLUS.',
          matchedSkills: ['Node.js'],
          missingSkills: ['Docker'],
          highlights: ['Mạnh Node.js', 'REST API thực chiến', 'Cần xác minh Docker'],
          skillAnalysis: ['Node.js: đáp ứng tốt'],
          redFlags: ['Chưa thấy kinh nghiệm Docker'],
          scoreBreakdown: [
            { category: 'skill_matching', score: 36, maxScore: 40, reason: 'Kỹ năng tốt.', evidence: [], gaps: [], status: 'matched', confidence: 'high' },
            { category: 'experience_relevance', score: 18, maxScore: 20, reason: 'Đúng định hướng.', evidence: [], gaps: [], status: 'matched', confidence: 'high' },
            { category: 'project_achievement', score: 12, maxScore: 15, reason: 'Dự án rõ ràng.', evidence: [], gaps: [], status: 'matched', confidence: 'medium' },
            { category: 'soft_skills', score: 8, maxScore: 10, reason: 'Hợp tác tốt.', evidence: [], gaps: [], status: 'matched', confidence: 'medium' },
            { category: 'education_certification', score: 8, maxScore: 10, reason: 'Đạt chuẩn.', evidence: [], gaps: [], status: 'matched', confidence: 'medium' },
            { category: 'cv_quality', score: 4, maxScore: 5, reason: 'Mạch lạc.', evidence: [], gaps: [], status: 'matched', confidence: 'high' },
          ],
          strengths: ['Mạnh Node.js'],
          gapsAndConcerns: ['Chưa thấy kinh nghiệm Docker'],
          requirementsAnalysis: [{ requirement: 'Docker', priority: 'preferred', status: 'not_found', evidence: [], gap: 'Chưa thấy Docker' }],
          interviewQuestions: ['Q1?', 'Q2?', 'Q3?'],
          careerPotential: { assessment: 'positive_evidence', reason: 'Tiến bộ tốt.' },
          confidence: 'high',
          limitations: [],
        }),
        inputTokens: 420,
        outputTokens: 210,
      }),
    };

    mocks.prisma.user.findUnique.mockResolvedValue({ company: { id: 'company-1', plan: 'PLUS', billingCycle: 'MONTHLY' } });
    const result = await evaluateCandidateWithAi(job, candidate, provider, 'hr-1', 'PLUS', 'company-1');

    expect(provider.generateEvaluation).toHaveBeenCalledWith(
      expect.stringContaining('1 skill_matching (40)'),
      'PLUS', 8192,
    );
    expect(result.score).toBe(86);
    expect(result.scoreBreakdown).toHaveLength(6);
    expect(result.skillAnalysis).toEqual(['Node.js: đáp ứng tốt']);
    expect(result.redFlags).toEqual(['Chưa thấy kinh nghiệm Docker']);
    expect(result.interviewQuestions).toEqual(['Q1?', 'Q2?', 'Q3?']);
  });

  it('strips deep PLUS fields when mapping a stored result for FREE users', () => {
    const dto = toMatchResultDto({
      id: 'm-1',
      candidateId: 'cv-1',
      jobDescriptionId: 'jd-1',
      score: 88,
      summary: 'Phù hợp',
      matchedSkills: ['Node.js'],
      missingSkills: [],
      highlights: ['A', 'B', 'C', 'D'],
      skillAnalysis: ['Deep skill'],
      redFlags: ['Deep flag'],
      interviewQuestions: ['Q1'],
      scoreBreakdown: [{ category: 'skill_matching' }],
      requirementsAnalysis: [{ requirement: 'Node.js' }],
      careerPotential: { assessment: 'positive_evidence', reason: 'Tốt' },
      createdAt: new Date('2026-11-25T00:00:00Z'),
    }, 'FREE');

    expect(dto.highlights).toEqual(['A', 'B', 'C']);
    expect(dto.skillAnalysis).toEqual([]);
    expect(dto.redFlags).toEqual([]);
    expect(dto.interviewQuestions).toEqual([]);
    expect(dto.scoreBreakdown).toBeUndefined();
    expect(dto.requirementsAnalysis).toBeUndefined();
    expect(dto.careerPotential).toBeUndefined();
  });

  it('blocks custom JD weights for FREE plan while allowing default weights and PLUS plan', async () => {
    const hrUser = { id: 'hr-1', role: 'ENTERPRISE' as const, tokenVersion: 0, mustChangePassword: false };

    mocks.prisma.user.findUnique.mockResolvedValue({
      company: { id: 'co-1', plan: 'FREE', billingCycle: 'MONTHLY', monthlyUsed: 0, quotaMonth: null },
    });

    await expect(
      jobService.createJob({
        title: 'Backend Developer',
        description: 'Build backend Node.js microservices',
        requiredSkills: ['Node.js'],
        minExperience: 2,
        evaluationConfig: job.evaluationConfig,
      }, hrUser),
    ).rejects.toMatchObject({ status: 403, code: 'PLUS_REQUIRED' });
    expect(mocks.prisma.jobDescription.create).not.toHaveBeenCalled();

    mocks.prisma.jobDescription.create.mockResolvedValue({ id: 'jd-free' });
    await jobService.createJob({
      title: 'Backend Developer',
      description: 'Build backend Node.js microservices',
      requiredSkills: ['Node.js'],
      minExperience: 2,
    }, hrUser);
    expect(mocks.prisma.jobDescription.create).toHaveBeenCalledTimes(1);

    mocks.prisma.user.findUnique.mockResolvedValue({
      company: { id: 'co-1', plan: 'PLUS', billingCycle: 'MONTHLY', monthlyUsed: 0, quotaMonth: null },
    });
    await jobService.createJob({
      title: 'Backend Developer',
      description: 'Build backend Node.js microservices',
      requiredSkills: ['Node.js'],
      minExperience: 2,
      evaluationConfig: job.evaluationConfig,
    }, hrUser);
    expect(mocks.prisma.jobDescription.create).toHaveBeenCalledTimes(2);
  });
});
