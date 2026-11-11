// @vitest-environment jsdom
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../features/candidates/store/removeDeletedCandidate', () => ({ removeDeletedCandidate: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));

function unauthorized(config: InternalAxiosRequestConfig) {
  return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, { config, status: 401, statusText: 'Unauthorized', headers: {}, data: {} });
}
function success(config: InternalAxiosRequestConfig, data = {}) {
  return { config, status: 200, statusText: 'OK', headers: {}, data };
}
afterEach(() => { vi.restoreAllMocks(); vi.resetModules(); });

it('stops refreshing and emits one expiry event after the refresh cookie is rejected', async () => {
  const { api } = await import('./api');
  const events = vi.spyOn(window, 'dispatchEvent');
  const refresh = vi.spyOn(axios, 'post').mockRejectedValue(unauthorized({} as InternalAxiosRequestConfig));
  api.defaults.adapter = async (config) => { throw unauthorized(config); };
  await expect(api.get('/jobs')).rejects.toBeTruthy();
  await expect(api.get('/jobs')).rejects.toBeTruthy();
  await expect(api.get('/auth/me')).rejects.toBeTruthy();
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(events.mock.calls.filter(([event]) => event.type === 'auth:expired')).toHaveLength(1);

  await api.post('/auth/login', {}, { adapter: async (config) => success(config) });
  await expect(api.get('/jobs')).rejects.toBeTruthy();
  expect(refresh).toHaveBeenCalledTimes(2);
});

it('shares one refresh across simultaneous 401 responses and retries using the new cookie', async () => {
  const { api } = await import('./api');
  let release!: (value: unknown) => void;
  const refresh = vi.spyOn(axios, 'post').mockImplementation(() => new Promise((resolve) => { release = resolve; }));
  const attempts = new Map<string, number>();
  api.defaults.adapter = async (config) => {
    const count = (attempts.get(config.url!) ?? 0) + 1;
    attempts.set(config.url!, count);
    if (count === 1) throw unauthorized(config);
    return success(config);
  };
  const requests = [api.get('/jobs'), api.get('/candidates')];
  await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  release({ status: 200 });
  await Promise.all(requests);
  expect(refresh).toHaveBeenCalledTimes(1);
  expect([...attempts.values()]).toEqual([2, 2]);
});

it('does not attempt refresh for invalid login credentials', async () => {
  const { api } = await import('./api');
  const refresh = vi.spyOn(axios, 'post');
  await expect(api.post('/auth/login', {}, { adapter: async (config) => { throw unauthorized(config); } })).rejects.toBeTruthy();
  expect(refresh).not.toHaveBeenCalled();
});
