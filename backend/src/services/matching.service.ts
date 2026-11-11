import { prisma } from '../config/database.js';
import { geminiModel } from '../config/gemini.js';
import { RunMatchingDto } from '../types/index.js';
import { sanitizeAndParseGeminiResponse } from '../utils/geminiParser.js';
import { AppError } from '../common/errors/app-error.js';
import { toMatchingProfile } from '../modules/candidates/matching-profile.js';
import { toAiError } from '../utils/ai-error.js';

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
    const { jobDescriptionId } = dto;
    const candidateIds = [...new Set(dto.candidateIds)];

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
      select: { id: true, fullName: true, skills: true, yearsOfExperience: true, extractionStatus: true },
    });

    if (candidates.length !== candidateIds.length) {
      throw new AppError(404, 'CANDIDATE_NOT_FOUND', 'Không tìm thấy một hoặc nhiều ứng viên hợp lệ');
    }

    if (candidates.some((candidate) => candidate.extractionStatus === 'FAILED')) {
      throw new AppError(422, 'CV_EXTRACTION_FAILED', 'Có CV chưa trích xuất được nội dung. Vui lòng kiểm tra lại hồ sơ đã chọn.');
    }

    const results = [];

    // Xử lý từng ứng viên với Gemini (có thể batch tuần tự để tránh rate limit)
    for (const candidate of candidates) {
      let saving = false;
      try {
        const prompt = `
=== THÔNG TIN JOB DESCRIPTION (JD) ===
Tiêu đề vị trí: ${job.title}
Số năm kinh nghiệm tối thiểu: ${job.minExperience} năm
Danh sách kỹ năng yêu cầu: ${job.requiredSkills.join(', ')}
Mô tả công việc:
${job.description}

=== HỒ SƠ CHUYÊN MÔN ĐÃ TRÍCH XUẤT NỘI BỘ ===
${JSON.stringify(toMatchingProfile(candidate))}
Chỉ đánh giá kỹ năng và số năm kinh nghiệm trong hồ sơ này. Không suy đoán thông tin chưa được cung cấp.
Trong nhận xét, nêu rõ đánh giá dựa trên dữ liệu kỹ năng và kinh nghiệm đã trích xuất, không phải toàn bộ CV.

Hãy đánh giá mức độ phù hợp và trả về kết quả JSON theo đúng định dạng:
{
  "score": <số nguyên từ 0 đến 100>,
  "summary": "<Đoạn nhận xét đánh giá tổng quan bằng tiếng Việt từ 2 đến 4 câu>",
  "matchedSkills": ["<kỹ năng 1>", "<kỹ năng 2>"],
  "missingSkills": ["<kỹ năng còn thiếu 1>", "<kỹ năng còn thiếu 2>"]
}
`;

        const geminiResponse = await geminiModel.generateContent(prompt, { timeout: 60000 });
        const rawText = geminiResponse.response.text();
        const parsedResult = sanitizeAndParseGeminiResponse(rawText);

        // Lưu hoặc cập nhật (Upsert) vào PostgreSQL
        saving = true;
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
        // A CV deleted while the provider was running must never be recreated or saved.
        if (err?.code === 'P2003' || err?.code === 'P2025') {
          throw new AppError(409, 'MATCHING_DATA_CHANGED', 'CV hoặc JD đã bị xóa trong lúc chấm điểm. Vui lòng tải lại danh sách.');
        }
        if (saving) throw err;
        const failure = toAiError(err);
        console.warn('AI matching failed', {
          code: failure.code,
          upstreamStatus: typeof err?.status === 'number' ? err.status : undefined,
          model: geminiModel.model,
        });
        throw failure;
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
