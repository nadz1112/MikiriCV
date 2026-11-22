import { describe, expect, it } from 'vitest';
import { calculateCvTestScore, getMatchLevel } from '../src/modules/evaluation/score-calculator.js';
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

  it('rejects provider output containing PII patterns', () => {
    expect(() => sanitizeAndParseGeminiResponse(JSON.stringify({
      score: 82,
      summary: 'Liên hệ secret@example.com',
      matchedSkills: [],
      missingSkills: [],
    }))).toThrow();
  });
});
