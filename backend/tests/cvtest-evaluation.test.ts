import { describe, expect, it, vi } from 'vitest';
import { calculateCvTestScore, getMatchLevel, resolveCvTestWeights } from '../src/modules/evaluation/score-calculator.js';
import { analyzeJobDescription } from '../src/modules/evaluation/jd-analyzer.js';
import { buildAiMatchingPrompt } from '../src/modules/candidates/ai-matching-payload.js';
import { FieldParser } from '../src/modules/candidates/field-parser.js';
import { isTransientAiError, withRetry } from '../src/utils/retry.js';
import { sanitizeAndParseGeminiResponse } from '../src/utils/geminiParser.js';
import type { CvTestCategoryAssessment } from '../src/types/index.js';

const breakdown: CvTestCategoryAssessment[] = [
  { category: 'skill_matching', score: 23, maxScore: 25, reason: 'Có bằng chứng sử dụng kỹ năng chính.', evidence: [{ source: 'CV', section: 'Projects', text: 'Phát triển REST API bằng Node.js.' }], gaps: [], status: 'matched', confidence: 'high' },
  { category: 'experience_relevance', score: 16, maxScore: 20, reason: 'Kinh nghiệm liên quan nhưng vai trò chưa rõ ở một dự án.', evidence: [], gaps: ['Vai trò cá nhân'], status: 'partially_matched', confidence: 'medium' },
  { category: 'project_achievement', score: 18, maxScore: 20, reason: 'Có mô tả dự án và đóng góp cá nhân.', evidence: [], gaps: [], status: 'matched', confidence: 'high' },
  { category: 'soft_skills', score: 12, maxScore: 15, reason: 'Có bằng chứng làm việc nhóm.', evidence: [], gaps: [], status: 'matched', confidence: 'medium' },
  { category: 'education_certification', score: 7, maxScore: 10, reason: 'Học vấn phù hợp với vị trí.', evidence: [], gaps: ['Chứng chỉ chuyên môn'], status: 'partially_matched', confidence: 'medium' },
  { category: 'cv_quality', score: 6, maxScore: 10, reason: 'Cấu trúc rõ ràng và dễ đọc.', evidence: [], gaps: [], status: 'matched', confidence: 'high' },
];

