import type { AuthUser } from '../../features/auth/authStore';
import type { CandidateItem } from '../../features/candidates/api/candidateApi';
import type { JobPayload } from '../../features/jobs/api/jobApi';
import type { PersonalUsageHistory, Subscription } from '../../services/subscriptionApi';
import type {
  Candidate,
  DashboardStats,
  JobDescription,
  JobStats,
  MatchingJob,
  MatchResult,
} from '../../types';

const DB_NAME = 'cvmikiri_offline_v1';
const DB_VERSION = 2;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PINNED_CV_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PINNED_CVS = 20;
const MAX_PINNED_BYTES = 50 * 1024 * 1024;
const MAX_OUTBOX_BYTES = 50 * 1024 * 1024;

const STORE_NAMES = [
  'session_meta',
  'jobs_cache',
  'candidates_cache',
  'dashboard_cache',
  'leaderboards_cache',
  'pinned_cvs',
  'outbox_queue',
  'matching_draft',
  'subscription_cache',
  'personal_usage_cache',
] as const;

type StoreName = (typeof STORE_NAMES)[number];

export interface SessionMetaRecord {
  key: 'current';
  user: AuthUser;
  verifiedAt: number;
  expiresAt: number;
}

export interface JobsCacheRecord {
  userId: string;
  jobs: JobDescription[];
  statsByJobId: Record<string, JobStats>;
  cachedAt: number;
}

export interface CandidatesCacheRecord {
  userId: string;
  items: CandidateItem[];
  total: number;
  cachedAt: number;
}

export interface DashboardCacheRecord {
  userId: string;
  stats: DashboardStats;
  cachedAt: number;
}

export interface LeaderboardCacheRecord {
  key: string;
  userId: string;
  jobDescriptionId: string;
  results: MatchResult[];
  cachedAt: number;
}

export interface PinnedCvRecord {
  key: string;
  userId: string;
  candidateId: string;
  candidate: Candidate;
  fileBlob?: Blob;
  fileName: string;
  contentType?: string;
  byteSize: number;
  pinnedAt: number;
  expiresAt: number;
}

export interface OfflineUploadFileEntry {
  name: string;
  type: string;
  size: number;
  lastModified: number;
  buffer: ArrayBuffer;
}

export type OutboxItem =
  | {
      id: string;
      userId: string;
      type: 'UPLOAD_CV';
      idempotencyKey: string;
      files: OfflineUploadFileEntry[];
      totalBytes: number;
      status: 'queued' | 'syncing' | 'failed';
      errorMessage?: string;
      createdAt: number;
    }
  | {
      id: string;
      userId: string;
      type: 'CREATE_JOB' | 'UPDATE_JOB';
      targetJobId?: string;
      baseUpdatedAt?: string;
      idempotencyKey: string;
      payload: JobPayload;
      status: 'queued' | 'syncing' | 'conflict' | 'failed';
      errorMessage?: string;
      createdAt: number;
    };

export interface MatchingDraftRecord {
  userId: string;
  selectedJobId: string;
  selectedCandidateIds: string[];
  activeJob: MatchingJob | null;
  updatedAt: number;
}

export interface SubscriptionCacheRecord {
  userId: string;
  subscription: Subscription;
  cachedAt: number;
}

export interface PersonalUsageCacheRecord {
  userId: string;
  history: PersonalUsageHistory;
  cachedAt: number;
}

