import { create } from 'zustand';
import { JobDescription } from '../../../types';

interface JobFeatureUIState {
  searchQuery: string;
  detailJob: JobDescription | null;
  editingJob: JobDescription | null;
  deletingJob: JobDescription | null;
  isFormModalOpen: boolean;
  setSearchQuery: (query: string) => void;
  openCreateModal: () => void;
  openEditModal: (job: JobDescription) => void;
  closeFormModal: () => void;
  openDetailDrawer: (job: JobDescription) => void;
  closeDetailDrawer: () => void;
  openDeleteModal: (job: JobDescription) => void;
  closeDeleteModal: () => void;
}

export const useJobFeatureStore = create<JobFeatureUIState>((set) => ({
  searchQuery: '',
  detailJob: null,
  editingJob: null,
  deletingJob: null,
  isFormModalOpen: false,

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  openCreateModal: () =>
    set({
      editingJob: null,
      isFormModalOpen: true,
    }),

  openEditModal: (job) =>
    set({
      editingJob: job,
      isFormModalOpen: true,
    }),

  closeFormModal: () =>
    set({
      editingJob: null,
      isFormModalOpen: false,
    }),

  openDetailDrawer: (job) =>
    set({
      detailJob: job,
    }),

  closeDetailDrawer: () =>
    set({
      detailJob: null,
    }),

  openDeleteModal: (job) =>
    set({
      deletingJob: job,
    }),

  closeDeleteModal: () =>
    set({
      deletingJob: null,
    }),
}));

