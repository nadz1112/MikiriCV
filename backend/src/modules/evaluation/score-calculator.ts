import { AppError } from '../../common/errors/app-error.js';
import type { CvTestCategory, CvTestCategoryAssessment } from '../../types/index.js';

export const CVTEST_CATEGORIES: CvTestCategory[] = [
  'skill_matching',
  'experience_relevance',
  'project_achievement',
  'soft_skills',
  'education_certification',
  'cv_quality',
];

export const CVTEST_DEFAULT_WEIGHTS: Record<CvTestCategory, number> = {
  skill_matching: 25,
  experience_relevance: 20,
  project_achievement: 20,
  soft_skills: 15,
  education_certification: 10,
  cv_quality: 10,
};

/** Resolve custom CVTest weights from a JD config and guarantee they sum to 100. */
export function resolveCvTestWeights(config?: unknown): Record<CvTestCategory, number> {
  if (!config || typeof config !== 'object' || !('weights' in config) || !(config as { weights?: unknown }).weights) {
    return { ...CVTEST_DEFAULT_WEIGHTS };
  }
  const rawWeights = (config as { weights?: Record<string, unknown> }).weights;
  if (!rawWeights || typeof rawWeights !== 'object') {
    throw new AppError(400, 'EVALUATION_CONFIG_INVALID', 'Trọng số đánh giá phải gồm đủ 6 nhóm với tổng bằng 100.');
  }
  const resolved = {} as Record<CvTestCategory, number>;
  let sum = 0;
  for (const category of CVTEST_CATEGORIES) {
    const value = rawWeights[category];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100) {
      throw new AppError(400, 'EVALUATION_CONFIG_INVALID', 'Trọng số đánh giá phải gồm đủ 6 nhóm với tổng bằng 100.');
    }
    resolved[category] = value;
    sum += value;
  }
  if (sum !== 100) {
    throw new AppError(400, 'EVALUATION_CONFIG_INVALID', 'Trọng số đánh giá phải gồm đủ 6 nhóm với tổng bằng 100.');
  }
  return resolved;
}

export function calculateCvTestScore(
  breakdown: CvTestCategoryAssessment[],
  configuredWeights?: Record<CvTestCategory, number>,
): number {
  if (configuredWeights) {
    const sum = Object.values(configuredWeights).reduce((total, weight) => total + weight, 0);
    if (sum !== 100) {
      throw new AppError(400, 'EVALUATION_CONFIG_INVALID', 'Trọng số đánh giá phải có tổng bằng 100.');
    }
  }
  if (breakdown.length !== 6) {
    throw new AppError(502, 'AI_INVALID_RESPONSE', 'Kết quả đánh giá không đủ sáu nhóm tiêu chí.');
  }

  const seen = new Set<CvTestCategory>();
  let total = 0;
  for (const category of breakdown) {
    if (seen.has(category.category)) {
      throw new AppError(502, 'AI_INVALID_RESPONSE', 'Kết quả đánh giá có nhóm tiêu chí trùng lặp.');
    }
    seen.add(category.category);
    const weights = configuredWeights ?? CVTEST_DEFAULT_WEIGHTS;
    const maxScore = weights[category.category];
    if (category.maxScore !== maxScore) {
      throw new AppError(502, 'AI_INVALID_RESPONSE', 'Kết quả đánh giá có trọng số tiêu chí không hợp lệ.');
    }
    if (!Number.isInteger(category.score) || category.score < 0 || category.score > maxScore) {
      throw new AppError(502, 'AI_INVALID_RESPONSE', 'Điểm thành phần đánh giá nằm ngoài phạm vi cho phép.');
    }
    total += category.score;
  }

  if (seen.size !== Object.keys(CVTEST_DEFAULT_WEIGHTS).length) {
    throw new AppError(502, 'AI_INVALID_RESPONSE', 'Thiếu hoặc thừa nhóm tiêu chí đánh giá.');
  }
  return total;
}

export function getMatchLevel(score: number): 'strong_match' | 'good_match' | 'partial_match' | 'low_match' {
  if (score >= 80) return 'strong_match';
  if (score >= 65) return 'good_match';
  if (score >= 50) return 'partial_match';
  return 'low_match';
}
