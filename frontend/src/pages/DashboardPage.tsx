import React, { useEffect, useState, useMemo } from 'react';
import {
  Briefcase,
  Users,
  Sparkles,
  Trophy,
  ArrowRight,
  TrendingUp,
  Search,
  RefreshCw,
  PlusCircle,
  CheckCircle2,
  Eye,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { jobApi } from '../services/jobApi';
import { candidateApi } from '../services/candidateApi';
import { matchingApi } from '../services/matchingApi';
import { JobDescription, Candidate, MatchResult } from '../types';
import { ScoreDistributionChart } from '../components/dashboard/ScoreDistributionChart';
import { CandidateInsightDrawer } from '../components/dashboard/CandidateInsightDrawer';
import { DeleteConfirmModal } from '../components/dashboard/DeleteConfirmModal';
import toast from 'react-hot-toast';

export const DashboardPage: React.FC = () => {
  // Global Data State
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedJobLeaderboard, setSelectedJobLeaderboard] = useState<MatchResult[]>([]);

  // UI & Loading State
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'allCandidates'>('leaderboard');
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('');

  // Drawer & Modal State
  const [selectedCandidateForDrawer, setSelectedCandidateForDrawer] = useState<Candidate | null>(null);
  const [selectedMatchForDrawer, setSelectedMatchForDrawer] = useState<MatchResult | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [candidateToDelete, setCandidateToDelete] = useState<Candidate | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load Initial Dashboard Data
  const loadDashboardData = async () => {
    try {
      const [jobsData, candidatesData] = await Promise.all([
        jobApi.getAll(),
        candidateApi.getAll(),
      ]);
      setJobs(jobsData);
      setCandidates(candidatesData);

      // Mặc định chọn JD đầu tiên nếu có
      if (jobsData.length > 0 && !selectedJobId) {
        const firstJobId = jobsData[0].id;
        setSelectedJobId(firstJobId);
        loadJobLeaderboard(firstJobId);
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu dashboard:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Tải bảng xếp hạng cho một JD cụ thể
  const loadJobLeaderboard = async (jobId: string) => {
    if (!jobId) {
      setSelectedJobLeaderboard([]);
      return;
    }
    try {
      const res = await matchingApi.getLeaderboard(jobId);
      if (res && res.matchResults) {
        setSelectedJobLeaderboard(res.matchResults);
      } else {
        setSelectedJobLeaderboard([]);
      }
    } catch (err) {
      console.error('Lỗi khi tải leaderboard:', err);
      setSelectedJobLeaderboard([]);
    }
  };

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    loadJobLeaderboard(jobId);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    if (selectedJobId) {
      await loadJobLeaderboard(selectedJobId);
    }
    toast.success('Dữ liệu đã được làm mới');
  };

  // Tính toán số liệu thống kê toàn hệ thống
  const systemStats = useMemo(() => {
    const totalJobs = jobs.length;
    const totalCandidates = candidates.length;

    let totalMatches = 0;
    let highMatches = 0; // >= 70 điểm

    candidates.forEach((c) => {
      if (c.matchResults && c.matchResults.length > 0) {
        totalMatches += c.matchResults.length;
        c.matchResults.forEach((m) => {
          if (m.score >= 70) highMatches++;
        });
      }
    });

    const highRate = totalMatches > 0 ? Math.round((highMatches / totalMatches) * 100) : 0;

    return {
      totalJobs,
      totalCandidates,
      totalMatches,
      highRate,
    };
  }, [jobs, candidates]);

  // JD đang được chọn
  const currentJob = useMemo(() => {
    return jobs.find((j) => j.id === selectedJobId) || null;
  }, [jobs, selectedJobId]);

  // Lọc danh sách ứng viên (Directory tab)
  const filteredCandidates = useMemo(() => {
    if (!candidateSearchQuery.trim()) return candidates;
    const q = candidateSearchQuery.toLowerCase();
    return candidates.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        c.skills.some((s) => s.toLowerCase().includes(q))
    );
  }, [candidates, candidateSearchQuery]);

  // Mở Drawer AI Insight
  const handleOpenInsight = async (matchResult: MatchResult) => {
    setSelectedMatchForDrawer(matchResult);

    // Ưu tiên nạp candidate chi tiết kèm matchResults qua API để có thông tin đầy đủ nhất
    if (matchResult.candidateId) {
      try {
        const fullCandidate = await candidateApi.getById(matchResult.candidateId);
        setSelectedCandidateForDrawer(fullCandidate || matchResult.candidate || null);
      } catch {
        setSelectedCandidateForDrawer(matchResult.candidate || null);
      }
    } else {
      setSelectedCandidateForDrawer(matchResult.candidate || null);
    }
    setIsDrawerOpen(true);
  };

  // Mở Drawer từ danh sách Candidate toàn cục
  const handleOpenCandidateDetails = (candidate: Candidate) => {
    // Tìm matchResult tương ứng với JD đang chọn nếu có
    const match = selectedJobLeaderboard.find((m) => m.candidateId === candidate.id) || null;
    setSelectedCandidateForDrawer(candidate);
    setSelectedMatchForDrawer(match);
    setIsDrawerOpen(true);
  };

  // Xóa ứng viên
  const handleRequestDelete = (candidate: Candidate) => {
    setCandidateToDelete(candidate);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!candidateToDelete) return;
    setIsDeleting(true);
    try {
      await candidateApi.delete(candidateToDelete.id);
      toast.success(`Đã xóa vĩnh viễn ứng viên ${candidateToDelete.fullName}`);

      // Cập nhật lại UI sau xóa cascade
      setCandidates((prev) => prev.filter((c) => c.id !== candidateToDelete.id));
      setSelectedJobLeaderboard((prev) =>
        prev.filter((m) => m.candidateId !== candidateToDelete.id)
      );

      // Đóng modal & drawer nếu đang mở ứng viên đó
      setIsDeleteModalOpen(false);
      setCandidateToDelete(null);
      if (selectedCandidateForDrawer?.id === candidateToDelete.id) {
        setIsDrawerOpen(false);
      }
    } catch {
      toast.error('Xóa ứng viên thất bại. Vui lòng thử lại.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper hiển thị badge điểm số theo 3 ngưỡng (🟢 >= 80, 🟡 50-79, 🔴 < 50)
  const renderScoreBadge = (score: number) => {
    if (score >= 80) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {score}/100 - Rất phù hợp
        </span>
      );
    }
    if (score >= 50) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          {score}/100 - Khá phù hợp
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
        <span className="w-2 h-2 rounded-full bg-rose-500" />
        {score}/100 - Cần cân nhắc
      </span>
    );
  };

  // Helper hiển thị thứ hạng huy chương
  const renderRank = (index: number) => {
    if (index === 0) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-100 text-amber-800 font-extrabold text-xs shadow-2xs border border-amber-300">
          🥇 1
        </span>
      );
    }
    if (index === 1) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-200 text-slate-800 font-extrabold text-xs shadow-2xs border border-slate-300">
          🥈 2
        </span>
      );
    }
    if (index === 2) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-700/20 text-amber-900 font-extrabold text-xs shadow-2xs border border-amber-600/30">
          🥉 3
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs">
        #{index + 1}
      </span>
    );
  };

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Hero Banner with Real-time Status */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/20">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Màn hình Bảng điều khiển & Xếp hạng tuyển dụng • FR5 Dashboard</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Trung tâm Bảng điều khiển Tuyển dụng
          </h1>

          <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
            Phân tích chuyên sâu kết quả sàng lọc hai tầng: Tổng hợp số liệu hồ sơ, theo dõi biểu đồ phân bố điểm số và khám phá chi tiết nhận xét AI Gemini cho từng ứng viên.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              to="/matching"
              className="inline-flex items-center gap-2 bg-white text-blue-700 font-bold px-5 py-2.5 rounded-xl text-sm shadow-md hover:bg-blue-50 transition transform hover:-translate-y-0.5"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Chạy đối soát AI Matching</span>
            </Link>

            <Link
              to="/candidates"
              className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white font-semibold px-4 py-2.5 rounded-xl text-sm backdrop-blur-md transition border border-white/20"
            >
              <Users className="w-4 h-4" />
              <span>Tải lên thêm CV</span>
            </Link>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 bg-black/20 hover:bg-black/30 text-white font-medium px-3.5 py-2.5 rounded-xl text-sm backdrop-blur-md transition border border-white/10"
              title="Làm mới toàn bộ dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>
          </div>
        </div>

        {/* Decorative background glows */}
        <div className="absolute -right-16 -bottom-16 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-40 -top-10 w-60 h-60 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* 2. Executive KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Vị trí tuyển dụng */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Vị trí Tuyển dụng
            </span>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800">
              {isLoading ? '...' : systemStats.totalJobs}
            </span>
            <span className="text-xs text-slate-400">Job Descriptions</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link to="/jobs" className="text-blue-600 font-semibold hover:underline inline-flex items-center gap-1">
              Quản lý JD <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Card 2: Hồ sơ ứng viên */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Hồ sơ Ứng viên
            </span>
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800">
              {isLoading ? '...' : systemStats.totalCandidates}
            </span>
            <span className="text-xs text-slate-400">CV đã lưu trữ</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link to="/candidates" className="text-purple-600 font-semibold hover:underline inline-flex items-center gap-1">
              Xem toàn bộ CV <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Card 3: Lượt đánh giá AI */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Lượt chấm điểm AI
            </span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800">
              {isLoading ? '...' : systemStats.totalMatches}
            </span>
            <span className="text-xs text-slate-400">kết quả matching</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link to="/matching" className="text-amber-600 font-semibold hover:underline inline-flex items-center gap-1">
              Chạy AI Studio <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Card 4: Tỷ lệ ứng viên đạt chuẩn */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tỷ lệ đạt chuẩn (≥70đ)
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600">
              {isLoading ? '...' : `${systemStats.highRate}%`}
            </span>
            <span className="text-xs text-slate-400">trên tổng lượt đối soát</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Sàng lọc Gemini AI
            </span>
          </div>
        </div>
      </div>

      {/* 3. Main Section: Job Selector & Analytics + Leaderboard */}
      <div className="space-y-6">
        {/* Navigation Tabs & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
                activeTab === 'leaderboard'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Bảng xếp hạng theo Vị trí (FR5.2)</span>
            </button>
            <button
              onClick={() => setActiveTab('allCandidates')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
                activeTab === 'allCandidates'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Danh mục Toàn bộ Ứng viên (FR5.1)</span>
            </button>
          </div>

          {/* Job Selector Dropdown when in Leaderboard tab */}
          {activeTab === 'leaderboard' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                Chọn vị trí:
              </span>
              <select
                value={selectedJobId}
                onChange={(e) => handleSelectJob(e.target.value)}
                className="bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden shadow-2xs min-w-[220px]"
              >
                {jobs.length === 0 ? (
                  <option value="">Chưa có vị trí tuyển dụng</option>
                ) : (
                  jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} ({job._count?.matchResults || job.matchResults?.length || 0} đã chấm)
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
        </div>

        {/* ================= TAB 1: LEADERBOARD & RECHARTS DISTRIBUTION ================= */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            {jobs.length === 0 ? (
              /* Empty state: No Jobs created yet */
              <div className="glass-panel p-12 text-center rounded-3xl border border-slate-200 space-y-4">
                <div className="w-16 h-16 mx-auto bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <Briefcase className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">
                  Chưa có Job Description nào trong hệ thống
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                  Hãy khởi tạo ít nhất một vị trí tuyển dụng để bắt đầu thu thập hồ sơ ứng viên và xem biểu đồ phân tích điểm số.
                </p>
                <div className="pt-2">
                  <Link
                    to="/jobs"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md transition"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Tạo Job Description mới</span>
                  </Link>
                </div>
              </div>
            ) : !currentJob ? (
              <div className="glass-panel p-8 text-center rounded-2xl border border-slate-200 text-slate-500 text-sm">
                Vui lòng chọn một vị trí tuyển dụng từ menu trên để xem bảng xếp hạng.
              </div>
            ) : (
              <>
                {/* Job Context Overview Badge */}
                <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wider text-blue-400 font-bold">
                        Bảng xếp hạng chi tiết
                      </span>
                      <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md">
                        {currentJob.minExperience} năm KN tối thiểu
                      </span>
                    </div>
                    <h2 className="text-xl font-extrabold text-white">
                      {currentJob.title}
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400">Kỹ năng yêu cầu:</span>
                    {currentJob.requiredSkills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2.5 py-1 bg-slate-800 text-blue-300 border border-slate-700 rounded-lg font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Score Distribution Chart (Recharts 4 buckets - FR5.5) */}
                <ScoreDistributionChart
                  matchResults={selectedJobLeaderboard}
                  jobTitle={currentJob.title}
                />

                {/* Leaderboard Table (FR5.2 & Wireframe 4.2.4) */}
                <div className="glass-panel rounded-2xl border border-slate-200 overflow-hidden shadow-xs bg-white">
                  <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                    <div>
                      <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        <span>Bảng Xếp Hạng Ứng Viên (Leaderboard)</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Sắp xếp theo Điểm AI Gemini giảm dần • Hiển thị đối chiếu kỹ năng nhanh
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        to="/matching"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold transition"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>Chấm điểm thêm ứng viên</span>
                      </Link>
                    </div>
                  </div>

                  {selectedJobLeaderboard.length === 0 ? (
                    /* Empty state for this job */
                    <div className="p-12 text-center space-y-3">
                      <div className="w-12 h-12 mx-auto bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-slate-700 text-sm">
                        Chưa có ứng viên nào được chấm điểm cho vị trí này
                      </h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Hãy chọn các hồ sơ ứng viên phù hợp trong danh mục và chạy đánh giá với Google Gemini AI để xem bảng xếp hạng.
                      </p>
                      <div className="pt-2">
                        <Link
                          to="/matching"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-sm hover:bg-blue-700 transition"
                        >
                          Chạy AI Matching ngay
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-100">
                          <tr>
                            <th className="py-3.5 px-4 w-14 text-center">Hạng</th>
                            <th className="py-3.5 px-4">Ứng viên & Liên hệ</th>
                            <th className="py-3.5 px-4">Kinh nghiệm</th>
                            <th className="py-3.5 px-4">Kỹ năng khớp / thiếu</th>
                            <th className="py-3.5 px-4 text-center">Điểm AI & Xếp loại</th>
                            <th className="py-3.5 px-4 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-normal">
                          {selectedJobLeaderboard.map((item, idx) => {
                            const cand = item.candidate;
                            return (
                              <tr
                                key={item.id}
                                className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                                onClick={() => handleOpenInsight(item)}
                              >
                                {/* Rank */}
                                <td className="py-4 px-4 text-center">
                                  {renderRank(idx)}
                                </td>

                                {/* Candidate Details */}
                                <td className="py-4 px-4">
                                  <div className="space-y-0.5">
                                    <div className="font-bold text-slate-900 group-hover:text-blue-600 transition flex items-center gap-1.5">
                                      <span>{cand?.fullName || 'Chưa rõ tên'}</span>
                                    </div>
                                    <div className="text-xs text-slate-400 flex items-center gap-2">
                                      <span>{cand?.email || 'N/A'}</span>
                                      {cand?.phone && (
                                        <>
                                          <span>•</span>
                                          <span>{cand.phone}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* Experience */}
                                <td className="py-4 px-4 text-xs">
                                  <span className="font-bold text-slate-800">
                                    {cand?.yearsOfExperience || 0}
                                  </span>{' '}
                                  <span className="text-slate-400">năm KN</span>
                                </td>

                                {/* Matched & Missing Skills Summary */}
                                <td className="py-4 px-4">
                                  <div className="space-y-1.5 max-w-xs">
                                    {/* Matched skills */}
                                    <div className="flex flex-wrap gap-1">
                                      {item.matchedSkills && item.matchedSkills.length > 0 ? (
                                        item.matchedSkills.slice(0, 3).map((s, sIdx) => (
                                          <span
                                            key={sIdx}
                                            className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[11px] font-medium"
                                          >
                                            ✓ {s}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-[11px] text-slate-400 italic">
                                          Không có
                                        </span>
                                      )}
                                      {item.matchedSkills && item.matchedSkills.length > 3 && (
                                        <span className="text-[10px] text-slate-400 self-center">
                                          +{item.matchedSkills.length - 3}
                                        </span>
                                      )}
                                    </div>

                                    {/* Missing skills preview */}
                                    {item.missingSkills && item.missingSkills.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {item.missingSkills.slice(0, 2).map((s, sIdx) => (
                                          <span
                                            key={sIdx}
                                            className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px]"
                                          >
                                            ✕ {s}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>

                                {/* Score & Badge */}
                                <td className="py-4 px-4 text-center">
                                  {renderScoreBadge(item.score)}
                                </td>

                                {/* Actions */}
                                <td className="py-4 px-4 text-right">
                                  <div
                                    className="flex items-center justify-end gap-1.5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={() => handleOpenInsight(item)}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold transition"
                                      title="Xem AI Insight chi tiết"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Chi tiết</span>
                                    </button>

                                    {cand && (
                                      <button
                                        onClick={() => handleRequestDelete(cand)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                        title="Xóa ứng viên cascade"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ================= TAB 2: ALL CANDIDATES DIRECTORY (FR5.1) ================= */}
        {activeTab === 'allCandidates' && (
          <div className="glass-panel rounded-2xl border border-slate-200 overflow-hidden shadow-xs bg-white space-y-4 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span>Danh Mục Toàn Bộ Ứng Viên Trong Hệ Thống (FR5.1)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tổng cộng {candidates.length} hồ sơ đã tải lên máy chủ và bóc tách dữ liệu
                </p>
              </div>

              {/* Search input */}
              <div className="relative min-w-[260px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên, email, kỹ năng..."
                  value={candidateSearchQuery}
                  onChange={(e) => setCandidateSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {filteredCandidates.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                Không tìm thấy ứng viên nào phù hợp với từ khóa "{candidateSearchQuery}".
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-4">Họ và tên</th>
                      <th className="py-3 px-4">Email & SĐT</th>
                      <th className="py-3 px-4">Kinh nghiệm</th>
                      <th className="py-3 px-4">Kỹ năng trích xuất</th>
                      <th className="py-3 px-4">Ngày tải lên</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {filteredCandidates.map((cand) => (
                      <tr
                        key={cand.id}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                        onClick={() => handleOpenCandidateDetails(cand)}
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {cand.fullName}
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          <div>{cand.email || 'N/A'}</div>
                          <div className="text-slate-400">{cand.phone || 'Chưa nhận diện'}</div>
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          <span className="font-semibold text-slate-800">
                            {cand.yearsOfExperience}
                          </span>{' '}
                          năm
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {cand.skills && cand.skills.length > 0 ? (
                              cand.skills.slice(0, 4).map((s, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs"
                                >
                                  {s}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400 italic">Chưa có</span>
                            )}
                            {cand.skills && cand.skills.length > 4 && (
                              <span className="text-[10px] text-slate-400 self-center">
                                +{cand.skills.length - 4}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-400">
                          {new Date(cand.createdAt).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div
                            className="flex items-center justify-end gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleOpenCandidateDetails(cand)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                            >
                              Xem
                            </button>
                            <button
                              onClick={() => handleRequestDelete(cand)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Xóa ứng viên"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Insight Drawer (FR5.3 & Wireframe 4.2.3) */}
      <CandidateInsightDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        candidate={selectedCandidateForDrawer}
        matchResult={selectedMatchForDrawer}
        jobTitle={currentJob?.title}
        onDeleteRequest={(cand) => {
          setIsDrawerOpen(false);
          handleRequestDelete(cand);
        }}
      />

      {/* Delete Cascade Confirmation Modal (FR5.4 & UserFlow 4.1.3.e) */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        candidate={candidateToDelete}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
};
