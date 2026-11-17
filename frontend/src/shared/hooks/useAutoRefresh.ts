import { useEffect, useRef } from 'react';

export const ADMIN_REFRESH_INTERVAL_MS = 10_000;

/** Poll only visible/online pages, with one request at a time and cleanup on exit. */
export function useAutoRefresh(refresh: (signal: AbortSignal) => void | Promise<void>, enabled = true, intervalMs = ADMIN_REFRESH_INTERVAL_MS) {
  const latestRefresh = useRef(refresh);
  latestRefresh.current = refresh;
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const canRefresh = () => document.visibilityState !== 'hidden' && navigator.onLine !== false;
    const schedule = () => {
      clearTimeout(timer);
      if (!disposed && canRefresh()) timer = setTimeout(() => { void run(); }, intervalMs);
    };
    const run = async () => {
      if (disposed || running || !canRefresh()) return;
      clearTimeout(timer);
      running = true;
      controller = new AbortController();
      try { await latestRefresh.current(controller.signal); }
      catch { /* Pages retain their own error states; the next refresh can retry. */ }
      finally { running = false; schedule(); }
    };
    const onVisibility = () => {
      clearTimeout(timer);
      if (canRefresh()) void run();
    };
    const onFocus = () => { void run(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    window.addEventListener('offline', onVisibility);
    schedule();
    return () => {
      disposed = true; clearTimeout(timer); controller?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
      window.removeEventListener('offline', onVisibility);
    };
  }, [enabled, intervalMs]);
}
