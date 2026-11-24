import { env } from '../config/env.js';
import { vietnamDay } from './admin-dashboard.service.js';
import { prisma } from '../config/database.js';
import { geminiModel } from '../config/gemini.js';
import { RunMatchingDto } from '../types/index.js';
import { sanitizeAndParseGeminiResponse } from '../utils/geminiParser.js';
import { AppError } from '../common/errors/app-error.js';
import { toAiError } from '../utils/ai-error.js';
import { toMatchResultDto } from '../modules/candidates/candidate.mapper.js';
import { assertSafeAiMatchingPayload, buildAiMatchingPayload, buildAiMatchingPrompt } from '../modules/candidates/ai-matching-payload.js';
import { resolveCvTestWeights } from '../modules/evaluation/score-calculator.js';
import { isTransientAiError, withRetry } from '../utils/retry.js';
import type { Prisma } from '@prisma/client';

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
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        fileName: true,
        rawText: true,
        skills: true,
        yearsOfExperience: true,
        extractionStatus: true,
      },
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
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;
      let succeeded = false;
      try {
        const weights = resolveCvTestWeights(job.evaluationConfig);
        const payload = buildAiMatchingPayload(job, candidate);
        assertSafeAiMatchingPayload(payload);
        const prompt = buildAiMatchingPrompt(payload, weights);
        if (typeof prisma.jobDescription.update === 'function') {
          await prisma.jobDescription.update({
            where: { id: job.id },
            data: { jdAnalysis: payload.job as unknown as Prisma.InputJsonValue, analyzedAt: new Date() },
          });
        }
        if (typeof prisma.candidate.update === 'function') {
          await prisma.candidate.update({
            where: { id: candidate.id },
            data: { structuredProfile: payload.candidate as unknown as Prisma.InputJsonValue, profileVersion: 'cvtest-1.0', profileAnalyzedAt: new Date() },
          });
        }

        const geminiResponse = await withRetry(
          () => geminiModel.generateContent(prompt, { timeout: 60000 }),
          {
            retries: env.AI_MAX_RETRIES,
            baseMs: env.NODE_ENV === 'test' ? 0 : 1000,
            shouldRetry: isTransientAiError,
          },
        );
        inputTokens = geminiResponse.response.usageMetadata?.promptTokenCount ?? null;
        outputTokens = geminiResponse.response.usageMetadata?.candidatesTokenCount ?? null;
        const rawText = geminiResponse.response.text();
        const parsedResult = sanitizeAndParseGeminiResponse(rawText, weights);

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
            matchLevel: parsedResult.matchLevel ?? null,
            scoreBreakdown: parsedResult.scoreBreakdown as Prisma.InputJsonValue | undefined,
            strengths: parsedResult.strengths as Prisma.InputJsonValue | undefined,
            gaps: parsedResult.gapsAndConcerns as Prisma.InputJsonValue | undefined,
            requirementsAnalysis: parsedResult.requirementsAnalysis as Prisma.InputJsonValue | undefined,
            interviewQuestions: parsedResult.interviewQuestions as Prisma.InputJsonValue | undefined,
            careerPotential: parsedResult.careerPotential as Prisma.InputJsonValue | undefined,
            confidence: parsedResult.confidence ?? null,
            limitations: parsedResult.limitations as Prisma.InputJsonValue | undefined,
            evidence: parsedResult.scoreBreakdown?.flatMap((item) => item.evidence) as Prisma.InputJsonValue | undefined,
            candidateProfileSnapshot: payload.candidate as unknown as Prisma.InputJsonValue,
            jdAnalysisSnapshot: payload.job as unknown as Prisma.InputJsonValue,
            evaluationConfig: job.evaluationConfig as Prisma.InputJsonValue | undefined,
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
            matchLevel: parsedResult.matchLevel ?? null,
            scoreBreakdown: parsedResult.scoreBreakdown as Prisma.InputJsonValue | undefined,
            strengths: parsedResult.strengths as Prisma.InputJsonValue | undefined,
            gaps: parsedResult.gapsAndConcerns as Prisma.InputJsonValue | undefined,
            requirementsAnalysis: parsedResult.requirementsAnalysis as Prisma.InputJsonValue | undefined,
            interviewQuestions: parsedResult.interviewQuestions as Prisma.InputJsonValue | undefined,
            careerPotential: parsedResult.careerPotential as Prisma.InputJsonValue | undefined,
            confidence: parsedResult.confidence ?? null,
            limitations: parsedResult.limitations as Prisma.InputJsonValue | undefined,
            evidence: parsedResult.scoreBreakdown?.flatMap((item) => item.evidence) as Prisma.InputJsonValue | undefined,
            candidateProfileSnapshot: payload.candidate as unknown as Prisma.InputJsonValue,
            jdAnalysisSnapshot: payload.job as unknown as Prisma.InputJsonValue,
            evaluationConfig: job.evaluationConfig as Prisma.InputJsonValue | undefined,
          },
          include: {
            candidate: {
              select: safeCandidateSelect,
            },
          },
        });

        results.push(toMatchResultDto(savedMatch));
        succeeded = true;
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
