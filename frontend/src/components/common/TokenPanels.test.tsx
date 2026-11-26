// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TokenHistoryPanel } from './TokenPanels';

const mocks = vi.hoisted(() => ({ history: vi.fn() }));
vi.mock('../../services/subscriptionApi', () => ({ billingApi: { history: mocks.history } }));
afterEach(cleanup);

it('keeps independent pages for AI usage, quota history and reconciliation', async () => {
  mocks.history.mockResolvedValue({ usage: [], ledger: [], reservations: [], usageTotal: 21, ledgerTotal: 21, reservationTotal: 21, pageSize: 10 });
  render(<TokenHistoryPanel userId="test-user" />);
  fireEvent.click(screen.getByText('Lịch sử token và chi phí AI của tài khoản'));
  const usage = await screen.findByRole('navigation', { name: 'Phân trang sử dụng AI' });
  fireEvent.click(within(usage).getByText('Sau'));
  await waitFor(() => expect(mocks.history).toHaveBeenLastCalledWith('test-user', 2, expect.any(AbortSignal), 1, 1));
  fireEvent.click(await screen.findByText('Lịch sử hạn mức và chu kỳ'));
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Phân trang hạn mức và chu kỳ' })).getByText('Sau'));
  await waitFor(() => expect(mocks.history).toHaveBeenLastCalledWith('test-user', 2, expect.any(AbortSignal), 2, 1));
  fireEvent.click(await screen.findByText('Cần đối soát'));
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Phân trang đối soát' })).getByText('Sau'));
  await waitFor(() => expect(mocks.history).toHaveBeenLastCalledWith('test-user', 2, expect.any(AbortSignal), 2, 2));
});
