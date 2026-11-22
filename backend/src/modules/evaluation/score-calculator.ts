import { AppError } from '../../common/errors/app-error.js';
import type { CvTestCategory, CvTestCategoryAssessment } from '../../types/index.js';

export const CVTEST_DEFAULT_WEIGHTS: Record<CvTestCategory, number> = {
  skill_matching: 25,
  experience_relevance: 20,
  project_achievement: 20,
  soft_skills: 15,
  education_certification: 10,
  cv_quality: 10,
};

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
