import { create } from 'zustand';
import { getSubscription, getTokenBalance, type Subscription } from '../../services/subscriptionApi';
import { offlineDb } from '../../shared/offline/offlineDb';
import { useNetworkStore } from '../../shared/offline/networkStore';
import { isNetworkOfflineError } from '../../shared/platform/runtime';
import { useAuthStore } from '../auth/authStore';

interface SubscriptionState {
  subscription: Subscription | null;
  isLoading: boolean;
  error: string;
  hasLoaded: boolean;
  fetchSubscription: (force?: boolean) => Promise<void>;
  refreshBalance: () => Promise<void>;
  reset: () => void;
}

let inflight: Promise<void> | null = null;
let generation = 0;
let balanceRequest: Promise<void> | null = null;

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  subscription: null,
  isLoading: false,
  error: '',
  hasLoaded: false,
  refreshBalance: () => {
    if (!useNetworkStore.getState().isOnline) return Promise.resolve();
    if (inflight) return inflight;
    if (balanceRequest) return balanceRequest;
    if (!get().subscription) return get().fetchSubscription(true);
    const requestGeneration = generation;
    balanceRequest = (async () => {
      try {
        const balance = await getTokenBalance();
        if (requestGeneration === generation) set((state) => ({ subscription: state.subscription ? { ...state.subscription, ...balance } : null, error: '' }));
      } catch { /* Keep the last confirmed balance; normal polling can retry. */ }
      finally { if (requestGeneration === generation) balanceRequest = null; }
    })();
    return balanceRequest;
  },
  fetchSubscription: async (force = false) => {
    if (!force && get().hasLoaded) return;
    if (inflight) return inflight;
    set({ isLoading: true });
    const requestGeneration = generation;
    const userId = useAuthStore.getState?.()?.user?.id;
    inflight = (async () => {
      try {
        const subscription = await getSubscription();
        if (userId) void offlineDb.saveSubscription(userId, subscription);
        if (requestGeneration === generation) set({ subscription, isLoading: false, hasLoaded: true, error: '' });
      } catch (error) {
        if (isNetworkOfflineError(error) && userId) {
          const cached = await offlineDb.getSubscription(userId);
          if (cached && requestGeneration === generation) {
            set({ subscription: cached.subscription, isLoading: false, hasLoaded: true, error: '' });
            return;
          }
        }
        if (requestGeneration === generation) set({
          isLoading: false,
          error: 'Không thể tải gói dịch vụ và hạn mức doanh nghiệp.',
        });
      } finally {
        if (requestGeneration === generation) inflight = null;
      }
    })();
    return inflight;
  },
  reset: () => {
    generation++;
    balanceRequest = null;
    inflight = null;
    set({ subscription: null, isLoading: false, error: '', hasLoaded: false });
  },
}));
