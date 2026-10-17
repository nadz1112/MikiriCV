import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Candidate } from '../../types';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate | null;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  candidate,
  onConfirm,
  isDeleting,
}) => {
  if (!isOpen || !candidate) return null;

  // Lấy chính xác số lượng MatchResult sẽ bị cascade xoá theo UserFlow 4.1.3.e
  const matchCount = candidate.matchResults ? candidate.matchResults.length : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-slate-200 animate-in zoom-in-95 duration-200">
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Xác nhận xóa ứng viên
                  </h3>
                  <p className="text-xs text-slate-500">
                    Hành động này không thể hoàn tác (Cascade Delete)
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                Bạn có chắc chắn muốn xóa vĩnh viễn hồ sơ ứng viên{' '}
                <strong className="text-slate-900 font-bold">{candidate.fullName}</strong> khỏi hệ thống?
              </p>

              {/* Cascade warning box */}
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/80 text-xs text-amber-800 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  ⚠️ Lưu ý ràng buộc dữ liệu:
                </div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    Tệp tin CV gốc trên máy chủ ({candidate.fileName}) sẽ bị xóa hoàn toàn.
                  </li>
                  <li>
                    Tự động xóa cascade <strong>{matchCount} kết quả đánh giá AI (MatchResult)</strong> đã liên kết với ứng viên này.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 px-6 py-4 flex flex-row-reverse gap-3 rounded-b-2xl border-t border-slate-100">
            <button
              type="button"
              disabled={isDeleting}
              onClick={onConfirm}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 focus:outline-hidden disabled:opacity-50 transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isDeleting ? 'Đang xóa...' : 'Xác nhận xóa vĩnh viễn'}</span>
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-2xs ring-1 ring-inset ring-slate-300 hover:bg-slate-50 transition"
            >
              Hủy bỏ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
