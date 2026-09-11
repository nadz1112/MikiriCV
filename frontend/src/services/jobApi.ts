import { api } from './api';
import { ApiResponse, JobDescription } from '../types';

export const jobApi = {
  getAll: async () => {
    const res = await api.get<ApiResponse<JobDescription[]>>('/jobs');
    return res.data.data || [];
  },

  getById: async (id: string) => {
    const res = await api.get<ApiResponse<JobDescription>>(`/jobs/${id}`);
    return res.data.data;
  },

  create: async (data: { title: string; description: string; requiredSkills: string[]; minExperience?: number }) => {
    const res = await api.post<ApiResponse<JobDescription>>('/jobs', data);
    return res.data.data;
  },

  update: async (id: string, data: Partial<JobDescription>) => {
    const res = await api.put<ApiResponse<JobDescription>>(`/jobs/${id}`, data);
    return res.data.data;
  },

  delete: async (id: string) => {
    const res = await api.delete<ApiResponse>(`/jobs/${id}`);
    return res.data;
  },
};
