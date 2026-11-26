// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SubscriptionPlans } from './SubscriptionPlans';
import type { Subscription } from '../../services/subscriptionApi';
const mocks = vi.hoisted(() => ({ update: vi.fn(), plans: vi.fn(), prices: vi.fn(), savePlan: vi.fn(), audit: vi.fn() }));
vi.mock('../../services/api', () => ({ api: { get: mocks.audit } }));
vi.mock('../../services/subscriptionApi', () => ({ updateSubscription: mocks.update, billingApi: { plans: mocks.plans, info: async () => ({ model: 'test', billingMode: 'FREE' }), savePlan: mocks.savePlan } }));
vi.mock('./TokenPanels', () => ({ CompanyTokenPanel: () => <div>Token các HR</div>, TokenHistoryPanel: () => null }));
const config = { name: 'FREE' as const, tokenLimit: 100000, cycleDays: 30, maxCvPerCall: 1, maxOutputTokens: 4096, version: 1, maxPages: 2, maxCharacters: 3000 };
const subscription: Subscription = { ...config, companyId: 'co', billingCycle: 'MONTHLY', endsAt: null, bulk: false, used: 90000, remaining: 9000, reservedTokens: 1000, periodStart: '2026-11-01T00:00:00Z', periodEnd: '2026-12-01T00:00:00Z' };
beforeEach(() => { mocks.plans.mockResolvedValue([config]); mocks.prices.mockResolvedValue([]); mocks.update.mockResolvedValue({}); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('renders readable audit history without internal identifiers or unnecessary pagination', async () => {
  mocks.audit.mockResolvedValue({ data: { total: 1, data: [{ id: 'change', createdAt: '2026-11-26T10:00:00Z', actorId: 'SYSTEM_MIGRATION', action: 'PLAN_CONFIG', targetId: 'PLUS', reason: 'Internal migration details', after: { monthlyPriceVnd: 100000 } }] } });
  render(<SubscriptionPlans admin />);
  const details = screen.getByText('Lịch sử thay đổi gói và đơn giá').closest('details')!;
  details.open = true; fireEvent(details, new Event('toggle'));
  expect(await screen.findByText('Cập nhật cấu hình gói · PLUS')).toBeTruthy();
  expect(screen.queryByText(/SYSTEM_MIGRATION|PLAN_CONFIG|monthlyPriceVnd|Internal migration details/)).toBeNull();
  expect(screen.queryByRole('navigation', { name: 'Phân trang lịch sử thay đổi' })).toBeNull();
});
it('does not render the removed HR dashboard block', () => {
  render(<SubscriptionPlans subscription={subscription} />);
  expect(screen.queryByText('Gói FREE · Token cá nhân')).toBeNull();
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Lưu gói doanh nghiệp' })).toBeNull();
});
it('lets admin assign a company plan with a durable receipt and reason', async () => {
  const updated = vi.fn(); render(<SubscriptionPlans subscription={subscription} admin onUpdated={updated} />);
  fireEvent.change(screen.getByLabelText('Gói doanh nghiệp'), { target: { value: 'PLUS' } });
  fireEvent.change(screen.getByLabelText('Lý do đổi gói'), { target: { value: 'Nâng cấp doanh nghiệp' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu gói doanh nghiệp' }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('co', 'PLUS', 'MONTHLY', null, 'Nâng cấp doanh nghiệp', expect.any(String)));
  expect(updated).toHaveBeenCalledTimes(1);
});
it('keeps failures visible and reuses the same receipt when retrying the same change', async () => {
  mocks.update.mockRejectedValue(new Error('offline'));
  render(<SubscriptionPlans subscription={subscription} admin />);
  fireEvent.change(screen.getByLabelText('Lý do đổi gói'), { target: { value: 'Nâng cấp' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu gói doanh nghiệp' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Lưu gói doanh nghiệp' }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(2));
  expect(mocks.update.mock.calls[0][5]).toBe(mocks.update.mock.calls[1][5]);
});
it('shows configurable token plans even when no company is selected', async () => {
  render(<SubscriptionPlans admin />);
  expect(await screen.findByLabelText('FREE Token mỗi tài khoản')).toBeTruthy();
  expect(screen.getByText(/Chọn doanh nghiệp ở bộ lọc/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Lưu gói doanh nghiệp' })).toBeNull();
});
