import { describe, expect, it } from 'vitest';
import { subscriptionEnd } from '../src/services/subscription-period.js';

describe('automatic subscription expiry', () => {
  it('keeps FREE unlimited', () => {
    expect(subscriptionEnd('FREE', 'MONTHLY', new Date())).toBeNull();
  });
  it('clamps month ends in Vietnam time', () => {
    expect(subscriptionEnd('PLUS', 'MONTHLY', new Date('2026-01-31T00:00:00+07:00'))?.toISOString()).toBe('2026-02-27T17:00:00.000Z');
    expect(subscriptionEnd('PLUS', 'MONTHLY', new Date('2024-01-31T00:00:00+07:00'))?.toISOString()).toBe('2024-02-28T17:00:00.000Z');
  });
  it('clamps leap day when adding a year', () => {
    expect(subscriptionEnd('PLUS', 'YEARLY', new Date('2024-02-29T00:00:00+07:00'))?.toISOString()).toBe('2025-02-27T17:00:00.000Z');
  });
});
