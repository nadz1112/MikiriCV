// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useMatching } from './useMatching';
import { useMatchingFeatureStore } from '../store/matchingStore';

const mocks = vi.hoisted(() => ({ run: vi.fn(), getAll: vi.fn(), fetchCandidates: vi.fn(), fetchJobs: vi.fn(), toastError: vi.fn() }));
vi.mock('../../../store/useCandidateStore', () => ({ useCandidateStore: Object.assign(() => ({ candidates: [], fetchCandidates: mocks.fetchCandidates }), { setState: vi.fn() }) }));
vi.mock('../../../store/useJobStore', () => ({ useJobStore: () => ({ jobs: [], fetchJobs: mocks.fetchJobs }) }));
vi.mock('../../../services/candidateApi', () => ({ candidateApi: { getAll: mocks.getAll } }));
vi.mock('../api/matchingApi', () => ({ matchingFeatureApi: { run: mocks.run, getLeaderboard: async () => ({ matchResults: [] }) } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: mocks.toastError } }));

beforeEach(() => {
  vi.clearAllMocks();
  useMatchingFeatureStore.setState({ selectedJobId: 'jd', selectedCandidateIds: ['cv'], isConfirmModalOpen: true });
  mocks.getAll.mockResolvedValue([{ id: 'cv', extractionStatus: 'SUCCESS' }]);
});
afterEach(cleanup);

it('closes the progress dialog after a successful AI run', async () => {
  mocks.run.mockResolvedValue({ success: true, data: [] });
  const { result } = renderHook(() => useMatching());
  await act(async () => { await result.current.handleRunMatching(); });
  await waitFor(() => expect(result.current.isConfirmModalOpen).toBe(false));
  expect(result.current.isRunning).toBe(false);
  expect(mocks.run).toHaveBeenCalledWith('jd', ['cv']);
});

it('closes the progress dialog and reports failure after an AI error', async () => {
  mocks.run.mockRejectedValue(new Error('Provider unavailable'));
  const { result } = renderHook(() => useMatching());
  await act(async () => { await result.current.handleRunMatching(); });
  expect(result.current.isConfirmModalOpen).toBe(false);
  expect(result.current.isRunning).toBe(false);
  expect(mocks.toastError).toHaveBeenCalledWith('Provider unavailable');
});

it('removes a deleted CV before submitting and requires reviewing the remaining selection', async () => {
  mocks.getAll.mockResolvedValue([]);
  const { result } = renderHook(() => useMatching());
  await act(async () => { await result.current.handleRunMatching(); });
  expect(mocks.run).not.toHaveBeenCalled();
  expect(result.current.selectedCandidateIds).toEqual([]);
  expect(result.current.isRunning).toBe(false);
});
