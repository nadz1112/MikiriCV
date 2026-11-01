import React, { useEffect, useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Search, Trash2, Mail, Phone, Clock, FileText, CheckCircle2, Sparkles } from 'lucide-react';
import { useCandidateStore } from '../store/useCandidateStore';
import { candidateApi } from '../services/candidateApi';
import toast from 'react-hot-toast';

export const CandidatesPage: React.FC = () => {
  const {
    candidates,
    isLoading,
    filter,
    selectedCandidates,
    fetchCandidates,
    setFilter,
    toggleSelectCandidate,
    selectAllCandidates,
    clearSelection,
    deleteCandidate,
  } = useCandidateStore();

  const [uploading, setUploading] = useState(false);
  const [searchInput, setSearchInput] = useState(filter.search || '');
  const [skillsInput, setSkillsInput] = useState(filter.skills || '');
  const [minExpInput, setMinExpInput] = useState(filter.minExp || '');

  // Danh mục gợi ý tìm kiếm phổ biến (Cỡ chữ to rõ ràng)
  const popularSkills = ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'Python', 'Tailwind'];
  const popularExp = [1, 2, 3, 5];

  const handleSelectSkillSuggestion = (skill: string) => {
    const current = skillsInput ? skillsInput.split(',').map((s) => s.trim()).filter(Boolean) : [];
    if (!current.includes(skill)) {
      const nextSkills = [...current, skill].join(', ');
      setSkillsInput(nextSkills);
      setFilter({
        search: searchInput,
        skills: nextSkills,
        minExp: minExpInput,
      });
    }
  };

  const handleSelectExpSuggestion = (exp: number) => {
    const expStr = exp.toString();
    setMinExpInput(expStr);
    setFilter({
      search: searchInput,
      skills: skillsInput,
      minExp: expStr,
    });
  };

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // Dropzone handling
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      setUploading(true);
      try {
        const res = await candidateApi.upload(acceptedFiles);
        toast.success(res.message || 'Tải lên CV thành công!');
        fetchCandidates();
      } catch {
        // lỗi đã được xử lý bởi api interceptor
      } finally {
        setUploading(false);
      }
    },
    [fetchCandidates]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setFilter({
      search: searchInput,
      skills: skillsInput,
      minExp: minExpInput,
    });
  };

  const handleResetFilter = () => {
    setSearchInput('');
    setSkillsInput('');
    setMinExpInput('');
    setFilter({});
  };

  const handleSelectAll = () => {
    if (selectedCandidates.length === candidates.length) {
      clearSelection();
    } else {
      selectAllCandidates(candidates.map((c) => c.id));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Xóa ứng viên "${name}" khỏi hệ thống?`)) {
      try {
        await deleteCandidate(id);
        toast.success('Đã xóa hồ sơ ứng viên');
      } catch {
        toast.error('Xóa ứng viên thất bại');
      }
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Hồ sơ Ứng viên (Candidates)</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">
            Tự động bóc tách thông tin từ PDF/DOCX và lọc nhanh bằng quy tắc (Rule-based)
          </p>
        </div>
        {selectedCandidates.length > 0 && (
          <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm font-bold border border-blue-200 shadow-2xs">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
            <span>Đã chọn {selectedCandidates.length} ứng viên</span>
          </div>
        )}
      </div>

      {/* Upload Drag & Drop Area - Responsive */}
      <div
        {...getRootProps()}
        className={`glass-panel border-2 border-dashed rounded-3xl p-8 sm:p-10 text-center cursor-pointer transition-all w-full ${
          isDragActive
            ? 'border-blue-500 bg-blue-50/50 scale-[1.005]'
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="max-w-xl mx-auto space-y-3">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl inline-block shadow-sm">
            <UploadCloud className="w-10 h-10 mx-auto" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base sm:text-lg">
              {uploading
                ? 'Đang tải lên và trích xuất dữ liệu...'
                : isDragActive
                ? 'Thả các file CV vào đây'
                : 'Kéo thả file CV vào đây, hoặc bấm để chọn'}
            </h3>
            <p className="text-sm text-slate-500 mt-1.5">
              Hỗ trợ định dạng .PDF, .DOCX. Dung lượng tối đa 10MB/file.
            </p>
          </div>
        </div>
      </div>

      {/* Rule-based Filter Bar - Chữ to rõ ràng (+2 sizes) & Responsive */}
      <form
        onSubmit={handleApplyFilter}
        className="glass-panel p-5 sm:p-6 rounded-3xl border border-slate-200/90 space-y-4 shadow-xs bg-white"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          {/* Cột 1: Tìm kiếm */}
          <div>
            <label className="block text-sm sm:text-base font-bold text-slate-700 mb-1.5">
              Tìm từ khóa / Họ tên
            </label>
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Nhập từ khóa hoặc họ tên..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-11 pr-3 py-2.5 text-sm sm:text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 placeholder:text-sm sm:placeholder:text-base placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Cột 2: Kỹ năng */}
          <div>
            <label className="block text-sm sm:text-base font-bold text-slate-700 mb-1.5">
              Kỹ năng (ngăn cách dấu phẩy)
            </label>
            <input
              type="text"
              placeholder="Ví dụ: React, Node.js..."
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm sm:text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 placeholder:text-sm sm:placeholder:text-base placeholder:text-slate-400"
            />
          </div>

          {/* Cột 3: Kinh nghiệm */}
          <div>
            <label className="block text-sm sm:text-base font-bold text-slate-700 mb-1.5">
              Kinh nghiệm tối thiểu (năm)
            </label>
            <input
              type="number"
              min="0"
              placeholder="Ví dụ: 2"
              value={minExpInput}
              onChange={(e) => setMinExpInput(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm sm:text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 placeholder:text-sm sm:placeholder:text-base placeholder:text-slate-400"
            />
          </div>

          {/* Cột 4: Nút hành động */}
          <div className="flex gap-2.5">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm sm:text-base font-bold shadow-sm transition"
            >
              Lọc hồ sơ
            </button>
            <button
              type="button"
              onClick={handleResetFilter}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm sm:text-base font-semibold transition"
            >
              Đặt lại
            </button>
          </div>
        </div>

        {/* Khu vực Gợi ý tìm kiếm trực quan (+2 Font Sizes) */}
        <div className="pt-3.5 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-sm">
          {/* Gợi ý kỹ năng */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm sm:text-base font-bold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Gợi ý kỹ năng:
            </span>
            {popularSkills.map((skill) => (
              <button
                key={skill}
                type="button"
                onClick={() => handleSelectSkillSuggestion(skill)}
                className={`px-3 py-1.5 rounded-xl text-sm sm:text-base font-medium border transition-all ${
                  skillsInput.includes(skill)
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 hover:bg-blue-50 text-slate-700 border-slate-200 hover:border-blue-300'
                }`}
              >
                + {skill}
              </button>
            ))}
          </div>

          {/* Gợi ý năm kinh nghiệm */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm sm:text-base font-bold text-slate-700">
              Kinh nghiệm:
            </span>
            {popularExp.map((exp) => (
              <button
                key={exp}
                type="button"
                onClick={() => handleSelectExpSuggestion(exp)}
                className={`px-3 py-1.5 rounded-xl text-sm sm:text-base font-medium border transition-all ${
                  minExpInput === exp.toString()
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 hover:bg-indigo-50 text-slate-700 border-slate-200 hover:border-indigo-300'
                }`}
              >
                ≥ {exp} năm
              </button>
            ))}
          </div>
        </div>
      </form>

      {/* Candidate Table - Auto Responsive Width */}
      <div className="glass-panel rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs bg-white w-full">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 text-base">Đang tải danh sách hồ sơ...</div>
        ) : candidates.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-base">
            Không tìm thấy ứng viên nào phù hợp với điều kiện lọc.
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-xs sm:text-sm">
                <tr>
                  <th className="p-4 sm:p-5 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={
                        candidates.length > 0 && selectedCandidates.length === candidates.length
                      }
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-4 sm:p-5">Ứng viên</th>
                  <th className="p-4 sm:p-5">Liên hệ</th>
                  <th className="p-4 sm:p-5">Kinh nghiệm</th>
                  <th className="p-4 sm:p-5">Kỹ năng trích xuất</th>
                  <th className="p-4 sm:p-5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {candidates.map((c) => {
                  const isSelected = selectedCandidates.includes(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        isSelected ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      <td className="p-4 sm:p-5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectCandidate(c.id)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-4 sm:p-5">
                        <div className="font-bold text-slate-900 text-base sm:text-lg">{c.fullName}</div>
                        <div className="text-slate-400 flex items-center gap-1.5 mt-1 text-xs sm:text-sm">
                          <FileText className="w-3.5 h-3.5" />
                          <span className="truncate max-w-xs">{c.fileName}</span>
                        </div>
                      </td>
                      <td className="p-4 sm:p-5 space-y-1 text-slate-600 text-sm sm:text-base">
                        {c.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <span>{c.email}</span>
                          </div>
                        )}
                        {c.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <span>{c.phone}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4 sm:p-5 font-bold text-slate-800 text-sm sm:text-base">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>{c.yearsOfExperience} năm</span>
                        </div>
                      </td>
                      <td className="p-4 sm:p-5">
                        <div className="flex flex-wrap gap-1.5 max-w-md">
                          {c.skills.slice(0, 5).map((s, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs sm:text-sm font-medium border border-slate-200"
                            >
                              {s}
                            </span>
                          ))}
                          {c.skills.length > 5 && (
                            <span className="text-xs sm:text-sm text-slate-400 self-center font-medium">
                              +{c.skills.length - 5}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 sm:p-5 text-right">
                        <button
                          onClick={() => handleDelete(c.id, c.fullName)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                          title="Xóa hồ sơ"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
