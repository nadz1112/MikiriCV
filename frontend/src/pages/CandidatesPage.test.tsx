// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CandidatesPage } from './CandidatesPage';

const auth = vi.hoisted(() => ({ user: { role: 'ENTERPRISE' } }));
vi.mock('../features/auth/authStore', () => ({ useAuthStore: (select: (state: typeof auth) => unknown) => select(auth) }));
vi.mock('../store/useJobStore', () => ({ useJobStore: () => ({ jobs: [], fetchJobs: vi.fn() }) }));
vi.mock('../features/candidates/hooks/useCandidates', () => ({ useCandidates: () => ({ candidates: [], total: 0, page: 1, limit: 50, isLoading: false, refresh: vi.fn() }) }));
vi.mock('../features/candidates/components/FilterBar', () => ({ FilterBar: () => <div>Bộ lọc CV</div> }));
vi.mock('../features/candidates/components/CandidateTable', () => ({ CandidateTable: () => <div>Danh sách CV</div> }));
vi.mock('../features/candidates/components/CvDropzone', () => ({ CvDropzone: () => <div>Tải CV cho HR</div> }));
vi.mock('../features/candidates/components/FloatingActionBar', () => ({ FloatingActionBar: () => <div>Chạy matching cho HR</div> }));
afterEach(cleanup);

it('provides upload and matching actions for HR', () => {
  auth.user.role = 'ENTERPRISE';
  render(<CandidatesPage />);
  expect(screen.getByText('Tải CV cho HR')).toBeTruthy();
  expect(screen.getByText('Chạy matching cho HR')).toBeTruthy();
});

it('keeps admin candidate browsing without exposing HR-only write actions', () => {
  auth.user.role = 'ADMIN';
  render(<CandidatesPage />);
  expect(screen.getByText('Danh sách CV')).toBeTruthy();
  expect(screen.getByText('Bộ lọc CV')).toBeTruthy();
  expect(screen.queryByText('Tải CV cho HR')).toBeNull();
  expect(screen.queryByText('Chạy matching cho HR')).toBeNull();
});
