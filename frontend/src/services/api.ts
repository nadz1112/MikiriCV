import axios, { type InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';
import { removeDeletedCandidate } from '../features/candidates/store/removeDeletedCandidate';
import {
  getApiBaseUrl,
  isNativeMobile,
  isNetworkOfflineError,
  resolveApiUrl,
} from '../shared/platform/runtime';
import {
  clearNativeTokens,
  getNativeAccessToken,
  getNativeRefreshToken,
  setNativeTokens,
  type NativeTokenPair,
} from '../shared/platform/secureTokenStorage';
import { useNetworkStore } from '../shared/offline/networkStore';

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'CVMikiri' },
});
let refreshRequest: Promise<unknown> | null = null;
let refreshBlocked = false;
let authGeneration = 0;
const pendingMatching = new Map<string, string>();
type SessionConfig = InternalAxiosRequestConfig & { _retried?: boolean; _authGeneration?: number; _matchingIntent?: string };

api.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  if (config.method === 'post' && ['/matching/run', '/matching/jobs'].includes(config.url ?? '') && !config.headers.get('Idempotency-Key')) {
    const intent = `${config.url}:${JSON.stringify(config.data)}`;
    const key = pendingMatching.get(intent) ?? crypto.randomUUID();
    pendingMatching.set(intent, key);
    (config as SessionConfig)._matchingIntent = intent;
    config.headers.set('Idempotency-Key', key);
  }
  (config as SessionConfig)._authGeneration = authGeneration;
  if (isNativeMobile()) {
    config.headers.set('X-Client-Platform', 'mobile-native');
    const accessToken = getNativeAccessToken();
    if (accessToken && !config.headers.get('Authorization')) {
      config.headers.set('Authorization', `Bearer ${accessToken}`);
    }
  }
  return config;
});

function expireSession() {
  if (refreshBlocked) return;
  refreshBlocked = true;
  if (isNativeMobile()) {
    void clearNativeTokens();
  }
  window.dispatchEvent(new Event('auth:expired'));
}

api.interceptors.response.use((response) => {
  const intent = (response.config as SessionConfig)._matchingIntent;
  if (intent) pendingMatching.delete(intent);
  if (!useNetworkStore.getState().isOnline) {
    useNetworkStore.getState().setOnline(true);
  }
  const url = response.config.url;
  const responseTokens = response.data?.data?.tokens as NativeTokenPair | undefined;
  if (isNativeMobile() && responseTokens?.accessToken && responseTokens?.refreshToken) {
    void setNativeTokens(responseTokens);
  }
  if (url === '/auth/login' || url === '/auth/change-password') {
    refreshBlocked = false;
    authGeneration++;
    pendingMatching.clear();
  } else if (url === '/auth/logout') {
    refreshBlocked = true;
    pendingMatching.clear();
    if (isNativeMobile()) void clearNativeTokens();
  } else if (url === '/auth/me' && !response.data?.data?.user) {
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
      const nativeMode = isNativeMobile();
      const refreshToken = nativeMode ? await getNativeRefreshToken() : null;
      const refreshHeaders: Record<string, string> = { 'X-Requested-With': 'CVMikiri' };
      if (nativeMode) refreshHeaders['X-Client-Platform'] = 'mobile-native';
      refreshRequest ??= axios.post(
        resolveApiUrl('/auth/refresh'),
        nativeMode && refreshToken ? { refreshToken } : {},
        { withCredentials: true, headers: refreshHeaders },
      )
        .then((response) => {
          const tokens = response.data?.data?.tokens as NativeTokenPair | undefined;
          if (nativeMode && tokens?.accessToken && tokens?.refreshToken) {
            void setNativeTokens(tokens);
          }
          authGeneration++;
          return response;
        })
        .finally(() => { refreshRequest = null; });
      await refreshRequest;
      return api(original);
    } catch (refreshError) {
      if (axios.isAxiosError(refreshError) && [401, 403].includes(refreshError.response?.status ?? 0)) expireSession();
      return Promise.reject(refreshError);
    }
  }
  if (isNetworkOfflineError(error)) {
    useNetworkStore.getState().setOnline(false);
    return Promise.reject(error);
  }
  const message = error.response?.data?.error?.message || error.response?.data?.message || error.message || 'Đã xảy ra lỗi kết nối máy chủ';
  if ((error.response?.status === 403 || !/\/auth\//.test(url)) && !url.endsWith('/candidates/upload')) toast.error(message);
  return Promise.reject(error);
});
