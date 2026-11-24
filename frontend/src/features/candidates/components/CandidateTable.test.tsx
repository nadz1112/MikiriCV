// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CandidateTable } from './CandidateTable';
import type { CandidateItem } from '../api/candidateApi';
import { candidateApi } from '../api/candidateApi';
import { useCandidateFeatureStore } from '../store/candidateStore';
import userEvent from '@testing-library/user-event';

const auth = vi.hoisted(() => ({ user: { role: 'ADMIN' } }));
vi.mock('../../auth/authStore', () => ({ useAuthStore: (select: (state: typeof auth) => unknown) => select(auth) }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useCandidateFeatureStore.setState(useCandidateFeatureStore.getInitialState());
});
const candidate: CandidateItem = { id: 'cv', fullName: 'Ứng viên mẫu', email: null, phone: null, yearsOfExperience: 1, skills: [], education: null, fileName: 'cv.pdf', extractionStatus: 'SUCCESS', extractionMessage: null, matchScore: null, createdAt: '2026-11-11', uploadedBy: { id: 'hr', fullName: 'Người tải mẫu', companyName: 'Công ty mẫu', email: 'sample@example.test' } };
const show = (item = candidate, onCandidateDeleted = () => {}) => render(<CandidateTable candidates={[item]} total={1} page={1} limit={50} isLoading={false} onPageChange={() => {}} onCandidateDeleted={onCandidateDeleted} />);
describe('cột người tải lên', () => {
  it('hiển thị họ tên và công ty cho admin', () => {
    auth.user.role = 'ADMIN'; show();
    expect(screen.getByText('Người tải lên')).toBeTruthy();
    expect(screen.getByText('Người tải mẫu')).toBeTruthy();
    expect(screen.getByText('Công ty mẫu')).toBeTruthy();
  });
  it('ẩn cột và thông tin người tải đối với HR', () => {
    auth.user.role = 'ENTERPRISE'; show();
    expect(screen.queryByText('Người tải lên')).toBeNull();
    expect(screen.queryByText('Công ty mẫu')).toBeNull();
  });
});

describe('cột chọn CV và điểm AI theo vai trò', () => {
  it.each([undefined, 'jd'])('admin không có checkbox hoặc điểm AI, kể cả khi có JD: %s', (jobId) => {
    auth.user.role = 'ADMIN';
    useCandidateFeatureStore.getState().setJobId(jobId);
    useCandidateFeatureStore.setState({ selectedCandidateIds: ['cv'] });
    show({ ...candidate, matchScore: 87 });
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByRole('columnheader', { name: 'Điểm AI' })).toBeNull();
    expect(screen.queryByText('87')).toBeNull();
    expect(screen.queryByText('Đã chọn 1')).toBeNull();
    expect(screen.getByTitle('Xóa ứng viên')).toBeTruthy();
  });

  it('HR vẫn chọn được CV khi chưa chọn JD, nhưng không hiện cột điểm AI', async () => {
    auth.user.role = 'ENTERPRISE';
    const user = userEvent.setup();
    show();
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.queryByRole('columnheader', { name: 'Điểm AI' })).toBeNull();
    await user.click(screen.getByTitle('Chọn ứng viên để chạy AI Matching'));
    expect(useCandidateFeatureStore.getState().selectedCandidateIds).toEqual(['cv']);
  });

  it('HR thấy điểm AI khi đã chọn JD đang làm việc', () => {
    auth.user.role = 'ENTERPRISE';
    useCandidateFeatureStore.getState().setJobId('jd');
    show({ ...candidate, matchScore: 87 });
    expect(screen.getByRole('columnheader', { name: 'Điểm AI' })).toBeTruthy();
    expect(screen.getByText('87')).toBeTruthy();
  });
});

