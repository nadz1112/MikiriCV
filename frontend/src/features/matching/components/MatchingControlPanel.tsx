import React from 'react';
import {
  Award,
  Briefcase,
  Check,
  Search,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import { Candidate, JobDescription } from '../../../types';

interface MatchingControlPanelProps {
  jobs: JobDescription[];
  selectedJob: JobDescription | null;
  selectedJobId: string;
  selectableCandidates: Candidate[];
  selectedCandidateIds: string[];
  scoredByCandidateId: Map<string, number>;
  candidateSearch: string;
  onlyUnscored: boolean;
  isRunning: boolean;
  onSelectJob: (jobId: string) => void;
  onToggleCandidate: (candidateId: string) => void;
  onSearchChange: (search: string) => void;
  onToggleOnlyUnscored: (val: boolean) => void;
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onOpenConfirm: () => void;
}

export const MatchingControlPanel: React.FC<MatchingControlPanelProps> = ({
  jobs,
  selectedJob,
  selectedJobId,
  selectableCandidates,
  selectedCandidateIds,
  scoredByCandidateId,
  candidateSearch,
  onlyUnscored,
  isRunning,
  onSelectJob,
  onToggleCandidate,
  onSearchChange,
  onToggleOnlyUnscored,
  onSelectAllFiltered,
  onClearSelection,
  onOpenConfirm,
}) => {
  const visibleIds = selectableCandidates.map((c) => c.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedCandidateIds.includes(id));

  return (
    <section className="glass-panel space-y-5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Bước 1: Chọn Job Description mục tiêu */}
        <div className="space-y-3 lg:col-span-5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              1
            </span>
            <label htmlFor="matching-job-select" className="text-sm font-bold text-slate-800">
              Chọn Job Description mục tiêu
            </label>
          </div>

          <select
            id="matching-job-select"
            value={selectedJobId}
            onChange={(e) => onSelectJob(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm font-medium text-slate-800 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">-- Chọn một vị trí tuyển dụng --</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title} (Tối thiểu {job.minExperience} năm KN • {job._count?.matchResults ?? 0} đã chấm)
              </option>
            ))}
          </select>

          {selectedJob ? (
            <div className="space-y-2.5 rounded-xl border border-blue-100 bg-blue-50/40 p-3.5 text-xs">
              <div className="flex items-center justify-between font-semibold text-slate-800">
                <span className="inline-flex items-center gap-1.5 text-blue-700">
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>{selectedJob.title}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-slate-600">
                  <Award className="h-3.5 w-3.5 text-amber-500" />
                  <span>≥ {selectedJob.minExperience} năm KN</span>
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {selectedJob.requiredSkills.map((skill, idx) => (
                  <span
                    key={`${skill}-${idx}`}
                    className="rounded-md border border-blue-200 bg-white px-2 py-0.5 text-[11px] font-medium text-blue-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-xs text-slate-500">
              Hãy chọn một vị trí tuyển dụng để Gemini AI đối chiếu kỹ năng và số năm kinh nghiệm của ứng viên.
            </div>
          )}
        </div>

        {/* Bước 2: Chọn tập ứng viên tham gia đánh giá */}
        <div className="space-y-3 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                2
              </span>
              <span className="text-sm font-bold text-slate-800">
                Chọn ứng viên tham gia đánh giá
              </span>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                Đã chọn {selectedCandidateIds.length}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={onSelectAllFiltered}
                disabled={selectableCandidates.length === 0}
                className="font-semibold text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-40"
              >
                {allVisibleSelected ? 'Bỏ chọn danh sách đang lọc' : `Chọn tất cả (${selectableCandidates.length})`}
              </button>
              {selectedCandidateIds.length > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={onClearSelection}
                    className="font-medium text-slate-500 hover:text-slate-800"
                  >
                    Xóa chọn ({selectedCandidateIds.length})
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Thanh tìm kiếm & lọc nhanh ứng viên */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={candidateSearch}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Lọc nhanh ứng viên theo tên, email, kỹ năng..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-8 pr-7 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              {candidateSearch && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-200"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {selectedJobId && (
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={onlyUnscored}
                  onChange={(e) => onToggleOnlyUnscored(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Chỉ hiện CV chưa chấm</span>
              </label>
            )}
          </div>

          {/* Lưới chọn ứng viên */}
          {selectableCandidates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-400">
              Không có ứng viên hợp lệ nào khớp bộ lọc hiện tại.
            </div>
          ) : (
            <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 sm:grid-cols-2">
              {selectableCandidates.map((candidate) => {
                const isSelected = selectedCandidateIds.includes(candidate.id);
                const existingScore = scoredByCandidateId.get(candidate.id);

                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => onToggleCandidate(candidate.id)}
                    className={`flex items-start justify-between gap-2 rounded-xl border p-2.5 text-left transition ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/90 ring-1 ring-blue-600'
                        : 'border-slate-200/90 bg-white hover:border-blue-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </span>
                        <span className="truncate text-xs font-bold text-slate-900">
                          {candidate.fullName}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1 pl-5 text-[11px] text-slate-500">
                        <span>{candidate.yearsOfExperience} năm KN</span>
                        {candidate.skills.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[140px]">
                              {candidate.skills.slice(0, 2).join(', ')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {existingScore !== undefined && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          existingScore >= 80
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : existingScore >= 50
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                        title="Đã có điểm đánh giá với JD này (chạy lại sẽ cập nhật)"
                      >
                        {existingScore}đ
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer kích hoạt chạy AI Matching */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <UserCheck className="h-4 w-4 text-blue-600" />
          <span>
            Sẵn sàng đối chiếu <strong className="text-slate-800">{selectedCandidateIds.length}</strong> hồ sơ đã chọn với{' '}
            <strong className="text-slate-800">{selectedJob ? selectedJob.title : 'chưa chọn JD'}</strong>.
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenConfirm}
          disabled={isRunning || !selectedJobId || selectedCandidateIds.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4 text-amber-300" />
          <span>
            {isRunning
              ? 'Google Gemini đang phân tích...'
              : `Chạy AI Matching (${selectedCandidateIds.length} ứng viên)`}
          </span>
        </button>
      </div>
    </section>
  );
};
