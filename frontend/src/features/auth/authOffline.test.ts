import { afterEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const mocks = vi.hoisted(() => ({
  me: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
}));

vi.mock('../../features/auth/authApi', () => ({
  authApi: {
    me: mocks.me,
    login: mocks.login,
    logout: mocks.logout,
    changePassword: mocks.changePassword,
  },
}));
vi.mock('../../store/useJobStore', () => ({ useJobStore: { setState: vi.fn() } }));
vi.mock('../../store/useCandidateStore', () => ({ useCandidateStore: { setState: vi.fn() } }));

import { useAuthStore, type AuthUser } from './authStore';
import { offlineDb } from '../../shared/offline/offlineDb';

const sampleUser: AuthUser = {
  id: 'hr-offline-1',
  email: 'hr@example.com',
  fullName: 'Nhân sự Offline',
  companyName: 'Mikiri Corp',
  role: 'ENTERPRISE',
  isActive: true,
  mustChangePassword: false,
  lastLoginAt: null,
};

afterEach(async () => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, status: 'loading', isOfflineSession: false });
  await offlineDb.purgeAllOfflineData();
});

describe('offline session persistence and revalidation', () => {
  it('preserves authenticated offline session on network error when valid session_meta exists', async () => {
    mocks.login.mockResolvedValue(sampleUser);
    await useAuthStore.getState().login('hr@example.com', 'Password123');
    await offlineDb.saveSessionMeta(sampleUser);

    const networkErr = new AxiosError('Network Error', 'ERR_NETWORK', {} as InternalAxiosRequestConfig);
    mocks.me.mockRejectedValueOnce(networkErr);

    await useAuthStore.getState().fetchMe();

    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().isOfflineSession).toBe(true);
    expect(useAuthStore.getState().user?.id).toBe('hr-offline-1');
  });

  it('clears offline session and cached data when revalidation later fails with 401', async () => {
    await offlineDb.saveSessionMeta(sampleUser);
    const config = {} as InternalAxiosRequestConfig;
    const unauthorizedErr = new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
      config,
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      data: {},
    });
    mocks.me.mockRejectedValueOnce(unauthorizedErr);

    await useAuthStore.getState().fetchMe();

    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useAuthStore.getState().isOfflineSession).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(await offlineDb.getValidSessionMeta()).toBeNull();
  });
});
