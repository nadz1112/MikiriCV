import { httpClient } from '../shared/api/httpClient';

export type DashboardRange = '7d' | '30d' | 'all';
export interface EnterpriseActivity {
  id: string;
  fullName: string;
  companyName: string | null;
  lastLoginAt: string | null;
  jobCount: number;
  candidateCount: number;
  matchCount: number;
  inputTokens: number;
  outputTokens: number;
}
export interface AdminDashboard {
  range: DashboardRange;
  overview: { totalUsers: number; activeUsers: number; lockedUsers: number; totalJobs: number; totalCandidates: number; failedCandidates: number; totalMatches: number };
  distribution: Array<{ label: string; count: number }>;
  ai: {
    inputTokens: number; outputTokens: number; estimatedCostUsd: number | null;
    inputRate: number | null; outputRate: number | null; calls: number; callsWithoutTokenData: number;
    daily: Array<{ date: string; inputTokens: number; outputTokens: number; estimatedCostUsd: number | null; calls: number }>;
  };
  enterprises: EnterpriseActivity[];
}
export async function getAdminDashboard(range: DashboardRange, signal?: AbortSignal): Promise<AdminDashboard> {
  const response = await httpClient.get<{ success: boolean; data: AdminDashboard }>('/admin/dashboard', { params: { range }, signal });
  return response.data.data;
}
