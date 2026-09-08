import { api } from './api';
import { ApiResponse, Candidate, CandidateFilter } from '../types';

export const candidateApi = {
  upload: async (files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const res = await api.post<ApiResponse<Candidate[]>>('/candidates/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  getAll: async (filter?: CandidateFilter) => {
    const params = new URLSearchParams();
    if (filter?.search) params.append('search', filter.search);
    if (filter?.skills) params.append('skills', filter.skills);
    if (filter?.minExp) params.append('minExp', filter.minExp);

    const res = await api.get<ApiResponse<Candidate[]>>(`/candidates?${params.toString()}`);
    return res.data.data || [];
  },

  getById: async (id: string) => {
    const res = await api.get<ApiResponse<Candidate>>(`/candidates/${id}`);
    return res.data.data;
  },

  delete: async (id: string) => {
    const res = await api.delete<ApiResponse>(`/candidates/${id}`);
    return res.data;
  },
};
