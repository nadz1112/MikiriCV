import { candidateApi } from '../../features/candidates/api/candidateApi';
import { jobFeatureApi } from '../../features/jobs/api/jobApi';
import { offlineDb, type OfflineUploadFileEntry, type OutboxItem } from './offlineDb';
import { useNetworkStore } from './networkStore';
import { isNetworkOfflineError } from '../platform/runtime';
import toast from 'react-hot-toast';

let syncInFlight: Promise<void> | null = null;

function reconstructFiles(entries: OfflineUploadFileEntry[]): File[] {
  return entries.map(
    (entry) =>
      new File([entry.buffer], entry.name, {
        type: entry.type || 'application/octet-stream',
        lastModified: entry.lastModified,
      }),
  );
}

function getHttpStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

function getErrorMessage(error: unknown): string {
  return (
    (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
    (error instanceof Error ? error.message : '') ||
    'Đồng bộ dữ liệu ngoại tuyến thất bại'
  );
}

async function processSingleItem(item: OutboxItem): Promise<'synced' | 'conflict' | 'failed' | 'offline'> {
  await offlineDb.updateOutboxItem({ ...item, status: 'syncing', errorMessage: undefined });

  try {
    if (item.type === 'UPLOAD_CV') {
      const files = reconstructFiles(item.files);
      await candidateApi.upload(files, item.idempotencyKey);
      await offlineDb.removeOutboxItem(item.id);
      return 'synced';
    }

    if (item.type === 'CREATE_JOB') {
      await jobFeatureApi.create(item.payload, { idempotencyKey: item.idempotencyKey });
      await offlineDb.removeOutboxItem(item.id);
      return 'synced';
    }

    if (item.type === 'UPDATE_JOB' && item.targetJobId) {
      await jobFeatureApi.update(item.targetJobId, item.payload, {
        idempotencyKey: item.idempotencyKey,
        unmodifiedSince: item.baseUpdatedAt,
      });
      await offlineDb.removeOutboxItem(item.id);
      return 'synced';
    }

    await offlineDb.removeOutboxItem(item.id);
    return 'synced';
  } catch (error) {
    if (isNetworkOfflineError(error)) {
      await offlineDb.updateOutboxItem({ ...item, status: 'queued' });
      return 'offline';
    }
    const status = getHttpStatus(error);
    if (item.type === 'UPDATE_JOB' && status === 409) {
      await offlineDb.updateOutboxItem({
        ...item,
        status: 'conflict',
        errorMessage: getErrorMessage(error),
      });
      return 'conflict';
    }
    await offlineDb.updateOutboxItem({
      ...item,
      status: 'failed',
      errorMessage: getErrorMessage(error),
    });
    return 'failed';
  }
}

export async function processOutboxQueue(userId: string): Promise<{ synced: number; conflicts: number; failed: number }> {
  if (!userId) return { synced: 0, conflicts: 0, failed: 0 };
  if (syncInFlight) {
    await syncInFlight;
    return { synced: 0, conflicts: 0, failed: 0 };
  }

  let synced = 0;
  let conflicts = 0;
  let failed = 0;

  const run = async () => {
    const items = await offlineDb.listOutbox(userId);
    const actionable = items.filter((item) => item.status === 'queued' || item.status === 'failed');
    if (actionable.length === 0) {
      await useNetworkStore.getState().refreshQueueCounts(userId);
      return;
    }

    useNetworkStore.getState().setSyncState({ isSyncing: true });
    try {
      for (const item of actionable) {
        const result = await processSingleItem(item);
        if (result === 'synced') synced++;
        else if (result === 'conflict') conflicts++;
        else if (result === 'failed') failed++;
        else if (result === 'offline') break;
      }
      await useNetworkStore.getState().refreshQueueCounts(userId);
      if (synced > 0) {
        useNetworkStore.getState().setSyncState({ lastSyncedAt: new Date().toISOString() });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('offline:synced', { detail: { synced, conflicts, failed } }));
        }
        toast.success(`Đã đồng bộ ${synced} mục dữ liệu ngoại tuyến lên máy chủ`);
      }
      if (conflicts > 0) {
        toast.error(`Có ${conflicts} Job Description bị xung đột phiên bản với máy chủ, vui lòng kiểm tra lại.`);
      }
    } finally {
      useNetworkStore.getState().setSyncState({ isSyncing: false });
    }
  };

  syncInFlight = run().finally(() => {
    syncInFlight = null;
  });
  await syncInFlight;
  return { synced, conflicts, failed };
}
