// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CandidateTable } from './CandidateTable';
import type { CandidateItem } from '../api/candidateApi';

const auth = vi.hoisted(() => ({ user: { role: 'ADMIN' } }));
vi.mock('../../auth/authStore', () => ({ useAuthStore: (select: (state: typeof auth) => unknown) => select(auth) }));
afterEach(cleanup);
const candidate: CandidateItem = { id: 'cv', fullName: 'Ứng viên mẫu', email: null, phone: null, yearsOfExperience: 1, skills: [], education: null, fileName: 'cv.pdf', extractionStatus: 'SUCCESS', extractionMessage: null, matchScore: null, createdAt: '2026-11-11', uploadedBy: { id: 'hr', fullName: 'Người tải mẫu', companyName: 'Công ty mẫu', email: 'sample@example.test' } };
const show = () => render(<CandidateTable candidates={[candidate]} total={1} page={1} limit={50} isLoading={false} onPageChange={() => {}} />);
describe('cột người tải lên', () => {
  it('hiển thị họ tên và công ty cho admin', () => {
    auth.user.role = 'ADMIN'; show();
    expect(screen.getByText('Người tải lên')).toBeTruthy();
    expect(screen.getByText('Người tải mẫu')).toBeTruthy();
    expect(screen.getByText('Công ty mẫu')).toBeTruthy();
  });
  it('ẩn cột và thông tin người tải đối với HR', () => {
    auth.user.role = 'ENTERPRISE'; show();
    expect(screen.queryByText('Người tải lên')).toBeNull();
    expect(screen.queryByText('Công ty mẫu')).toBeNull();
  });
});
