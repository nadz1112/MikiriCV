import { ModalPortal } from '../common/ModalPortal';
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

const STATUS_BADGE_MAP = {
  not_found: { label: 'Chưa tìm thấy', className: 'bg-slate-200/70 text-slate-700' },
  insufficient_evidence: { label: 'Thiếu bằng chứng', className: 'bg-amber-100 text-amber-800' },
  partially_matched: { label: 'Đáp ứng một phần', className: 'bg-sky-100 text-sky-800' },
  matched: { label: 'Đáp ứng', className: 'bg-emerald-100 text-emerald-800' },
  strongly_matched: { label: 'Đáp ứng tốt', className: 'bg-emerald-200 text-emerald-900' },
} as const;

const CONFIDENCE_LABEL_MAP = {
  high: 'Tin cậy cao',
  medium: 'Tin cậy trung bình',
  low: 'Tin cậy thấp',
} as const;

const POTENTIAL_LABEL_MAP = {
  positive_evidence: { label: 'Có dấu hiệu tích cực', className: 'bg-emerald-100 text-emerald-800' },
  mixed_evidence: { label: 'Bằng chứng đa chiều', className: 'bg-amber-100 text-amber-800' },
  insufficient_evidence: { label: 'Chưa đủ bằng chứng', className: 'bg-slate-200 text-slate-700' },
} as const;

interface CandidateInsightDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate | null;
  matchResult: MatchResult | null;
  jobTitle?: string;
  onDeleteRequest: (candidate: Candidate) => void;
  showHistory?: boolean;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
}

