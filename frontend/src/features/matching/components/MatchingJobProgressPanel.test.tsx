// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { MatchingJob } from '../../../types';
import { MatchingJobProgressPanel } from './MatchingJobProgressPanel';

afterEach(cleanup);
const job: MatchingJob = { id: 'job', jobDescriptionId: 'jd', status: 'COMPLETED', total: 2, processed: 2, failed: 2, cancelRequested: false, errorMessage: null, createdAt: '2026-11-26T00:00:00Z', startedAt: null, finishedAt: null,
  items: [1, 2].map((n) => ({ id: `item${n}`, candidateId: `cv${n}`, candidateName: `Ứng viên ${n}`, status: 'FAILED', attempts: 1, errorCode: 'AI_SERVICE_UNAVAILABLE', errorMessage: 'Dịch vụ AI đang quá tải.', finishedAt: null })) };

it('shows complete processing as failed when all evaluations failed and preserves retry', () => {
  const retry = vi.fn();
  render(<MatchingJobProgressPanel job={job} isCancelling={false} isRetrying={false} onCancel={vi.fn()} onRetryFailed={retry} onDismiss={vi.fn()} />);
  expect(screen.getByText('Đánh giá thất bại')).toBeTruthy();
  expect(screen.queryByText('Hoàn tất')).toBeNull();
  expect(screen.getAllByText('Dịch vụ AI đang quá tải.')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại các hồ sơ lỗi (2)' }));
  expect(retry).toHaveBeenCalledOnce();
});
it('distinguishes partial failures from successful completion', () => {
  const props = { isCancelling: false, isRetrying: false, onCancel: vi.fn(), onRetryFailed: vi.fn(), onDismiss: vi.fn() };
  const { rerender } = render(<MatchingJobProgressPanel {...props} job={{ ...job, failed: 1 }} />);
  expect(screen.getByText('Đã xử lý · Có lỗi')).toBeTruthy();
  rerender(<MatchingJobProgressPanel {...props} job={{ ...job, failed: 0, items: [] }} />);
  expect(screen.getByText('Hoàn tất')).toBeTruthy();
});