it('admin phải xác nhận xóa và thấy số matching cascade khi dữ liệu đã có', async () => {
  auth.user.role = 'ADMIN';
  const user = userEvent.setup();
  const remove = vi.spyOn(candidateApi, 'delete').mockResolvedValue({ success: true, message: 'Đã xóa ứng viên' });
  const refresh = vi.fn();
  show({ ...candidate, matchResults: [{ jobDescriptionId: 'jd-1', score: 80 }, { jobDescriptionId: 'jd-2', score: 70 }] }, refresh);
  await user.click(screen.getByTitle('Xóa ứng viên'));
  expect(screen.getByText('Xác nhận xóa ứng viên')).toBeTruthy();
  expect(screen.getByText('2 kết quả đánh giá AI (MatchResult)')).toBeTruthy();
  expect(remove).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Xác nhận xóa vĩnh viễn' }));
  expect(remove).toHaveBeenCalledWith('cv');
  expect(refresh).toHaveBeenCalledOnce();
});

it('opens admin details with extraction, uploader, CV text and matching history', async () => {
  auth.user.role = 'ADMIN';
  const user = userEvent.setup();
  const detail = { ...candidate, rawText: 'Dòng CV đầu\nDòng CV sau', extractionStatus: 'WARNING' as const, extractionMessage: 'Thiếu số điện thoại', matchResults: [{ jobDescriptionId: 'jd', jobTitle: 'React Developer', score: 85, summary: 'Phù hợp với vị trí', matchedSkills: ['React'], missingSkills: ['Docker'], evaluatedAt: '2026-11-17T00:00:00Z' }] };
  const load = vi.spyOn(candidateApi, 'getById').mockResolvedValue(detail);
  show();
  await user.click(screen.getByRole('button', { name: 'Ứng viên mẫu' }));
  expect(await screen.findByText('Lịch sử matching theo JD')).toBeTruthy();
  expect(load).toHaveBeenCalledWith('cv');
  expect(screen.getByText('Thiếu số điện thoại')).toBeTruthy();
  expect(screen.getByText('React Developer')).toBeTruthy();
  expect(screen.getByText('Phù hợp với vị trí')).toBeTruthy();
  expect(screen.getByText('Docker')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: /Văn bản trích xuất thô/ }));
  expect(screen.getByText(/Dòng CV đầu/).textContent).toBe(detail.rawText);
  expect(screen.getByRole('link', { name: 'Xem tệp CV gốc' }).getAttribute('href')).toBe('/api/candidates/cv/file');
  await user.click(within(screen.getByRole('dialog', { name: 'Chi tiết ứng viên' })).getByRole('button', { name: 'Xóa ứng viên' }));
  expect(screen.getByText('Xác nhận xóa ứng viên')).toBeTruthy();
});

it('shows a detail error and retries into the empty-history state', async () => {
  auth.user.role = 'ADMIN';
  const user = userEvent.setup();
  vi.spyOn(candidateApi, 'getById').mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ...candidate, rawText: '', matchResults: [] });
  show();
  await user.click(screen.getByRole('button', { name: 'Ứng viên mẫu' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Không thể tải chi tiết ứng viên');
  await user.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText('Chưa có kết quả matching')).toBeTruthy();
});

it('shows a loading state until the detail response arrives', async () => {
  auth.user.role = 'ADMIN';
  const user = userEvent.setup();
  vi.spyOn(candidateApi, 'getById').mockReturnValue(new Promise(() => {}));
  show();
  await user.click(screen.getByRole('button', { name: 'Ứng viên mẫu' }));
  expect(screen.getByRole('status').textContent).toContain('Đang tải chi tiết ứng viên');
});

it('shows reextract button only to HR for failed/warning candidates and calls reextract API', async () => {
  const user = userEvent.setup();
  const reextract = vi.spyOn(candidateApi, 'reextract').mockResolvedValue({
    success: true,
    message: 'Đã trích xuất lại',
    data: { ...candidate, extractionStatus: 'SUCCESS' },
  });
  const refresh = vi.fn();

  auth.user.role = 'ADMIN';
  show({ ...candidate, extractionStatus: 'FAILED', extractionMessage: 'Lỗi đọc file' }, refresh);
  expect(screen.queryByRole('button', { name: /Thử lại trích xuất/ })).toBeNull();
  cleanup();

  auth.user.role = 'ENTERPRISE';
  show({ ...candidate, extractionStatus: 'FAILED', extractionMessage: 'Lỗi đọc file' }, refresh);
  await user.click(screen.getByRole('button', { name: /Thử lại trích xuất/ }));
  expect(reextract).toHaveBeenCalledWith('cv');
  expect(refresh).toHaveBeenCalledOnce();
});
