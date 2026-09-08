import { api } from './api';
import { ApiResponse, JobDescription, MatchResult } from '../types';

export const matchingApi = {
  run: async (jobDescriptionId: string, candidateIds: string[]) => {
    const res = await api.post<ApiResponse<MatchResult[]>>('/matching/run', {
      jobDescriptionId,
      candidateIds,
    });
    return res.data;
  },

  getLeaderboard: async (jobDescriptionId: string) => {
    const res = await api.get<ApiResponse<JobDescription>>(`/matching/leaderboard/${jobDescriptionId}`);
    return res.data.data;
  },
};
