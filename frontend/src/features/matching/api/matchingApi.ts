import { httpClient } from '../../../shared/api/httpClient';
import { ApiResponse, Candidate, JobDescription, MatchResult, MatchingJob } from '../../../types';

export interface RunMatchingResponse {
  success: boolean;
  message?: string;
  data?: MatchResult[];
}

export interface MatchingJobResponse {
  success: boolean;
  message?: string;
  data?: MatchingJob;
}

export const matchingFeatureApi = {
  run: async (jobDescriptionId: string, candidateIds: string[]): Promise<RunMatchingResponse> => {
    const res = await httpClient.post<RunMatchingResponse>(
      '/matching/run',
      {
        jobDescriptionId,
        candidateIds,
      },
      {
        timeout: 180000,
      },
    );
    return res.data;
  },

  createJob: async (jobDescriptionId: string, candidateIds: string[]): Promise<MatchingJobResponse> => {
    const res = await httpClient.post<MatchingJobResponse>('/matching/jobs', {
      jobDescriptionId,
      candidateIds,
    });
    return res.data;
  },

  getJob: async (jobId: string, includeItems = true): Promise<MatchingJob | undefined> => {
    const res = await httpClient.get<MatchingJobResponse>(
      `/matching/jobs/${jobId}${includeItems ? '?include=items' : ''}`,
    );
    return res.data.data;
  },

  cancelJob: async (jobId: string): Promise<MatchingJobResponse> => {
    const res = await httpClient.post<MatchingJobResponse>(`/matching/jobs/${jobId}/cancel`);
    return res.data;
  },

  getLeaderboard: async (jobDescriptionId: string): Promise<JobDescription | undefined> => {
    const res = await httpClient.get<ApiResponse<JobDescription>>(
      `/matching/leaderboard/${jobDescriptionId}`,
    );
    return res.data.data;
  },

  getCandidateDetail: async (candidateId: string): Promise<Candidate | undefined> => {
    const res = await httpClient.get<ApiResponse<Candidate>>(`/candidates/${candidateId}`);
    return res.data.data;
  },

  deleteCandidate: async (candidateId: string): Promise<{ success: boolean; message?: string }> => {
    const res = await httpClient.delete<ApiResponse>(`/candidates/${candidateId}`);
    return res.data;
  },
};
