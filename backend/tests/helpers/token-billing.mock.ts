import { vi } from 'vitest';

export const tokenMocks = {
  reserveTokens: vi.fn(), startReservation: vi.fn(), settleTokens: vi.fn(), releaseTokens: vi.fn(), markUncertain: vi.fn(),
  getAccountQuota: vi.fn(), subscription: vi.fn(),
};
export function setupTokenMocks(plan: 'FREE' | 'PLUS' = 'FREE') {
  tokenMocks.reserveTokens.mockResolvedValue({ id: 'reservation-1' });
  tokenMocks.startReservation.mockResolvedValue(undefined);
  tokenMocks.settleTokens.mockResolvedValue(undefined);
  tokenMocks.releaseTokens.mockResolvedValue(undefined);
  tokenMocks.markUncertain.mockResolvedValue(undefined);
  tokenMocks.getAccountQuota.mockResolvedValue({ tokenLimit: 100000, used: 0, remaining: 100000, reservedTokens: 0, periodStart: '2026-11-01T00:00:00Z', periodEnd: '2026-12-01T00:00:00Z' });
  tokenMocks.subscription.mockResolvedValue({ name: plan, companyId: 'company-a', maxOutputTokens: 8192 });
}
