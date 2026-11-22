import { api } from './api';
export interface Subscription {
  companyId: string; name: 'FREE' | 'PLUS'; billingCycle: 'MONTHLY' | 'YEARLY';
  monthlyLimit: number; maxPages: number; maxCharacters: number; bulk: boolean;
  used: number; remaining: number; month: string;
}
export async function getSubscription(signal?: AbortSignal): Promise<Subscription> {
  const response = await api.get('/subscription', { signal });
  return response.data.data;
}
export async function updateSubscription(companyId: string, plan: Subscription['name'], billingCycle: Subscription['billingCycle']) {
  return api.patch(`/admin/companies/${encodeURIComponent(companyId)}/subscription`, { plan, billingCycle });
}
