import React from 'react';
import {
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  LoaderCircle,
  Trophy,
  XCircle,
} from 'lucide-react';
import { MatchResult } from '../../../types';

interface MatchingResultsTableProps {
  selectedJobId: string;
  jobTitle?: string;
  results: MatchResult[];
  isLoading: boolean;
  onOpenInsight: (result: MatchResult) => void;
}

export const MatchingResultsTable: React.FC<MatchingResultsTableProps> = ({
  selectedJobId,
  jobTitle,
  results,
  isLoading,
  onOpenInsight,
}) => {
  const renderScoreBadge = (score: number) => {
    if (score >= 80) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>{score}/100 • Rất phù hợp</span>
        </span>
      );
    }
    if (score >= 50) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span>{score}/100 • Khá phù hợp</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
        <span className="h-2 w-2 rounded-full bg-rose-500" />
        <span>{score}/100 • Cần cân nhắc</span>
      </span>
    );
  };

  return (
    <section className="glass-panel overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <Trophy className="h-5 w-5 text-amber-500" />
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Bảng xếp hạng ứng viên {jobTitle ? `— ${jobTitle}` : ''}
            </h2>
            <p className="text-xs text-slate-500">
              Sắp xếp giảm dần theo điểm đánh giá độ phù hợp của Google Gemini AI
            </p>
          </div>
        </div>

        {results.length > 0 && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            Tổng cộng {results.length} kết quả
          </span>
        )}
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" />
          <span>Đang tải bảng xếp hạng...</span>
        </div>
      ) : results.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-400">
          {selectedJobId
            ? 'Chưa có kết quả đánh giá nào cho vị trí này. Hãy chọn ứng viên ở trên và bấm Chạy AI Matching.'
            : 'Hãy chọn một Job Description ở Bước 1 để xem bảng xếp hạng ứng viên.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="w-16 px-4 py-3 text-center">Hạng</th>
                <th className="px-4 py-3">Ứng viên</th>
                <th className="px-4 py-3">Điểm số AI</th>
                <th className="px-4 py-3">Kỹ năng khớp / thiếu</th>
                <th className="px-4 py-3">Nhận xét tóm tắt</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map((result, idx) => (
                <tr
                  key={result.id}
                  onClick={() => onOpenInsight(result)}
                  className="cursor-pointer transition hover:bg-blue-50/40"
                >
                  <td className="px-4 py-3.5 text-center font-bold text-slate-600">
                    {idx === 0
                      ? '🥇 1'
                      : idx === 1
                        ? '🥈 2'
                        : idx === 2
                          ? '🥉 3'
                          : `#${idx + 1}`}
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="text-sm font-bold text-slate-900">
                      {result.candidate?.fullName || 'Ứng viên'}
                    </div>
                    {result.candidate?.email && (
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {result.candidate.email}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3.5">{renderScoreBadge(result.score)}</td>

                  <td className="px-4 py-3.5">
                    <div className="flex max-w-[260px] flex-wrap gap-1">
                      {result.matchedSkills.slice(0, 3).map((skill) => (
                        <span
                          key={`m-${skill}`}
                          className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200"
                        >
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          {skill}
                        </span>
                      ))}
                      {result.missingSkills.slice(0, 2).map((skill) => (
                        <span
                          key={`x-${skill}`}
                          className="inline-flex items-center gap-0.5 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 border border-rose-200"
                        >
                          <XCircle className="h-2.5 w-2.5" />
                          {skill}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="max-w-md px-4 py-3.5 text-slate-600">
                    <p className="line-clamp-2 leading-relaxed">{result.summary}</p>
                  </td>

                  <td
                    className="px-4 py-3.5 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="inline-flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          window.open(
                            `/api/candidates/${result.candidateId}/file`,
                            '_blank',
                            'noopener,noreferrer',
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        title="Xem CV gốc"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                        <span>CV gốc</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenInsight(result)}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        <span>AI Insight</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
