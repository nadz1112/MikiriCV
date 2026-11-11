import React, { useState } from 'react';
import { AlertCircle, Plus, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../features/auth/authStore';
import { useJobs } from '../features/jobs/hooks/useJobs';
import { useJobFeatureStore } from '../features/jobs/store/jobStore';
import { JobCard } from '../features/jobs/components/JobCard';
import { JobFormModal } from '../features/jobs/components/JobFormModal';
import { JobDetailDrawer } from '../features/jobs/components/JobDetailDrawer';
import { JobDeleteModal } from '../features/jobs/components/JobDeleteModal';
import { JobDescription } from '../types';

export const JobsPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';

  const { jobs, filteredJobs, isLoading, fetchJobs, updateJob, deleteJob } = useJobs();
  const {
    searchQuery,
    setSearchQuery,
    detailJob,
    editingJob,
    deletingJob,
    isFormModalOpen,
    openCreateModal,
    openEditModal,
    closeFormModal,
    openDetailDrawer,
    closeDetailDrawer,
    openDeleteModal,
    closeDeleteModal,
  } = useJobFeatureStore();

  const [isDeleting, setIsDeleting] = useState(false);

  const canManageJob = (job: JobDescription) =>
    Boolean(isAdmin || !job.createdById || job.createdById === user?.id);

  const handleFormSuccess = (savedJob: JobDescription, isEdit: boolean) => {
    if (isEdit) {
      updateJob(savedJob);
      if (detailJob?.id === savedJob.id) {
        openDetailDrawer({ ...detailJob, ...savedJob });
      }
    } else {
      void fetchJobs();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingJob) return;
    setIsDeleting(true);
    try {
      await deleteJob(deletingJob.id);
      toast.success('Đã xóa Job Description và các kết quả matching liên quan');
      if (detailJob?.id === deletingJob.id) {
        closeDetailDrawer();
      }
      closeDeleteModal();
    } catch {
      toast.error('Xóa Job Description thất bại');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Quản lý Job Description
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Tạo và quản lý tiêu chuẩn tuyển dụng làm cơ sở sàng lọc và chấm điểm CV bằng AI.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          <span>Tạo JD mới</span>
        </button>
      </div>

      {/* Thanh tìm kiếm nhanh JD */}
      {jobs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="relative min-w-[240px] flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm JD theo tiêu đề, kỹ năng hoặc mô tả..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-8 text-xs text-slate-800 placeholder-slate-400 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <span className="text-xs font-medium text-slate-500">
            Hiển thị <strong className="text-slate-800">{filteredJobs.length}</strong> / {jobs.length} vị trí tuyển dụng
          </span>
        </div>
      )}

      {/* Danh sách JD */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white p-6"
            >
              <div className="h-5 w-3/4 rounded bg-slate-200" />
              <div className="mt-3 h-4 w-1/3 rounded bg-slate-100" />
              <div className="mt-4 space-y-2">
                <div className="h-3 w-full rounded bg-slate-100" />
                <div className="h-3 w-5/6 rounded bg-slate-100" />
                <div className="h-3 w-2/3 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-16 text-center">
          <AlertCircle className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <h2 className="text-base font-semibold text-slate-800">Chưa có Job Description nào</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            Tạo JD đầu tiên để lưu mô tả công việc, kỹ năng yêu cầu và số năm kinh nghiệm tối thiểu.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            <span>Tạo JD ngay</span>
          </button>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-14 text-center">
          <p className="text-sm font-medium text-slate-700">
            Không tìm thấy vị trí tuyển dụng nào khớp từ khóa “{searchQuery}”.
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="mt-3 rounded-lg bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          >
            Xóa từ khóa tìm kiếm
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              canManage={canManageJob(job)}
              isAdmin={isAdmin}
              onViewDetail={openDetailDrawer}
              onEdit={openEditModal}
              onDelete={openDeleteModal}
            />
          ))}
        </div>
      )}

      {/* Modal Tạo / Sửa JD */}
      <JobFormModal
        isOpen={isFormModalOpen}
        editingJob={editingJob}
        onClose={closeFormModal}
        onSuccess={handleFormSuccess}
      />

      {/* Drawer Xem chi tiết JD & Thống kê phân bổ điểm */}
      <JobDetailDrawer
        job={detailJob}
        canManage={detailJob ? canManageJob(detailJob) : false}
        onClose={closeDetailDrawer}
        onEdit={openEditModal}
        onDelete={openDeleteModal}
      />

      {/* Modal Xác nhận xóa JD kèm cảnh báo Cascade MatchResult */}
      <JobDeleteModal
        job={deletingJob}
        isDeleting={isDeleting}
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default JobsPage;
