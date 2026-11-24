import { env } from '../config/env.js';
import { vietnamDay } from './admin-dashboard.service.js';
import { prisma } from '../config/database.js';
import { geminiModel } from '../config/gemini.js';
import { RunMatchingDto } from '../types/index.js';
import { sanitizeAndParseGeminiResponse } from '../utils/geminiParser.js';
import { AppError } from '../common/errors/app-error.js';
import { toMatchingProfile } from '../modules/candidates/matching-profile.js';
import { toAiError } from '../utils/ai-error.js';
import { toMatchResultDto } from '../modules/candidates/candidate.mapper.js';
import { reserveAnalyses, refundAnalyses, checkDocuments } from './subscription.service.js';
import { PdfTextExtractor } from '../modules/candidates/text-extractor.js';
import path from 'path';

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
        ? await prisma.jobDescription.findFirst({ where: jobWhere, include: { owner: { select: { companyId: true } } } })
        : await (prisma.jobDescription.findUnique as any)({ where: jobWhere });

    if (!job) {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Không tìm thấy Job Description');
    }

    const candidates = await prisma.candidate.findMany({
      where: {
        id: { in: candidateIds },
        ...(ownerId ? { ownerId } : {}),
      },
      select: { id: true, fullName: true, skills: true, yearsOfExperience: true, extractionStatus: true, rawText: true, pageCount: true, fileUrl: true, fileName: true },
    });

    if (candidates.length !== candidateIds.length) {
      throw new AppError(404, 'CANDIDATE_NOT_FOUND', 'Không tìm thấy một hoặc nhiều ứng viên hợp lệ');
    }

    if (candidates.some((candidate) => candidate.extractionStatus === 'FAILED')) {
      throw new AppError(422, 'CV_EXTRACTION_FAILED', 'Có CV chưa trích xuất được nội dung. Vui lòng kiểm tra lại hồ sơ đã chọn.');
    }

    for (const candidate of candidates) {
      if (candidate.pageCount == null && candidate.fileName?.toLowerCase().endsWith('.pdf')) {
        try {
          const root = path.resolve(process.cwd(), env.UPLOAD_DIR);
          const filePath = candidate.fileUrl.startsWith('/uploads/') ? path.resolve(root, path.basename(candidate.fileUrl)) : path.resolve(candidate.fileUrl);
          if (!filePath.startsWith(`${root}${path.sep}`)) throw new Error('INVALID_CV_PATH');
          candidate.pageCount = (await new PdfTextExtractor().extractDocument(filePath)).pageCount;
        }
        catch { throw new AppError(422, 'CV_PAGE_COUNT_UNAVAILABLE', 'Không thể kiểm tra số trang CV. Vui lòng tải lại file PDF hợp lệ.'); }
      }
    }
    const ticket = await reserveAnalyses(ownerId ?? job.ownerId, candidateIds.length);
    const results = [];
    let completed = 0;
    let failed = false;
    try {
      checkDocuments(ticket, candidates);

      // Xử lý từng ứng viên với Gemini (có thể batch tuần tự để tránh rate limit)
      for (const candidate of candidates) {
        let saving = false;
        let inputTokens: number | null = null;
        let outputTokens: number | null = null;
        let succeeded = false;
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
  ${ticket.name === 'PLUS' ? 'Bổ sung skillAnalysis (mảng nhận xét chi tiết từng kỹ năng), redFlags (mảng khoảng trống kỹ năng cần xác minh, không suy đoán tính cách hay lý lịch), interviewQuestions (ít nhất 3 câu hỏi phỏng vấn theo kỹ năng còn thiếu). Chỉ dựa trên kỹ năng và kinh nghiệm được cung cấp; nêu rõ giới hạn dữ liệu.' : 'Tóm tắt ngắn gọn, không cần phân tích chuyên sâu.'}
  Bổ sung highlights là mảng đúng 3 điểm nổi bật được dẫn chứng từ kỹ năng/kinh nghiệm; nếu thiếu dữ liệu hãy ghi rõ cần xác minh, không bịa thông tin.
  {
    "score": <số nguyên từ 0 đến 100>,
    "summary": "<Đoạn nhận xét đánh giá tổng quan bằng tiếng Việt từ 2 đến 4 câu>",
    "matchedSkills": ["<kỹ năng 1>", "<kỹ năng 2>"],
    "missingSkills": ["<kỹ năng còn thiếu 1>", "<kỹ năng còn thiếu 2>"],
    "highlights": ["<điểm nổi bật 1>", "<điểm nổi bật 2>", "<điểm nổi bật 3>"]${ticket.name === 'PLUS' ? ',\n  "skillAnalysis": ["<nhận xét từng kỹ năng>"],\n  "redFlags": ["<khoảng trống cần xác minh nếu có>"],\n  "interviewQuestions": ["<câu hỏi 1>", "<câu hỏi 2>", "<câu hỏi 3>"]' : ''}
  }
  `;

          const geminiResponse = await geminiModel.generateContent(prompt, { timeout: 60000 });
          inputTokens = geminiResponse.response.usageMetadata?.promptTokenCount ?? null;
          outputTokens = geminiResponse.response.usageMetadata?.candidatesTokenCount ?? null;
          const rawText = geminiResponse.response.text();
          const parsedResult = sanitizeAndParseGeminiResponse(rawText, ticket.name);

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
              inputTokens,
              outputTokens,
              updatedAt: new Date(),
              score: parsedResult.score,
              summary: parsedResult.summary,
              matchedSkills: parsedResult.matchedSkills,
              missingSkills: parsedResult.missingSkills,
              highlights: parsedResult.highlights,
              skillAnalysis: parsedResult.skillAnalysis,
              redFlags: parsedResult.redFlags,
              interviewQuestions: parsedResult.interviewQuestions,
            },
            create: {
              inputTokens,
              outputTokens,
              updatedAt: new Date(),
              candidateId: candidate.id,
              jobDescriptionId: job.id,
              score: parsedResult.score,
              summary: parsedResult.summary,
              matchedSkills: parsedResult.matchedSkills,
              missingSkills: parsedResult.missingSkills,
              highlights: parsedResult.highlights,
              skillAnalysis: parsedResult.skillAnalysis,
              redFlags: parsedResult.redFlags,
              interviewQuestions: parsedResult.interviewQuestions,
            },
            include: {
              candidate: {
                select: safeCandidateSelect,
              },
            },
          });

          results.push(toMatchResultDto(savedMatch));
          succeeded = true;
          completed++;
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
        } finally {
          try {
            await prisma.aiUsage.create({ data: {
              enterpriseId: ownerId ?? job.ownerId,
              companyId: ticket.companyId,
              model: env.GEMINI_MODEL, inputTokens, outputTokens, succeeded, day: vietnamDay(),
            } });
          } catch {
            console.error('AI_USAGE_RECORDING_FAILED');
            // Keep the original provider/database failure visible if recording also fails.
            if (succeeded) throw new AppError(500, 'AI_USAGE_RECORDING_FAILED', 'Đã lưu kết quả đánh giá nhưng chưa ghi được lịch sử sử dụng AI. Vui lòng tải lại kết quả và kiểm tra backend.');
          }
        }
      }

      return results;
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      try { await refundAnalyses(ticket, ticket.reserved - completed); }
      catch {
        console.error('ANALYSIS_QUOTA_REFUND_FAILED');
        if (!failed) throw new AppError(500, 'QUOTA_REFUND_FAILED', 'Không thể hoàn lượt chưa sử dụng. Vui lòng liên hệ quản trị viên.');
      }
    }
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

    return { ...job, matchResults: job.matchResults.map(toMatchResultDto) };
  }
}

export const matchingService = new MatchingService();
