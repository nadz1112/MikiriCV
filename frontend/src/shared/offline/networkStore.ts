import { create } from 'zustand';
import { getCapacitor } from '../platform/runtime';
import { offlineDb } from './offlineDb';

interface NetworkState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  conflictCount: number;
  lastSyncedAt: string | null;
  setOnline: (isOnline: boolean) => void;
  setSyncState: (patch: Partial<Pick<NetworkState, 'isSyncing' | 'pendingCount' | 'conflictCount' | 'lastSyncedAt'>>) => void;
  refreshQueueCounts: (userId?: string) => Promise<void>;
}

const initialOnline = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: initialOnline,
  isSyncing: false,
  pendingCount: 0,
  conflictCount: 0,
  lastSyncedAt: null,
  setOnline: (isOnline) => set({ isOnline }),
  setSyncState: (patch) => set((state) => ({ ...state, ...patch })),
  refreshQueueCounts: async (userId) => {
    if (!userId) {
      set({ pendingCount: 0, conflictCount: 0 });
      return;
    }
    const items = await offlineDb.listOutbox(userId);
    const conflictCount = items.filter((item) => item.status === 'conflict').length;
    set({
      pendingCount: items.length,
      conflictCount,
    });
  },
}));

let listenersInitialized = false;

export function initNetworkListeners(): void {
  if (listenersInitialized || typeof window === 'undefined') return;
  listenersInitialized = true;

  const onOnline = () => useNetworkStore.getState().setOnline(true);
  const onOffline = () => useNetworkStore.getState().setOnline(false);

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  const networkPlugin = getCapacitor()?.Plugins?.Network;
  if (networkPlugin?.getStatus) {
    void networkPlugin.getStatus().then((status) => {
      if (typeof status?.connected === 'boolean') {
        useNetworkStore.getState().setOnline(status.connected);
      }
    }).catch(() => undefined);
  }
  if (networkPlugin?.addListener) {
    void networkPlugin.addListener('networkStatusChange', (status) => {
      if (typeof status?.connected === 'boolean') {
        useNetworkStore.getState().setOnline(status.connected);
      }
    }).catch(() => undefined);
  }
}
