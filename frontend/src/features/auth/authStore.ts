import { create } from 'zustand';
import { authApi } from './authApi';
import { useJobStore } from '../../store/useJobStore';
import { useCandidateStore } from '../../store/useCandidateStore';

export interface AuthUser { id: string; email: string; fullName: string; companyName: string | null; role: 'ADMIN' | 'ENTERPRISE'; isActive: boolean; mustChangePassword: boolean; lastLoginAt: string | null }
interface AuthState {
  user: AuthUser | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  fetchMe: () => Promise<void>;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  setUnauthenticated: () => void;
}
const resetWorkspace = () => {
  useJobStore.setState({ jobs: [], selectedJob: null, isLoading: false });
  useCandidateStore.setState({ candidates: [], selectedCandidates: [], filter: {}, isLoading: false });
};
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',
  fetchMe: async () => {
    try { const user = await authApi.me(); set({ user, status: 'authenticated' }); }
    catch { set({ user: null, status: 'unauthenticated' }); }
  },
  login: async (email, password) => {
    const user = await authApi.login(email, password);
    set({ user, status: 'authenticated' });
    return user;
  },
  logout: async () => {
    try { await authApi.logout(); } finally { resetWorkspace(); set({ user: null, status: 'unauthenticated' }); }
  },
  setUnauthenticated: () => { resetWorkspace(); set({ user: null, status: 'unauthenticated' }); },
}));
