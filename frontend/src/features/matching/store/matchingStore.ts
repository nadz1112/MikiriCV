import { create } from 'zustand';

interface MatchingFeatureState {
  selectedJobId: string;
  selectedCandidateIds: string[];
  candidateSearch: string;
  onlyUnscored: boolean;
  isConfirmModalOpen: boolean;
  setSelectedJobId: (jobId: string) => void;
  setSelectedCandidateIds: (ids: string[]) => void;
  toggleCandidateId: (id: string) => void;
  setCandidateSearch: (search: string) => void;
  setOnlyUnscored: (onlyUnscored: boolean) => void;
  openConfirmModal: () => void;
  closeConfirmModal: () => void;
  clearSelection: () => void;
}

export const useMatchingFeatureStore = create<MatchingFeatureState>((set) => ({
  selectedJobId: '',
  selectedCandidateIds: [],
  candidateSearch: '',
  onlyUnscored: false,
  isConfirmModalOpen: false,

  setSelectedJobId: (selectedJobId) => set({ selectedJobId }),

  setSelectedCandidateIds: (selectedCandidateIds) => set({ selectedCandidateIds }),

  toggleCandidateId: (id) =>
    set((state) => {
      const exists = state.selectedCandidateIds.includes(id);
      return {
        selectedCandidateIds: exists
          ? state.selectedCandidateIds.filter((item) => item !== id)
          : [...state.selectedCandidateIds, id],
      };
    }),

  setCandidateSearch: (candidateSearch) => set({ candidateSearch }),

  setOnlyUnscored: (onlyUnscored) => set({ onlyUnscored }),

  openConfirmModal: () => set({ isConfirmModalOpen: true }),

  closeConfirmModal: () => set({ isConfirmModalOpen: false }),

  clearSelection: () => set({ selectedCandidateIds: [] }),
}));

