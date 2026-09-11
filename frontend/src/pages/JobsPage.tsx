import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Calendar, Award, AlertCircle } from 'lucide-react';
import { useJobStore } from '../store/useJobStore';
import { jobApi } from '../services/jobApi';
import toast from 'react-hot-toast';

export const JobsPage: React.FC = () => {
  const { jobs, isLoading, fetchJobs, deleteJob } = useJobStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [minExp, setMinExp] = useState(1);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const skills = skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (skills.length === 0) {
      toast.error('Vui lòng nhập ít nhất một kỹ năng');
      return;
    }

    setSubmitting(true);
    try {
      await jobApi.create({
        title,
        description,
        requiredSkills: skills,
        minExperience: Number(minExp),
      });
      toast.success('Tạo Job Description thành công');
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setSkillsInput('');
      setMinExp(1);
      fetchJobs();
    } catch {
      // lỗi đã được axios interceptor hiển thị toast
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, jobTitle: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa vị trí "${jobTitle}"? Các kết quả đánh giá liên quan sẽ bị xóa theo.`)) {
      try {
        await deleteJob(id);
        toast.success('Đã xóa Job Description');
      } catch {
        toast.error('Xóa thất bại');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Job Descriptions (Mô tả Công việc)</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Quản lý các vị trí tuyển dụng làm chuẩn đối soát cho AI Matching
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo JD mới</span>
        </button>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400">Đang tải danh sách vị trí...</div>
      ) : jobs.length === 0 ? (
        /* Empty State */
        <div className="glass-panel text-center py-16 px-4 rounded-2xl border border-dashed border-slate-300">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">Chưa có Job Description nào</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Bấm &quot;Tạo JD mới&quot; để thiết lập tiêu chí kỹ thuật và số năm kinh nghiệm tuyển dụng.
          </p>
        </div>
      ) : (
        /* Job Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="glass-panel p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-base text-slate-900 line-clamp-1">{job.title}</h3>
                  <button
                    onClick={() => handleDelete(job.id, job.title)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Xóa JD"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                  {job.description}
                </p>

                {/* Skills tags */}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {job.requiredSkills.map((skill, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-[11px] font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1 font-medium text-slate-600">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  Tối thiểu: {job.minExperience} năm
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(job.createdAt).toLocaleDateString('vi-VN')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tạo JD Mới */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-4 animate-in fade-in zoom-in duration-200">
            <h2 className="text-lg font-bold text-slate-900">Tạo Job Description Mới</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiêu đề công việc <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Senior Backend NodeJS Developer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số năm kinh nghiệm tối thiểu <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  required
                  value={minExp}
                  onChange={(e) => setMinExp(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Danh sách kỹ năng yêu cầu (ngăn cách bởi dấu phẩy){' '}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: React, TypeScript, Node.js, PostgreSQL"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mô tả chi tiết vị trí <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Mô tả trách nhiệm công việc, quyền lợi và yêu cầu chuyên môn..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition disabled:opacity-50"
                >
                  {submitting ? 'Đang lưu...' : 'Lưu Job Description'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
