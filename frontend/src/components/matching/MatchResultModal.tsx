import React from 'react';
import { X, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import { MatchResult } from '../../types';
import { ScoreBadge } from '../common/ScoreBadge';

interface MatchResultModalProps {
  result: MatchResult | null;
  onClose: () => void;
}

export const MatchResultModal: React.FC<MatchResultModalProps> = ({ result, onClose }) => {
  if (!result) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-5 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-lg text-slate-900">
              {result.candidate?.fullName || 'Chi tiết Đánh giá'}
            </h3>
            <span className="text-xs text-slate-400">
              Đánh giá độ phù hợp với vị trí tuyển dụng
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ScoreBadge score={result.score} size="md" />
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Nhận xét AI */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 space-y-1.5">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            Nhận xét từ Google Gemini AI:
          </span>
          <p className="text-xs text-slate-600 leading-relaxed">
            {result.summary}
          </p>
        </div>

        {/* So sánh kỹ năng */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Kỹ năng khớp */}
          <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2">
            <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Kỹ năng đáp ứng yêu cầu:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {result.matchedSkills.length === 0 ? (
                <span className="text-xs text-slate-400">Không có</span>
              ) : (
                result.matchedSkills.map((s, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[11px] font-medium"
                  >
                    {s}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Kỹ năng còn thiếu */}
          <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100 space-y-2">
            <span className="text-xs font-bold text-rose-800 flex items-center gap-1">
              <XCircle className="w-4 h-4 text-rose-600" />
              Kỹ năng còn thiếu:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {result.missingSkills.length === 0 ? (
                <span className="text-xs text-slate-400">Không thiếu</span>
              ) : (
                result.missingSkills.map((s, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded text-[11px] font-medium"
                  >
                    {s}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
