import { expect, it, vi } from 'vitest';
import type { Subscription } from '../../services/subscriptionApi';
const get = vi.hoisted(() => vi.fn());
vi.mock('../../services/subscriptionApi', () => ({ getSubscription: get }));
import { useSubscriptionStore } from './subscriptionStore';
it('discards a late token balance from the previous account after resetting the session', async () => {
  let previous!: (data: Subscription) => void;
  get.mockImplementationOnce(() => new Promise((resolve) => { previous = resolve; }));
  const old = useSubscriptionStore.getState().fetchSubscription(true);
  useSubscriptionStore.getState().reset();
  const current = { companyId: 'new-company', tokenLimit: 200000 } as Subscription;
  get.mockResolvedValueOnce(current);
  await useSubscriptionStore.getState().fetchSubscription(true);
  previous({ companyId: 'old-company', tokenLimit: 100000 } as Subscription); await old;
  expect(useSubscriptionStore.getState().subscription).toEqual(current);
});
