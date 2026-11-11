import axios, { type InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';
import { removeDeletedCandidate } from '../features/candidates/store/removeDeletedCandidate';

export const api = axios.create({ baseURL: '/api', withCredentials: true, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'CVMikiri' } });
let refreshRequest: Promise<unknown> | null = null;
let refreshBlocked = false;
let authGeneration = 0;
type SessionConfig = InternalAxiosRequestConfig & { _retried?: boolean; _authGeneration?: number };

api.interceptors.request.use((config) => {
  (config as SessionConfig)._authGeneration = authGeneration;
  return config;
});

function expireSession() {
  if (refreshBlocked) return;
  refreshBlocked = true;
  window.dispatchEvent(new Event('auth:expired'));
}

api.interceptors.response.use((response) => {
  const url = response.config.url;
  if (url === '/auth/login' || url === '/auth/change-password') {
    refreshBlocked = false;
    authGeneration++;
  } else if (url === '/auth/logout' || (url === '/auth/me' && !response.data?.data?.user)) {
    refreshBlocked = true;
  } else if (url === '/auth/me' && response.data?.data?.user) {
    refreshBlocked = false;
  }
  const deletedCandidate = response.config.method === 'delete'
    ? response.config.url?.match(/^\/candidates\/([^/?]+)$/)
    : null;
  if (deletedCandidate) removeDeletedCandidate(decodeURIComponent(deletedCandidate[1]));
  return response;
}, async (error) => {
  const original = error.config as SessionConfig | undefined;
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
