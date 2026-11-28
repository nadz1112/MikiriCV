import { beforeEach, expect, it, vi } from 'vitest';
const calls = vi.hoisted(() => ({ generate: vi.fn(), count: vi.fn() }));
vi.mock('../src/config/gemini.js', () => ({ geminiModel: { generationConfig: { responseMimeType: 'application/json' }, countTokens: calls.count, generateContent: calls.generate } }));
import { GeminiMatchingProvider } from '../src/modules/matching/ai-matching-provider.js';
const provider = new GeminiMatchingProvider();
beforeEach(() => vi.resetAllMocks());
it('counts the same prompt and schema that will be sent to the provider', async () => {
  calls.count.mockResolvedValue({ totalTokens: 150 });
  expect(await provider.countInputTokens('Safe prompt', 'PLUS')).toBe(150);
  expect(calls.count).toHaveBeenCalledWith({ generateContentRequest: { contents: [{ role: 'user', parts: [{ text: 'Safe prompt' }] }], generationConfig: { responseMimeType: 'application/json' } } }, { timeout: 30000 });
});
it('bounds generated output and preserves separate thinking and total counts', async () => {
  calls.generate.mockResolvedValue({ response: { text: () => '{}', usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, thoughtsTokenCount: 20, totalTokenCount: 170 } } });
  expect(await provider.generateEvaluation('Safe prompt', 'PLUS', 4096)).toEqual({ rawText: '{}', inputTokens: 100, outputTokens: 50, thinkingTokens: 20, totalTokens: 170 });
  expect(calls.generate).toHaveBeenCalledWith({ contents: [{ role: 'user', parts: [{ text: 'Safe prompt' }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4096 } }, { timeout: 60000 });
});
it('does not hide an ambiguous failure behind another billable generation attempt', async () => {
  calls.generate.mockRejectedValue({ name: 'TimeoutError' });
  await expect(provider.generateEvaluation('Safe prompt')).rejects.toMatchObject({ name: 'TimeoutError' });
  expect(calls.generate).toHaveBeenCalledTimes(1);
});
