import axios from 'axios';
import toast from 'react-hot-toast';

export const api = axios.create({ baseURL: '/api', withCredentials: true, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'CVMikiri' } });
let refreshRequest: Promise<unknown> | null = null;
api.interceptors.response.use((response) => response, async (error) => {
  const original = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
  const url = String(original?.url || '');
  if (error.response?.status === 401 && original && !original._retried && !/\/auth\/(login|refresh)/.test(url)) {
    original._retried = true;
    try {
      refreshRequest ??= axios.post('/api/auth/refresh', {}, { withCredentials: true, headers: { 'X-Requested-With': 'CVMikiri' } }).finally(() => { refreshRequest = null; });
      await refreshRequest;
      return api(original);
    } catch {
      window.dispatchEvent(new Event('auth:expired'));
    }
  }
  const message = error.response?.data?.error?.message || error.response?.data?.message || error.message || 'Đã xảy ra lỗi kết nối máy chủ';
  if (error.response?.status === 403 || !/\/auth\//.test(url)) toast.error(message);
  return Promise.reject(error);
});
