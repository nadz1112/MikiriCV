import React, { useRef, useEffect } from 'react';
import { AlertTriangle, AlertCircle, FileText, ExternalLink, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { CandidateItem } from '../api/candidateApi';
import { useCandidateFeatureStore } from '../store/candidateStore';

interface CandidateTableProps {
  candidates: CandidateItem[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  onPageChange: (newPage: number) => void;
}

export const CandidateTable: React.FC<CandidateTableProps> = ({
  candidates,
  total,
  page,
  limit,
  isLoading,
  onPageChange,
}) => {
  const {
    selectedCandidateIds,
    toggleSelect,
    toggleSelectAll,
    filter,
    setSort,
    resetFilter,
  } = useCandidateFeatureStore();

  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const visibleIds = candidates.map((c) => c.id);
  const selectedVisibleCount = visibleIds.filter((id) => selectedCandidateIds.includes(id)).length;
  const isAllVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const isIndeterminate = selectedVisibleCount > 0 && !isAllVisibleSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const renderScoreBadge = (score: number | null) => {
    if (score === null || score === undefined) {
      return <span className="text-slate-400 font-mono">—</span>;
    }
    if (score >= 80) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {score}
        </span>
      );
    }
    if (score >= 50) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          {score}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 border border-red-200">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        {score}
      </span>
    );
  };

  const renderStatusBadge = (status: 'SUCCESS' | 'WARNING' | 'FAILED', message: string | null) => {
    if (status === 'SUCCESS') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
          Thành công
        </span>
      );
    }
    if (status === 'WARNING') {
      return (
        <span
          className="group relative inline-flex cursor-help items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200"
          title={message || 'Cần xem lại thông tin trích xuất'}
        >
          <AlertTriangle className="h-3 w-3 text-amber-600" />
          <span>Cần xem lại</span>
        </span>
      );
    }
    return (
      <span
        className="group relative inline-flex cursor-help items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 border border-red-200"
        title={message || 'Không thể đọc nội dung văn bản'}
      >
        <AlertCircle className="h-3 w-3 text-red-600" />
        <span>Thất bại</span>
      </span>
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition">
      {/* Header thông tin & sắp xếp */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-800">
            Tìm thấy <span className="font-bold text-blue-600">{total}</span> ứng viên phù hợp
          </span>
          {selectedCandidateIds.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
              Đã chọn {selectedCandidateIds.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs text-slate-500">Sắp xếp:</span>
          <select
            value={filter.sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="createdAt">Mới nhất</option>
            <option value="yearsOfExperience">Kinh nghiệm nhiều nhất</option>
            <option value="fullName">Họ tên (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Loading progress line */}
      <div className="relative h-0.5 w-full bg-transparent overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-blue-600 animate-[pulse_1s_ease-in-out_infinite]" />
        )}
      </div>

      {/* Table Content */}
      {candidates.length === 0 && !isLoading ? (
        <div className="py-16 text-center">
          <FileText className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-base font-semibold text-slate-800">Không tìm thấy ứng viên phù hợp</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            Thử điều chỉnh từ khóa tìm kiếm, giảm số năm kinh nghiệm hoặc bỏ bớt các kỹ năng đã chọn.
          </p>
          <button
            type="button"
            onClick={resetFilter}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
          >
            Đặt lại bộ lọc
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table
            className={`w-full min-w-[960px] text-left text-sm transition-opacity duration-200 ${
              isLoading ? 'opacity-60 pointer-events-none' : 'opacity-100'
            }`}
          >
            <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 tracking-wider border-b border-slate-200">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    ref={headerCheckboxRef}
                    checked={isAllVisibleSelected}
                    onChange={() => toggleSelectAll(visibleIds)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    title="Chọn tất cả kết quả đang hiển thị"
                  />
                </th>
                <th className="px-4 py-3">Họ tên</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">SĐT</th>
                <th className="px-4 py-3 text-center">Kinh nghiệm</th>
                <th className="px-4 py-3">Kỹ năng</th>
                <th className="px-4 py-3 text-center">Điểm AI</th>
                <th className="px-4 py-3 text-center">Trích xuất</th>
                <th className="px-4 py-3 text-right">CV gốc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.map((candidate) => {
                const isSelected = selectedCandidateIds.includes(candidate.id);
                return (
                  <tr
                    key={candidate.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(candidate.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{candidate.fullName}</div>
                      {candidate.education && (
                        <div className="text-xs text-slate-400 truncate max-w-[200px]" title={candidate.education}>
                          {candidate.education}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{candidate.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs font-mono">{candidate.phone || '—'}</td>
                    <td className="px-4 py-3 text-center text-xs font-medium text-slate-800">
                      {candidate.yearsOfExperience} năm
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[280px] flex-wrap gap-1">
                        {candidate.skills.slice(0, 4).map((skill) => (
                          <span
                            key={skill}
                            className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                          >
                            {skill}
                          </span>
                        ))}
                        {candidate.skills.length > 4 && (
                          <span
                            className="rounded bg-slate-200/60 px-1.5 py-0.5 text-[10px] text-slate-500 cursor-default"
                            title={candidate.skills.slice(4).join(', ')}
                          >
                            +{candidate.skills.length - 4}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">{renderScoreBadge(candidate.matchScore)}</td>
                    <td className="px-4 py-3 text-center">
                      {renderStatusBadge(candidate.extractionStatus, candidate.extractionMessage)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => window.open(`/api/candidates/${candidate.id}/file`, '_blank', 'noopener,noreferrer')}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Xem CV</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 bg-slate-50/30">
          <span>
            Hiển thị trang <strong className="text-slate-700">{page}</strong> / {totalPages} (Tổng số {total} ứng viên)
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => onPageChange(page - 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Trước</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages || isLoading}
              onClick={() => onPageChange(page + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
            >
              <span>Sau</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
