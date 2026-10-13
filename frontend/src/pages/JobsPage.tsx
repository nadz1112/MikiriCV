import React, { useEffect, useState } from 'react';
import { AlertCircle, Award, Calendar, Pencil, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useJobStore } from '../store/useJobStore';
import { jobApi, JobPayload } from '../services/jobApi';
import { JobDescription } from '../types';
import { useAuthStore } from '../features/auth/authStore';

const emptyForm = { title: '', description: '', skillsInput: '', minExperience: '0' };

export const JobsPage: React.FC = () => {
  const { jobs, isLoading, fetchJobs, updateJob, deleteJob } = useJobStore();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const [editingJob, setEditingJob] = useState<JobDescription | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const openCreateModal = () => {
    setEditingJob(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (job: JobDescription) => {
    setEditingJob(job);
    setForm({
      title: job.title,
      description: job.description,
      skillsInput: job.requiredSkills.join(', '),
      minExperience: String(job.minExperience),
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setIsModalOpen(false);
    setEditingJob(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requiredSkills = form.skillsInput.split(',').map((skill) => skill.trim()).filter(Boolean);
    if (requiredSkills.length === 0) {
      toast.error('Vui lòng nhập ít nhất một kỹ năng');
      return;
    }

    const payload: JobPayload = {
      title: form.title.trim(),
      description: form.description.trim(),
      requiredSkills,
      minExperience: Number(form.minExperience),
    };

    setSubmitting(true);
    try {
      if (editingJob) {
        const updated = await jobApi.update(editingJob.id, payload);
        if (updated) updateJob(updated);
        toast.success('Cập nhật JD thành công');
      } else {
        await jobApi.create(payload);
        await fetchJobs();
        toast.success('Tạo JD thành công');
      }
      setIsModalOpen(false);
      setEditingJob(null);
      setForm(emptyForm);
    } catch {
      // The API interceptor displays request errors.
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (job: JobDescription) => {
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa JD “${job.title}”? Các kết quả matching liên quan cũng sẽ bị xóa.`,
    );
    if (!confirmed) return;

    try {
      await deleteJob(job.id);
      toast.success('Đã xóa JD');
    } catch {
      toast.error('Xóa JD thất bại');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý Job Description</h1>
          <p className="mt-1 text-sm text-slate-500">Tạo và quản lý tiêu chí tuyển dụng cho AI Matching.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Tạo JD mới
        </button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-slate-400">Đang tải danh sách JD...</div>
      ) : jobs.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-dashed border-slate-300 px-4 py-16 text-center">
          <AlertCircle className="mx-auto mb-3 h-12 w-12 text-slate-400" />
          <h2 className="text-base font-semibold text-slate-700">Chưa có JD nào</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            Tạo JD để lưu mô tả công việc, kỹ năng yêu cầu và kinh nghiệm tối thiểu.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <article key={job.id} className="glass-panel flex flex-col justify-between rounded-2xl p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="line-clamp-2 font-bold text-slate-900">{job.title}</h2>
                  {(isAdmin || job.createdById === user?.id) && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => openEditModal(job)}
                        aria-label={`Chỉnh sửa ${job.title}`}
                        title="Chỉnh sửa JD"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => void handleDelete(job)}
                        aria-label={`Xóa ${job.title}`}
                        title="Xóa JD"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <p className="text-xs text-slate-500">
                    Người tạo: {job.createdBy?.fullName || job.createdBy?.email || 'Không xác định'}
                  </p>
                )}

                <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-slate-500">{job.description}</p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {job.requiredSkills.map((skill, index) => (
                    <span key={`${skill}-${index}`} className="rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-400">
                <span className="flex items-center gap-1 font-medium text-slate-600">
                  <Award className="h-3.5 w-3.5 text-amber-500" />
                  Tối thiểu: {job.minExperience} năm
                </span>
                <time className="flex items-center gap-1" dateTime={job.createdAt}>
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(job.createdAt).toLocaleDateString('vi-VN')}
                </time>
              </div>
            </article>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="job-form-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="job-form-title" className="text-lg font-bold text-slate-900">
                  {editingJob ? 'Chỉnh sửa JD' : 'Tạo Job Description mới'}
                </h2>
                {editingJob && (
                  <p className="mt-1 text-xs leading-5 text-amber-700">
                    Kết quả matching đã có sẽ không tự chấm lại theo nội dung JD mới.
                  </p>
                )}
              </div>
              <button type="button" onClick={closeModal} aria-label="Đóng" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="job-title" className="mb-1 block text-xs font-semibold text-slate-700">Tiêu đề công việc</label>
                <input
                  id="job-title"
                  type="text"
                  required
                  minLength={5}
                  maxLength={150}
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="Ví dụ: Senior Backend Developer"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-right text-xs text-slate-400">{form.title.length}/150</p>
              </div>

              <div>
                <label htmlFor="job-description" className="mb-1 block text-xs font-semibold text-slate-700">Mô tả công việc</label>
                <textarea
                  id="job-description"
                  required
                  minLength={10}
                  rows={5}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Mô tả trách nhiệm, quyền lợi và yêu cầu chuyên môn..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="job-skills" className="mb-1 block text-xs font-semibold text-slate-700">Kỹ năng yêu cầu</label>
                <input
                  id="job-skills"
                  type="text"
                  required
                  value={form.skillsInput}
                  onChange={(event) => setForm({ ...form, skillsInput: event.target.value })}
                  placeholder="React, TypeScript, Node.js, PostgreSQL"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-slate-400">Nhập các kỹ năng, phân tách bằng dấu phẩy.</p>
              </div>

              <div>
                <label htmlFor="job-experience" className="mb-1 block text-xs font-semibold text-slate-700">Số năm kinh nghiệm tối thiểu</label>
                <input
                  id="job-experience"
                  type="number"
                  required
                  min={0}
                  max={30}
                  step={1}
                  value={form.minExperience}
                  onChange={(event) => setForm({ ...form, minExperience: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} disabled={submitting} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100">
                  Hủy
                </button>
                <button type="submit" disabled={submitting} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-50">
                  {submitting ? 'Đang lưu...' : editingJob ? 'Lưu thay đổi' : 'Tạo JD'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};
