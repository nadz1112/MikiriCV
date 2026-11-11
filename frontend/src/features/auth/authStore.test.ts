import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ me: vi.fn(), login: vi.fn() }));
vi.mock('./authApi', () => ({ authApi: { me: mocks.me, login: mocks.login } }));
vi.mock('../../store/useJobStore', () => ({ useJobStore: { setState: vi.fn() } }));
vi.mock('../../store/useCandidateStore', () => ({ useCandidateStore: { setState: vi.fn() } }));
import { useAuthStore, type AuthUser } from './authStore';
import { useCandidateFeatureStore } from '../candidates/store/candidateStore';
import { useJobFeatureStore } from '../jobs/store/jobStore';
import { useMatchingFeatureStore } from '../matching/store/matchingStore';
afterEach(() => { vi.clearAllMocks(); useAuthStore.setState({ user: null, status: 'loading' }); });

it('deduplicates simultaneous session probes including StrictMode initialization', async () => {
  mocks.me.mockResolvedValue(null);
  await Promise.all([useAuthStore.getState().fetchMe(), useAuthStore.getState().fetchMe()]);
  expect(mocks.me).toHaveBeenCalledTimes(1);
  expect(useAuthStore.getState().status).toBe('unauthenticated');
});

it('does not allow an old session probe to overwrite a successful login', async () => {
  let finish!: (value: null) => void;
  mocks.me.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const probe = useAuthStore.getState().fetchMe();
  const user = { id: 'new-user', role: 'ENTERPRISE' };
  mocks.login.mockResolvedValue(user);
  await useAuthStore.getState().login('user@example.com', 'password');
  finish(null);
  await probe;
  expect(useAuthStore.getState().user).toEqual(user);
  expect(useAuthStore.getState().status).toBe('authenticated');
});

it('clears HR selections and open job details when the session ends', () => {
  useCandidateFeatureStore.setState({ selectedCandidateIds: ['private-cv'], filter: { ...useCandidateFeatureStore.getState().filter, jobId: 'private-jd', enterpriseId: 'previous-company' } });
  useJobFeatureStore.getState().openDetailDrawer({ id: 'private-jd', title: 'Private job', description: 'Private description', requiredSkills: [], minExperience: 0, createdAt: '2026-11-11', updatedAt: '2026-11-11' });
  useMatchingFeatureStore.setState({ selectedJobId: 'private-jd', selectedCandidateIds: ['private-cv'], isConfirmModalOpen: true });
  useAuthStore.getState().setUnauthenticated();
  expect(useCandidateFeatureStore.getState().selectedCandidateIds).toEqual([]);
  expect(useCandidateFeatureStore.getState().filter.jobId).toBeUndefined();
  expect(useCandidateFeatureStore.getState().filter.enterpriseId).toBeUndefined();
  expect(useJobFeatureStore.getState().detailJob).toBeNull();
  expect(useMatchingFeatureStore.getState().selectedCandidateIds).toEqual([]);
  expect(useMatchingFeatureStore.getState().isConfirmModalOpen).toBe(false);
});

describe('khôi phục phiên đăng nhập', () => {
  it('gộp các lần kiểm tra đồng thời, kể cả hiệu ứng StrictMode', async () => {
    let finish: (user: AuthUser) => void = () => {};
    mocks.me.mockReturnValue(new Promise<AuthUser>((resolve) => { finish = resolve; }));
    const first = useAuthStore.getState().fetchMe();
    const second = useAuthStore.getState().fetchMe();
    expect(first).toBe(second);
    expect(mocks.me).toHaveBeenCalledTimes(1);
    finish({ id: 'hr', email: 'sample@example.test', fullName: 'Nhân sự mẫu', companyName: null, role: 'ENTERPRISE', isActive: true, mustChangePassword: false, lastLoginAt: null });
    await first;
    expect(useAuthStore.getState().status).toBe('authenticated');
  });
  it('kết thúc khôi phục khi không có phiên và cho phép kiểm tra lại sau đó', async () => {
    mocks.me.mockRejectedValue(new Error('unauthenticated'));
    await Promise.all([useAuthStore.getState().fetchMe(), useAuthStore.getState().fetchMe()]);
    expect(mocks.me).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    await useAuthStore.getState().fetchMe();
    expect(mocks.me).toHaveBeenCalledTimes(2);
  });
});
