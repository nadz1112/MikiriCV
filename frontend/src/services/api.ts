import axios, { type InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';
import { removeDeletedCandidate } from '../features/candidates/store/removeDeletedCandidate';

export const api = axios.create({ baseURL: '/api', withCredentials: true, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'CVMikiri' } });
let refreshRequest: Promise<unknown> | null = null;
let refreshBlocked = false;
let authGeneration = 0;
const pendingMatching = new Map<string, string>();
type SessionConfig = InternalAxiosRequestConfig & { _retried?: boolean; _authGeneration?: number; _matchingIntent?: string };

api.interceptors.request.use((config) => {
  if (config.method === 'post' && ['/matching/run', '/matching/jobs'].includes(config.url ?? '') && !config.headers.get('Idempotency-Key')) {
    const intent = `${config.url}:${JSON.stringify(config.data)}`;
    const key = pendingMatching.get(intent) ?? crypto.randomUUID();
    pendingMatching.set(intent, key);
    (config as SessionConfig)._matchingIntent = intent;
    config.headers.set('Idempotency-Key', key);
  }
  (config as SessionConfig)._authGeneration = authGeneration;
  return config;
});

function expireSession() {
  if (refreshBlocked) return;
  refreshBlocked = true;
  window.dispatchEvent(new Event('auth:expired'));
}

api.interceptors.response.use((response) => {
  const intent = (response.config as SessionConfig)._matchingIntent;
  if (intent) pendingMatching.delete(intent);
  const url = response.config.url;
  if (url === '/auth/login' || url === '/auth/change-password') {
    refreshBlocked = false;
    authGeneration++;
    pendingMatching.clear();
  } else if (url === '/auth/logout' || (url === '/auth/me' && !response.data?.data?.user)) {
    refreshBlocked = true;
    pendingMatching.clear();
  } else if (url === '/auth/me' && response.data?.data?.user) {
    refreshBlocked = false;
  }
  const deletedCandidate = response.config.method === 'delete'
    ? response.config.url?.match(/^\/candidates\/([^/?]+)$/)
    : null;
  if (deletedCandidate) removeDeletedCandidate(decodeURIComponent(deletedCandidate[1]));
  return response;
}, async (error) => {
  // Dashboard cleanup aborts requests on navigation, filter changes and StrictMode.
  // Preserve cancellation for callers without treating it as an API/session failure.
  if (axios.isCancel(error) || error?.code === 'ERR_CANCELED') return Promise.reject(error);
  const original = error.config as SessionConfig | undefined;
  // A network timeout can occur after the server committed the result. Reuse its
  // receipt on the next attempt instead of generating another billable request.
  if (original?._matchingIntent && error.response && error.response.status !== 401 && error.response.data?.error?.code !== 'REQUEST_IN_PROGRESS') pendingMatching.delete(original._matchingIntent);
  const url = String(original?.url || '');
  if (error.response?.status === 401 && original && !/\/auth\/(login|refresh)/.test(url)) {
    if (refreshBlocked) return Promise.reject(error);
    if (original._retried) {
      expireSession();
      return Promise.reject(error);
    }
    original._retried = true;
    // A late 401 from the previous access token should reuse the refreshed cookie.
    if (original._authGeneration !== authGeneration) return api(original);
    try {
      refreshRequest ??= axios.post('/api/auth/refresh', {}, { withCredentials: true, headers: { 'X-Requested-With': 'CVMikiri' } })
        .then((response) => { authGeneration++; return response; })
        .finally(() => { refreshRequest = null; });
      await refreshRequest;
      return api(original);
    } catch (refreshError) {
      if (axios.isAxiosError(refreshError) && [401, 403].includes(refreshError.response?.status ?? 0)) expireSession();
      return Promise.reject(refreshError);
    }
  }
  const message = error.response?.data?.error?.message || error.response?.data?.message || error.message || 'Đã xảy ra lỗi kết nối máy chủ';
  if ((error.response?.status === 403 || !/\/auth\//.test(url)) && !url.endsWith('/candidates/upload')) toast.error(message);
  return Promise.reject(error);
});
