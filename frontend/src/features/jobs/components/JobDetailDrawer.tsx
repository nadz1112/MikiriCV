import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  Briefcase,
  Calendar,
  Filter,
  LoaderCircle,
  Pencil,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { JobDescription, JobStats } from '../../../types';
import { jobFeatureApi } from '../api/jobApi';
import { ScoreDistributionChart } from '../../../components/dashboard/ScoreDistributionChart';
import { useCandidateFeatureStore } from '../../candidates/store/candidateStore';
import { useAuthStore } from '../../auth/authStore';

interface JobDetailDrawerProps {
  job: JobDescription | null;
  canManage: boolean;
  onClose: () => void;
  onEdit: (job: JobDescription) => void;
  onDelete: (job: JobDescription) => void;
}

export const JobDetailDrawer: React.FC<JobDetailDrawerProps> = ({
  job,
  canManage,
  onClose,
  onEdit,
  onDelete,
}) => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { setJobId, setSkills, setMinExp } = useCandidateFeatureStore();

  const [detail, setDetail] = useState<JobDescription | null>(job);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!job) {
      setDetail(null);
      setStats(null);
      return;
    }

    setDetail(job);
    let active = true;
    setLoading(true);

    Promise.all([jobFeatureApi.getById(job.id), jobFeatureApi.getStats(job.id)])
      .then(([freshJob, jobStats]) => {
        if (!active) return;
        if (freshJob) setDetail({ ...job, ...freshJob });
        if (jobStats) setStats(jobStats);
      })
      .catch(() => {
        // Fallback hiển thị dữ liệu đã có từ danh sách
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [job]);

  if (!job || !detail) return null;

  const matchCount = stats?.totalEvaluated ?? detail._count?.matchResults ?? 0;

  const handleGoToCandidates = () => {
    setJobId(detail.id);
    setSkills(detail.requiredSkills);
    setMinExp(detail.minExperience);
    onClose();
    navigate('/candidates');
  };

  const handleGoToMatching = () => {
    onClose();
    navigate('/matching', { state: { jobId: detail.id } });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-drawer-title"
        onClick={(e) => e.stopPropagation()}
        className="flex h-[94vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              <Briefcase className="h-3.5 w-3.5" />
              <span>Chi tiết Job Description</span>
            </div>
            <h2 id="job-drawer-title" className="text-xl font-bold text-slate-900">
              {detail.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                <Award className="h-3.5 w-3.5 text-amber-500" />
                Kinh nghiệm tối thiểu: {detail.minExperience} năm
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Tạo ngày: {new Date(detail.createdAt).toLocaleDateString('vi-VN')}
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <Users className="h-3.5 w-3.5" />
                {matchCount} ứng viên đã chấm
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              <span>Đang tải dữ liệu chi tiết và thống kê...</span>
            </div>
          )}

          {/* Kỹ năng yêu cầu */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Kỹ năng chuyên môn yêu cầu ({detail.requiredSkills.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {detail.requiredSkills.map((skill, idx) => (
                <span
                  key={`${skill}-${idx}`}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
                >
                  {skill}
                </span>
              ))}
            </div>
          </section>

          {/* Mô tả chi tiết */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Nội dung mô tả công việc
            </h3>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
              {detail.description}
            </div>
          </section>

          {/* Thống kê phân bổ điểm AI (FR5.5) */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Thống kê đánh giá AI Matching
            </h3>
            {stats && stats.totalEvaluated > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                    <div className="text-xs text-slate-500">Đã đánh giá</div>
                    <div className="mt-1 text-lg font-bold text-slate-900">
                      {stats.totalEvaluated}
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-center">
                    <div className="text-xs text-emerald-700">Đạt chuẩn (≥70)</div>
                    <div className="mt-1 text-lg font-bold text-emerald-700">
                      {stats.qualifiedCount} ({stats.qualifiedRate}%)
                    </div>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-center">
                    <div className="text-xs text-blue-700">Điểm trung bình</div>
                    <div className="mt-1 text-lg font-bold text-blue-700">{stats.avgScore}</div>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-center">
                    <div className="text-xs text-amber-700">Điểm cao nhất</div>
                    <div className="mt-1 text-lg font-bold text-amber-700">{stats.topScore}</div>
                  </div>
                </div>

                <ScoreDistributionChart
                  matchResults={[]}
                  jobTitle={detail.title}
                  jobStats={stats}
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
                Chưa có ứng viên nào được chấm điểm AI cho vị trí này. Hãy bấm <strong>Sàng lọc CV</strong> hoặc <strong>Chạy AI Matching</strong> bên dưới để bắt đầu.
              </div>
            )}
          </section>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          {canManage ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(detail);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Chỉnh sửa</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(detail);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Xóa JD</span>
              </button>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGoToCandidates}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Sàng lọc CV theo JD</span>
            </button>

            {user?.role !== 'ADMIN' && (
              <button
                type="button"
                onClick={handleGoToMatching}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:from-blue-700 hover:to-indigo-700"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>Chạy AI Matching</span>
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

