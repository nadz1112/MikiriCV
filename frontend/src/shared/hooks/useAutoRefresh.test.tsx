// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ADMIN_REFRESH_INTERVAL_MS, useAutoRefresh } from './useAutoRefresh';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

it('refreshes periodically and cleans up when the page unmounts', async () => {
  const refresh = vi.fn().mockResolvedValue(undefined);
  const { unmount } = renderHook(() => useAutoRefresh(refresh));
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(ADMIN_REFRESH_INTERVAL_MS); });
  expect(refresh).toHaveBeenCalledTimes(1);
  const signal = refresh.mock.calls[0][0] as AbortSignal;
  unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(refresh).toHaveBeenCalledTimes(1);
});

it('does not overlap slow requests even when focus events occur', async () => {
  let finish!: () => void;
  const refresh = vi.fn().mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  renderHook(() => useAutoRefresh(refresh));
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  await act(async () => {
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(60_000);
  });
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => { finish(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(ADMIN_REFRESH_INTERVAL_MS); });
  expect(refresh).toHaveBeenCalledTimes(2);
});

it('pauses while hidden or offline and refreshes on return', async () => {
  const refresh = vi.fn().mockResolvedValue(undefined);
  renderHook(() => useAutoRefresh(refresh));
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(30_000);
  });
  expect(refresh).not.toHaveBeenCalled();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(refresh).toHaveBeenCalledTimes(1);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  await act(async () => { window.dispatchEvent(new Event('offline')); await vi.advanceTimersByTimeAsync(30_000); });
  expect(refresh).toHaveBeenCalledTimes(1);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  await act(async () => { window.dispatchEvent(new Event('online')); });
  expect(refresh).toHaveBeenCalledTimes(2);
});

it('uses the latest callback without resetting the timer and respects disabled pages', async () => {
  const first = vi.fn(); const latest = vi.fn();
  const { rerender } = renderHook(({ enabled, callback }) => useAutoRefresh(callback, enabled), { initialProps: { enabled: false, callback: first } });
  await act(async () => { window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(30_000); });
  expect(first).not.toHaveBeenCalled();
  rerender({ enabled: true, callback: first });
  await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
  rerender({ enabled: true, callback: latest });
  await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
  expect(first).not.toHaveBeenCalled(); expect(latest).toHaveBeenCalledTimes(1);
});
