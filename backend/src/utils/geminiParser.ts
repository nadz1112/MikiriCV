import { AiMatchingResult, CvTestCategory, CvTestCategoryAssessment } from '../types/index.js';
import { AppError } from '../common/errors/app-error.js';
import { calculateCvTestScore, getMatchLevel } from '../modules/evaluation/score-calculator.js';

const categories: CvTestCategory[] = [
  'skill_matching',
  'experience_relevance',
  'project_achievement',
  'soft_skills',
  'education_certification',
  'cv_quality',
];

function validEvidence(value: unknown): boolean {
  if (!Array.isArray(value)) return true;
  return value.every((item) => item && typeof item === 'object'
    && (item.source === 'CV' || item.source === 'JD')
    && typeof item.section === 'string'
    && typeof item.text === 'string');
}

function parseDetailedResult(parsed: Record<string, unknown>, weights?: Record<string, number>): AiMatchingResult {
  if (!Array.isArray(parsed.scoreBreakdown)) throw new Error('INVALID_AI_RESPONSE');
  const breakdown = parsed.scoreBreakdown as CvTestCategoryAssessment[];
  if (breakdown.length !== 6 || breakdown.some((item) =>
    !item || !categories.includes(item.category)
    || !Number.isInteger(item.score)
    || typeof item.reason !== 'string'
    || !validEvidence(item.evidence)
    || !Array.isArray(item.gaps)
    || !['not_found', 'insufficient_evidence', 'partially_matched', 'matched', 'strongly_matched'].includes(item.status)
    || !['high', 'medium', 'low'].includes(item.confidence)
  )) throw new Error('INVALID_AI_RESPONSE');

  const calculatedScore = calculateCvTestScore(breakdown, weights as Record<CvTestCategory, number> | undefined);
  if (!Array.isArray(parsed.strengths) || !parsed.strengths.every((item) => typeof item === 'string')
    || !Array.isArray(parsed.gapsAndConcerns) || !parsed.gapsAndConcerns.every((item) => typeof item === 'string')
    || !Array.isArray(parsed.interviewQuestions) || !parsed.interviewQuestions.every((item) => typeof item === 'string')
    || !Array.isArray(parsed.limitations) || !parsed.limitations.every((item) => typeof item === 'string')) {
    throw new Error('INVALID_AI_RESPONSE');
  }

  return {
    score: calculatedScore,
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
    matchedSkills: Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills.filter((item): item is string => typeof item === 'string') : [],
    missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills.filter((item): item is string => typeof item === 'string') : [],
    matchLevel: getMatchLevel(calculatedScore),
    scoreBreakdown: breakdown,
    strengths: parsed.strengths,
    gapsAndConcerns: parsed.gapsAndConcerns,
    requirementsAnalysis: Array.isArray(parsed.requirementsAnalysis) ? parsed.requirementsAnalysis as AiMatchingResult['requirementsAnalysis'] : [],
    interviewQuestions: parsed.interviewQuestions,
    careerPotential: parsed.careerPotential as AiMatchingResult['careerPotential'],
    confidence: parsed.confidence as AiMatchingResult['confidence'],
    limitations: parsed.limitations,
  };
}

export function sanitizeAndParseGeminiResponse(rawText: string, weights?: Record<string, number>): AiMatchingResult {
  try {
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const serialized = JSON.stringify(parsed);
    if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(serialized)
      || /(?:\+84|0084|0)(?:[ .()-]*\d){9}/.test(serialized)) {
      throw new Error('AI_RESPONSE_CONTAINED_PII');
    }

    if (Array.isArray(parsed.scoreBreakdown)) {
      return parseDetailedResult(parsed, weights);
    }

    if (!parsed || typeof parsed.score !== 'number' || !Number.isInteger(parsed.score) || parsed.score < 0 || parsed.score > 100
      || typeof parsed.summary !== 'string' || !parsed.summary.trim()
      || !Array.isArray(parsed.matchedSkills) || !parsed.matchedSkills.every((skill: unknown) => typeof skill === 'string')
      || !Array.isArray(parsed.missingSkills) || !parsed.missingSkills.every((skill: unknown) => typeof skill === 'string')) {
      throw new Error('INVALID_AI_RESPONSE');
    }
    const score = parsed.score as number;
    const summary = parsed.summary as string;
    const matchedSkills = parsed.matchedSkills as string[];
    const missingSkills = parsed.missingSkills as string[];

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
