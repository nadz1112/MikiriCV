import { redactPiiText } from '../candidates/ai-matching-payload.js';
import { skillNormalizer } from '../skills/skill-dictionary.js';

export interface CandidateEvidenceProfile {
  skills: string[];
  yearsOfExperience: number;
  experienceEvidence: string[];
  projectEvidence: string[];
  softSkillEvidence: string[];
  educationEvidence: string[];
  cvQuality: {
    hasSections: boolean;
    hasDates: boolean;
    hasConsistentStructure: boolean;
  };
  limitations: string[];
}

function sanitizeCandidateText(text: string, pii: { fullName?: string | null; email?: string | null; phone?: string | null; fileName?: string | null }): string {
  let safe = redactPiiText(text);
  for (const value of [pii.fullName, pii.email, pii.phone, pii.fileName]) {
    if (value?.trim()) {
      const escaped = value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      safe = safe.replace(new RegExp(escaped, 'gi'), '[đã ẩn]');
    }
  }
  return safe
    .replace(/\b(?:quận|phường|địa chỉ)[^\n]{0,100}/gi, '[địa chỉ đã ẩn]')
    .replace(/\b(?:nam|nữ)\b/gi, '[giới tính đã ẩn]')
    .replace(/\b(?:tuổi|age)\b\s*\d{1,3}/gi, '[tuổi đã ẩn]');
}

export function extractCandidateEvidence(
  candidate: {
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
    fileName?: string | null;
    rawText?: string | null;
    skills: string[];
    yearsOfExperience: number;
  },
): CandidateEvidenceProfile {
  const safeText = sanitizeCandidateText(candidate.rawText ?? '', {
    fullName: candidate.fullName,
    email: candidate.email,
    phone: candidate.phone,
    fileName: candidate.fileName,
  });
  const lines = safeText.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length >= 15);
  const projectEvidence = lines.filter((line) => /(project|dự án|ứng dụng|hệ thống|api|rest|database|cơ sở dữ liệu)/i.test(line)).slice(0, 20);
  const experienceEvidence = lines.filter((line) => /(experience|kinh nghiệm|làm việc|phụ trách|phát triển|triển khai|vận hành)/i.test(line)).slice(0, 20);
  const softSkillEvidence = lines.filter((line) => /(giao tiếp|communication|teamwork|làm việc nhóm|problem solving|giải quyết vấn đề|leadership|lãnh đạo|tự học|adaptability)/i.test(line)).slice(0, 12);
  const educationEvidence = lines.filter((line) => /(học|trường|đại học|cao đẳng|chứng chỉ|ielts|toeic|bằng)/i.test(line)).slice(0, 12);
  const lower = safeText.toLowerCase();

  return {
    skills: [...new Set(candidate.skills.map((skill) => skillNormalizer.normalize(skill)).filter((skill): skill is string => Boolean(skill)))],
    yearsOfExperience: Math.max(0, Math.min(30, Math.floor(candidate.yearsOfExperience || 0))),
    experienceEvidence,
    projectEvidence,
    softSkillEvidence,
    educationEvidence,
    cvQuality: {
      hasSections: /(kinh nghiệm|dự án|học vấn|kỹ năng)/i.test(safeText),
      hasDates: /\b(?:20\d{2}|19\d{2})\b/.test(safeText),
      hasConsistentStructure: lines.length >= 8,
    },
    limitations: lower.includes('[địa chỉ đã ẩn]') || lower.includes('[tuổi đã ẩn]') || lower.includes('[giới tính đã ẩn]')
      ? ['Thông tin nhạy cảm đã được loại khỏi dữ liệu đánh giá.']
      : [],
  };
}
