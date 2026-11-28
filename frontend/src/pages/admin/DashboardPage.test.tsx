// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminDashboardPage } from './DashboardPage';
vi.mock('../../services/adminDashboardApi', () => ({ getAdminDashboard: async () => ({ overview: { activeUsers: 0, lockedUsers: 0 }, ai: { inputTokens: 0, outputTokens: 0, actualCostUsd: '0', calls: 0, daily: [] }, enterprises: [] }) }));
afterEach(cleanup);
it('shows overview without company configuration forms', async () => {
  render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);
  expect(await screen.findByText('Top doanh nghiệp sử dụng token')).toBeTruthy();
  expect(screen.queryByText('HR đang hoạt động')).toBeNull();
  expect(screen.queryByRole('region', { name: 'Quản lý gói và token' })).toBeNull();
});
