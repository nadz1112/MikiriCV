import { env } from '../../config/env.js';
import * as geminiConfig from '../../config/gemini.js';
import { isTransientAiError, withRetry } from '../../utils/retry.js';
import { AppError } from '../../common/errors/app-error.js';
import type { GenerativeModel } from '@google/generative-ai';

export interface AiEvaluationOutput {
  rawText: string;
  inputTokens: number | null;
  outputTokens: number | null;
  thinkingTokens?: number | null;
  totalTokens?: number | null;
}

export interface AIMatchingProvider {
  readonly modelName: string;
  readonly promptVersion: string;
  countInputTokens(prompt: string, plan?: 'FREE' | 'PLUS'): Promise<number>;
  generateEvaluation(prompt: string, plan?: 'FREE' | 'PLUS', maxOutputTokens?: number): Promise<AiEvaluationOutput>;
}

export class GeminiMatchingProvider implements AIMatchingProvider {
  readonly promptVersion = 'cvtest-1.0';

  get modelName(): string {
    return env.GEMINI_MODEL;
  }

  private model(plan: 'FREE' | 'PLUS'): GenerativeModel {
    let model = geminiConfig.geminiModel;
    if (plan === 'FREE') {
      try {
        if (geminiConfig.geminiFreeModel) {
          model = geminiConfig.geminiFreeModel;
        }
      } catch {
        // Test mocks that only stub geminiModel fall back to geminiModel cleanly.
      }
    }

    return model;
  }

  async countInputTokens(prompt: string, plan: 'FREE' | 'PLUS' = 'PLUS') {
    const model = this.model(plan);
    const response = await withRetry(() => model.countTokens({ generateContentRequest: {
      contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: model.generationConfig,
    } }, { timeout: 30000 }),
      {
        retries: env.NODE_ENV === 'test' ? 0 : env.AI_MAX_RETRIES,
        baseMs: env.NODE_ENV === 'test' ? 0 : 1000,
        shouldRetry: isTransientAiError,
      },
    );
    if (!Number.isSafeInteger(response.totalTokens) || response.totalTokens < 0) throw new AppError(502, 'AI_TOKEN_COUNT_FAILED', 'Không thể xác định số token đầu vào');
    return response.totalTokens;
  }

  async generateEvaluation(prompt: string, plan: 'FREE' | 'PLUS' = 'PLUS', maxOutputTokens = 8192): Promise<AiEvaluationOutput> {
    // No hidden retry after an ambiguous generation failure: it may already be billed.
    const geminiResponse = await this.model(plan).generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens },
    }, { timeout: 60000 });
    const metadata = geminiResponse.response.usageMetadata as (typeof geminiResponse.response.usageMetadata & { thoughtsTokenCount?: number });
    let rawText = '';
    try { rawText = geminiResponse.response.text(); } catch { /* Preserve usage on blocked responses. */ }
    return {
      rawText,
      inputTokens: geminiResponse.response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: geminiResponse.response.usageMetadata?.candidatesTokenCount ?? null,
      thinkingTokens: metadata?.thoughtsTokenCount ?? null,
      totalTokens: metadata?.totalTokenCount ?? null,
    };
  }
}

export const geminiMatchingProvider = new GeminiMatchingProvider();
