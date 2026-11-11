import { create } from 'zustand';
import { authApi } from './authApi';
import { useJobStore } from '../../store/useJobStore';
import { useCandidateStore } from '../../store/useCandidateStore';
import { useCandidateFeatureStore } from '../candidates/store/candidateStore';
import { useJobFeatureStore } from '../jobs/store/jobStore';
import { useMatchingFeatureStore } from '../matching/store/matchingStore';

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
  useCandidateFeatureStore.setState(useCandidateFeatureStore.getInitialState());
  useJobFeatureStore.setState(useJobFeatureStore.getInitialState());
  useMatchingFeatureStore.setState(useMatchingFeatureStore.getInitialState());
};
let sessionRequest: Promise<void> | null = null;
let sessionVersion = 0;
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',
  fetchMe: () => {
    if (sessionRequest) return sessionRequest;
    const version = sessionVersion;
    sessionRequest = (async () => {
      try {
        const user = await authApi.me();
        if (version !== sessionVersion) return;
        if (!user) resetWorkspace();
        set({ user, status: user ? 'authenticated' : 'unauthenticated' });
      } catch {
        if (version !== sessionVersion) return;
        resetWorkspace();
        set({ user: null, status: 'unauthenticated' });
      }
    })().finally(() => { sessionRequest = null; });
    return sessionRequest;
  },
  login: async (email, password) => {
    const user = await authApi.login(email, password);
    sessionVersion++;
    resetWorkspace();
    set({ user, status: 'authenticated' });
    return user;
  },
  logout: async () => {
    sessionVersion++;
    try { await authApi.logout(); } finally { resetWorkspace(); set({ user: null, status: 'unauthenticated' }); }
  },
  setUnauthenticated: () => { sessionVersion++; resetWorkspace(); set({ user: null, status: 'unauthenticated' }); },
}));
