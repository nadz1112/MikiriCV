import React from 'react';
import { X, Mail, Phone, Clock, FileText, Download, Award } from 'lucide-react';
import { Candidate } from '../../types';
import { ScoreBadge } from '../common/ScoreBadge';

interface CandidateDetailModalProps {
  candidate: Candidate | null;
  onClose: () => void;
}

export const CandidateDetailModal: React.FC<CandidateDetailModalProps> = ({ candidate, onClose }) => {
  if (!candidate) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-lg text-slate-900">{candidate.fullName}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Mã hồ sơ: {candidate.id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200/70">
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Email</span>
              <div className="flex items-center gap-1.5 text-slate-700 font-medium mt-1">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{candidate.email || 'Chưa rõ'}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Số điện thoại</span>
              <div className="flex items-center gap-1.5 text-slate-700 font-medium mt-1">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{candidate.phone || 'Chưa rõ'}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Kinh nghiệm</span>
              <div className="flex items-center gap-1.5 text-slate-700 font-medium mt-1">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{candidate.yearsOfExperience} năm</span>
              </div>
            </div>
          </div>

          {/* Skills */}
          <div>
            <h4 className="font-semibold text-slate-800 text-xs mb-2">Kỹ năng phát hiện:</h4>
            <div className="flex flex-wrap gap-1.5">
              {candidate.skills.length === 0 ? (
                <span className="text-slate-400">Không tìm thấy kỹ năng tự động</span>
              ) : (
                candidate.skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-xs font-medium"
                  >
                    {skill}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Match results history if any */}
          {candidate.matchResults && candidate.matchResults.length > 0 && (
            <div>
              <h4 className="font-semibold text-slate-800 text-xs mb-2 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-500" />
                Lịch sử chấm điểm AI gần đây:
              </h4>
              <div className="space-y-2">
                {candidate.matchResults.map((m, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-xl"
                  >
                    <span className="text-slate-600 font-medium">Job ID: {m.jobDescriptionId.substring(0, 8)}...</span>
                    <ScoreBadge score={m.score} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw Text Extract */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Nội dung văn bản bóc tách:
              </h4>
              <a
                href={candidate.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
              >
                <Download className="w-3 h-3" />
                <span>Mở file gốc ({candidate.fileName})</span>
              </a>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl max-h-48 overflow-y-auto text-[11px] text-slate-600 font-mono whitespace-pre-wrap leading-relaxed">
              {candidate.rawText || 'Không có dữ liệu text'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex justify-end">
          <button
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
