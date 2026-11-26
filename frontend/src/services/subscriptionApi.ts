import { api } from './api';
export interface Subscription {
  monthlyPriceVnd?: number;
  companyId: string; name: 'FREE' | 'PLUS'; billingCycle: 'MONTHLY' | 'YEARLY';
  tokenLimit: number; cycleDays: number; maxCvPerCall: number; maxOutputTokens: number;
  maxPages: number; maxCharacters: number; bulk: boolean;
  startsAt?: string; endsAt: string | null;
  used?: number; remaining?: number; reservedTokens?: number; periodStart?: string; periodEnd?: string;
}
export interface ServicePlan { name: 'FREE' | 'PLUS'; monthlyPriceVnd?: number; tokenLimit: number; cycleDays: number; maxCvPerCall: number; maxOutputTokens: number; version: number; maxPages: number; maxCharacters: number }
export interface AiBillingInfo { model: string; billingMode: 'FREE' | 'PAID'; status: 'FREE' | 'CONFIGURED' | 'MISSING'; inputUsd: string | null; outputUsd: string | null; priceVersion: string | null; pricingUrl: string; rateLimitsUrl: string }
export interface AccountQuota { walletId: string; tokenLimit: number; baseLimit: number; adjustment: number; used: number; remaining: number; reservedTokens: number; periodStart: string; periodEnd: string }
export interface CompanyTokens { companyId: string; companyName: string; subscription: Subscription; accounts: Array<{ id: string; fullName: string; isActive: boolean; quota: AccountQuota }> }
export interface UsageEntry { id: string; createdAt: string; model: string; inputTokens: number | null; outputTokens: number | null; thinkingTokens: number | null; totalTokens: number | null; succeeded: boolean; actualCostUsd: string | null; priceVersion: string | null }
export interface TokenHistory { ledger: Array<{ id: string; createdAt: string; kind: string; amount: number; reason: string; actorId: string | null }>; usage: UsageEntry[]; reservations: Array<{ id: string; amount: number; status: string; model: string; createdAt: string }>; ledgerTotal: number; usageTotal: number; page: number; pageSize: number }
export interface TokenBalance { tokenLimit: number; used: number; remaining: number; reservedTokens: number; periodStart: string; periodEnd: string }
export type PlanComparison = Pick<ServicePlan, 'name' | 'monthlyPriceVnd' | 'tokenLimit' | 'cycleDays' | 'maxCvPerCall' | 'maxPages' | 'maxCharacters'>;
export interface PersonalUsageHistory {
  entries: Array<{ id: string; createdAt: string; jobTitle: string | null; cvCount: number; tokensUsed: number | null; succeeded: boolean }>;
  total: number; page: number; pageSize: number;
  estimate: { averageTokensPerCv: number; sampleCount: number; source: 'PERSONAL_HISTORY' | 'DEFAULT' };
}
export async function getTokenBalance(): Promise<TokenBalance> { return (await api.get<{ data: TokenBalance }>('/subscription/balance')).data.data; }
export async function getPersonalUsageHistory(page: number, signal?: AbortSignal): Promise<PersonalUsageHistory> {
  return (await api.get<{ data: PersonalUsageHistory }>('/subscription/history', { params: { page }, signal })).data.data;
}
export async function getPlanComparison(signal?: AbortSignal): Promise<PlanComparison[]> {
  return (await api.get<{ data: PlanComparison[] }>('/subscription/plans', { signal })).data.data;
}
export async function getSubscription(signal?: AbortSignal): Promise<Subscription> {
  const response = await api.get('/subscription', { signal });
  return response.data.data;
}
export async function updateSubscription(companyId: string, plan: Subscription['name'], billingCycle: Subscription['billingCycle'], endsAt: string | null, reason: string, operationKey: string) {
  return api.patch(`/admin/companies/${encodeURIComponent(companyId)}/subscription`, { plan, billingCycle, endsAt, reason, operationKey });
}
export const billingApi = {
  info: async (): Promise<AiBillingInfo> => (await api.get('/admin/ai-billing')).data.data,
  plans: async (): Promise<ServicePlan[]> => (await api.get('/admin/plans')).data.data,
  savePlan: async (plan: ServicePlan, reason: string, operationKey: string) => api.put(`/admin/plans/${plan.name}`, { ...plan, reason, operationKey }),
  company: async (companyId: string): Promise<CompanyTokens> => (await api.get(`/admin/companies/${encodeURIComponent(companyId)}/tokens`)).data.data,
  history: async (userId: string, page = 1, signal?: AbortSignal): Promise<TokenHistory> => (await api.get(`/admin/users/${encodeURIComponent(userId)}/token-history`, { params: { page }, signal })).data.data,
  adjust: async (userId: string, amount: number, reason: string, operationKey: string) => api.post(`/admin/users/${encodeURIComponent(userId)}/tokens`, { amount, reason, operationKey }),
  prices: async (): Promise<Array<{ id: string; model: string; inputUsd: string; outputUsd: string; thinkingUsd: string; createdAt: string }>> => (await api.get('/admin/prices')).data.data,
  savePrice: async (model: string, inputUsd: number, outputUsd: number, reason: string, operationKey: string) => api.post('/admin/prices', { model, inputUsd, outputUsd, reason, operationKey }),
  reconcile: async (id: string, action: 'release' | 'settle', reason: string, inputTokens?: number, outputTokens?: number, thinkingTokens?: number) => api.post(`/admin/reservations/${encodeURIComponent(id)}/reconcile`, { action, reason, inputTokens, outputTokens, thinkingTokens }),
};
