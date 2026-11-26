// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiBillingPanel, PlanPriceCalculator } from './AiBillingPanel';

const mocks = vi.hoisted(() => ({ info: vi.fn(), savePrice: vi.fn() }));
vi.mock('../../services/subscriptionApi', () => ({ billingApi: mocks }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('Chi phí và giá dịch vụ', () => {
  it('automatically explains free cost and removes the manual pricing form', async () => {
    mocks.info.mockResolvedValue({ model: 'configured-model', billingMode: 'FREE' });
    render(<AiBillingPanel />);
    expect(await screen.findByText(/0 USD cho lần gọi mới/)).toBeTruthy();
    expect(screen.getByText('configured-model')).toBeTruthy();
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });
  it('prices paid reasoning at the output rate with no separate third price', async () => {
    mocks.info.mockResolvedValue({ model: 'configured-model', billingMode: 'PAID', inputUsd: '0.75', outputUsd: '3.75' });
    render(<AiBillingPanel />);
    await screen.findByText('configured-model');
    expect(screen.getByLabelText(/Đầu ra, gồm suy luận/)).toHaveProperty('value', '3.75');
    expect(screen.getAllByRole('spinbutton', { hidden: true })).toHaveLength(2);
  });
  it('calculates a company monthly fee from explicit costs and margin without saving it', () => {
    const apply = vi.fn(); render(<PlanPriceCalculator onApply={apply} />);
    expect(screen.getByText('Giá gợi ý: 100.000đ / doanh nghiệp / tháng')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Chi phí vận hành phân bổ/), { target: { value: '70000' } });
    fireEvent.change(screen.getByLabelText(/Chi phí AI dự kiến cả doanh nghiệp/), { target: { value: '30000' } });
    expect(screen.getByText('Giá gợi ý: 143.000đ / doanh nghiệp / tháng')).toBeTruthy();
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Áp dụng giá gợi ý/, hidden: true }));
    expect(apply).toHaveBeenCalledWith(143000);
    fireEvent.change(screen.getByLabelText(/Biên lợi nhuận/), { target: { value: '100' } });
    expect(screen.queryByText(/Giá gợi ý:/)).toBeNull();
  });
});
