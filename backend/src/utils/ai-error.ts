import { AppError } from '../common/errors/app-error.js';

/** Classify errors without exposing API keys, prompts or provider response bodies. */
export function toAiError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const upstream = error as { status?: number; message?: string; name?: string } | null;
  const message = String(upstream?.message || '');
  if (upstream?.status === 429) {
    return new AppError(429, 'AI_RATE_LIMIT', 'Gemini đã đạt giới hạn lượt gọi hoặc quota. Vui lòng kiểm tra quota và thử lại sau.');
  }
  if (upstream?.status === 403 && /free tier|billing|paid tier|PROJECT_UNAVAILABLE/i.test(message)) {
    return new AppError(502, 'AI_BILLING_REQUIRED', 'Dự án Gemini hiện không được dùng free tier. Vui lòng bật billing cho đúng dự án của API key tại Google AI Studio rồi thử lại.');
  }
  if ([400, 401, 403].includes(upstream?.status ?? 0)) {
    return new AppError(502, 'AI_CONFIGURATION_ERROR', 'Gemini từ chối yêu cầu. Vui lòng kiểm tra API key, quyền truy cập và cấu hình model của backend.');
  }
  if (upstream?.status === 404) {
    return new AppError(502, 'AI_MODEL_NOT_FOUND', 'Không tìm thấy model Gemini đã cấu hình hoặc API key chưa có quyền sử dụng model này.');
  }
  if (upstream?.name === 'AbortError' || upstream?.name === 'TimeoutError' || upstream?.status === 504) {
    return new AppError(504, 'AI_TIMEOUT', 'Gemini phản hồi quá thời gian chờ. Vui lòng thử lại sau.');
  }
  return new AppError(502, 'AI_PROVIDER_ERROR', 'Không thể kết nối hoặc nhận kết quả từ Gemini. Vui lòng thử lại sau.');
}
