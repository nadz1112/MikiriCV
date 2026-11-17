import { create } from 'zustand';
import { JobDescription } from '../types';
import { jobApi } from '../services/jobApi';

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
    try {
      const data = await jobApi.getAll(options?.signal);
      if (options?.signal?.aborted) return;
      set({ jobs: data, isLoading: false });
    } catch {
      if (!options?.signal?.aborted) set({ isLoading: false });
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
