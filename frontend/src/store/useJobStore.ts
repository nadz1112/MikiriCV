import { create } from 'zustand';
import { JobDescription } from '../types';
import { jobApi } from '../services/jobApi';

interface JobState {
  jobs: JobDescription[];
  selectedJob: JobDescription | null;
  isLoading: boolean;
  fetchJobs: () => Promise<void>;
  selectJob: (job: JobDescription | null) => void;
  deleteJob: (id: string) => Promise<void>;
}

export const useJobStore = create<JobState>((set) => ({
  jobs: [],
  selectedJob: null,
  isLoading: false,

  fetchJobs: async () => {
    set({ isLoading: true });
    try {
      const data = await jobApi.getAll();
      set({ jobs: data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  selectJob: (job) => set({ selectedJob: job }),

  deleteJob: async (id: string) => {
    await jobApi.delete(id);
    set((state) => ({
      jobs: state.jobs.filter((j) => j.id !== id),
      selectedJob: state.selectedJob?.id === id ? null : state.selectedJob,
    }));
  },
}));
