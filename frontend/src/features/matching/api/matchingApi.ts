import { httpClient } from '../../../shared/api/httpClient';
import { ApiResponse, Candidate, JobDescription, MatchResult } from '../../../types';

export interface RunMatchingResponse {
  success: boolean;
  message?: string;
  data?: MatchResult[];
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
