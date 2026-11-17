// @vitest-environment jsdom
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../features/candidates/store/removeDeletedCandidate', () => ({ removeDeletedCandidate: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));

function unauthorized(config: InternalAxiosRequestConfig) {
  return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, { config, status: 401, statusText: 'Unauthorized', headers: {}, data: {} });
}
function success(config: InternalAxiosRequestConfig, data = {}) {
  return { config, status: 200, statusText: 'OK', headers: {}, data };
}
afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); vi.resetModules(); });

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

it.each(['axios-cancel', 'error-code', 'abort-signal'])('does not show a toast or expire the session for dashboard cancellation: %s', async (kind) => {
  const { api } = await import('./api');
  const events = vi.spyOn(window, 'dispatchEvent');
  const refresh = vi.spyOn(axios, 'post');
  const controller = new AbortController();
  if (kind === 'abort-signal') controller.abort();
  const request = api.get('/admin/dashboard', {
    signal: controller.signal,
    adapter: async (config) => {
      if (kind === 'axios-cancel') throw new axios.CanceledError('canceled', config);
      throw new AxiosError('canceled', 'ERR_CANCELED', config);
    },
  });
  await expect(request).rejects.toMatchObject({ code: 'ERR_CANCELED' });
  expect(toast.error).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  expect(events.mock.calls.filter(([event]) => event.type === 'auth:expired')).toHaveLength(0);
});

it('still reports actual dashboard API failures', async () => {
  const { api } = await import('./api');
  await expect(api.get('/admin/dashboard', {
    adapter: async (config) => {
      throw new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, undefined, {
        config, status: 500, statusText: 'Internal Server Error', headers: {},
        data: { success: false, error: { message: 'Không thể tải dữ liệu Dashboard' } },
      });
    },
  })).rejects.toBeTruthy();
  expect(toast.error).toHaveBeenCalledExactlyOnceWith('Không thể tải dữ liệu Dashboard');
});
