import { prisma } from '../config/database.js';
import { geminiModel } from '../config/gemini.js';
import { RunMatchingDto } from '../types/index.js';
import { sanitizeAndParseGeminiResponse } from '../utils/geminiParser.js';

export class MatchingService {
  async runMatching(dto: RunMatchingDto, ownerId?: string) {
    const { jobDescriptionId, candidateIds } = dto;

    const job = await prisma.jobDescription.findUnique({
      where: { id: jobDescriptionId, ...(ownerId ? { ownerId } : {}) },
    });

    if (!job) {
      throw Object.assign(new Error('Không tìm thấy Job Description'), { status: 404, code: 'JOB_NOT_FOUND' });
      throw new Error(`Không tìm thấy Job Description với ID: ${jobDescriptionId}`);
    }

    const candidates = await prisma.candidate.findMany({
      where: {
        id: { in: candidateIds },
        ...(ownerId ? { ownerId } : {}),
      },
    });

    if (candidates.length !== candidateIds.length) {
      throw Object.assign(new Error('Không tìm thấy một hoặc nhiều tài nguyên'), { status: 404, code: 'CANDIDATE_NOT_FOUND' });
      throw new Error('Không tìm thấy ứng viên nào để thực hiện đối soát');
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
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
          },
        });

        results.push(savedMatch);
      } catch (err) {
        console.error('Lỗi khi xử lý kết quả matching với AI');
        // Lưu kết quả fallback tạm thời nếu AI gặp sự cố
        const fallbackMatch = await prisma.matchResult.upsert({
          where: {
            candidateId_jobDescriptionId: {
              candidateId: candidate.id,
              jobDescriptionId: job.id,
            },
          },
          update: {
            score: 0,
            summary: 'Đã xảy ra lỗi trong quá trình kết nối với Gemini AI. Vui lòng thử lại.',
            matchedSkills: [],
            missingSkills: [],
          },
          create: {
            candidateId: candidate.id,
            jobDescriptionId: job.id,
            score: 0,
            summary: 'Đã xảy ra lỗi trong quá trình kết nối với Gemini AI. Vui lòng thử lại.',
            matchedSkills: [],
            missingSkills: [],
          },
        });
        results.push(fallbackMatch);
      }
    }

    return results;
  }

  async getLeaderboardByJobId(jobDescriptionId: string, ownerId?: string) {
    const job = await prisma.jobDescription.findUnique({
      where: { id: jobDescriptionId, ...(ownerId ? { ownerId } : {}) },
      include: {
        matchResults: {
          include: {
            candidate: true,
          },
          orderBy: { score: 'desc' },
        },
      },
    });

    if (!job) {
      throw Object.assign(new Error('Không tìm thấy Job Description'), { status: 404, code: 'JOB_NOT_FOUND' });
      throw new Error(`Không tìm thấy Job Description với ID: ${jobDescriptionId}`);
    }

    return job;
  }
}

export const matchingService = new MatchingService();
