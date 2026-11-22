import { ModalPortal } from '../../../components/common/ModalPortal';
import React from 'react';
import { Briefcase, Clock, LoaderCircle, RefreshCw, Sparkles, Users, X } from 'lucide-react';
import { JobDescription } from '../../../types';

interface MatchingConfirmModalProps {
  isOpen: boolean;
  isRunning: boolean;
  selectedJob: JobDescription | null;
  selectedCandidateIds: string[];
  scoredByCandidateId: Map<string, number>;
  onClose: () => void;
  onConfirm: () => void;
}

export const MatchingConfirmModal: React.FC<MatchingConfirmModalProps> = ({
  isOpen,
  isRunning,
  selectedJob,
  selectedCandidateIds,
  scoredByCandidateId,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !selectedJob) return null;

  const totalCount = selectedCandidateIds.length;
  const rescoredCount = selectedCandidateIds.filter((id) => scoredByCandidateId.has(id)).length;
  const newCount = totalCount - rescoredCount;
  const estSeconds = Math.max(4, totalCount * 4);

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="matching-confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 id="matching-confirm-title" className="text-base font-bold text-slate-900">
                {isRunning ? 'Đang chấm điểm bằng Gemini AI...' : 'Xác nhận chạy AI Matching'}
              </h3>
              <p className="text-xs text-slate-500">
                Đối chiếu kỹ năng và kinh nghiệm đã trích xuất với JD
              </p>
            </div>
          </div>

          {!isRunning && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Body */}
        {isRunning ? (
          <div className="space-y-4 px-6 py-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <LoaderCircle className="h-8 w-8 animate-spin" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900">
                Đang đánh giá {totalCount} hồ sơ bằng Google Gemini AI...
              </p>
              <p className="mx-auto max-w-sm text-xs leading-relaxed text-slate-500">
                Chỉ kỹ năng chuẩn hóa và số năm kinh nghiệm được gửi đi; tên, thông tin liên hệ và văn bản CV được giữ tại máy chủ. Đang đối chiếu với vị trí{' '}
                <strong className="text-slate-700">{selectedJob.title}</strong>. Vui lòng không đóng cửa sổ này.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 px-6 py-5 text-sm text-slate-600">
            <p className="text-xs leading-relaxed text-slate-500">
              AI chỉ nhận kỹ năng chuẩn hóa, số năm kinh nghiệm và nội dung JD. Thông tin cá nhân và văn bản CV được giữ tại máy chủ. Đánh giá chưa bao gồm đầy đủ dự án và thành tích trong CV.
            </p>
            {/* Thông tin JD */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Briefcase className="h-4 w-4 text-blue-600" />
                <span>Vị trí: {selectedJob.title}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedJob.requiredSkills.map((skill, idx) => (
                  <span
                    key={`${skill}-${idx}`}
                    className="rounded bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Thống kê số lượng hồ sơ */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2.5 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                <Users className="h-4 w-4 text-blue-600" />
                <div>
                  <div className="text-slate-500">Số lượng hồ sơ</div>
                  <div className="font-bold text-slate-900">
                    {totalCount} ứng viên ({newCount} mới)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                <Clock className="h-4 w-4 text-amber-600" />
                <div>
                  <div className="text-slate-500">Thời gian ước tính</div>
                  <div className="font-bold text-slate-900">~{estSeconds} giây</div>
                </div>
              </div>
            </div>

            {rescoredCount > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>
                  Có <strong>{rescoredCount} ứng viên</strong> đã từng được chấm điểm cho vị trí này. Kết quả mới sẽ tự động cập nhật đè (upsert) lên kết quả cũ.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/60 px-6 py-3.5">
          <button
            type="button"
            disabled={isRunning}
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                <span>Đang phân tích...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>Xác nhận chấm {totalCount} hồ sơ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};
