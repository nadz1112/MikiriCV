// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCandidates } from './useCandidates';

const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../api/candidateApi', () => ({ candidateApi: { list: mocks.list } }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue({ data: [], total: 0, page: 2, limit: 20 });
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('refreshes admin CV data with the same filters and page', async () => {
  const filter = { page: 2, limit: 20, enterpriseId: 'enterprise', skills: ['React'], extractionStatus: 'WARNING' as const };
  const { result } = renderHook(() => useCandidates(filter, true));
  await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  mocks.list.mockResolvedValue({ data: [{ id: 'new-cv' }], total: 21, page: 2, limit: 20 });
  act(() => { window.dispatchEvent(new Event('focus')); });
  await waitFor(() => expect(result.current.candidates[0]?.id).toBe('new-cv'));
  expect(mocks.list).toHaveBeenLastCalledWith(filter, expect.any(AbortSignal));
  expect(result.current.page).toBe(2); expect(result.current.isLoading).toBe(false);
});

it('keeps background refresh disabled unless requested', async () => {
  renderHook(() => useCandidates({}));
  await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1));
  act(() => { window.dispatchEvent(new Event('focus')); });
  expect(mocks.list).toHaveBeenCalledTimes(1);
});
