import { prisma } from '../config/database.js';
import { geminiModel } from '../config/gemini.js';
import { RunMatchingDto } from '../types/index.js';
import { sanitizeAndParseGeminiResponse } from '../utils/geminiParser.js';
import { AppError } from '../common/errors/app-error.js';

const safeCandidateSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  skills: true,
  yearsOfExperience: true,
  education: true,
  fileName: true,
  extractionStatus: true,
  extractionMessage: true,
  createdAt: true,
} as const;

export class MatchingService {
  async runMatching(dto: RunMatchingDto, ownerId?: string) {
    const { jobDescriptionId, candidateIds } = dto;

    const jobWhere = { id: jobDescriptionId, ...(ownerId ? { ownerId } : {}) };
    const job =
      typeof prisma.jobDescription.findFirst === 'function'
        ? await prisma.jobDescription.findFirst({ where: jobWhere })
        : await (prisma.jobDescription.findUnique as any)({ where: jobWhere });

    if (!job) {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Không tìm thấy Job Description');
    }

    const candidates = await prisma.candidate.findMany({
      where: {
        id: { in: candidateIds },
        ...(ownerId ? { ownerId } : {}),
      },
    });

    if (candidates.length !== candidateIds.length) {
      throw new AppError(404, 'CANDIDATE_NOT_FOUND', 'Không tìm thấy một hoặc nhiều ứng viên hợp lệ');
    }

    const results = [];

    // Xử lý từng ứng viên với Gemini (có thể batch tuần tự để tránh rate limit)
    for (const candidate of candidates) {
      try {
        const prompt = `
=== THÔNG TIN JOB DESCRIPTION (JD) ===
Tiêu đề vị trí: ${job.title}
Số năm kinh nghiệm tối thiểu: ${job.minExperience} năm
Danh sách kỹ năng yêu cầu: ${job.requiredSkills.join(', ')}
Mô tả công việc:
${job.description}

=== NỘI DUNG CV ỨNG VIÊN ===
Tên ứng viên: ${candidate.fullName}
Nội dung văn bản trích xuất từ CV:
${candidate.rawText.substring(0, 10000)}

Hãy đánh giá mức độ phù hợp và trả về kết quả JSON theo đúng định dạng:
{
  "score": <số nguyên từ 0 đến 100>,
  "summary": "<Đoạn nhận xét đánh giá tổng quan bằng tiếng Việt từ 2 đến 4 câu>",
  "matchedSkills": ["<kỹ năng 1>", "<kỹ năng 2>"],
  "missingSkills": ["<kỹ năng còn thiếu 1>", "<kỹ năng còn thiếu 2>"]
}
`;

        const geminiResponse = await geminiModel.generateContent(prompt);
        const rawText = geminiResponse.response.text();
        const parsedResult = sanitizeAndParseGeminiResponse(rawText);

        // Lưu hoặc cập nhật (Upsert) vào PostgreSQL
        const savedMatch = await prisma.matchResult.upsert({
          where: {
            candidateId_jobDescriptionId: {
              candidateId: candidate.id,
              jobDescriptionId: job.id,
            },
          },
          update: {
            score: parsedResult.score,
            summary: parsedResult.summary,
            matchedSkills: parsedResult.matchedSkills,
            missingSkills: parsedResult.missingSkills,
          },
          create: {
            candidateId: candidate.id,
            jobDescriptionId: job.id,
            score: parsedResult.score,
            summary: parsedResult.summary,
            matchedSkills: parsedResult.matchedSkills,
            missingSkills: parsedResult.missingSkills,
          },
          include: {
            candidate: {
              select: safeCandidateSelect,
            },
          },
        });

        results.push(savedMatch);
      } catch (err: any) {
        const status = err?.status === 429 || String(err?.message || '').includes('429') ? 429 : 502;
        const code = status === 429 ? 'AI_RATE_LIMIT' : 'AI_PROVIDER_ERROR';
        const message =
          status === 429
            ? 'Hệ thống Gemini AI đang đạt giới hạn lượt gọi (Rate Limit). Vui lòng thử lại sau ít phút.'
            : `Không thể phân tích hồ sơ "${candidate.fullName}" qua Gemini AI. Vui lòng thử lại.`;
        throw new AppError(status, code, message);
      }
    }

    return results;
  }

  async getLeaderboardByJobId(jobDescriptionId: string, ownerId?: string) {
    const jobWhere = { id: jobDescriptionId, ...(ownerId ? { ownerId } : {}) };
    const include = {
      matchResults: {
        include: {
          candidate: {
            select: safeCandidateSelect,
          },
        },
        orderBy: { score: 'desc' as const },
      },
    };

    const job =
      typeof prisma.jobDescription.findFirst === 'function'
        ? await prisma.jobDescription.findFirst({
            where: jobWhere,
            include,
          })
        : await (prisma.jobDescription.findUnique as any)({
            where: jobWhere,
            include,
          });

    if (!job) {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Không tìm thấy Job Description');
    }

    return job;
  }
}

export const matchingService = new MatchingService();
