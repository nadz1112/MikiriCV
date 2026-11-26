// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AccountPage } from './AccountPage';
import { Navbar } from '../components/common/Navbar';
import { AccountDialogs } from '../features/subscription/components/AccountDialogs';
import { useAccountDialogsStore } from '../features/subscription/accountDialogsStore';
import { useAuthStore, type AuthUser } from '../features/auth/authStore';
import { useSubscriptionStore } from '../features/subscription/subscriptionStore';
import type { PersonalUsageHistory, PlanComparison, Subscription } from '../services/subscriptionApi';

const mocks = vi.hoisted(() => ({ history: vi.fn(), plans: vi.fn(), fetch: vi.fn(), fetchMe: vi.fn(), password: vi.fn() }));
vi.mock('../services/subscriptionApi', () => ({ getPersonalUsageHistory: mocks.history, getPlanComparison: mocks.plans, getSubscription: vi.fn(), getTokenBalance: vi.fn() }));
vi.mock('../services/api', () => ({ api: { post: mocks.password } }));
const user: AuthUser = { id: 'self', fullName: 'HR của tôi', email: 'self@example.test', companyName: 'Công ty mẫu', role: 'ENTERPRISE', isActive: true, mustChangePassword: false, lastLoginAt: null };
const subscription: Subscription = { companyId: 'company', name: 'FREE', billingCycle: 'MONTHLY', endsAt: null, tokenLimit: 100000, cycleDays: 30, maxCvPerCall: 1, maxOutputTokens: 4096, maxPages: 2, maxCharacters: 3000, bulk: false, used: 70000, remaining: 25000, reservedTokens: 5000, periodStart: '2026-11-26T00:00:00Z', periodEnd: '2026-12-26T00:00:00Z' };
const history: PersonalUsageHistory = { entries: [{ id: 'call-1', createdAt: '2026-11-26T03:00:00Z', jobTitle: 'Lập trình viên React', cvCount: 1, tokensUsed: 1000, succeeded: true }], page: 1, pageSize: 20, total: 21, estimate: { averageTokensPerCv: 1000, sampleCount: 21, source: 'PERSONAL_HISTORY' } };
const plans: PlanComparison[] = [
  { name: 'FREE', tokenLimit: 123456, cycleDays: 7, maxCvPerCall: 2, maxPages: 2, maxCharacters: 3333 },
  { name: 'PLUS', tokenLimit: 998877, cycleDays: 31, maxCvPerCall: 77, maxPages: 6, maxCharacters: 15000 },
];
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user, status: 'authenticated', fetchMe: mocks.fetchMe });
  const ownSubscription = { ...subscription, accounts: [{ fullName: 'HR khác không được xem' }] };
  useSubscriptionStore.setState({ subscription: ownSubscription, isLoading: false, error: '', fetchSubscription: mocks.fetch });
  mocks.fetch.mockResolvedValue(undefined); mocks.fetchMe.mockResolvedValue(undefined); mocks.password.mockResolvedValue({});
  mocks.history.mockResolvedValue(history); mocks.plans.mockResolvedValue(plans);
  useAccountDialogsStore.getState().close();
});
afterEach(() => { cleanup(); useAccountDialogsStore.getState().close(); });
function account(tab = 'profile') {
  return render(<MemoryRouter initialEntries={[`/account?tab=${tab}`]}><AccountPage /><AccountDialogs /></MemoryRouter>);
}
it('shows loading, retryable errors, and empty personal history without inventing usage', async () => {
  useSubscriptionStore.setState({ subscription: null, isLoading: true });
  const view = account('plan');
  expect(screen.getByText('Đang tải gói và token cá nhân…')).toBeTruthy();
  act(() => useSubscriptionStore.setState({ isLoading: false, error: 'Không thể tải gói.' }));
  expect(screen.getByRole('alert').textContent).toContain('Không thể tải gói.');
  view.unmount();
  useSubscriptionStore.setState({ subscription, isLoading: false, error: '' });
  mocks.history.mockResolvedValue({ ...history, entries: [], total: 0, estimate: { averageTokensPerCv: 2000, sampleCount: 0, source: 'DEFAULT' } });
  account('plan');
  expect(await screen.findByText('Bạn chưa có lịch sử sử dụng ở trang này.')).toBeTruthy();
  expect(screen.getByText(/dùng mức tham khảo 2.000 token\/CV/)).toBeTruthy();
});
it('keeps failed personal history and comparison requests retryable', async () => {
  mocks.history.mockRejectedValueOnce(new Error('offline'));
  account('plan');
  expect(await screen.findByRole('alert')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText('Lập trình viên React')).toBeTruthy();
  mocks.plans.mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Nâng cấp' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText('998.877')).toBeTruthy();
});
it('shows read-only profile, security and personal plan tabs without other HR accounts or price cards', async () => {
  account();
  expect(screen.getByRole('tab', { name: 'Hồ sơ' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByText('self@example.test')).toBeTruthy(); expect(screen.queryByRole('textbox')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Bảo mật' }));
  expect(screen.getByLabelText('Mật khẩu hiện tại')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Gói & token' }));
  expect(await screen.findByText('Lập trình viên React')).toBeTruthy();
  expect(screen.getByText('Ngày đặt lại chu kỳ: 26/12/2026')).toBeTruthy();
  expect(screen.getByText(/≈ 25 CV có thể xử lý/)).toBeTruthy();
  expect(screen.getByRole('progressbar').getAttribute('value')).toBe('70000');
  expect(screen.queryByText('HR khác không được xem')).toBeNull();
  expect(screen.queryByText('Token các tài khoản')).toBeNull(); expect(screen.queryByText('PLUS')).toBeNull();
  expect(screen.getByRole('tabpanel').textContent).not.toMatch(/provider|thinking|input\/output/i);
  expect(screen.getByRole('button', { name: /Đang giữ/ }).getAttribute('aria-describedby')).toBe('held-tokens-help');
});
it('reuses the existing password endpoint from the security tab and stays in that tab', async () => {
  account('security');
  fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: 'Current123' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'Changed123' } });
  fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu mới'), { target: { value: 'Changed123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cập nhật mật khẩu' }));
  expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Đã đổi mật khẩu thành công.');
  expect(mocks.password).toHaveBeenCalledWith('/auth/change-password', { currentPassword: 'Current123', newPassword: 'Changed123' });
  expect(screen.getByRole('tab', { name: 'Bảo mật' }).getAttribute('aria-selected')).toBe('true');
});
it('paginates only personal history and opens a comparison fetched from real configuration', async () => {
  account('plan'); await screen.findByText('Lập trình viên React');
  fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
  await waitFor(() => expect(mocks.history).toHaveBeenLastCalledWith(2, expect.any(AbortSignal)));
  fireEvent.click(screen.getByRole('button', { name: 'Nâng cấp' }));
  expect(await screen.findByRole('dialog', { name: 'So sánh gói' })).toBeTruthy();
  expect(await screen.findByText('123.456')).toBeTruthy(); expect(screen.getByText('998.877')).toBeTruthy();
  expect(screen.getByText('Liên hệ quản trị viên để nâng cấp gói')).toBeTruthy();
});
it('handles loading, read errors and empty history without inventing usage', async () => {
  useSubscriptionStore.setState({ subscription: null, isLoading: true });
  const view = account('plan');
  expect(screen.getByRole('status').textContent).toContain('Đang tải gói');
  act(() => useSubscriptionStore.setState({ isLoading: false, error: 'Không thể tải dữ liệu.' }));
  expect(screen.getByRole('alert').textContent).toContain('Không thể tải dữ liệu.');
  view.unmount();
  useSubscriptionStore.setState({ subscription, isLoading: false, error: '' });
  mocks.history.mockResolvedValue({ ...history, entries: [], total: 0, estimate: { averageTokensPerCv: 2000, sampleCount: 0, source: 'DEFAULT' } });
  account('plan'); expect(await screen.findByText(/Bạn chưa có lịch sử/)).toBeTruthy();
  expect(screen.getByText(/chỉ là ước tính/).textContent).toContain('mức tham khảo');
});
it('hides upgrade action for PLUS', () => {
  useSubscriptionStore.setState({ subscription: { ...subscription, name: 'PLUS' } }); account('plan');
  expect(screen.queryByRole('button', { name: 'Nâng cấp' })).toBeNull();
});
it('shows the HR token chip with warning at 20%, red at zero, and hides it from ADMIN', () => {
  render(<MemoryRouter><Navbar /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Token còn 25.000' }).className).toContain('bg-blue-50');
  act(() => useSubscriptionStore.setState({ subscription: { ...subscription, remaining: 20000 } }));
  expect(screen.getByRole('link', { name: 'Token còn 20.000' }).className).toContain('bg-amber-50');
  expect(screen.getByRole('link', { name: 'Token còn 20.000' }).getAttribute('href')).toBe('/account?tab=plan');
  act(() => useSubscriptionStore.setState({ subscription: { ...subscription, remaining: 0 } }));
  expect(screen.getByRole('link', { name: 'Token còn 0' }).className).toContain('bg-red-50');
  fireEvent.click(screen.getByRole('button', { name: 'Mở menu người dùng' }));
  expect(screen.getByRole('link', { name: 'Tài khoản của tôi' }).getAttribute('href')).toBe('/account');
  act(() => useAuthStore.setState({ user: { ...user, role: 'ADMIN' } }));
  expect(screen.queryByRole('link', { name: /Token còn/ })).toBeNull();
});
