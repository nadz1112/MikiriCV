import { isNativeMobile } from '../platform/runtime';

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || isNativeMobile()) return;
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
