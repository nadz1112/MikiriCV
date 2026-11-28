// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MatchingControlPanel } from './MatchingControlPanel';
import type { Candidate, JobDescription } from '../../../types';

afterEach(cleanup);

const job: JobDescription = {
  id: 'jd-1',
  title: 'Backend Node.js',
  description: 'Build APIs',
  requiredSkills: ['Node.js'],
  minExperience: 2,
  createdAt: '2026-11-25',
  updatedAt: '2026-11-25',
};

const candidates: Candidate[] = [
  {
    id: 'c1',
    fullName: 'Nguyễn Văn An',
    email: 'an@example.com',
    phone: null,
    skills: ['Node.js'],
    yearsOfExperience: 3,
    education: null,
    fileName: 'c1.pdf',
    createdAt: '2026-11-25',
  },
  {
    id: 'c2',
    fullName: 'Trần Thị Bình',
    email: 'binh@example.com',
    phone: null,
    skills: ['React'],
    yearsOfExperience: 2,
    education: null,
    fileName: 'c2.pdf',
    createdAt: '2026-11-25',
  },
];

describe('MatchingControlPanel plan modes', () => {
  it('hides bulk select-all and disables CTA when FREE quota is exhausted', () => {
    const onOpenConfirm = vi.fn();
    render(
      <MatchingControlPanel
        jobs={[job]}
        selectedJob={job}
        selectedJobId="jd-1"
        selectableCandidates={candidates}
        selectedCandidateIds={['c1']}
        scoredByCandidateId={new Map()}
        candidateSearch=""
        onlyUnscored={false}
        isRunning={false}
        plan="FREE"
        remainingQuota={0}
        onSelectJob={vi.fn()}
        onToggleCandidate={vi.fn()}
        onSearchChange={vi.fn()}
        onToggleOnlyUnscored={vi.fn()}
        onSelectAllFiltered={vi.fn()}
        onClearSelection={vi.fn()}
        onOpenConfirm={onOpenConfirm}
      />,
    );

    expect(screen.getByText('Gói FREE · Chấm đơn lẻ 1 CV')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Chọn tất cả/ })).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('Tài khoản đã hết token khả dụng');
    const cta = screen.getByRole('button', { name: 'Chấm điểm CV này (Gói FREE)' }) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    fireEvent.click(cta);
    expect(onOpenConfirm).not.toHaveBeenCalled();
  });

  it('keeps bulk select-all and multi-candidate CTA on PLUS plan', () => {
    render(
      <MatchingControlPanel
        jobs={[job]}
        selectedJob={job}
        selectedJobId="jd-1"
        selectableCandidates={candidates}
        selectedCandidateIds={['c1']}
        scoredByCandidateId={new Map()}
        candidateSearch=""
        onlyUnscored={false}
        isRunning={false}
        plan="PLUS"
        remainingQuota={298}
        onSelectJob={vi.fn()}
        onToggleCandidate={vi.fn()}
        onSearchChange={vi.fn()}
        onToggleOnlyUnscored={vi.fn()}
        onSelectAllFiltered={vi.fn()}
        onClearSelection={vi.fn()}
        onOpenConfirm={vi.fn()}
      />,
    );

    expect(screen.queryByText('Gói FREE · Chấm đơn lẻ 1 CV')).toBeNull();
    expect(screen.getByRole('button', { name: 'Chọn tất cả (2)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chạy AI Matching (1 ứng viên)' })).toBeTruthy();
  });
});
