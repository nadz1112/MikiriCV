import { AiMatchingResult } from '../types/index.js';
import { AppError } from '../common/errors/app-error.js';

export function sanitizeAndParseGeminiResponse(rawText: string, plan?: 'FREE' | 'PLUS'): AiMatchingResult {
  try {
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    if (!parsed || !Number.isInteger(parsed.score) || parsed.score < 0 || parsed.score > 100
      || typeof parsed.summary !== 'string' || !parsed.summary.trim()
      || !Array.isArray(parsed.matchedSkills) || !parsed.matchedSkills.every((skill: unknown) => typeof skill === 'string')
      || !Array.isArray(parsed.missingSkills) || !parsed.missingSkills.every((skill: unknown) => typeof skill === 'string')) {
      throw new Error('INVALID_AI_RESPONSE');
    }
    const { score, summary, matchedSkills, missingSkills } = parsed;
    const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0);
    if (plan && (!strings(parsed.highlights) || parsed.highlights.length !== 3)) throw new Error('MISSING_HIGHLIGHTS');
    if (plan === 'PLUS' && (!strings(parsed.skillAnalysis) || !parsed.skillAnalysis.length || !strings(parsed.redFlags) || !strings(parsed.interviewQuestions) || parsed.interviewQuestions.length < 3)) throw new Error('MISSING_PLUS_REPORT');

    return {
      score,
      summary,
      matchedSkills,
      missingSkills,
      highlights: strings(parsed.highlights) ? parsed.highlights : [],
      skillAnalysis: plan === 'PLUS' ? parsed.skillAnalysis : [],
      redFlags: plan === 'PLUS' ? parsed.redFlags : [],
      interviewQuestions: plan === 'PLUS' ? parsed.interviewQuestions : [],
    };
  } catch (error) {
    // Do not log provider output, which can contain sensitive prompt data.
    throw new AppError(502, 'AI_INVALID_RESPONSE', 'Gemini trả về dữ liệu đánh giá không đúng cấu trúc. Chưa lưu điểm cho hồ sơ này; vui lòng thử lại.');
  }
}
