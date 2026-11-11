import { httpClient } from '../../../shared/api/httpClient';

export interface CandidateItem {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  yearsOfExperience: number;
  skills: string[];
  education: string | null;
  fileName: string;
  extractionStatus: 'SUCCESS' | 'WARNING' | 'FAILED';
  extractionMessage: string | null;
  matchScore: number | null;
  createdAt: string;
  uploadedBy?: { id: string; fullName: string; email: string; companyName: string | null } | null;
}

export interface CandidateListResponse {
  success: boolean;
  total: number;
  page: number;
  limit: number;
  data: CandidateItem[];
}

export interface CandidateQueryParams {
  enterpriseId?: string;
  search?: string;
  skills?: string[];
  skillMode?: 'any' | 'all';
  minExp?: number;
  extractionStatus?: 'SUCCESS' | 'WARNING' | 'FAILED';
  jobId?: string;
  page?: number;
  limit?: number;
  sort?: 'createdAt' | 'yearsOfExperience' | 'fullName';
}

export const candidateApi = {
  list: async (params: CandidateQueryParams = {}): Promise<CandidateListResponse> => {
    const searchParams = new URLSearchParams();
    if (params.enterpriseId) searchParams.append('enterpriseId', params.enterpriseId);

    if (params.search?.trim()) searchParams.append('search', params.search.trim());
    if (params.skills && params.skills.length > 0) searchParams.append('skills', params.skills.join(','));
    if (params.skillMode) searchParams.append('skillMode', params.skillMode);
    if (params.minExp !== undefined && params.minExp > 0) searchParams.append('minExp', params.minExp.toString());
    if (params.extractionStatus) searchParams.append('extractionStatus', params.extractionStatus);
    if (params.jobId) searchParams.append('jobId', params.jobId);
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.sort) searchParams.append('sort', params.sort);

    const res = await httpClient.get<CandidateListResponse>(`/candidates?${searchParams.toString()}`);
    return res.data;
  },

  getSkills: async (): Promise<string[]> => {
    const res = await httpClient.get<{ success: boolean; data: string[] }>('/skills');
    return res.data.data;
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await httpClient.delete<{ success: boolean; message: string }>(`/candidates/${id}`);
    return res.data;
  },
};
