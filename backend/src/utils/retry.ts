import { AppError } from '../common/errors/app-error.js';

/** Transient errors (429 rate-limit, 5xx, timeout, network) are safe to retry; 4xx config errors are not. */
export function isTransientAiError(error: unknown): boolean {
  if (error instanceof AppError) return false;
  const err = error as { status?: number; name?: string; code?: string; message?: string } | null;
  if (!err) return false;
  if (err.status === 429 || (typeof err.status === 'number' && err.status >= 500)) return true;
  if (err.name === 'AbortError' || err.name === 'TimeoutError') return true;
  if (['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND'].includes(String(err.code || ''))) return true;
  return /fetch failed|network|timeout|rate limit|429|503|502|504/i.test(String(err.message || ''));
}

/** Retry an async operation with exponential backoff and jitter. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries: number; baseMs?: number; shouldRetry: (error: unknown) => boolean },
): Promise<T> {
  const baseMs = opts.baseMs ?? 1000;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= opts.retries || !opts.shouldRetry(error)) {
        throw error;
      }
      const waitMs = baseMs > 0 ? baseMs * 2 ** attempt + Math.random() * 250 : 0;
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }
}