const memoryFallback = new Map<StoreName, Map<string, unknown>>();
for (const store of STORE_NAMES) {
  memoryFallback.set(store, new Map());
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('session_meta')) db.createObjectStore('session_meta', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('jobs_cache')) db.createObjectStore('jobs_cache', { keyPath: 'userId' });
      if (!db.objectStoreNames.contains('candidates_cache')) db.createObjectStore('candidates_cache', { keyPath: 'userId' });
      if (!db.objectStoreNames.contains('dashboard_cache')) db.createObjectStore('dashboard_cache', { keyPath: 'userId' });
      if (!db.objectStoreNames.contains('leaderboards_cache')) db.createObjectStore('leaderboards_cache', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('pinned_cvs')) db.createObjectStore('pinned_cvs', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('outbox_queue')) db.createObjectStore('outbox_queue', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('matching_draft')) db.createObjectStore('matching_draft', { keyPath: 'userId' });
      if (!db.objectStoreNames.contains('subscription_cache')) db.createObjectStore('subscription_cache', { keyPath: 'userId' });
      if (!db.objectStoreNames.contains('personal_usage_cache')) db.createObjectStore('personal_usage_cache', { keyPath: 'userId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

async function idbGet<T>(store: StoreName, key: string): Promise<T | null> {
  if (!hasIndexedDb()) {
    return (memoryFallback.get(store)?.get(key) as T | undefined) ?? null;
  }
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return (memoryFallback.get(store)?.get(key) as T | undefined) ?? null;
  }
}

async function idbPut<T extends Record<string, unknown>>(store: StoreName, key: string, value: T): Promise<void> {
  memoryFallback.get(store)?.set(key, value);
  if (!hasIndexedDb()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Keep memory fallback synchronized when IndexedDB quota or private mode blocks writes.
  }
}

async function idbDelete(store: StoreName, key: string): Promise<void> {
  memoryFallback.get(store)?.delete(key);
  if (!hasIndexedDb()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore cleanup errors.
  }
}

async function idbGetAll<T>(store: StoreName): Promise<T[]> {
  if (!hasIndexedDb()) {
    return Array.from(memoryFallback.get(store)?.values() ?? []) as T[];
  }
  try {
    const db = await openDb();
    return await new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve((req.result as T[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return Array.from(memoryFallback.get(store)?.values() ?? []) as T[];
  }
}

async function idbClearAll(): Promise<void> {
  for (const store of STORE_NAMES) {
    memoryFallback.get(store)?.clear();
  }
  if (!hasIndexedDb()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([...STORE_NAMES], 'readwrite');
      for (const store of STORE_NAMES) {
        tx.objectStore(store).clear();
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore cleanup errors.
  }
}

/** Strips raw CV text, searchText, and file paths from list caches per privacy rules. */
export function stripPrivateCandidateFields(item: CandidateItem): CandidateItem {
  const safeItem = { ...item } as CandidateItem & {
    rawText?: unknown;
    searchText?: unknown;
    fileUrl?: unknown;
  };
  delete safeItem.rawText;
  delete safeItem.searchText;
  delete safeItem.fileUrl;
  return safeItem;
}

export const offlineDb = {
  async saveSessionMeta(user: AuthUser, ttlMs = SESSION_TTL_MS): Promise<void> {
    const now = Date.now();
    await idbPut('session_meta', 'current', {
      key: 'current',
      user,
      verifiedAt: now,
      expiresAt: now + ttlMs,
    } satisfies SessionMetaRecord);
  },

  async getValidSessionMeta(): Promise<SessionMetaRecord | null> {
    const record = await idbGet<SessionMetaRecord>('session_meta', 'current');
    if (!record) return null;
    if (record.expiresAt <= Date.now()) {
      await idbDelete('session_meta', 'current');
      return null;
    }
    return record;
  },

  async saveJobs(userId: string, jobs: JobDescription[], statsByJobId?: Record<string, JobStats>): Promise<void> {
    const existing = await this.getJobs(userId);
    await idbPut('jobs_cache', userId, {
      userId,
      jobs,
      statsByJobId: statsByJobId ?? existing?.statsByJobId ?? {},
      cachedAt: Date.now(),
    } satisfies JobsCacheRecord);
  },

  async saveJobStats(userId: string, jobId: string, stats: JobStats): Promise<void> {
    const existing = await this.getJobs(userId);
    await idbPut('jobs_cache', userId, {
      userId,
      jobs: existing?.jobs ?? [],
      statsByJobId: { ...(existing?.statsByJobId ?? {}), [jobId]: stats },
      cachedAt: existing?.cachedAt ?? Date.now(),
    } satisfies JobsCacheRecord);
  },

  async getJobs(userId: string): Promise<JobsCacheRecord | null> {
    const record = await idbGet<JobsCacheRecord>('jobs_cache', userId);
    if (!record || record.userId !== userId) return null;
    return record;
  },

  async saveCandidates(userId: string, items: CandidateItem[], total: number): Promise<void> {
    const sanitized = items.map(stripPrivateCandidateFields);
    await idbPut('candidates_cache', userId, {
      userId,
      items: sanitized,
      total,
      cachedAt: Date.now(),
    } satisfies CandidatesCacheRecord);
  },

  async getCandidates(userId: string): Promise<CandidatesCacheRecord | null> {
    const record = await idbGet<CandidatesCacheRecord>('candidates_cache', userId);
    if (!record || record.userId !== userId) return null;
    return record;
  },

  async saveDashboardStats(userId: string, stats: DashboardStats): Promise<void> {
    await idbPut('dashboard_cache', userId, {
      userId,
      stats,
      cachedAt: Date.now(),
    } satisfies DashboardCacheRecord);
  },

  async getDashboardStats(userId: string): Promise<DashboardCacheRecord | null> {
    const record = await idbGet<DashboardCacheRecord>('dashboard_cache', userId);
    if (!record || record.userId !== userId) return null;
    return record;
  },

  async saveLeaderboard(userId: string, jobDescriptionId: string, results: MatchResult[]): Promise<void> {
    const key = `${userId}:${jobDescriptionId}`;
    await idbPut('leaderboards_cache', key, {
      key,
      userId,
      jobDescriptionId,
      results,
      cachedAt: Date.now(),
    } satisfies LeaderboardCacheRecord);
  },

  async getLeaderboard(userId: string, jobDescriptionId: string): Promise<LeaderboardCacheRecord | null> {
    const key = `${userId}:${jobDescriptionId}`;
    const record = await idbGet<LeaderboardCacheRecord>('leaderboards_cache', key);
    if (!record || record.userId !== userId) return null;
    return record;
  },

  async pinCv(
    userId: string,
    candidate: Candidate,
    fileBlob?: Blob,
    contentType?: string,
  ): Promise<PinnedCvRecord> {
    const existingList = await this.listPinnedCvs(userId);
    const key = `${userId}:${candidate.id}`;
    const byteSize = fileBlob?.size ?? 0;
    const otherRecords = existingList.filter((item) => item.candidateId !== candidate.id);
    const totalOtherBytes = otherRecords.reduce((sum, item) => sum + item.byteSize, 0);

    if (otherRecords.length >= MAX_PINNED_CVS) {
      throw new Error(`Bạn chỉ có thể lưu tối đa ${MAX_PINNED_CVS} hồ sơ ngoại tuyến cùng lúc.`);
    }
    if (totalOtherBytes + byteSize > MAX_PINNED_BYTES) {
      throw new Error('Dung lượng hồ sơ lưu ngoại tuyến đã vượt quá giới hạn 50MB.');
    }

    const safeCandidate = { ...candidate };
    delete safeCandidate.fileUrl;

    const record: PinnedCvRecord = {
      key,
      userId,
      candidateId: candidate.id,
      candidate: safeCandidate,
      fileBlob,
      fileName: candidate.fileName || 'cv.pdf',
      contentType,
      byteSize,
      pinnedAt: Date.now(),
      expiresAt: Date.now() + PINNED_CV_TTL_MS,
    };
    await idbPut('pinned_cvs', key, record as unknown as Record<string, unknown>);
    return record;
  },

  async getPinnedCv(userId: string, candidateId: string): Promise<PinnedCvRecord | null> {
    const key = `${userId}:${candidateId}`;
    const record = await idbGet<PinnedCvRecord>('pinned_cvs', key);
    if (!record || record.userId !== userId) return null;
    if (record.expiresAt <= Date.now()) {
      await idbDelete('pinned_cvs', key);
      return null;
    }
    return record;
  },

  async listPinnedCvs(userId: string): Promise<PinnedCvRecord[]> {
    const all = await idbGetAll<PinnedCvRecord>('pinned_cvs');
    const now = Date.now();
    const valid: PinnedCvRecord[] = [];
    for (const item of all) {
      if (item.userId !== userId) continue;
      if (item.expiresAt <= now) {
        await idbDelete('pinned_cvs', item.key);
      } else {
        valid.push(item);
      }
    }
    return valid;
  },

  async unpinCv(userId: string, candidateId: string): Promise<void> {
    await idbDelete('pinned_cvs', `${userId}:${candidateId}`);
  },

  async listOutbox(userId: string): Promise<OutboxItem[]> {
    const all = await idbGetAll<OutboxItem>('outbox_queue');
    return all
      .filter((item) => item.userId === userId)
      .sort((a, b) => a.createdAt - b.createdAt);
  },

  async enqueueUploadCv(
    userId: string,
    files: File[],
    idempotencyKey: string,
  ): Promise<OutboxItem> {
    const entries: OfflineUploadFileEntry[] = [];
    let batchBytes = 0;
    for (const file of files) {
      const buffer = typeof file.arrayBuffer === 'function'
        ? await file.arrayBuffer()
        : await new Response(file).arrayBuffer();
      batchBytes += buffer.byteLength || file.size;
      entries.push({
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified || Date.now(),
        buffer,
      });
    }

    const existing = await this.listOutbox(userId);
    const existingUploadBytes = existing.reduce(
      (sum, item) => sum + (item.type === 'UPLOAD_CV' ? item.totalBytes : 0),
      0,
    );
    if (existingUploadBytes + batchBytes > MAX_OUTBOX_BYTES) {
      throw new Error('Hàng đợi tải CV ngoại tuyến đã đạt giới hạn 50MB. Vui lòng kết nối mạng để đồng bộ.');
    }

    const item: OutboxItem = {
      id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      userId,
      type: 'UPLOAD_CV',
      idempotencyKey,
      files: entries,
      totalBytes: batchBytes,
      status: 'queued',
      createdAt: Date.now(),
    };
    await idbPut('outbox_queue', item.id, item as unknown as Record<string, unknown>);
    return item;
  },

  async enqueueJobMutation(
    userId: string,
    options: {
      type: 'CREATE_JOB' | 'UPDATE_JOB';
      payload: JobPayload;
      idempotencyKey: string;
      targetJobId?: string;
      baseUpdatedAt?: string;
    },
  ): Promise<OutboxItem> {
    const item: OutboxItem = {
      id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `job-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      userId,
      type: options.type,
      targetJobId: options.targetJobId,
      baseUpdatedAt: options.baseUpdatedAt,
      idempotencyKey: options.idempotencyKey,
      payload: options.payload,
      status: 'queued',
      createdAt: Date.now(),
    };
    await idbPut('outbox_queue', item.id, item as unknown as Record<string, unknown>);
    return item;
  },

  async updateOutboxItem(item: OutboxItem): Promise<void> {
    await idbPut('outbox_queue', item.id, item as unknown as Record<string, unknown>);
  },

  async removeOutboxItem(id: string): Promise<void> {
    await idbDelete('outbox_queue', id);
  },

  async saveMatchingDraft(
    userId: string,
    draft: Omit<MatchingDraftRecord, 'userId' | 'updatedAt'>,
  ): Promise<void> {
    await idbPut('matching_draft', userId, {
      userId,
      ...draft,
      updatedAt: Date.now(),
    } satisfies MatchingDraftRecord);
  },

  async getMatchingDraft(userId: string): Promise<MatchingDraftRecord | null> {
    const record = await idbGet<MatchingDraftRecord>('matching_draft', userId);
    if (!record || record.userId !== userId) return null;
    return record;
  },

  async saveSubscription(userId: string, subscription: Subscription): Promise<void> {
    await idbPut('subscription_cache', userId, {
      userId,
      subscription,
      cachedAt: Date.now(),
    } satisfies SubscriptionCacheRecord);
  },

  async getSubscription(userId: string): Promise<SubscriptionCacheRecord | null> {
    const record = await idbGet<SubscriptionCacheRecord>('subscription_cache', userId);
    if (!record || record.userId !== userId) return null;
    return record;
  },

  async savePersonalUsage(userId: string, history: PersonalUsageHistory): Promise<void> {
    await idbPut('personal_usage_cache', userId, {
      userId,
      history,
      cachedAt: Date.now(),
    } satisfies PersonalUsageCacheRecord);
  },

  async getPersonalUsage(userId: string): Promise<PersonalUsageCacheRecord | null> {
    const record = await idbGet<PersonalUsageCacheRecord>('personal_usage_cache', userId);
    if (!record || record.userId !== userId) return null;
    return record;
  },

  async purgeAllOfflineData(): Promise<void> {
    await idbClearAll();
  },
};
