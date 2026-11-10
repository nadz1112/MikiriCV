import { httpClient as api } from '../shared/api/httpClient';
import type { JobStats } from '../types';
import { ApiResponse, JobDescription } from '../types';

export interface JobPayload {
  title: string;
  description: string;
  requiredSkills: string[];
  minExperience: number;
}

export const jobApi = {
  getStats: async (id: string) => {
    const response = await api.get<ApiResponse<JobStats>>(`/jobs/${encodeURIComponent(id)}/stats`);
    return response.data.data;
  },
  getAll: async () => {
    const res = await api.get<ApiResponse<JobDescription[]>>('/jobs');
    return res.data.data || [];
  },

  getById: async (id: string) => {
    const res = await api.get<ApiResponse<JobDescription>>(`/jobs/${id}`);
    return res.data.data;
  },

  create: async (data: JobPayload) => {
    const res = await api.post<ApiResponse<JobDescription>>('/jobs', data);
    return res.data.data;
  },

  update: async (id: string, data: JobPayload) => {
    const res = await api.put<ApiResponse<JobDescription>>(`/jobs/${id}`, data);
    return res.data.data;
  },

  delete: async (id: string) => {
    const res = await api.delete<ApiResponse>(`/jobs/${id}`);
    return res.data;
  },
};
