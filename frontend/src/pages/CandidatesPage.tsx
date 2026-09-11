import React, { useEffect, useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Search, Trash2, Mail, Phone, Clock, FileText, CheckCircle2 } from 'lucide-react';
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
    <div className="space-y-6">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hồ sơ Ứng viên (Candidates)</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Tự động bóc tách thông tin từ PDF/DOCX và lọc nhanh bằng quy tắc (Rule-based)
          </p>
        </div>
        {selectedCandidates.length > 0 && (
          <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Đã chọn {selectedCandidates.length} ứng viên</span>
          </div>
        )}
      </div>

      {/* Upload Drag & Drop Area */}
      <div
        {...getRootProps()}
        className={`glass-panel border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="max-w-md mx-auto space-y-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl inline-block shadow-sm">
            <UploadCloud className="w-8 h-8 mx-auto" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-sm sm:text-base">
              {uploading
                ? 'Đang tải lên và trích xuất dữ liệu...'
                : isDragActive
                ? 'Thả các file CV vào đây'
                : 'Kéo thả file CV vào đây, hoặc bấm để chọn'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Hỗ trợ định dạng .PDF, .DOCX. Dung lượng tối đa 10MB/file.
            </p>
          </div>
        </div>
      </div>

      {/* Rule-based Filter Bar */}
      <form
        onSubmit={handleApplyFilter}
        className="glass-panel p-4 rounded-2xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
      >
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Tìm từ khóa / Họ tên</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Nhập từ khóa..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Kỹ năng (ngăn cách dấu phẩy)</label>
          <input
            type="text"
            placeholder="Ví dụ: React, Node.js..."
            value={skillsInput}
            onChange={(e) => setSkillsInput(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Kinh nghiệm tối thiểu (năm)</label>
          <input
            type="number"
            min="0"
            placeholder="Ví dụ: 2"
            value={minExpInput}
            onChange={(e) => setMinExpInput(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            Lọc hồ sơ
          </button>
          <button
            type="button"
            onClick={handleResetFilter}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition"
          >
            Đặt lại
          </button>
        </div>
      </form>

      {/* Candidate Table */}
      <div className="glass-panel rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Đang tải danh sách hồ sơ...</div>
        ) : candidates.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            Không tìm thấy ứng viên nào phù hợp với điều kiện lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        candidates.length > 0 && selectedCandidates.length === candidates.length
                      }
                      onChange={handleSelectAll}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="p-4">Ứng viên</th>
                  <th className="p-4">Liên hệ</th>
                  <th className="p-4">Kinh nghiệm</th>
                  <th className="p-4">Kỹ năng trích xuất</th>
                  <th className="p-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {candidates.map((c) => {
                  const isSelected = selectedCandidates.includes(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        isSelected ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectCandidate(c.id)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-800 text-sm">{c.fullName}</div>
                        <div className="text-slate-400 flex items-center gap-1 mt-0.5">
                          <FileText className="w-3 h-3" />
                          <span className="truncate max-w-xs">{c.fileName}</span>
                        </div>
                      </td>
                      <td className="p-4 space-y-1 text-slate-600">
                        {c.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{c.email}</span>
                          </div>
                        )}
                        {c.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{c.phone}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-medium text-slate-700">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.yearsOfExperience} năm</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {c.skills.slice(0, 5).map((s, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium"
                            >
                              {s}
                            </span>
                          ))}
                          {c.skills.length > 5 && (
                            <span className="text-[10px] text-slate-400 self-center">
                              +{c.skills.length - 5}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDelete(c.id, c.fullName)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Xóa hồ sơ"
                        >
                          <Trash2 className="w-4 h-4" />
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
