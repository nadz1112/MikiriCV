import { create } from 'zustand';

export interface CandidateFilterState {
  search: string;
  skills: string[];
  skillMode: 'any' | 'all';
  minExp: number;
  extractionStatus?: 'SUCCESS' | 'WARNING' | 'FAILED';
  page: number;
  limit: number;
  sort: 'createdAt' | 'yearsOfExperience' | 'fullName';
}

interface CandidateStore {
  filter: CandidateFilterState;
  selectedCandidateIds: string[];
  setSearch: (search: string) => void;
  setSkills: (skills: string[]) => void;
  toggleSkill: (skill: string) => void;
  setSkillMode: (mode: 'any' | 'all') => void;
  setMinExp: (minExp: number) => void;
  setExtractionStatus: (status?: 'SUCCESS' | 'WARNING' | 'FAILED') => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setSort: (sort: 'createdAt' | 'yearsOfExperience' | 'fullName') => void;
  resetFilter: () => void;
  toggleSelect: (id: string) => void;
  toggleSelectAll: (visibleIds: string[]) => void;
  clearSelection: () => void;
}

const defaultFilter: CandidateFilterState = {
  search: '',
  skills: [],
  skillMode: 'any',
  minExp: 0,
  page: 1,
  limit: 50,
  sort: 'createdAt',
};

export const useCandidateFeatureStore = create<CandidateStore>((set) => ({
  filter: { ...defaultFilter },
  selectedCandidateIds: [],

  setSearch: (search) =>
    set((state) => ({ filter: { ...state.filter, search, page: 1 } })),

  setSkills: (skills) =>
    set((state) => ({ filter: { ...state.filter, skills, page: 1 } })),

  toggleSkill: (skill) =>
    set((state) => {
      const exists = state.filter.skills.includes(skill);
      const newSkills = exists
        ? state.filter.skills.filter((s) => s !== skill)
        : [...state.filter.skills, skill];
      return { filter: { ...state.filter, skills: newSkills, page: 1 } };
    }),

  setSkillMode: (skillMode) =>
    set((state) => ({ filter: { ...state.filter, skillMode, page: 1 } })),

  setMinExp: (minExp) =>
    set((state) => ({ filter: { ...state.filter, minExp, page: 1 } })),

  setExtractionStatus: (extractionStatus) =>
    set((state) => ({ filter: { ...state.filter, extractionStatus, page: 1 } })),

  setPage: (page) =>
    set((state) => ({ filter: { ...state.filter, page } })),

  setLimit: (limit) =>
    set((state) => ({ filter: { ...state.filter, limit, page: 1 } })),

  setSort: (sort) =>
    set((state) => ({ filter: { ...state.filter, sort, page: 1 } })),

  resetFilter: () =>
    set({ filter: { ...defaultFilter } }),

  toggleSelect: (id) =>
    set((state) => {
      const exists = state.selectedCandidateIds.includes(id);
      return {
        selectedCandidateIds: exists
          ? state.selectedCandidateIds.filter((item) => item !== id)
          : [...state.selectedCandidateIds, id],
      };
    }),

  toggleSelectAll: (visibleIds) =>
    set((state) => {
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => state.selectedCandidateIds.includes(id));
      if (allSelected) {
        // Deselect all visible
        return {
          selectedCandidateIds: state.selectedCandidateIds.filter((id) => !visibleIds.includes(id)),
        };
      }
      // Add missing visible
      const toAdd = visibleIds.filter((id) => !state.selectedCandidateIds.includes(id));
      return {
        selectedCandidateIds: [...state.selectedCandidateIds, ...toAdd],
      };
    }),

  clearSelection: () => set({ selectedCandidateIds: [] }),
}));
