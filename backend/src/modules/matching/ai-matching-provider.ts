import { env } from '../../config/env.js';
import * as geminiConfig from '../../config/gemini.js';
import { isTransientAiError, withRetry } from '../../utils/retry.js';

export interface AiEvaluationOutput {
  rawText: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface AIMatchingProvider {
  readonly modelName: string;
  readonly promptVersion: string;
  generateEvaluation(prompt: string, plan?: 'FREE' | 'PLUS'): Promise<AiEvaluationOutput>;
}

export class GeminiMatchingProvider implements AIMatchingProvider {
  readonly promptVersion = 'cvtest-1.0';

  get modelName(): string {
    return env.GEMINI_MODEL;
  }

  async generateEvaluation(prompt: string, plan: 'FREE' | 'PLUS' = 'PLUS'): Promise<AiEvaluationOutput> {
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

    const geminiResponse = await withRetry(
      () => model.generateContent(prompt, { timeout: 60000 }),
      {
        retries: env.NODE_ENV === 'test' ? 0 : env.AI_MAX_RETRIES,
        baseMs: env.NODE_ENV === 'test' ? 0 : 1000,
        shouldRetry: isTransientAiError,
      },
    );
    return {
      rawText: geminiResponse.response.text(),
      inputTokens: geminiResponse.response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: geminiResponse.response.usageMetadata?.candidatesTokenCount ?? null,
    };
  }
}

export const geminiMatchingProvider = new GeminiMatchingProvider();
