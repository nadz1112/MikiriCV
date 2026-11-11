// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from './FilterBar';
import { useCandidateFeatureStore } from '../store/candidateStore';
vi.mock('../api/candidateApi', () => ({ candidateApi: { getSkills: async () => ['React', 'Python'] } }));
afterEach(() => { cleanup(); useCandidateFeatureStore.getState().resetFilter(); });

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
