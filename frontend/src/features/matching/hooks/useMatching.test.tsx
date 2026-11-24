// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useMatching } from './useMatching';
import { useMatchingFeatureStore } from '../store/matchingStore';

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  createJob: vi.fn(),
  getJob: vi.fn(),
  cancelJob: vi.fn(),
  getAll: vi.fn(),
  fetchCandidates: vi.fn(),
  fetchJobs: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock('../../../store/useCandidateStore', () => ({ useCandidateStore: Object.assign(() => ({ candidates: [], fetchCandidates: mocks.fetchCandidates }), { setState: vi.fn() }) }));
vi.mock('../../../store/useJobStore', () => ({ useJobStore: () => ({ jobs: [], fetchJobs: mocks.fetchJobs }) }));
vi.mock('../../../services/candidateApi', () => ({ candidateApi: { getAll: mocks.getAll } }));
vi.mock('../api/matchingApi', () => ({
  matchingFeatureApi: {
    run: mocks.run,
    createJob: mocks.createJob,
    getJob: mocks.getJob,
    cancelJob: mocks.cancelJob,
    getLeaderboard: async () => ({ matchResults: [] }),
  },
}));
vi.mock('react-hot-toast', () => ({ default: { success: mocks.toastSuccess, error: mocks.toastError } }));

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

it('creates an async job when multiple candidates are selected and supports cancellation and retry', async () => {
  useMatchingFeatureStore.setState({ selectedJobId: 'jd', selectedCandidateIds: ['cv1', 'cv2'], isConfirmModalOpen: true });
  mocks.getAll.mockResolvedValue([
    { id: 'cv1', extractionStatus: 'SUCCESS' },
    { id: 'cv2', extractionStatus: 'SUCCESS' },
  ]);
  mocks.createJob.mockResolvedValue({
    success: true,
    data: {
      id: 'job-1',
      jobDescriptionId: 'jd',
      status: 'QUEUED',
      total: 2,
      processed: 0,
      failed: 0,
      cancelRequested: false,
      errorMessage: null,
      createdAt: '2026-11-24T00:00:00Z',
      startedAt: null,
      finishedAt: null,
      items: [
        { id: 'i1', candidateId: 'cv1', candidateName: 'An', status: 'PENDING', attempts: 0, errorCode: null, errorMessage: null, finishedAt: null },
        { id: 'i2', candidateId: 'cv2', candidateName: 'Binh', status: 'PENDING', attempts: 0, errorCode: null, errorMessage: null, finishedAt: null },
      ],
    },
  });
  mocks.cancelJob.mockResolvedValue({
    success: true,
    data: {
      id: 'job-1',
      jobDescriptionId: 'jd',
      status: 'CANCELLED',
      total: 2,
      processed: 2,
      failed: 1,
      cancelRequested: true,
      errorMessage: null,
      createdAt: '2026-11-24T00:00:00Z',
      startedAt: null,
      finishedAt: '2026-11-24T00:00:02Z',
      items: [
        { id: 'i1', candidateId: 'cv1', candidateName: 'An', status: 'FAILED', attempts: 1, errorCode: 'AI_RATE_LIMIT', errorMessage: 'Quá tải', finishedAt: null },
        { id: 'i2', candidateId: 'cv2', candidateName: 'Binh', status: 'SKIPPED', attempts: 0, errorCode: 'JOB_CANCELLED', errorMessage: 'Đã hủy', finishedAt: null },
      ],
    },
  });

  const { result } = renderHook(() => useMatching());
  await act(async () => { await result.current.handleRunMatching(); });

  expect(mocks.createJob).toHaveBeenCalledWith('jd', ['cv1', 'cv2']);
  expect(mocks.run).not.toHaveBeenCalled();
  expect(result.current.activeJob?.id).toBe('job-1');

  await act(async () => { await result.current.handleCancelJob(); });
  expect(mocks.cancelJob).toHaveBeenCalledWith('job-1');
  expect(result.current.activeJob?.status).toBe('CANCELLED');

  await act(async () => { await result.current.handleRetryFailedItems(); });
  expect(mocks.createJob).toHaveBeenLastCalledWith('jd', ['cv1']);
});
