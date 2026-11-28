import { useAuthStore, type AuthUser } from './authStore';

export function useSafeAuth(): {
  user: AuthUser | null;
  isOfflineSession: boolean;
} {
  const userOrState = useAuthStore((state) => state?.user ?? null) as
    | AuthUser
    | { user?: AuthUser | null; isOfflineSession?: boolean }
    | null;
  const offlineOrState = useAuthStore((state) => state?.isOfflineSession ?? false) as
    | boolean
    | { user?: AuthUser | null; isOfflineSession?: boolean };

  const user =
    userOrState && typeof userOrState === 'object' && 'user' in userOrState
      ? (userOrState.user ?? null)
      : (userOrState as AuthUser | null);

  const isOfflineSession =
    typeof offlineOrState === 'boolean'
      ? offlineOrState
      : Boolean(offlineOrState?.isOfflineSession);

  return { user, isOfflineSession };
}
