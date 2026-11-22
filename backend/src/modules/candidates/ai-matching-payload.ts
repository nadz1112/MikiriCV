import { AppError } from '../../common/errors/app-error.js';
import { skillNormalizer } from '../skills/skill-dictionary.js';
import type { JdAnalysis } from '../evaluation/jd-analyzer.js';
import type { CandidateEvidenceProfile } from '../evaluation/candidate-evidence-extractor.js';
import { analyzeJobDescription } from '../evaluation/jd-analyzer.js';
import { extractCandidateEvidence } from '../evaluation/candidate-evidence-extractor.js';

export interface AiMatchingPayload {
  job: JdAnalysis;
  candidate: CandidateEvidenceProfile;
}

export function redactPiiText(value: string): string {
  return value
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email đã ẩn]')
    .replace(/(?:\+84|0084|0)(?:[ .()-]*\d){9,11}/g, '[số điện thoại đã ẩn]');
}

export function buildAiMatchingPayload(
  job: {
    title: string;
    description: string;
    requiredSkills: string[];
    preferredSkills?: string[];
    minExperience: number;
  },
  candidate: {
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
    fileName?: string | null;
    rawText?: string | null;
    skills: string[];
    yearsOfExperience: number;
  },
): AiMatchingPayload {
  const jdAnalysis = analyzeJobDescription(job);
  const evidence = extractCandidateEvidence(candidate);
  return {
    job: jdAnalysis,
    candidate: evidence,
  };
}

export function assertSafeAiMatchingPayload(payload: AiMatchingPayload): void {
  const serialized = JSON.stringify(payload);

  if (
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(serialized)
    || /(?:\+84|0084|0)(?:[ .()-]*\d){9}/.test(serialized)
  ) {
    throw new AppError(422, 'AI_PAYLOAD_PRIVACY_VIOLATION', 'Không thể gửi dữ liệu đánh giá do phát hiện thông tin nhận dạng ứng viên.');
  }
}

export function buildAiMatchingPrompt(payload: AiMatchingPayload): string {
  return `
=== PHÂN TÍCH JOB DESCRIPTION (JD) ===
${JSON.stringify(payload.job)}

=== PROFILE CHUYÊN MÔN ĐÃ LỌC PII ===
${JSON.stringify(payload.candidate)}
Chỉ đánh giá bằng bằng chứng chuyên môn trong profile. Không sử dụng tên, email, điện thoại, địa chỉ, tuổi, giới tính, ảnh, quê quán hoặc thông tin nhạy cảm.
Không đồng nhất "không tìm thấy" với "không có". Không suy đoán năng lực, vai trò hoặc thành tích chưa có bằng chứng.
Yêu cầu preferred không được biến thành bắt buộc.

Hãy trả về đúng JSON với 6 nhóm:
1 skill_matching (25)
2 experience_relevance (20)
3 project_achievement (20)
4 soft_skills (15)
5 education_certification (10)
6 cv_quality (10)

Mỗi nhóm gồm category, score, maxScore, reason, evidence, gaps, status, confidence.
Evidence chỉ trích dẫn nội dung chuyên môn đã cung cấp trong CV/JD; không viết lại thông tin ngoài dữ liệu.
Trường overall score sẽ do backend tính lại từ scoreBreakdown, không được tự quyết định loại ứng viên.

Kết quả:
{
  "score": 0,
  "matchLevel": "partial_match",
  "summary": "<Tóm tắt bằng tiếng Việt>",
  "matchedSkills": ["<kỹ năng 1>", "<kỹ năng 2>"],
  "missingSkills": ["<kỹ năng còn thiếu 1>", "<kỹ năng còn thiếu 2>"],
  "scoreBreakdown": [],
  "strengths": [],
  "gapsAndConcerns": [],
  "requirementsAnalysis": [],
  "interviewQuestions": [],
  "careerPotential": {"assessment": "insufficient_evidence", "reason": ""},
  "confidence": "medium",
  "limitations": []
}
`;
}
