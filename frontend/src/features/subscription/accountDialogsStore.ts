import { create } from 'zustand';

const messages: Record<string, string> = {
  TOKEN_QUOTA_EXCEEDED: 'Token còn lại chưa đủ cho lần chạy này. Bạn có thể xem lại gói hoặc liên hệ quản trị viên để được hỗ trợ.',
  PLAN_BATCH_LIMIT: 'Số CV đã chọn vượt số hồ sơ được xử lý trong một lần chạy của gói hiện tại.',
  PLAN_DOCUMENT_LIMIT: 'Có CV vượt giới hạn số trang PDF hoặc số ký tự của gói hiện tại.',
  SUBSCRIPTION_EXPIRED: 'Gói dịch vụ đã hết hạn hoặc chưa có hiệu lực. Vui lòng liên hệ quản trị viên.',
  PLUS_REQUIRED: 'Tính năng này cần gói PLUS. Bạn có thể xem quyền lợi và liên hệ quản trị viên để nâng cấp.',
};
export const useAccountDialogsStore = create<{
  message: string | null; comparisonOpen: boolean;
  showQuota: (code: string | null | undefined) => void; compare: () => void; close: () => void;
}>((set) => ({
  message: null, comparisonOpen: false,
  showQuota: (code) => { if (code && messages[code]) set({ message: messages[code], comparisonOpen: false }); },
  compare: () => set({ message: null, comparisonOpen: true }),
  close: () => set({ message: null, comparisonOpen: false }),
}));
export function showMatchingQuotaError(error: unknown) {
  if (!error || typeof error !== 'object' || !('response' in error)) return;
  const response = error.response;
  if (!response || typeof response !== 'object' || !('data' in response)) return;
  const data = response.data;
  if (!data || typeof data !== 'object' || !('error' in data)) return;
  const detail = data.error;
  if (detail && typeof detail === 'object' && 'code' in detail && typeof detail.code === 'string') useAccountDialogsStore.getState().showQuota(detail.code);
}
