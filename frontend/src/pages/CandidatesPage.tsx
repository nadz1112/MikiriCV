import React, { useEffect } from 'react';
import { Briefcase, Sparkles } from 'lucide-react';
import { CvDropzone } from '../features/candidates/components/CvDropzone';
import { FilterBar } from '../features/candidates/components/FilterBar';
import { CandidateTable } from '../features/candidates/components/CandidateTable';
import { FloatingActionBar } from '../features/candidates/components/FloatingActionBar';
import { useCandidateFeatureStore } from '../features/candidates/store/candidateStore';
import { useCandidates } from '../features/candidates/hooks/useCandidates';
import { useJobStore } from '../store/useJobStore';
import { useAuthStore } from '../features/auth/authStore';

export const CandidatesPage: React.FC = () => {
  const isHr = useAuthStore((state) => state.user?.role === 'ENTERPRISE');
  const { filter, setPage, setJobId, setSkills, setMinExp } = useCandidateFeatureStore();
  const { candidates, total, page, limit, isLoading, refresh } = useCandidates(filter);
  const { jobs, fetchJobs } = useJobStore();

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const activeJob = jobs.find((j) => j.id === filter.jobId);

  const handleApplyJobCriteria = () => {
    if (!activeJob) return;
    setSkills(activeJob.requiredSkills);
    setMinExp(activeJob.minExperience);
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Header & Ngữ cảnh JD đang chọn (Wireframe 4.2.2) */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quản lý CV</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tải lên hồ sơ PDF/DOCX hàng loạt, sàng lọc nhanh theo kỹ năng và chọn ứng viên đưa vào AI Matching.
          </p>
        </div>

        {/* Selector JD đang chọn làm ngữ cảnh */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-sm">
          <Briefcase className="h-4 w-4 text-blue-600" />
          <label htmlFor="context-jd" className="text-xs font-semibold text-slate-600">
            JD đang chọn:
          </label>
          <select
            id="context-jd"
            value={filter.jobId || ''}
            onChange={(e) => setJobId(e.target.value || undefined)}
            className="max-w-[260px] truncate rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">— Toàn bộ ứng viên (Chưa gắn JD) —</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title} ({job._count?.matchResults ?? 0} đã chấm)
              </option>
            ))}
          </select>

          {activeJob && (
            <button
              type="button"
              onClick={handleApplyJobCriteria}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
              title="Lọc nhanh ứng viên theo kỹ năng và số năm kinh nghiệm của JD này"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Áp tiêu chí JD</span>
            </button>
          )}
        </div>
      </div>

      {/* Khu vực kéo-thả Upload CV (FR2 - Wireframe 4.2.2) */}
      {isHr && <CvDropzone onUploadSuccess={refresh} />}

      {/* Sticky FilterBar (FR3) */}
      <FilterBar />

      {/* Bảng dữ liệu ứng viên (FR5.1) */}
      <CandidateTable
        candidates={candidates}
        total={total}
        page={page}
        limit={limit}
        isLoading={isLoading}
        onPageChange={setPage}
        onCandidateDeleted={refresh}
      />

      {/* Thanh hành động nổi khi tích chọn ứng viên (Wireframe 4.2.2) */}
      {isHr && <FloatingActionBar />}
    </div>
  );
};

export default CandidatesPage;
