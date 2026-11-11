import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { JobDescription } from '../../../types';

interface JobDeleteModalProps {
  job: JobDescription | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const JobDeleteModal: React.FC<JobDeleteModalProps> = ({
  job,
  isDeleting,
  onClose,
  onConfirm,
}) => {
  if (!job) return null;

  const matchCount = job._count?.matchResults ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-job-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 id="delete-job-title" className="text-base font-bold text-slate-900">
                Xác nhận xóa Job Description
              </h3>
              <p className="text-xs text-slate-500">Hành động này không thể hoàn tác</p>
            </div>
          </div>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5 text-sm text-slate-600">
          <p>
            Bạn có chắc chắn muốn xóa vị trí tuyển dụng{' '}
            <strong className="font-semibold text-slate-900">“{job.title}”</strong>?
          </p>

          <div
            className={`rounded-xl border p-3.5 text-xs leading-relaxed ${
              matchCount > 0
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}
          >
            {matchCount > 0 ? (
              <p>
                ⚠️ <strong>Cảnh báo xóa dữ liệu liên quan (Cascade):</strong> Vị trí này đang có{' '}
                <strong className="font-bold text-rose-700">
                  {matchCount} kết quả chấm điểm AI (MatchResult)
                </strong>
                . Toàn bộ {matchCount} kết quả đánh giá này sẽ bị xóa vĩnh viễn theo JD (hồ sơ gốc của ứng viên vẫn được giữ nguyên).
              </p>
            ) : (
              <p>
                Vị trí này hiện chưa có kết quả chấm điểm AI nào. Hồ sơ ứng viên trong hệ thống sẽ không bị ảnh hưởng.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/60 px-6 py-3.5">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>
              {isDeleting
                ? 'Đang xóa...'
                : matchCount > 0
                  ? `Xóa JD & ${matchCount} kết quả`
                  : 'Xác nhận xóa JD'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