export const CandidateInsightDrawer: React.FC<CandidateInsightDrawerProps> = ({
  isOpen,
  onClose,
  candidate,
  matchResult,
  jobTitle,
  onDeleteRequest,
  showHistory = false,
  isLoading = false,
  error = '',
  onRetry,
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

  // URL file gốc: Sử dụng endpoint an toàn /api/candidates/:id/file
  const fileDownloadUrl = candidate.id
    ? `/api/candidates/${candidate.id}/file`
    : '#';

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div role="dialog" aria-modal="true" aria-label="Chi tiết ứng viên" className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/70">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {showHistory ? 'Chi tiết ứng viên' : 'AI Insight'}
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
            {isLoading ? <p role="status" className="py-8 text-center text-slate-500">Đang tải chi tiết ứng viên…</p> : error ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}<button type="button" onClick={onRetry} className="ml-3 font-semibold underline">Thử lại</button></div> : <>
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
                  {candidate.education || 'N/A'}
                </p>
              </div>
            </div>

            {candidate.uploadedBy && <section className="rounded-xl border border-slate-200 p-4 text-sm"><h3 className="font-semibold">Người tải lên</h3><p>{candidate.uploadedBy.fullName}</p><p className="text-slate-500">{candidate.uploadedBy.companyName || 'Chưa có tên công ty'}</p></section>}
            {candidate.extractionStatus && <section className="rounded-xl border border-slate-200 p-4 text-sm"><h3 className="font-semibold">Trạng thái trích xuất</h3><p>{({ SUCCESS: 'Thành công', WARNING: 'Cảnh báo', FAILED: 'Lỗi' } as const)[candidate.extractionStatus]}</p>{candidate.extractionMessage && <p className="mt-1 text-amber-800">{candidate.extractionMessage}</p>}</section>}

            {showHistory && <section className="space-y-3"><h3 className="font-semibold">Lịch sử matching theo JD</h3>
              {candidate.matchResults?.length ? <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{['JD', 'Điểm', 'Nhận xét', 'Kỹ năng khớp', 'Kỹ năng thiếu', 'Đánh giá lúc'].map((heading) => <th key={heading} className="p-2">{heading}</th>)}</tr></thead><tbody>{candidate.matchResults.map((match) => <tr key={match.jobDescriptionId} className="border-t border-slate-200"><td className="p-2">{match.jobTitle || match.jobDescriptionId}</td><td className="p-2"><span className={`rounded-full px-2 py-1 font-bold ${match.score >= 80 ? 'bg-emerald-50 text-emerald-700' : match.score >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>{match.score}</span></td><td className="min-w-40 p-2">{match.summary || 'Chưa có nhận xét'}</td><td className="p-2">{match.matchedSkills?.join(', ') || '—'}</td><td className="p-2">{match.missingSkills?.join(', ') || '—'}</td><td className="p-2">{match.evaluatedAt ? new Date(match.evaluatedAt).toLocaleString('vi-VN') : '—'}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-500">Chưa có kết quả matching</p>}
            </section>}

            {/* Score Showcase Hero */}
            {matchResult ? (
              <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg ring-4"
                    style={{
                      backgroundColor: scoreBadge.bgColor.replace('bg-', ''),
                      borderColor: scoreBadge.borderColor.replace('border-', ''),
                      color: scoreBadge.ringColor,
                    }}
                  >
                    {matchResult.score}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                        Điểm phù hợp tổng thể
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${scoreBadge.bgColor} ${scoreBadge.color}`}
                      >
                        {scoreBadge.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 max-w-sm">
                      Được phân tích và chấm điểm đối soát tự động bởi mô hình <strong>Google Gemini AI</strong> theo tiêu chí Job Description.
                    </p>
                  </div>
                </div>

                <div className="text-right text-xs text-slate-400 flex sm:flex-col items-center sm:items-end gap-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Đánh giá lúc:
                  </span>
                  <span className="font-medium text-slate-200">
                    {new Date(matchResult.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              </div>
            ) : !showHistory && (
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

            {matchResult?.scoreBreakdown && matchResult.scoreBreakdown.length > 0 && (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-bold text-slate-800">Phân tích theo 6 nhóm tiêu chí</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {matchResult.scoreBreakdown.map((item) => (
                    <div key={item.category} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-slate-700">
                          {({
                            skill_matching: 'Khớp kỹ năng',
                            experience_relevance: 'Kinh nghiệm liên quan',
                            project_achievement: 'Dự án & thành tựu',
                            soft_skills: 'Kỹ năng mềm',
                            education_certification: 'Học vấn & chứng chỉ',
                            cv_quality: 'Chất lượng CV',
                          } as const)[item.category]}
                        </span>
                        <span className="text-sm font-bold text-blue-700">{item.score}/{item.maxScore}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                        <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_BADGE_MAP[item.status].className}`}>
                          {STATUS_BADGE_MAP[item.status].label}
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5 font-medium text-slate-500 border border-slate-200">
                          {CONFIDENCE_LABEL_MAP[item.confidence]}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.reason}</p>
                      {item.evidence?.length > 0 && (
                        <ul className="mt-2 space-y-1 text-[11px] text-slate-500">
                          {item.evidence.slice(0, 3).map((evidence, index) => (
                            <li key={`${item.category}-${index}`}><strong>{evidence.source}</strong> · {evidence.section}: {evidence.text}</li>
                          ))}
                        </ul>
                      )}
                      {item.gaps?.length > 0 && (
                        <p className="mt-2 text-[11px] text-amber-700">Cần xác minh: {item.gaps.join('; ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {matchResult && (
              <div className="grid gap-4 sm:grid-cols-2">
                {matchResult.strengths && matchResult.strengths.length > 0 && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                    <h3 className="text-sm font-bold text-emerald-800">Điểm mạnh có bằng chứng</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-emerald-800">
                      {matchResult.strengths.map((strength, index) => <li key={index}>{strength}</li>)}
                    </ul>
                  </div>
                )}
                {matchResult.gapsAndConcerns && matchResult.gapsAndConcerns.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                    <h3 className="text-sm font-bold text-amber-800">Điểm cần xác minh</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-800">
                      {matchResult.gapsAndConcerns.map((gap, index) => <li key={index}>{gap}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {matchResult?.requirementsAnalysis && matchResult.requirementsAnalysis.length > 0 && (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-bold text-slate-800">Phân tích yêu cầu theo JD</h3>
                <div className="space-y-2.5">
                  {matchResult.requirementsAnalysis.map((req, index) => (
                    <div key={`${req.requirement}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-800">{req.requirement}</span>
                          <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${req.priority === 'required' ? 'bg-rose-100 text-rose-700' : 'bg-violet-100 text-violet-700'}`}>
                            {req.priority === 'required' ? 'Bắt buộc' : 'Ưu tiên'}
                          </span>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_BADGE_MAP[req.status]?.className ?? 'bg-slate-200 text-slate-700'}`}>
                          {STATUS_BADGE_MAP[req.status]?.label ?? req.status}
                        </span>
                      </div>
                      {req.evidence?.length > 0 && (
                        <ul className="mt-2 space-y-1 text-[11px] text-slate-600">
                          {req.evidence.slice(0, 2).map((ev, evIdx) => (
                            <li key={evIdx}><strong>{ev.source}</strong> · {ev.section}: {ev.text}</li>
                          ))}
                        </ul>
                      )}
                      {req.gap && (
                        <p className="mt-1.5 text-[11px] text-amber-700">Cần xác minh: {req.gap}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {matchResult?.careerPotential && (
              <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-sky-900">Tiềm năng phát triển (Career Potential)</h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${POTENTIAL_LABEL_MAP[matchResult.careerPotential.assessment]?.className ?? 'bg-slate-200 text-slate-700'}`}>
                    {POTENTIAL_LABEL_MAP[matchResult.careerPotential.assessment]?.label ?? matchResult.careerPotential.assessment}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-700">{matchResult.careerPotential.reason}</p>
                <p className="text-[11px] italic text-sky-800">Nhận xét bổ trợ — không cộng vào tổng 100 điểm.</p>
              </div>
            )}

            {matchResult?.interviewQuestions && matchResult.interviewQuestions.length > 0 && (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5">
                <h3 className="text-sm font-bold text-indigo-800">Câu hỏi phỏng vấn gợi ý</h3>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-700">
                  {matchResult.interviewQuestions.map((question, index) => <li key={index}>{question}</li>)}
                </ol>
              </div>
            )}

            {matchResult && (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                <div className="flex flex-wrap gap-3">
                  {matchResult.confidence && <span>Độ tin cậy: <strong>{CONFIDENCE_LABEL_MAP[matchResult.confidence]}</strong></span>}
                  {matchResult.matchLevel && <span>Mức phù hợp: <strong>{matchResult.matchLevel}</strong></span>}
                </div>
                <p className="text-[11px] text-slate-500">
                  Kết quả AI chỉ hỗ trợ sàng lọc; nhà tuyển dụng cần xem hồ sơ gốc và xác minh khi phỏng vấn.
                </p>
              </div>
            )}
            {matchResult?.limitations && matchResult.limitations.length > 0 && (
              <div className="rounded-xl border border-slate-200 p-4 text-xs text-slate-600">
                <strong>Giới hạn dữ liệu:</strong> {matchResult.limitations.join('; ')}
              </div>
            )}

            {/* 2 Cột Gestalt: Kỹ năng khớp (Xanh) vs Kỹ năng thiếu (Đỏ nhạt) */}
            {matchResult && ([['3 điểm nổi bật', matchResult.highlights], ['Phân tích kỹ năng', matchResult.skillAnalysis], ['Điểm cần xác minh (Red flags)', matchResult.redFlags], ['Câu hỏi phỏng vấn gợi ý', matchResult.interviewQuestions]] as const).map(([title, items]) => items && items.length > 0 ? <section key={title} className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="font-semibold text-slate-800">{title}</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">{items.map((item, index) => <li key={index}>{item}</li>)}</ul></section> : null)}
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
            </>}
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
              disabled={isLoading || Boolean(error)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold border border-rose-200 rounded-xl text-xs sm:text-sm transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa ứng viên</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

