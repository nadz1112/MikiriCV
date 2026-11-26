import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  LoaderCircle,
  RotateCcw,
  StopCircle,
  X,
} from 'lucide-react';
import type { MatchingItemStatus, MatchingJob, MatchingJobStatus } from '../../../types';

interface MatchingJobProgressPanelProps {
  job: MatchingJob;
  isCancelling: boolean;
  isRetrying: boolean;
  onCancel: () => void;
  onRetryFailed: () => void;
  onDismiss: () => void;
}

const JOB_STATUS_LABELS: Record<MatchingJobStatus, { label: string; className: string }> = {
  QUEUED: { label: 'Đang chờ xử lý', className: 'bg-slate-100 text-slate-700' },
  RUNNING: { label: 'Đang phân tích', className: 'bg-blue-50 text-blue-700' },
  COMPLETED: { label: 'Hoàn tất', className: 'bg-emerald-50 text-emerald-700' },
  CANCELLED: { label: 'Đã hủy', className: 'bg-amber-50 text-amber-700' },
  FAILED: { label: 'Thất bại', className: 'bg-rose-50 text-rose-700' },
};

const ITEM_STATUS_UI: Record<MatchingItemStatus, { label: string; className: string }> = {
  PENDING: { label: 'Đang chờ', className: 'bg-slate-100 text-slate-600' },
  DONE: { label: 'Hoàn tất', className: 'bg-emerald-50 text-emerald-700' },
  FAILED: { label: 'Lỗi', className: 'bg-rose-50 text-rose-700' },
  SKIPPED: { label: 'Bỏ qua', className: 'bg-amber-50 text-amber-700' },
};

export const MatchingJobProgressPanel: React.FC<MatchingJobProgressPanelProps> = ({
  job,
  isCancelling,
  isRetrying,
  onCancel,
  onRetryFailed,
  onDismiss,
}) => {
  const isTerminal = ['COMPLETED', 'CANCELLED', 'FAILED'].includes(job.status);
  const percent = job.total > 0 ? Math.min(100, Math.round((job.processed / job.total) * 100)) : 0;
  const items = job.items ?? [];
  const failedItems = items.filter((item) => item.status === 'FAILED');
  const completedWithErrors = job.status === 'COMPLETED' && job.failed > 0;
  const allFailed = completedWithErrors && job.failed === job.total;
  const statusInfo = completedWithErrors
    ? { label: allFailed ? 'Đánh giá thất bại' : 'Đã xử lý · Có lỗi', className: allFailed ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700' }
    : JOB_STATUS_LABELS[job.status];

  return (
    <section
      aria-label="Tiến trình AI Matching"
      className="rounded-2xl border border-blue-200/80 bg-white p-5 shadow-sm space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {!isTerminal ? (
            <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" />
          ) : job.failed > 0 || job.status === 'FAILED' ? (
            <AlertCircle className="h-5 w-5 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                Tiến trình đánh giá hàng loạt ({job.processed}/{job.total})
              </h2>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusInfo.className}`}>
                {job.cancelRequested && !isTerminal ? 'Đang dừng...' : statusInfo.label}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {job.failed > 0
                ? `${job.failed} hồ sơ gặp lỗi trong quá trình gọi AI`
                : isTerminal
                  ? 'Bảng xếp hạng bên dưới đã được cập nhật.'
                  : 'Hệ thống đang xử lý từng đợt để tránh quá tải API.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isTerminal && (
            <button
              type="button"
              disabled={isCancelling || job.cancelRequested}
              onClick={onCancel}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              <StopCircle className="h-3.5 w-3.5" />
              <span>{job.cancelRequested ? 'Đang dừng...' : 'Dừng đánh giá'}</span>
            </button>
          )}

          {isTerminal && failedItems.length > 0 && (
            <button
              type="button"
              disabled={isRetrying}
              onClick={onRetryFailed}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Thử lại các hồ sơ lỗi ({failedItems.length})</span>
            </button>
          )}

          {isTerminal && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Đóng tiến trình"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Thanh tiến độ */}
      <div className="space-y-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full transition-all duration-300 ${
              job.status === 'FAILED' || allFailed ? 'bg-rose-500' : job.status === 'CANCELLED' || completedWithErrors ? 'bg-amber-500' : 'bg-blue-600'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>Tiến độ: {percent}%</span>
          <span>Lỗi: {job.failed}</span>
        </div>
      </div>

      {/* Chi tiết từng hồ sơ */}
      {items.length > 0 && (
        <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-1.5">
          {items.map((item) => {
            const badge = ITEM_STATUS_UI[item.status];
            return (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-slate-800">{item.candidateName}</span>
                  {item.errorMessage && (
                    <p className="mt-0.5 text-[11px] text-rose-600">{item.errorMessage}</p>
                  )}
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}>
                  {item.status === 'PENDING' && <Clock className="h-3 w-3" />}
                  {badge.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

