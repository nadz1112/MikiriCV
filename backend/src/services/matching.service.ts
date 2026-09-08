import { prisma } from '../config/database.js';
import { geminiModel } from '../config/gemini.js';
import { RunMatchingDto } from '../types/index.js';
import { sanitizeAndParseGeminiResponse } from '../utils/geminiParser.js';

export class MatchingService {
  async runMatching(dto: RunMatchingDto) {
    const { jobDescriptionId, candidateIds } = dto;

    const job = await prisma.jobDescription.findUnique({
      where: { id: jobDescriptionId },
    });

    if (!job) {
      throw new Error(`Không tìm thấy Job Description với ID: ${jobDescriptionId}`);
    }

    const candidates = await prisma.candidate.findMany({
      where: {
        id: { in: candidateIds },
      },
    });

    if (candidates.length === 0) {
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
        console.error(`Lỗi khi chấm điểm ứng viên ${candidate.fullName}:`, err);
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

  async getLeaderboardByJobId(jobDescriptionId: string) {
    const job = await prisma.jobDescription.findUnique({
      where: { id: jobDescriptionId },
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
      throw new Error(`Không tìm thấy Job Description với ID: ${jobDescriptionId}`);
    }

    return job;
  }
}

export const matchingService = new MatchingService();
