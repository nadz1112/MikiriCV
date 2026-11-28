import { create } from 'zustand';
import { authApi } from './authApi';
import { useJobStore } from '../../store/useJobStore';
import { useCandidateStore } from '../../store/useCandidateStore';
import { useCandidateFeatureStore } from '../candidates/store/candidateStore';
import { useJobFeatureStore } from '../jobs/store/jobStore';
import { useMatchingFeatureStore } from '../matching/store/matchingStore';
import { useSubscriptionStore } from '../subscription/subscriptionStore';
import { offlineDb } from '../../shared/offline/offlineDb';
import { isNetworkOfflineError } from '../../shared/platform/runtime';
import { clearNativeTokens } from '../../shared/platform/secureTokenStorage';
import { useNetworkStore } from '../../shared/offline/networkStore';

export interface AuthUser { id: string; email: string; fullName: string; companyName: string | null; role: 'ADMIN' | 'ENTERPRISE'; isActive: boolean; mustChangePassword: boolean; lastLoginAt: string | null }
interface AuthState {
  user: AuthUser | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  isOfflineSession: boolean;
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
  useSubscriptionStore.getState().reset();
  useNetworkStore.getState().setSyncState({ pendingCount: 0, conflictCount: 0, isSyncing: false });
  void offlineDb.purgeAllOfflineData();
  void clearNativeTokens();
};
let sessionRequest: Promise<void> | null = null;
let sessionVersion = 0;
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',
  isOfflineSession: false,
  fetchMe: () => {
    if (sessionRequest) return sessionRequest;
    const version = sessionVersion;
    sessionRequest = (async () => {
      try {
        const user = await authApi.me();
        if (version !== sessionVersion) return;
        if (!user) {
          resetWorkspace();
        } else {
          void offlineDb.saveSessionMeta(user);
          void useNetworkStore.getState().refreshQueueCounts(user.id);
        }
        set({ user, status: user ? 'authenticated' : 'unauthenticated', isOfflineSession: false });
      } catch (error) {
        if (version !== sessionVersion) return;
        if (isNetworkOfflineError(error)) {
          const cachedSession = await offlineDb.getValidSessionMeta();
          if (version !== sessionVersion) return;
          if (cachedSession?.user) {
            useNetworkStore.getState().setOnline(false);
            void useNetworkStore.getState().refreshQueueCounts(cachedSession.user.id);
            set({
              user: cachedSession.user,
              status: 'authenticated',
              isOfflineSession: true,
            });
            return;
          }
        }
        resetWorkspace();
        set({ user: null, status: 'unauthenticated', isOfflineSession: false });
      }
    })().finally(() => { sessionRequest = null; });
    return sessionRequest;
  },
  login: async (email, password) => {
    const user = await authApi.login(email, password);
    sessionVersion++;
    resetWorkspace();
    void offlineDb.saveSessionMeta(user);
    void useNetworkStore.getState().refreshQueueCounts(user.id);
    set({ user, status: 'authenticated', isOfflineSession: false });
    return user;
  },
  logout: async () => {
    sessionVersion++;
    try { await authApi.logout(); } finally { resetWorkspace(); set({ user: null, status: 'unauthenticated', isOfflineSession: false }); }
  },
  setUnauthenticated: () => { sessionVersion++; resetWorkspace(); set({ user: null, status: 'unauthenticated', isOfflineSession: false }); },
}));
