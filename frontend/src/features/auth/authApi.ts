import { api } from '../../services/api';
import type { AuthUser } from './authStore';

export const authApi = {
  login: async (email: string, password: string) => (await api.post<{ data: { user: AuthUser } }>('/auth/login', { email, password })).data.data.user,
  me: async () => (await api.get<{ data: { user: AuthUser } }>('/auth/me')).data.data.user,
  logout: async () => { await api.post('/auth/logout'); },
  changePassword: async (currentPassword: string, newPassword: string) => (await api.post<{ data: { user: AuthUser } }>('/auth/change-password', { currentPassword, newPassword })).data.data.user,
};
