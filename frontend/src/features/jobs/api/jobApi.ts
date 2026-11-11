import { httpClient } from '../../../shared/api/httpClient';
import { ApiResponse, JobDescription, JobStats } from '../../../types';

export interface JobPayload {
  title: string;
  description: string;
  requiredSkills: string[];
  minExperience: number;
}

export const jobFeatureApi = {
  getAll: async (): Promise<JobDescription[]> => {
    const res = await httpClient.get<ApiResponse<JobDescription[]>>('/jobs');
    return res.data.data || [];
  },

  getById: async (id: string): Promise<JobDescription | undefined> => {
    const res = await httpClient.get<ApiResponse<JobDescription>>(`/jobs/${id}`);
    return res.data.data;
  },

  getStats: async (id: string): Promise<JobStats | undefined> => {
    const res = await httpClient.get<ApiResponse<JobStats>>(`/jobs/${id}/stats`);
    return res.data.data;
  },

  create: async (data: JobPayload): Promise<JobDescription | undefined> => {
    const res = await httpClient.post<ApiResponse<JobDescription>>('/jobs', data);
    return res.data.data;
  },

  update: async (id: string, data: JobPayload): Promise<JobDescription | undefined> => {
    const res = await httpClient.put<ApiResponse<JobDescription>>(`/jobs/${id}`, data);
    return res.data.data;
  },

  delete: async (id: string): Promise<{ success: boolean; message?: string }> => {
    const res = await httpClient.delete<ApiResponse>(`/jobs/${id}`);
    return res.data;
  },
};
