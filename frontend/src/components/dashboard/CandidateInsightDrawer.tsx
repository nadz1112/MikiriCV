import React, { useState } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Briefcase,
  Mail,
  Phone,
  GraduationCap,
  Calendar,
} from 'lucide-react';
import { Candidate, MatchResult } from '../../types';

interface CandidateInsightDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate | null;
  matchResult: MatchResult | null;
  jobTitle?: string;
  onDeleteRequest: (candidate: Candidate) => void;
}

export const CandidateInsightDrawer: React.FC<CandidateInsightDrawerProps> = ({
  isOpen,
  onClose,
  candidate,
  matchResult,
  jobTitle,
  onDeleteRequest,
}) => {
  const [showRawText, setShowRawText] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !candidate) return null;

  const score = matchResult ? matchResult.score : 0;

  // Thống nhất 3 ngưỡng badge theo US-05 và Wireframe 4.2.2/4.2.4
  // 🟢 >= 80: Rất phù hợp
  // 🟡 50 - 79: Khá phù hợp
  // 🔴 < 50: Cần cân nhắc
  let scoreBadge = {
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    ringColor: '#f43f5e',
    label: 'Cần cân nhắc',
    dotColor: 'bg-rose-500',
  };

  if (score >= 80) {
    scoreBadge = {
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      ringColor: '#10b981',
      label: 'Rất phù hợp (Strong Match)',
      dotColor: 'bg-emerald-500',
    };
  } else if (score >= 50) {
    scoreBadge = {
      color: 'text-amber-700',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      ringColor: '#f59e0b',
      label: 'Khá phù hợp (Moderate Match)',
      dotColor: 'bg-amber-500',
    };
  }

  const handleCopyRawText = () => {
    if (candidate.rawText) {
      navigator.clipboard.writeText(candidate.rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // URL file gốc
  const fileDownloadUrl = candidate.fileUrl.startsWith('http')
    ? candidate.fileUrl
    : `${candidate.fileUrl}`;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/70">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  AI Insight Drawer • Wireframe 4.2.3
                </span>
                {jobTitle && (
                  <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    Đối soát với: {jobTitle}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                {candidate.fullName || 'Ứng viên'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
              title="Đóng chi tiết"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Candidate Quick Info Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50/80 rounded-xl border border-slate-100 text-xs text-slate-600">
              <div className="space-y-1">
                <span className="text-slate-400 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> Email
                </span>
                <p className="font-semibold text-slate-800 truncate" title={candidate.email || 'N/A'}>
                  {candidate.email || 'Chưa nhận diện'}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> SĐT
                </span>
                <p className="font-semibold text-slate-800 truncate">
                  {candidate.phone || 'Chưa nhận diện'}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" /> Kinh nghiệm
                </span>
                <p className="font-semibold text-slate-800">
                  {candidate.yearsOfExperience} năm
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5" /> Học vấn
                </span>
                <p className="font-semibold text-slate-800 truncate" title={candidate.education || 'N/A'}>
                  {candidate.education || 'Đại học/Cao đẳng'}
                </p>
              </div>
            </div>

            {/* Score Display (Gauge / Circular Hero) */}
            {matchResult ? (
              <div className={`p-6 rounded-2xl border ${scoreBadge.bgColor} ${scoreBadge.borderColor} flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm`}>
                <div className="flex items-center gap-5">
                  {/* Circular Score Badge */}
                  <div className="relative w-24 h-24 flex items-center justify-center rounded-full bg-white shadow-md border-4 border-slate-100">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-slate-100"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        strokeWidth="3.5"
                        strokeDasharray={`${score}, 100`}
                        stroke={scoreBadge.ringColor}
                        strokeLinecap="round"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-2xl font-black text-slate-900">{score}</span>
                      <span className="text-[10px] text-slate-400 font-medium -mt-1">/ 100</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${scoreBadge.dotColor}`} />
                      <span className={`text-sm font-bold ${scoreBadge.color}`}>
                        {scoreBadge.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 max-w-sm">
                      Được phân tích và chấm điểm đối soát tự động bởi mô hình <strong>Google Gemini AI</strong> theo tiêu chí Job Description.
                    </p>
                  </div>
                </div>

                <div className="text-right text-xs text-slate-400 flex sm:flex-col items-center sm:items-end gap-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Đánh giá lúc:
                  </span>
                  <span className="font-medium text-slate-600">
                    {new Date(matchResult.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-100 text-slate-500 text-center text-xs">
                Ứng viên này chưa được chấm điểm AI đối với vị trí hiện tại.
              </div>
            )}

            {/* AI Summary / Nhận xét AI */}
            {matchResult && (
              <div className="glass-panel p-5 rounded-2xl border border-slate-200 space-y-2.5 bg-gradient-to-br from-indigo-50/40 via-white to-blue-50/30">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Nhận xét Phân tích từ Gemini AI</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic bg-white/70 p-3.5 rounded-xl border border-slate-100 shadow-inner">
                  "{matchResult.summary || 'Không có nhận xét chi tiết'}"
                </p>
              </div>
            )}

            {/* 2 Cột Gestalt: Kỹ năng khớp (Xanh) vs Kỹ năng thiếu (Đỏ nhạt) */}
            {matchResult && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Đối chiếu Năng lực (Gestalt Visual Contrast)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Cột Kỹ năng khớp */}
                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-3">
                    <div className="flex items-center justify-between text-emerald-800 font-bold text-xs pb-2 border-b border-emerald-200/60">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Kỹ năng khớp ({matchResult.matchedSkills?.length || 0})
                      </span>
                    </div>
                    {matchResult.matchedSkills && matchResult.matchedSkills.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {matchResult.matchedSkills.map((skill, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-emerald-800 border border-emerald-300 rounded-lg text-xs font-medium shadow-2xs"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-emerald-600 italic">
                        Không có kỹ năng nào khớp hoàn toàn với JD
                      </p>
                    )}
                  </div>

                  {/* Cột Kỹ năng còn thiếu */}
                  <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 space-y-3">
                    <div className="flex items-center justify-between text-rose-800 font-bold text-xs pb-2 border-b border-rose-200/60">
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        Kỹ năng còn thiếu ({matchResult.missingSkills?.length || 0})
                      </span>
                    </div>
                    {matchResult.missingSkills && matchResult.missingSkills.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {matchResult.missingSkills.map((skill, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-rose-800 border border-rose-300 rounded-lg text-xs font-medium shadow-2xs"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-rose-600 italic">
                        Ứng viên đáp ứng đầy đủ tất cả kỹ năng yêu cầu!
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Toàn bộ kỹ năng bóc tách từ CV */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
              <span className="text-xs font-semibold text-slate-500">
                Toàn bộ Kỹ năng nhận diện từ CV ({candidate.skills?.length || 0}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {candidate.skills && candidate.skills.length > 0 ? (
                  candidate.skills.map((s, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-white border border-slate-200 text-slate-700 rounded text-xs"
                    >
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">Chưa bóc tách được kỹ năng</span>
                )}
              </div>
            </div>

            {/* Văn bản trích xuất thô (Raw Text) Accordion */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => setShowRawText(!showRawText)}
                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700 transition"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span>Văn bản trích xuất thô (Raw Text từ file gốc)</span>
                </div>
                {showRawText ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showRawText && (
                <div className="p-4 bg-slate-900 text-slate-100 text-xs font-mono relative">
                  <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-800">
                    <span className="text-[11px] text-slate-400">
                      Kích thước: {candidate.rawText ? candidate.rawText.length : 0} ký tự
                    </span>
                    <button
                      onClick={handleCopyRawText}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Đã sao chép' : 'Sao chép text'}
                    </button>
                  </div>
                  <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed text-slate-300">
                    {candidate.rawText || 'Không có dữ liệu văn bản thô.'}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Actions Footer */}
          <div className="p-4 sm:px-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
            <a
              href={fileDownloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 rounded-xl text-xs sm:text-sm shadow-2xs transition"
            >
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Xem tệp CV gốc</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>

            <button
              onClick={() => onDeleteRequest(candidate)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold border border-rose-200 rounded-xl text-xs sm:text-sm transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa ứng viên</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
