import { AiMatchingResult } from '../types/index.js';

export function sanitizeAndParseGeminiResponse(rawText: string): AiMatchingResult {
  try {
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 0;
    const summary = typeof parsed.summary === 'string' ? parsed.summary : 'Đã hoàn tất đánh giá.';
    const matchedSkills = Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills.map(String) : [];
    const missingSkills = Array.isArray(parsed.missingSkills) ? parsed.missingSkills.map(String) : [];

    return {
      score,
      summary,
      matchedSkills,
      missingSkills,
    };
  } catch (error) {
    console.error('Lỗi khi parse JSON từ Gemini response:', rawText, error);
    return {
      score: 0,
      summary: 'Không thể phân tích dữ liệu tự động do định dạng phản hồi từ AI không đúng cấu trúc.',
      matchedSkills: [],
      missingSkills: [],
    };
  }
}
