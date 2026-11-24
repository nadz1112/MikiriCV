import { httpClient } from '../shared/api/httpClient';
import type { Subscription } from './subscriptionApi';

export type DashboardRange = '7d' | '30d' | 'all';
export interface HrActivity {
  id: string; email: string; fullName: string; isActive: boolean;
  lastLoginAt: string | null; jobCount: number; candidateCount: number;
  matchCount: number; inputTokens: number; outputTokens: number; calls: number;
}
export interface EnterpriseActivity {
  simulatedCostVnd?: number;
  subscription?: Subscription;
  id: string | null;
  fullName: string;
  companyName: string | null;
  lastLoginAt: string | null;
  jobCount: number;
  candidateCount: number;
  matchCount: number;
  inputTokens: number;
  outputTokens: number;
  calls: number;
  estimatedCostUsd: number | null;
  hrCount: number;
  members: HrActivity[];
}
export interface AdminDashboard {
  range: DashboardRange;
  aiUsageSince: string | null;
  overview: { totalUsers: number; activeUsers: number; lockedUsers: number; totalJobs: number; totalCandidates: number; failedCandidates: number; totalMatches: number };
  distribution: Array<{ label: string; count: number }>;
  ai: {
    simulatedCostVnd: number; demoInputRate: number; demoOutputRate: number;
    billingMode: 'FREE' | 'PAID';
    inputTokens: number; outputTokens: number; estimatedCostUsd: number | null;
    inputRate: number | null; outputRate: number | null; calls: number; callsWithoutTokenData: number;
    daily: Array<{ date: string; inputTokens: number; outputTokens: number; estimatedCostUsd: number | null; simulatedCostVnd: number; calls: number }>;
  };
  enterprises: EnterpriseActivity[];
}
export async function getAdminDashboard(range: DashboardRange, signal?: AbortSignal, companyId?: string): Promise<AdminDashboard> {
  const response = await httpClient.get<{ success: boolean; data: AdminDashboard }>('/admin/dashboard', { params: { range, companyId }, signal });
  return response.data.data;
}
