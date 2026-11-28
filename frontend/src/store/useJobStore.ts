import { create } from 'zustand';
import { JobDescription } from '../types';
import { jobApi } from '../services/jobApi';
import { offlineDb } from '../shared/offline/offlineDb';
import { isNetworkOfflineError } from '../shared/platform/runtime';
import { useAuthStore } from '../features/auth/authStore';

async function mergePendingOutboxJobs(userId: string, baseJobs: JobDescription[]): Promise<JobDescription[]> {
  const outbox = await offlineDb.listOutbox(userId);
  const next = [...baseJobs];
  for (const item of outbox) {
    if (item.type === 'CREATE_JOB') {
      const draftId = `offline-draft-${item.idempotencyKey}`;
      if (!next.some((j) => j.id === draftId)) {
        const nowIso = new Date(item.createdAt).toISOString();
        next.unshift({
          id: draftId,
          title: `${item.payload.title} (Chờ đồng bộ)`,
          description: item.payload.description,
          requiredSkills: item.payload.requiredSkills,
          minExperience: item.payload.minExperience,
          preferredSkills: item.payload.preferredSkills,
          evaluationConfig: item.payload.evaluationConfig,
          createdAt: nowIso,
          updatedAt: nowIso,
          createdById: userId,
          _count: { matchResults: 0 },
        });
      }
    } else if (item.type === 'UPDATE_JOB' && item.targetJobId) {
      const idx = next.findIndex((j) => j.id === item.targetJobId);
      if (idx >= 0) {
        next[idx] = {
          ...next[idx],
          ...item.payload,
          title: item.payload.title.includes('(Chờ đồng bộ)')
            ? item.payload.title
            : `${item.payload.title} (Chờ đồng bộ)`,
          updatedAt: new Date(item.createdAt).toISOString(),
        };
      }
    }
  }
  return next;
}

interface JobState {
  jobs: JobDescription[];
  selectedJob: JobDescription | null;
  isLoading: boolean;
  fetchJobs: (options?: { background?: boolean; signal?: AbortSignal }) => Promise<void>;
  selectJob: (job: JobDescription | null) => void;
  updateJob: (job: JobDescription) => void;
  deleteJob: (id: string) => Promise<void>;
}

export const useJobStore = create<JobState>((set) => ({
  jobs: [],
  selectedJob: null,
  isLoading: false,

  fetchJobs: async (options) => {
    if (!options?.background) set({ isLoading: true });
    const userId = useAuthStore.getState?.()?.user?.id;
    try {
      const data = await jobApi.getAll(options?.signal);
      if (options?.signal?.aborted) return;
      if (userId) {
        void offlineDb.saveJobs(userId, data);
      }
      const merged = userId ? await mergePendingOutboxJobs(userId, data) : data;
      set({ jobs: merged, isLoading: false });
    } catch (error) {
      if (options?.signal?.aborted) return;
      if (isNetworkOfflineError(error) && userId) {
        const cached = await offlineDb.getJobs(userId);
        const merged = await mergePendingOutboxJobs(userId, cached?.jobs ?? []);
        set({ jobs: merged, isLoading: false });
        return;
      }
      set({ isLoading: false });
    }
  },

  selectJob: (job) => set({ selectedJob: job }),

  updateJob: (job) => set((state) => ({
    jobs: state.jobs.map((item) => item.id === job.id ? { ...item, ...job } : item),
    selectedJob: state.selectedJob?.id === job.id ? { ...state.selectedJob, ...job } : state.selectedJob,
  })),

  deleteJob: async (id: string) => {
    await jobApi.delete(id);
    set((state) => ({
      jobs: state.jobs.filter((j) => j.id !== id),
      selectedJob: state.selectedJob?.id === id ? null : state.selectedJob,
    }));
  },
}));
