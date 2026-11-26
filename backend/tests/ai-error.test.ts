import { expect, it } from 'vitest';
import { toAiError } from '../src/utils/ai-error.js';

it('distinguishes provider overload from quota and hides upstream details', () => {
  const failure = toAiError({ status: 503, message: 'Sensitive URL, API key and prompt' });
  expect(failure).toMatchObject({ status: 503, code: 'AI_SERVICE_UNAVAILABLE' });
  expect(failure.message).toContain('quá tải');
  expect(failure.message).not.toContain('Sensitive');
  expect(toAiError({ status: 429 })).toMatchObject({ code: 'AI_RATE_LIMIT' });
  expect(toAiError({ name: 'TimeoutError' })).toMatchObject({ code: 'AI_TIMEOUT' });
});
