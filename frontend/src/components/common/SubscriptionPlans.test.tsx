// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SubscriptionPlans } from './SubscriptionPlans';
import type { Subscription } from '../../services/subscriptionApi';
const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock('../../services/subscriptionApi', () => ({ updateSubscription: mocks.update }));
const subscription: Subscription = { companyId: 'co', name: 'FREE', billingCycle: 'MONTHLY', monthlyLimit: 10, maxPages: 2, maxCharacters: 3000, bulk: false, used: 9, remaining: 1, month: '2026-11-01' };
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('shows shared company quota and both exact plan prices without HR controls', () => {
  render(<SubscriptionPlans subscription={subscription} />);
  expect(screen.getByText('9/10 lượt CV · Còn 1 lượt')).toBeTruthy();
  expect(screen.getByRole('progressbar').getAttribute('value')).toBe('9');
  expect(screen.getByText(/249.000đ\/tháng khi thanh toán theo năm/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Cập nhật gói' })).toBeNull();
});
it('lets admin manage the company quota without pricing or sales cards', async () => {
  const updated = vi.fn(); mocks.update.mockResolvedValue({});
  render(<SubscriptionPlans subscription={subscription} admin onUpdated={updated} />);
  expect(screen.queryByText('FREE — Trải nghiệm cơ bản')).toBeNull();
  expect(screen.queryByText('Khuyên dùng')).toBeNull();
  expect(screen.queryByText(/299.000đ/)).toBeNull();
  expect(screen.getByText('Còn lại')).toBeTruthy();
  expect(screen.queryByLabelText('Chu kỳ tính phí')).toBeNull();
  fireEvent.change(screen.getByLabelText('Hạn mức phân tích mỗi tháng'), { target: { value: 'PLUS' } });
  fireEvent.change(screen.getByLabelText('Chu kỳ thanh toán'), { target: { value: 'YEARLY' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu hạn mức' }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('co', 'PLUS', 'YEARLY'));
  expect(updated).toHaveBeenCalledTimes(1);
});
it('keeps failed plan changes visible', async () => {
  mocks.update.mockRejectedValue(new Error('offline'));
  render(<SubscriptionPlans subscription={subscription} admin />);
  fireEvent.click(screen.getByRole('button', { name: 'Lưu hạn mức' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
});
it('asks admin to select a company and hides pricing when viewing all companies', () => {
  render(<SubscriptionPlans admin />);
  expect(screen.getByText(/Chọn doanh nghiệp ở bộ lọc phía trên/)).toBeTruthy();
  expect(screen.queryByRole('article')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Lưu hạn mức' })).toBeNull();
});
