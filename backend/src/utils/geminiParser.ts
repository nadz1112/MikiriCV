import { AiMatchingResult } from '../types/index.js';
import { z } from 'zod';

const matchingResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  summary: z.string().min(1),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
});

export function sanitizeAndParseGeminiResponse(rawText: string): AiMatchingResult {
  try {
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed: unknown = JSON.parse(cleaned);
    return matchingResultSchema.parse(parsed);
  } catch {
    throw new Error('Phản hồi AI không đúng cấu trúc yêu cầu');
  }
}
