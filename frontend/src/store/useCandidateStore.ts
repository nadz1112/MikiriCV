import { create } from 'zustand';
import { Candidate, CandidateFilter } from '../types';
import { candidateApi } from '../services/candidateApi';

interface CandidateState {
  candidates: Candidate[];
  selectedCandidates: string[];
  filter: CandidateFilter;
  isLoading: boolean;
  page: number;
  total: number;
  fetchPage: (page: number) => Promise<void>;
  fetchCandidates: (filter?: CandidateFilter) => Promise<void>;
  setFilter: (filter: CandidateFilter) => void;
  toggleSelectCandidate: (id: string) => void;
  selectAllCandidates: (ids: string[]) => void;
  clearSelection: () => void;
  deleteCandidate: (id: string) => Promise<void>;
}

export const useCandidateStore = create<CandidateState>((set, get) => ({
  candidates: [],
  selectedCandidates: [],
  filter: {},
  isLoading: false,
  page: 1,
  total: 0,
  fetchPage: async (page) => {
    set({ isLoading: true });
    try {
      const result = await candidateApi.getPage(page);
      set({ candidates: result.data, page: result.page, total: result.total, isLoading: false });
    } catch { set({ isLoading: false }); }
  },

  fetchCandidates: async (filter) => {
    set({ isLoading: true });
    try {
      const activeFilter = filter || get().filter;
      const data = await candidateApi.getAll(activeFilter);
      set({ candidates: data, total: data.length, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  setFilter: (filter) => {
    set({ filter });
    get().fetchCandidates(filter);
  },

  toggleSelectCandidate: (id) => {
    set((state) => {
      const exists = state.selectedCandidates.includes(id);
      return {
        selectedCandidates: exists
          ? state.selectedCandidates.filter((item) => item !== id)
          : [...state.selectedCandidates, id],
      };
    });
  },

  selectAllCandidates: (ids) => set({ selectedCandidates: ids }),

  clearSelection: () => set({ selectedCandidates: [] }),

  deleteCandidate: async (id: string) => {
    await candidateApi.delete(id);
    set((state) => ({
      candidates: state.candidates.filter((c) => c.id !== id),
      selectedCandidates: state.selectedCandidates.filter((item) => item !== id),
    }));
  },
}));
