// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminDashboardPage } from './DashboardPage';
import type { AdminDashboard } from '../../services/adminDashboardApi';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../services/adminDashboardApi', () => ({ getAdminDashboard: mocks.get }));
const fixture: AdminDashboard = {
  range: '7d', overview: { totalUsers: 0, activeUsers: 0, lockedUsers: 0, totalJobs: 0, totalCandidates: 0, failedCandidates: 0, totalMatches: 0 },
  distribution: [], ai: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: null, inputRate: null, outputRate: null, calls: 0, callsWithoutTokenData: 0, daily: [] }, enterprises: [],
};
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue(fixture); });
describe('Dashboard quản trị', () => {
  it('shows loading and empty states', async () => {
    render(<AdminDashboardPage/>);
    expect(screen.getByRole('status').textContent).toContain('Đang tải');
    expect(await screen.findByText('Chưa có tài khoản doanh nghiệp.')).toBeTruthy();
    expect(screen.getByText('Chưa có kết quả matching.')).toBeTruthy();
    expect(screen.getByText('Chưa cấu hình đơn giá')).toBeTruthy();
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
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith('30d', expect.any(AbortSignal)));
  });
  it('sorts company activity by JD count', async () => {
    const activity = { fullName: 'Nhân sự', lastLoginAt: null, candidateCount: 0, matchCount: 0, inputTokens: 0, outputTokens: 0 };
    mocks.get.mockResolvedValue({ ...fixture, enterprises: [{ ...activity, id: 'a', companyName: 'Alpha', jobCount: 1 }, { ...activity, id: 'b', companyName: 'Beta', jobCount: 3 }] });
    render(<AdminDashboardPage/>);
    await screen.findByText('Alpha');
    fireEvent.click(screen.getByRole('button', { name: /JD/ }));
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows[1].textContent).toContain('Beta');
  });
});
