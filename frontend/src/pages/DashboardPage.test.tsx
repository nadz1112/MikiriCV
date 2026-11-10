// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';

const api = vi.hoisted(() => ({ jobs: vi.fn(), stats: vi.fn(), jobStats: vi.fn(), list: vi.fn(), detail: vi.fn(), remove: vi.fn(), leaderboard: vi.fn() }));
vi.mock('../services/jobApi', () => ({ jobApi: { getAll: api.jobs, getStats: api.jobStats } }));
vi.mock('../services/dashboardApi', () => ({ dashboardApi: { getStats: api.stats } }));
vi.mock('../features/candidates/api/candidateApi', () => ({ candidateApi: { list: api.list } }));
vi.mock('../services/candidateApi', () => ({ candidateApi: { getById: api.detail, delete: api.remove } }));
vi.mock('../services/matchingApi', () => ({ matchingApi: { getLeaderboard: api.leaderboard } }));
vi.mock('../features/auth/authStore', () => ({ useAuthStore: () => ({ user: { role: 'ENTERPRISE' } }) }));
vi.mock('../components/dashboard/ScoreDistributionChart', () => ({ ScoreDistributionChart: () => <div>Biểu đồ</div> }));

const candidate = { id: 'c1', fullName: 'Ứng viên trang đầu', email: null, phone: null, skills: ['React'],
  education: null, yearsOfExperience: 2, fileName: 'cv.pdf', extractionStatus: 'SUCCESS', extractionMessage: null, createdAt: '2026-11-01T00:00:00Z' };
const renderDashboard = () => render(<MemoryRouter><DashboardPage/></MemoryRouter>);
beforeEach(() => {
  vi.resetAllMocks();
  api.jobs.mockResolvedValue([]);
  api.stats.mockResolvedValue({ totalJobs: 0, totalCandidates: 75, totalMatches: 12, qualifiedMatches: 6, qualifiedRate: 50, avgScore: 65 });
  api.list.mockResolvedValue({ data: [candidate], total: 75, page: 1, limit: 20 });
  api.detail.mockResolvedValue({ ...candidate, rawText: 'Văn bản riêng của CV', matchResults: [] });
  api.remove.mockResolvedValue({ success: true });
});
afterEach(cleanup);

describe('dashboard on FR2 data contracts', () => {
  it('uses server totals and requests subsequent pages instead of counting the visible page', async () => {
    renderDashboard();
    expect(await screen.findByText('75')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Danh mục ứng viên' }));
    await screen.findByText(candidate.fullName);
    expect(screen.getByText('Trang 1/4 · 75 hồ sơ')).toBeTruthy();
    api.list.mockResolvedValue({ data: [{ ...candidate, id: 'c2', fullName: 'Ứng viên trang hai' }], total: 75, page: 2, limit: 20 });
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(await screen.findByText('Ứng viên trang hai')).toBeTruthy();
    expect(api.list).toHaveBeenLastCalledWith({ search: '', page: 2, limit: 20 });
    fireEvent.change(screen.getByPlaceholderText('Tìm theo tên, email, kỹ năng...'), { target: { value: 'Nguyễn' } });
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ search: 'Nguyễn', page: 1, limit: 20 }));
  });

  it('loads private text only on opening detail and uses the authorized file endpoint', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: 'Danh mục ứng viên' }));
    fireEvent.click(await screen.findByText(candidate.fullName));
    const fileLink = await screen.findByRole('link', { name: 'Xem tệp CV gốc' });
    expect(fileLink.getAttribute('href')).toBe('/api/candidates/c1/file');
    expect(api.detail).toHaveBeenCalledWith('c1');
  });

  it('refreshes statistics and clamps an empty last page after deletion', async () => {
    api.list.mockResolvedValueOnce({ data: [candidate], total: 21, page: 1, limit: 20 });
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: 'Danh mục ứng viên' }));
    await screen.findByText(candidate.fullName);
    api.list.mockResolvedValueOnce({ data: [candidate], total: 21, page: 2, limit: 20 });
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    await screen.findByText('Trang 2/2 · 21 hồ sơ');
    fireEvent.click(await screen.findByTitle('Xóa ứng viên'));
    api.list.mockResolvedValue({ data: [], total: 20, page: 2, limit: 20 });
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận xóa vĩnh viễn' }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(api.stats).toHaveBeenCalledTimes(2));
    await screen.findByText('Trang 1/1 · 20 hồ sơ');
  });

  it('shows a load failure rather than a successful empty candidate result', async () => {
    api.list.mockRejectedValue(new Error('Network unavailable'));
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: 'Danh mục ứng viên' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Không thể tải danh sách ứng viên');
  });

  it('ignores an older search response arriving after the latest result', async () => {
    let resolveOld!: (value: unknown) => void;
    api.list.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: 'Danh mục ứng viên' }));
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(1));
    api.list.mockResolvedValue({ data: [{ ...candidate, fullName: 'Kết quả mới' }], total: 1, page: 1, limit: 20 });
    fireEvent.change(screen.getByPlaceholderText('Tìm theo tên, email, kỹ năng...'), { target: { value: 'mới' } });
    await screen.findByText('Kết quả mới');
    resolveOld({ data: [candidate], total: 75, page: 1, limit: 20 });
    await waitFor(() => expect(screen.queryByText(candidate.fullName)).toBeNull());
    expect(screen.getByText('Kết quả mới')).toBeTruthy();
  });
});
