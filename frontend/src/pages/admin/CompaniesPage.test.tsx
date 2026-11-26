// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompaniesPage } from './CompaniesPage';
import { MemoryRouter } from 'react-router-dom';
const AdminDashboardPage = () => <MemoryRouter><CompaniesPage /></MemoryRouter>;
import type { AdminDashboard } from '../../services/adminDashboardApi';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../services/adminDashboardApi', () => ({ getAdminDashboard: mocks.get }));
vi.mock('../../services/subscriptionApi', () => ({ updateSubscription: vi.fn(), billingApi: { plans: async () => [], info: async () => ({ model: 'test', billingMode: 'FREE' }) } }));
const fixture: AdminDashboard = {
  aiUsageSince: null,
  range: '7d', overview: { totalUsers: 0, activeUsers: 0, lockedUsers: 0, totalJobs: 0, totalCandidates: 0, failedCandidates: 0, totalMatches: 0 },
  distribution: [], ai: { simulatedCostVnd: 0, demoInputRate: 10000, demoOutputRate: 30000, billingMode: 'PAID', inputTokens: 0, outputTokens: 0, estimatedCostUsd: null, inputRate: null, outputRate: null, calls: 0, callsWithoutTokenData: 0, daily: [] }, enterprises: [],
};
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue(fixture); });
describe('Dashboard quản trị', () => {
  it('shows recorded free costs without presenting simulated money as an expense', async () => {
    mocks.get.mockResolvedValue({ ...fixture, ai: { ...fixture.ai, billingMode: 'FREE', inputTokens: 311, outputTokens: 110, simulatedCostVnd: 6.41, actualCostUsd: '0', callsWithoutPrice: 0 } });
    render(<AdminDashboardPage />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Sử dụng AI' }));
    expect((await screen.findAllByText('0 USD')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/API Free tier|API đang dùng Free tier|Áp dụng cho cả FREE và PLUS/)).toBeNull();
    expect(screen.queryByText('6,41 đ')).toBeNull();
    expect(screen.queryByText('Chi phí quy đổi (mô phỏng)')).toBeNull();
    expect(screen.queryByText('Chưa cấu hình đơn giá')).toBeNull();
    expect(screen.queryByText('Cách tính chi phí AI')).toBeNull();
    expect(screen.queryByText(/USD\/triệu token/)).toBeNull();
  });
  it('shows loading and empty states', async () => {
    render(<AdminDashboardPage/>);
    expect(screen.getByRole('status').textContent).toContain('Đang tải');
    expect(await screen.findByText('Chưa có tài khoản doanh nghiệp.')).toBeTruthy();
    expect(screen.queryByText('Phân bổ điểm toàn hệ thống')).toBeNull();
    expect(screen.getByRole('region', { name: 'Quản lý gói và token' })).toBeTruthy();
    expect(screen.queryByText('FREE — Trải nghiệm cơ bản')).toBeNull();
    expect(screen.queryByText('Khuyên dùng')).toBeNull();

  });
  it('refreshes the admin overview when returning to the tab without reloading the page', async () => {
    const listeners = vi.spyOn(window, 'addEventListener');
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    try {
      render(<AdminDashboardPage />);
      await screen.findByText('Chưa có tài khoản doanh nghiệp.');
      mocks.get.mockResolvedValue({ ...fixture, overview: { ...fixture.overview, totalJobs: 5 } });
      await waitFor(() => expect(listeners).toHaveBeenCalledWith('focus', expect.any(Function)));
      fireEvent(window, new Event('focus'));
      await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
      expect(screen.queryByRole('status')).toBeNull();
    } finally { vi.restoreAllMocks(); }
  });
  it('shows an error and allows retry', async () => {
    mocks.get.mockRejectedValueOnce(new Error('offline'));
    render(<AdminDashboardPage/>);
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByText('Thử lại'));
    expect(await screen.findByText('Chưa có tài khoản doanh nghiệp.')).toBeTruthy();
  });
  it('requests the selected range', async () => {
    render(<AdminDashboardPage/>);
    await screen.findByText('Chưa có tài khoản doanh nghiệp.');
    fireEvent.change(screen.getByLabelText('Khoảng thời gian AI'), { target: { value: '30d' } });
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith('30d', expect.any(AbortSignal), undefined));
  });
  it('sorts company activity by JD count', async () => {
    const activity = { hrCount: 0, members: [], fullName: 'Nhân sự', lastLoginAt: null, candidateCount: 0, matchCount: 0, inputTokens: 0, outputTokens: 0, calls: 0, estimatedCostUsd: null };
    mocks.get.mockResolvedValue({ ...fixture, enterprises: [{ ...activity, id: 'a', companyName: 'Alpha', jobCount: 1 }, { ...activity, id: 'b', companyName: 'Beta', jobCount: 3 }] });
    render(<AdminDashboardPage/>);
    await screen.findByRole('button', { name: 'Alpha' });
    fireEvent.click(screen.getByRole('button', { name: /JD/ }));
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows[1].textContent).toContain('Beta');
  });
  it('retains deleted-account activity without the removed usage explanation', async () => {
    mocks.get.mockResolvedValue({ ...fixture, aiUsageSince: '2026-11-17T00:00:00Z', enterprises: [{ id: null, fullName: 'Tài khoản đã xóa', companyName: 'Tài khoản đã xóa', lastLoginAt: null, jobCount: 0, candidateCount: 0, matchCount: 0, inputTokens: 100, outputTokens: 50, calls: 2, estimatedCostUsd: 0.001 }] });
    render(<AdminDashboardPage />);
    await screen.findAllByText('Tài khoản đã xóa');
    expect(screen.queryByText(/Chi phí AI tính từ/)).toBeNull();
    expect(screen.getAllByText('Tài khoản đã xóa').length).toBeGreaterThan(0);
    expect(screen.getByRole('columnheader', { name: 'Lượt gọi AI' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Chi phí Gemini (USD)' })).toBeTruthy();
  });
  it('opens company HR details and filters AI usage by company', async () => {
    const hr = { id: 'hr-a', fullName: 'HR Alpha', email: 'hr@alpha.test', isActive: true, lastLoginAt: null, jobCount: 2, candidateCount: 3, matchCount: 1, inputTokens: 120, outputTokens: 30, calls: 1 };
    mocks.get.mockResolvedValue({ ...fixture, enterprises: [{ id: 'alpha', companyName: 'Alpha', fullName: 'Alpha', lastLoginAt: null, hrCount: 1, members: [hr], jobCount: 2, candidateCount: 3, matchCount: 1, inputTokens: 120, outputTokens: 30, calls: 1, estimatedCostUsd: null }] });
    render(<AdminDashboardPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Alpha' }));
    const details = await screen.findByRole('region', { name: 'HR thuộc Alpha' });
    expect(within(details).getByText('hr@alpha.test')).toBeTruthy();
    expect(within(details).getByText('120')).toBeTruthy();
    fireEvent.click(within(details).getByRole('button', { name: 'Thu gọn' }));
    expect(screen.queryByRole('region', { name: 'HR thuộc Alpha' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Doanh nghiệp thống kê AI'), { target: { value: 'alpha' } });
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith('7d', expect.any(AbortSignal), 'alpha'));
  });
});

it('searches companies and paginates ten rows', async () => {
  mocks.get.mockResolvedValue({ ...fixture, enterprises: Array.from({ length: 12 }, (_, i) => ({ id: `co-${i}`, companyName: `Doanh nghiệp ${String(i).padStart(2, '0')}`, members: [], jobCount: 0, candidateCount: 0, matchCount: 0, inputTokens: 0, outputTokens: 0, calls: 0, actualCostUsd: '0' })) });
  render(<AdminDashboardPage />);
  const search = await screen.findByRole('textbox', { name: 'Tìm doanh nghiệp' });
  expect(screen.getAllByRole('button', { name: /^Doanh nghiệp \d/ })).toHaveLength(10);
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Phân trang doanh nghiệp' })).getByText('Sau'));
  expect(screen.getAllByRole('button', { name: /^Doanh nghiệp \d/ })).toHaveLength(2);
  fireEvent.change(search, { target: { value: 'doanh nghiep 01' } });
  expect(screen.getAllByRole('button', { name: /^Doanh nghiệp \d/ })).toHaveLength(1);
  expect(screen.queryByRole('navigation', { name: 'Phân trang doanh nghiệp' })).toBeNull();
});
