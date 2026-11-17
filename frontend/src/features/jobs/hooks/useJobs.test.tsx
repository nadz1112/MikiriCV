// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useJobs } from './useJobs';
import { useJobStore } from '../../../store/useJobStore';
import { useJobFeatureStore } from '../store/jobStore';

const mocks = vi.hoisted(() => ({ getAll: vi.fn(), user: { role: 'ADMIN' } }));
vi.mock('../../../services/jobApi', () => ({ jobApi: { getAll: mocks.getAll } }));
vi.mock('../../auth/authStore', () => ({ useAuthStore: (select: (state: typeof mocks) => unknown) => select(mocks) }));
const job = { id: 'jd', title: 'JD ban đầu', description: 'Mô tả ban đầu', requiredSkills: ['React'], minExperience: 1, createdAt: '2026-11-17', updatedAt: '2026-11-17' };
beforeEach(() => {
  vi.clearAllMocks(); mocks.user.role = 'ADMIN'; mocks.getAll.mockResolvedValue([job]);
  useJobStore.setState(useJobStore.getInitialState());
  useJobFeatureStore.setState(useJobFeatureStore.getInitialState());
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('refreshes admin JD data and the open detail while preserving the edit draft', async () => {
  const { result } = renderHook(() => useJobs());
  await waitFor(() => expect(result.current.jobs).toHaveLength(1));
  act(() => { useJobFeatureStore.getState().openDetailDrawer(job); useJobFeatureStore.getState().openEditModal(job); });
  const updated = { ...job, title: 'JD HR vừa cập nhật', description: 'Mô tả mới' };
  mocks.getAll.mockResolvedValue([updated]);
  act(() => { window.dispatchEvent(new Event('focus')); });
  await waitFor(() => expect(result.current.jobs[0].title).toBe(updated.title));
  expect(useJobFeatureStore.getState().detailJob?.title).toBe(updated.title);
  expect(useJobFeatureStore.getState().editingJob?.title).toBe(job.title);
  expect(result.current.isLoading).toBe(false);
});

it('keeps ENTERPRISE fetch behavior without admin background refresh', async () => {
  mocks.user.role = 'ENTERPRISE';
  const { result } = renderHook(() => useJobs());
  await waitFor(() => expect(result.current.jobs).toHaveLength(1));
  act(() => { window.dispatchEvent(new Event('focus')); });
  expect(mocks.getAll).toHaveBeenCalledTimes(1);
});
