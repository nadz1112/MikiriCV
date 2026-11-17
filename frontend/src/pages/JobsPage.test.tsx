// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { JobsPage } from './JobsPage';
import { useJobFeatureStore } from '../features/jobs/store/jobStore';
const state = vi.hoisted(() => ({ user: { id: 'user', role: 'ENTERPRISE' }, hasJobs: false }));
vi.mock('../features/auth/authStore', () => ({ useAuthStore: (select: (value: typeof state) => unknown) => select(state) }));
vi.mock('../features/jobs/hooks/useJobs', () => ({ useJobs: () => {
  const jobs = state.hasJobs ? [{ id: 'jd', title: 'Developer', description: 'Build apps', requiredSkills: ['React'], minExperience: 0, createdAt: '2026-11-17', updatedAt: '2026-11-17' }] : [];
  return { jobs, filteredJobs: jobs, isLoading: false, fetchJobs: vi.fn(), updateJob: vi.fn(), deleteJob: vi.fn() };
} }));
afterEach(() => { cleanup(); useJobFeatureStore.setState(useJobFeatureStore.getInitialState()); });
it.each([false, true])('hides all admin create actions when hasJobs=%s', (hasJobs) => {
  state.user.role = 'ADMIN'; state.hasJobs = hasJobs;
  render(<MemoryRouter><JobsPage /></MemoryRouter>);
  expect(screen.queryByRole('button', { name: /Tạo JD/ })).toBeNull();
  if (!hasJobs) expect(screen.getByText('Chưa có doanh nghiệp nào tạo Job Description.')).toBeTruthy();
});
it.each([false, true])('keeps ENTERPRISE create actions when hasJobs=%s', (hasJobs) => {
  state.user.role = 'ENTERPRISE'; state.hasJobs = hasJobs;
  render(<MemoryRouter><JobsPage /></MemoryRouter>);
  expect(screen.getByRole('button', { name: 'Tạo JD mới' })).toBeTruthy();
  if (!hasJobs) expect(screen.getByRole('button', { name: 'Tạo JD ngay' })).toBeTruthy();
});
