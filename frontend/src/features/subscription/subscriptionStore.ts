import { create } from 'zustand';
import { getSubscription, type Subscription } from '../../services/subscriptionApi';

interface SubscriptionState {
  subscription: Subscription | null;
  isLoading: boolean;
  error: string;
  hasLoaded: boolean;
  fetchSubscription: (force?: boolean) => Promise<void>;
  reset: () => void;
}

let inflight: Promise<void> | null = null;

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  subscription: null,
  isLoading: false,
  error: '',
  hasLoaded: false,
  fetchSubscription: async (force = false) => {
    if (!force && get().hasLoaded) return;
    if (inflight) return inflight;
    set({ isLoading: true });
    inflight = (async () => {
      try {
        const subscription = await getSubscription();
        set({ subscription, isLoading: false, hasLoaded: true, error: '' });
      } catch {
        set({
          isLoading: false,
          error: 'Không thể tải gói dịch vụ và hạn mức doanh nghiệp.',
        });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },
  reset: () => {
    inflight = null;
    set({ subscription: null, isLoading: false, error: '', hasLoaded: false });
  },
}));
