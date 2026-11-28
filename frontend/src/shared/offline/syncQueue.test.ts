import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { offlineDb } from './offlineDb';
import { processOutboxQueue } from './syncQueue';
import { useNetworkStore } from './networkStore';

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  createJob: vi.fn(),
  updateJob: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('../../features/candidates/api/candidateApi', () => ({
  candidateApi: { upload: mocks.upload },
}));
vi.mock('../../features/jobs/api/jobApi', () => ({
  jobFeatureApi: { create: mocks.createJob, update: mocks.updateJob },
}));
vi.mock('react-hot-toast', () => ({
  default: { success: mocks.toastSuccess, error: mocks.toastError },
}));

beforeEach(() => {
  vi.clearAllMocks();
  useNetworkStore.setState({ isOnline: true, isSyncing: false, pendingCount: 0, conflictCount: 0 });
});

afterEach(async () => {
  await offlineDb.purgeAllOfflineData();
});

describe('offline outbox syncQueue', () => {
  it('syncs queued CV uploads and job mutations using their Idempotency-Key', async () => {
    const file = new File(['%PDF-1.4 sample'], 'cv-offline.pdf', { type: 'application/pdf' });
    await offlineDb.enqueueUploadCv('hr-1', [file], 'idem-upload-1');
    await offlineDb.enqueueJobMutation('hr-1', {
      type: 'CREATE_JOB',
      idempotencyKey: 'idem-job-1',
      payload: {
        title: 'Frontend Engineer',
        description: 'Phát triển giao diện đa nền tảng',
        requiredSkills: ['React'],
        minExperience: 2,
      },
    });

    mocks.upload.mockResolvedValue({ success: true, data: [], errors: [] });
    mocks.createJob.mockResolvedValue({ id: 'jd-created' });

    const summary = await processOutboxQueue('hr-1');

    expect(summary).toEqual({ synced: 2, conflicts: 0, failed: 0 });
    expect(mocks.upload).toHaveBeenCalledWith(expect.any(Array), 'idem-upload-1');
    expect(mocks.createJob).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Frontend Engineer' }),
      { idempotencyKey: 'idem-job-1' },
    );
    expect(await offlineDb.listOutbox('hr-1')).toHaveLength(0);
    expect(useNetworkStore.getState().pendingCount).toBe(0);
  });

  it('marks UPDATE_JOB as conflict without overwriting when server returns 409', async () => {
    await offlineDb.enqueueJobMutation('hr-1', {
      type: 'UPDATE_JOB',
      targetJobId: 'jd-1',
      baseUpdatedAt: '2026-11-25T09:00:00.000Z',
      idempotencyKey: 'idem-upd-1',
      payload: {
        title: 'Updated Offline Title',
        description: 'Mô tả cập nhật khi ngoại tuyến',
        requiredSkills: ['TypeScript'],
        minExperience: 3,
      },
    });

    const config = {} as InternalAxiosRequestConfig;
    mocks.updateJob.mockRejectedValue(
      new AxiosError('Conflict', 'ERR_BAD_REQUEST', config, undefined, {
        config,
        status: 409,
        statusText: 'Conflict',
        headers: {},
        data: { success: false, error: { code: 'CONFLICT', message: 'Job Description đã được cập nhật trên thiết bị khác.' } },
      }),
    );

    const summary = await processOutboxQueue('hr-1');

    expect(summary).toEqual({ synced: 0, conflicts: 1, failed: 0 });
    const remaining = await offlineDb.listOutbox('hr-1');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].status).toBe('conflict');
    expect(useNetworkStore.getState().conflictCount).toBe(1);
  });
});
