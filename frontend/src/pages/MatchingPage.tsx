import React, { useEffect, useState } from 'react';
import { Sparkles, Trophy, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { useJobStore } from '../store/useJobStore';
import { useCandidateStore } from '../store/useCandidateStore';
import { matchingApi } from '../services/matchingApi';
import { MatchResult } from '../types';
import toast from 'react-hot-toast';

export const MatchingPage: React.FC = () => {
  const { jobs, fetchJobs } = useJobStore();
  const { candidates, fetchCandidates } = useCandidateStore();

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [matchingResults, setMatchingResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailModal, setDetailModal] = useState<MatchResult | null>(null);

  useEffect(() => {
    fetchJobs();
    fetchCandidates();
  }, [fetchJobs, fetchCandidates]);

  // Khi chọn JD, tải bảng xếp hạng đã có nếu có
  const handleSelectJob = async (jobId: string) => {
    setSelectedJobId(jobId);
    if (!jobId) {
      setMatchingResults([]);
      return;
    }
    try {
      const jobData = await matchingApi.getLeaderboard(jobId);
      if (jobData && jobData.matchResults) {
        setMatchingResults(jobData.matchResults);
      } else {
        setMatchingResults([]);
      }
    } catch {
      setMatchingResults([]);
    }
  };

  const handleToggleCandidate = (id: string) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedCandidateIds.length === candidates.length) {
      setSelectedCandidateIds([]);
    } else {
      setSelectedCandidateIds(candidates.map((c) => c.id));
    }
  };

  const handleRunMatching = async () => {
    if (!selectedJobId) {
      toast.error('Vui lòng chọn một Job Description');
      return;
    }
    if (selectedCandidateIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một ứng viên để đánh giá');
      return;
    }

    setLoading(true);
    try {
      const res = await matchingApi.run(selectedJobId, selectedCandidateIds);
      toast.success(res.message || 'Chấm điểm AI hoàn tất!');
      // Tải lại leaderboard mới nhất
      handleSelectJob(selectedJobId);
    } catch {
      // lỗi hiển thị qua axios interceptor
    } finally {
      setLoading(false);
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) {
      return (
        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded-full text-xs flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          {score}/100 - Rất phù hợp
        </span>
      );
    }
    if (score >= 50) {
      return (
        <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 font-bold rounded-full text-xs flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          {score}/100 - Khá phù hợp
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 font-bold rounded-full text-xs flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
        {score}/100 - Cần cân nhắc
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI Matching Studio</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Đối soát ngữ nghĩa thông minh giữa CV và Job Description bằng Google Gemini AI
        </p>
      </div>

      {/* Control Panel: Chọn JD & Chọn tập ứng viên */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-200/80 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Chọn JD */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              1. Chọn Job Description mục tiêu:
            </label>
            <select
              value={selectedJobId}
              onChange={(e) => handleSelectJob(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">-- Chọn một vị trí tuyển dụng --</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} (Yêu cầu: {j.minExperience} năm KN)
                </option>
              ))}
            </select>
          </div>

          {/* Chọn tập ứng viên */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                2. Chọn ứng viên tham gia đánh giá:
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-blue-600 font-medium hover:underline"
              >
                {selectedCandidateIds.length === candidates.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
            </div>
            <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-200/80">
              Đã tích chọn <span className="font-bold text-blue-600">{selectedCandidateIds.length}</span> / {candidates.length} ứng viên.
            </div>
          </div>
        </div>

        {/* Danh sách ứng viên thu nhỏ dạng chip để tích chọn */}
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-slate-100 rounded-xl bg-slate-50/50">
          {candidates.map((c) => {
            const isSelected = selectedCandidateIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleToggleCandidate(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{c.fullName}</span>
                <span className="text-[10px] opacity-75">({c.yearsOfExperience}y)</span>
              </button>
            );
          })}
        </div>

        {/* Nút Kích hoạt AI Matching */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={handleRunMatching}
            disabled={loading || !selectedJobId || selectedCandidateIds.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 transition disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>{loading ? 'Google Gemini đang phân tích...' : 'Bắt đầu Chấm điểm bằng Gemini AI'}</span>
          </button>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="glass-panel rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-bold text-slate-800">
            Bảng Xếp Hạng Ứng Viên (Leaderboard)
          </h2>
        </div>

        {matchingResults.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            {selectedJobId
              ? 'Chưa có kết quả đánh giá nào cho vị trí này. Vui lòng chọn ứng viên và bấm Chấm điểm.'
              : 'Hãy chọn một Job Description ở trên để xem bảng xếp hạng.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="p-3 w-12 text-center">Hạng</th>
                  <th className="p-3">Ứng viên</th>
                  <th className="p-3">Điểm số AI</th>
                  <th className="p-3">Nhận xét tóm tắt</th>
                  <th className="p-3 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matchingResults.map((result, idx) => (
                  <tr key={result.id} className="hover:bg-blue-50/30 transition">
                    <td className="p-3 text-center font-bold text-slate-500">
                      {idx + 1 === 1 ? '🥇 1' : idx + 1 === 2 ? '🥈 2' : idx + 1 === 3 ? '🥉 3' : `#${idx + 1}`}
                    </td>
                    <td className="p-3 font-semibold text-slate-800">
                      {result.candidate?.fullName || 'Ứng viên'}
                    </td>
                    <td className="p-3">{getScoreBadge(result.score)}</td>
                    <td className="p-3 text-slate-600 line-clamp-2 max-w-md">
                      {result.summary}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setDetailModal(result)}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        <span>Xem chi tiết</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Chi tiết AI Insight */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-lg text-slate-900">
                  {detailModal.candidate?.fullName}
                </h3>
                <span className="text-xs text-slate-400">
                  Đánh giá độ phù hợp với vị trí tuyển dụng
                </span>
              </div>
              <div>{getScoreBadge(detailModal.score)}</div>
            </div>

            {/* Nhận xét AI */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 space-y-1.5">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Nhận xét từ Google Gemini AI:
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                {detailModal.summary}
              </p>
            </div>

            {/* So sánh kỹ năng */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Kỹ năng khớp */}
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2">
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Kỹ năng đáp ứng yêu cầu:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {detailModal.matchedSkills.length === 0 ? (
                    <span className="text-xs text-slate-400">Không có</span>
                  ) : (
                    detailModal.matchedSkills.map((s, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[11px] font-medium"
                      >
                        {s}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Kỹ năng còn thiếu */}
              <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100 space-y-2">
                <span className="text-xs font-bold text-rose-800 flex items-center gap-1">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  Kỹ năng còn thiếu:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {detailModal.missingSkills.length === 0 ? (
                    <span className="text-xs text-slate-400">Không thiếu</span>
                  ) : (
                    detailModal.missingSkills.map((s, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded text-[11px] font-medium"
                      >
                        {s}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