describe('CVTest evaluation structure', () => {
  it('calculates total score only from six category scores', () => {
    expect(calculateCvTestScore(breakdown)).toBe(82);
    expect(getMatchLevel(82)).toBe('strong_match');
  });

  it('accepts a detailed provider result and preserves evidence data', () => {
    const response = {
      score: 999,
      summary: 'Ứng viên có bằng chứng phù hợp.',
      matchedSkills: ['Node.js'],
      missingSkills: ['Docker'],
      scoreBreakdown: breakdown,
      strengths: ['Có kinh nghiệm REST API'],
      gapsAndConcerns: ['Cần xác minh vai trò cá nhân'],
      requirementsAnalysis: [],
      interviewQuestions: ['Bạn trực tiếp phụ trách module nào?'],
      careerPotential: { assessment: 'insufficient_evidence', reason: 'Chưa đủ bằng chứng.' },
      confidence: 'medium',
      limitations: ['CV chưa nêu kết quả định lượng'],
    };
    const result = sanitizeAndParseGeminiResponse(JSON.stringify(response));
    expect(result.score).toBe(82);
    expect(result.matchLevel).toBe('strong_match');
    expect(result.scoreBreakdown?.[0].evidence[0].section).toBe('Projects');
  });

  it('preserves custom weights alongside FREE and PLUS plan gating', () => {
    const customWeights = {
      skill_matching: 40,
      experience_relevance: 20,
      project_achievement: 15,
      soft_skills: 10,
      education_certification: 10,
      cv_quality: 5,
    };
    const customBreakdown: CvTestCategoryAssessment[] = [
      { category: 'skill_matching', score: 36, maxScore: 40, reason: 'Kỹ năng tốt.', evidence: [], gaps: [], status: 'matched', confidence: 'high' },
      { category: 'experience_relevance', score: 18, maxScore: 20, reason: 'Kinh nghiệm phù hợp.', evidence: [], gaps: [], status: 'matched', confidence: 'high' },
      { category: 'project_achievement', score: 12, maxScore: 15, reason: 'Dự án tốt.', evidence: [], gaps: [], status: 'matched', confidence: 'medium' },
      { category: 'soft_skills', score: 8, maxScore: 10, reason: 'Giao tiếp tốt.', evidence: [], gaps: [], status: 'matched', confidence: 'medium' },
      { category: 'education_certification', score: 8, maxScore: 10, reason: 'Bằng cấp phù hợp.', evidence: [], gaps: [], status: 'matched', confidence: 'medium' },
      { category: 'cv_quality', score: 4, maxScore: 5, reason: 'Trình bày rõ.', evidence: [], gaps: [], status: 'matched', confidence: 'high' },
    ];
    const response = {
      score: 10,
      summary: 'Đánh giá theo trọng số tùy chỉnh.',
      matchedSkills: ['Node.js'],
      missingSkills: [],
      scoreBreakdown: customBreakdown,
      strengths: ['Mạnh backend'],
      gapsAndConcerns: ['Cần hỏi thêm về Docker'],
      requirementsAnalysis: [],
      interviewQuestions: ['Câu hỏi 1?', 'Câu hỏi 2?', 'Câu hỏi 3?'],
      careerPotential: { assessment: 'positive_evidence', reason: 'Phát triển tốt.' },
      confidence: 'high',
      limitations: [],
    };

    const plusResult = sanitizeAndParseGeminiResponse(JSON.stringify(response), { weights: customWeights, plan: 'PLUS' });
    expect(plusResult.score).toBe(86);
    expect(plusResult.interviewQuestions).toHaveLength(3);
    expect(plusResult.skillAnalysis?.length).toBeGreaterThan(0);
    expect(plusResult.redFlags).toEqual(['Cần hỏi thêm về Docker']);

    const freeResult = sanitizeAndParseGeminiResponse(JSON.stringify(response), { weights: customWeights, plan: 'FREE' });
    expect(freeResult.score).toBe(86);
    expect(freeResult.highlights).toEqual(['Mạnh backend']);
    expect(freeResult.interviewQuestions).toEqual([]);
    expect(freeResult.skillAnalysis).toEqual([]);
    expect(freeResult.redFlags).toEqual([]);
  });

  it('rejects provider output containing PII patterns', () => {
    expect(() => sanitizeAndParseGeminiResponse(JSON.stringify({
      score: 82,
      summary: 'Liên hệ secret@example.com',
      matchedSkills: [],
      missingSkills: [],
    }))).toThrow();
  });

  it('distinguishes senior from lead in JD level analysis', () => {
    const seniorJd = analyzeJobDescription({
      title: 'Senior Backend Developer',
      description: 'Xây dựng hệ thống backend Node.js chịu tải cao và tối ưu truy vấn.',
      requiredSkills: ['Node.js'],
      minExperience: 4,
    });
    const leadJd = analyzeJobDescription({
      title: 'Tech Lead Backend',
      description: 'Dẫn dắt đội ngũ kỹ sư và thiết kế kiến trúc hệ thống.',
      requiredSkills: ['Node.js'],
      minExperience: 6,
    });
    expect(seniorJd.level).toBe('senior');
    expect(leadJd.level).toBe('lead');
  });

  it('validates custom weights and injects them into prompt inside cv_profile', () => {
    const weights = resolveCvTestWeights({
      weights: {
        skill_matching: 35,
        experience_relevance: 25,
        project_achievement: 20,
        soft_skills: 10,
        education_certification: 5,
        cv_quality: 5,
      },
    });
    expect(weights.skill_matching).toBe(35);
    expect(() => resolveCvTestWeights({
      weights: {
        skill_matching: 50,
        experience_relevance: 20,
        project_achievement: 20,
        soft_skills: 15,
        education_certification: 10,
        cv_quality: 10,
      },
    })).toThrow();

    const prompt = buildAiMatchingPrompt({
      job: analyzeJobDescription({
        title: 'Senior Backend',
        description: 'Phát triển REST API bằng Node.js và PostgreSQL.',
        requiredSkills: ['Node.js'],
        minExperience: 3,
      }),
      candidate: {
        skills: ['Node.js'],
        yearsOfExperience: 3,
        experienceEvidence: [],
        projectEvidence: [],
        softSkillEvidence: [],
        educationEvidence: [],
        cvQuality: { hasSections: true, hasDates: true, hasConsistentStructure: false },
        limitations: [],
      },
    }, weights);
    expect(prompt).toContain('<cv_profile>');
    expect(prompt).toContain('1 skill_matching (35)');
  });

  it('retries transient AI errors but fails fast on configuration errors', async () => {
    const transientFn = vi.fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValueOnce('ok');
    const res = await withRetry(transientFn, { retries: 2, baseMs: 0, shouldRetry: isTransientAiError });
    expect(res).toBe('ok');
    expect(transientFn).toHaveBeenCalledTimes(2);

    const authFn = vi.fn().mockRejectedValue({ status: 401 });
    await expect(withRetry(authFn, { retries: 2, baseMs: 0, shouldRetry: isTransientAiError })).rejects.toMatchObject({ status: 401 });
    expect(authFn).toHaveBeenCalledTimes(1);
  });

  it('extracts candidate education line when present', () => {
    const parser = new FieldParser();
    const parsed = parser.parse('Nguyễn Văn A\nĐại học Bách Khoa Hà Nội - Kỹ sư CNTT\nKinh nghiệm 3 năm React', 'CV_Nguyen_Van_A.pdf');
    expect(parsed.education).toContain('Đại học Bách Khoa');
  });
});
