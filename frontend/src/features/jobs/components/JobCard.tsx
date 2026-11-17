import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  Calendar,
  Eye,
  Filter,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react';
import { JobDescription } from '../../../types';
import { useCandidateFeatureStore } from '../../candidates/store/candidateStore';

interface JobCardProps {
  job: JobDescription;
  canManage: boolean;
  isAdmin: boolean;
  onViewDetail: (job: JobDescription) => void;
  onEdit: (job: JobDescription) => void;
  onDelete: (job: JobDescription) => void;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  canManage,
  isAdmin,
  onViewDetail,
  onEdit,
  onDelete,
}) => {
  const navigate = useNavigate();
  const { setJobId, setSkills, setMinExp } = useCandidateFeatureStore();
  const matchCount = job._count?.matchResults ?? 0;

  const handleFilterCandidatesByJob = (e: React.MouseEvent) => {
    e.stopPropagation();
    setJobId(job.id);
    setSkills(job.requiredSkills);
    setMinExp(job.minExperience);
    navigate('/candidates');
  };

  return (
    <article
      onClick={() => onViewDetail(job)}
      className="group glass-panel flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
    >
      <div className="space-y-3">
        {/* Header: Title + Actions */}
        <div className="flex items-start justify-between gap-3">
          <h2 className="line-clamp-2 text-base font-bold text-slate-900 transition-colors group-hover:text-blue-600">
            {job.title}
          </h2>

          {canManage && (
            <div
              className="flex shrink-0 items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => onEdit(job)}
                aria-label={`Chỉnh sửa ${job.title}`}
                title="Chỉnh sửa JD"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-700"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(job)}
                aria-label={`Xóa ${job.title}`}
                title="Xóa JD"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Badge số ứng viên đã chấm & Người tạo (nếu ADMIN) */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              matchCount > 0
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border border-slate-200 bg-slate-100 text-slate-600'
            }`}
          >
            <Users className="h-3 w-3" />
            <span>{matchCount} ứng viên đã chấm AI</span>
          </span>

          {isAdmin && (
            <span className="text-xs text-slate-500">
              • Bởi: {job.createdBy?.fullName || job.createdBy?.email || 'Không xác định'}
            </span>
          )}
        </div>

        {/* Mô tả rút gọn */}
        <p className="line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-slate-500">
          {job.description}
        </p>

        {/* Kỹ năng yêu cầu */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {job.requiredSkills.slice(0, 6).map((skill, index) => (
            <span
              key={`${skill}-${index}`}
              className="rounded-md border border-blue-100 bg-blue-50/80 px-2 py-0.5 text-[11px] font-medium text-blue-700"
            >
              {skill}
            </span>
          ))}
          {job.requiredSkills.length > 6 && (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              +{job.requiredSkills.length - 6}
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-5 space-y-3 border-t border-slate-100 pt-3.5">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1 font-medium text-slate-600">
            <Award className="h-3.5 w-3.5 text-amber-500" />
            Tối thiểu: {job.minExperience} năm KN
          </span>
          <time className="flex items-center gap-1" dateTime={job.createdAt}>
            <Calendar className="h-3.5 w-3.5" />
            {new Date(job.createdAt).toLocaleDateString('vi-VN')}
          </time>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetail(job);
            }}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <Eye className="h-3.5 w-3.5 text-slate-500" />
            <span>Chi tiết JD</span>
          </button>

          <button
            type="button"
            onClick={handleFilterCandidatesByJob}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
            title="Chuyển sang Quản lý CV và lọc ứng viên theo yêu cầu của JD này"
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Sàng lọc CV</span>
          </button>
        </div>
      </div>
    </article>
  );
};
