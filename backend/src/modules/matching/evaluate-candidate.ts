import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { vietnamDay } from '../../services/admin-dashboard.service.js';
import { sanitizeAndParseGeminiResponse } from '../../utils/geminiParser.js';
import { toAiError } from '../../utils/ai-error.js';
import { toMatchResultDto } from '../candidates/candidate.mapper.js';
import {
  assertSafeAiMatchingPayload,
  buildAiMatchingPayload,
  buildAiMatchingPrompt,
  buildFreeMatchingPrompt,
} from '../candidates/ai-matching-payload.js';
import { CVTEST_DEFAULT_WEIGHTS, getMatchLevel, resolveCvTestWeights } from '../evaluation/score-calculator.js';
import type { AIMatchingProvider } from './ai-matching-provider.js';

export const safeMatchingCandidateSelect = {
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

export interface EvaluatableJob {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  requiredSkills: string[];
  preferredSkills?: string[];
  minExperience: number;
  evaluationConfig?: unknown;
}

export interface EvaluatableCandidate {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  fileName?: string | null;
  rawText?: string | null;
  skills: string[];
  yearsOfExperience: number;
  extractionStatus: string;
}

export async function evaluateCandidateWithAi(
  job: EvaluatableJob,
  candidate: EvaluatableCandidate,
  aiProvider: AIMatchingProvider,
  ownerId?: string,
  plan?: 'FREE' | 'PLUS',
  companyId?: string | null,
) {
  let saving = false;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let succeeded = false;
  try {
    const isFree = plan === 'FREE';
    const weights = isFree ? CVTEST_DEFAULT_WEIGHTS : resolveCvTestWeights(job.evaluationConfig);
    const payload = buildAiMatchingPayload(job, candidate);
    assertSafeAiMatchingPayload(payload);
    const prompt = isFree ? buildFreeMatchingPrompt(payload) : buildAiMatchingPrompt(payload, weights);

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

    const aiResponse = await aiProvider.generateEvaluation(prompt, isFree ? 'FREE' : 'PLUS');
    inputTokens = aiResponse.inputTokens;
    outputTokens = aiResponse.outputTokens;
    const parsedResult = sanitizeAndParseGeminiResponse(aiResponse.rawText, { weights, plan });
    const promptVersion = isFree ? 'free-1.0' : aiProvider.promptVersion;
    const freeHighlights = (parsedResult.highlights ?? []).slice(0, 3);

    saving = true;
    const savedMatch = await prisma.matchResult.upsert({
      where: {
        candidateId_jobDescriptionId: {
          candidateId: candidate.id,
          jobDescriptionId: job.id,
        },
      },
      update: isFree
        ? {
            modelName: aiProvider.modelName,
            promptVersion,
            inputTokens,
            outputTokens,
            updatedAt: new Date(),
            score: parsedResult.score,
            summary: parsedResult.summary,
            matchedSkills: parsedResult.matchedSkills,
            missingSkills: parsedResult.missingSkills,
            highlights: freeHighlights,
            skillAnalysis: [],
            redFlags: [],
            interviewQuestions: [],
            matchLevel: getMatchLevel(parsedResult.score),
            scoreBreakdown: Prisma.DbNull,
            strengths: Prisma.DbNull,
            gaps: Prisma.DbNull,
            requirementsAnalysis: Prisma.DbNull,
            careerPotential: Prisma.DbNull,
            confidence: null,
            limitations: Prisma.DbNull,
            evidence: Prisma.DbNull,
            evaluationConfig: Prisma.DbNull,
            candidateProfileSnapshot: payload.candidate as unknown as Prisma.InputJsonValue,
            jdAnalysisSnapshot: payload.job as unknown as Prisma.InputJsonValue,
          }
        : {
            modelName: aiProvider.modelName,
            promptVersion,
            inputTokens,
            outputTokens,
            updatedAt: new Date(),
            score: parsedResult.score,
            summary: parsedResult.summary,
            matchedSkills: parsedResult.matchedSkills,
            missingSkills: parsedResult.missingSkills,
            highlights: parsedResult.highlights ?? [],
            skillAnalysis: parsedResult.skillAnalysis ?? [],
            redFlags: parsedResult.redFlags ?? [],
            matchLevel: parsedResult.matchLevel ?? null,
            scoreBreakdown: parsedResult.scoreBreakdown as Prisma.InputJsonValue | undefined,
            strengths: parsedResult.strengths as Prisma.InputJsonValue | undefined,
            gaps: parsedResult.gapsAndConcerns as Prisma.InputJsonValue | undefined,
            requirementsAnalysis: parsedResult.requirementsAnalysis as Prisma.InputJsonValue | undefined,
            interviewQuestions: parsedResult.interviewQuestions ?? [],
            careerPotential: parsedResult.careerPotential as Prisma.InputJsonValue | undefined,
            confidence: parsedResult.confidence ?? null,
            limitations: parsedResult.limitations as Prisma.InputJsonValue | undefined,
            evidence: parsedResult.scoreBreakdown?.flatMap((item) => item.evidence) as Prisma.InputJsonValue | undefined,
            candidateProfileSnapshot: payload.candidate as unknown as Prisma.InputJsonValue,
            jdAnalysisSnapshot: payload.job as unknown as Prisma.InputJsonValue,
            evaluationConfig: job.evaluationConfig as Prisma.InputJsonValue | undefined,
          },
      create: isFree
        ? {
            modelName: aiProvider.modelName,
            promptVersion,
            inputTokens,
            outputTokens,
            updatedAt: new Date(),
            candidateId: candidate.id,
            jobDescriptionId: job.id,
            score: parsedResult.score,
            summary: parsedResult.summary,
            matchedSkills: parsedResult.matchedSkills,
            missingSkills: parsedResult.missingSkills,
            highlights: freeHighlights,
            skillAnalysis: [],
            redFlags: [],
            interviewQuestions: [],
            matchLevel: getMatchLevel(parsedResult.score),
            candidateProfileSnapshot: payload.candidate as unknown as Prisma.InputJsonValue,
            jdAnalysisSnapshot: payload.job as unknown as Prisma.InputJsonValue,
          }
        : {
            modelName: aiProvider.modelName,
            promptVersion,
            inputTokens,
            outputTokens,
            updatedAt: new Date(),
            candidateId: candidate.id,
            jobDescriptionId: job.id,
            score: parsedResult.score,
            summary: parsedResult.summary,
            matchedSkills: parsedResult.matchedSkills,
            missingSkills: parsedResult.missingSkills,
            highlights: parsedResult.highlights ?? [],
            skillAnalysis: parsedResult.skillAnalysis ?? [],
            redFlags: parsedResult.redFlags ?? [],
            matchLevel: parsedResult.matchLevel ?? null,
            scoreBreakdown: parsedResult.scoreBreakdown as Prisma.InputJsonValue | undefined,
            strengths: parsedResult.strengths as Prisma.InputJsonValue | undefined,
            gaps: parsedResult.gapsAndConcerns as Prisma.InputJsonValue | undefined,
            requirementsAnalysis: parsedResult.requirementsAnalysis as Prisma.InputJsonValue | undefined,
            interviewQuestions: parsedResult.interviewQuestions ?? [],
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
          select: safeMatchingCandidateSelect,
        },
      },
    });

    succeeded = true;
    return toMatchResultDto(savedMatch, plan);
  } catch (err: unknown) {
    const prismaCode = (err as { code?: string })?.code;
    if (prismaCode === 'P2003' || prismaCode === 'P2025') {
      throw new AppError(409, 'MATCHING_DATA_CHANGED', 'CV hoặc JD đã bị xóa trong lúc chấm điểm. Vui lòng tải lại danh sách.');
    }
    if (saving) throw err;
    const failure = toAiError(err);
    const upstreamStatus = (err as { status?: number })?.status;
    console.warn('AI matching failed', {
      code: failure.code,
      upstreamStatus: typeof upstreamStatus === 'number' ? upstreamStatus : undefined,
    });
    throw failure;
  } finally {
    try {
      await prisma.aiUsage.create({
        data: {
          enterpriseId: ownerId ?? job.ownerId,
          companyId: companyId ?? null,
          model: aiProvider.modelName,
          inputTokens,
          outputTokens,
          succeeded,
          day: vietnamDay(),
        },
      });
    } catch {
      console.error('AI_USAGE_RECORDING_FAILED');
      if (succeeded) {
        throw new AppError(500, 'AI_USAGE_RECORDING_FAILED', 'Đã lưu kết quả đánh giá nhưng chưa ghi được lịch sử sử dụng AI. Vui lòng tải lại kết quả và kiểm tra backend.');
      }
    }
  }
}
