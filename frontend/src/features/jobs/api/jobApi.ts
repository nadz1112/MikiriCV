import { httpClient } from '../../../shared/api/httpClient';
import { ApiResponse, CvTestEvaluationConfig, JobDescription, JobStats } from '../../../types';

export interface JobPayload {
  title: string;
  description: string;
  requiredSkills: string[];
  minExperience: number;
  preferredSkills?: string[];
  evaluationConfig?: CvTestEvaluationConfig;
}

export interface JobSyncOptions {
  idempotencyKey?: string;
  unmodifiedSince?: string;
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

  create: async (data: JobPayload, options?: JobSyncOptions): Promise<JobDescription | undefined> => {
    const headers: Record<string, string> = {};
    if (options?.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
    const res = await httpClient.post<ApiResponse<JobDescription>>('/jobs', data, { headers });
    return res.data.data;
  },

  update: async (id: string, data: JobPayload, options?: JobSyncOptions): Promise<JobDescription | undefined> => {
    const headers: Record<string, string> = {};
    if (options?.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
    if (options?.unmodifiedSince) headers['X-Unmodified-Since'] = options.unmodifiedSince;
    const res = await httpClient.put<ApiResponse<JobDescription>>(`/jobs/${id}`, data, { headers });
    return res.data.data;
  },

  delete: async (id: string): Promise<{ success: boolean; message?: string }> => {
    const res = await httpClient.delete<ApiResponse>(`/jobs/${id}`);
    return res.data;
  },
};
