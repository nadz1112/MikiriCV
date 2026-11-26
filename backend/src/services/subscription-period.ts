export function subscriptionEnd(plan: 'FREE' | 'PLUS', cycle: 'MONTHLY' | 'YEARLY', start: Date): Date | null {
  if (plan === 'FREE') return null;
  const local = new Date(start.getTime() + 7 * 3600000);
  const day = local.getUTCDate();
  local.setUTCDate(1);
  local.setUTCMonth(local.getUTCMonth() + (cycle === 'YEARLY' ? 12 : 1));
  const lastDay = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  local.setUTCDate(Math.min(day, lastDay));
  return new Date(local.getTime() - 7 * 3600000);
}
