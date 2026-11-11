import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ me: vi.fn(), login: vi.fn() }));
vi.mock('./authApi', () => ({ authApi: { me: mocks.me, login: mocks.login } }));
vi.mock('../../store/useJobStore', () => ({ useJobStore: { setState: vi.fn() } }));
vi.mock('../../store/useCandidateStore', () => ({ useCandidateStore: { setState: vi.fn() } }));
import { useAuthStore } from './authStore';
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
