// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from './FilterBar';
import { useCandidateFeatureStore } from '../store/candidateStore';
vi.mock('../api/candidateApi', () => ({ candidateApi: { getSkills: async () => ['React', 'Python'] } }));
const auth = vi.hoisted(() => ({ user: { role: 'ENTERPRISE' } }));
vi.mock('../../auth/authStore', () => ({ useAuthStore: (select: (state: typeof auth) => unknown) => select(auth) }));
vi.mock('../../../shared/api/httpClient', () => ({ httpClient: { get: async () => ({ data: { data: [], total: 0 } }) } }));
afterEach(() => { cleanup(); auth.user.role = 'ENTERPRISE'; useCandidateFeatureStore.setState(useCandidateFeatureStore.getInitialState()); });

it('accepts a typed skill when leaving the field without selecting a suggestion', async () => {
  const user = userEvent.setup();
  render(<><FilterBar /><button>Outside</button></>);
  await user.click(screen.getByRole('button', { name: 'Kỹ năng' }));
  await user.type(screen.getByPlaceholderText('Gõ kỹ năng (Enter để thêm)...'), 'Custom skill');
  await user.click(screen.getByText('Outside'));
  expect(useCandidateFeatureStore.getState().filter.skills).toEqual(['Custom skill']);
});

it('selecting a suggestion does not also add the partially typed query', async () => {
  const user = userEvent.setup();
  render(<><FilterBar /><button>Outside</button></>);
  await user.click(screen.getByRole('button', { name: 'Kỹ năng' }));
  await user.type(screen.getByPlaceholderText('Gõ kỹ năng (Enter để thêm)...'), 'Pyt');
  await user.click((await screen.findAllByRole('button', { name: 'Python' }))[0]);
  await user.click(screen.getByText('Outside'));
  expect(useCandidateFeatureStore.getState().filter.skills).toEqual(['Python']);
});

it.each(['ADMIN', 'ENTERPRISE'])('lọc trích xuất cho %s và đưa phân trang về trang 1', async (role) => {
  auth.user.role = role;
  const user = userEvent.setup();
  useCandidateFeatureStore.getState().setPage(3);
  render(<FilterBar />);
  const select = screen.getByRole('combobox', { name: 'Trích xuất:' });
  for (const status of ['SUCCESS', 'WARNING', 'FAILED']) {
    await user.selectOptions(select, status);
    expect(useCandidateFeatureStore.getState().filter.extractionStatus).toBe(status);
    expect(useCandidateFeatureStore.getState().filter.page).toBe(1);
  }
  await user.selectOptions(select, '');
  expect(useCandidateFeatureStore.getState().filter.extractionStatus).toBeUndefined();
  await user.selectOptions(select, 'WARNING');
  await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
  expect(useCandidateFeatureStore.getState().filter.extractionStatus).toBeUndefined();
  expect((select as HTMLSelectElement).value).toBe('');
});
