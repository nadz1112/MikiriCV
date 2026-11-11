import { AiMatchingResult } from '../types/index.js';
import { AppError } from '../common/errors/app-error.js';

export function sanitizeAndParseGeminiResponse(rawText: string): AiMatchingResult {
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

    return {
      score,
      summary,
      matchedSkills,
      missingSkills,
    };
  } catch (error) {
    // Do not log provider output, which can contain sensitive prompt data.
    throw new AppError(502, 'AI_INVALID_RESPONSE', 'Gemini trả về dữ liệu đánh giá không đúng cấu trúc. Chưa lưu điểm cho hồ sơ này; vui lòng thử lại.');
  }
}
