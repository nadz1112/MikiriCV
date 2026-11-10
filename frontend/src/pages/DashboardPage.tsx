import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
import { candidateApi as candidateListApi } from '../features/candidates/api/candidateApi';
import { matchingApi } from '../services/matchingApi';
import { JobDescription, Candidate, MatchResult, JobStats, DashboardStats } from '../types';
import { dashboardApi } from '../services/dashboardApi';
import { ScoreDistributionChart } from '../components/dashboard/ScoreDistributionChart';
import { CandidateInsightDrawer } from '../components/dashboard/CandidateInsightDrawer';
import { DeleteConfirmModal } from '../components/dashboard/DeleteConfirmModal';
import toast from 'react-hot-toast';
import { useAuthStore } from '../features/auth/authStore';

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const canRunMatching = user?.role === 'ENTERPRISE';
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedJobLeaderboard, setSelectedJobLeaderboard] = useState<MatchResult[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [currentJobStats, setCurrentJobStats] = useState<JobStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'allCandidates'>('leaderboard');
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('');
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidateTotal, setCandidateTotal] = useState(0);
  const [candidateLoading, setCandidateLoading] = useState(true);
  const [candidateError, setCandidateError] = useState('');
  const [dashboardError, setDashboardError] = useState('');
  const [jobError, setJobError] = useState('');
  const [jobLoading, setJobLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const candidateLimit = 20;
  const candidatePages = Math.max(1, Math.ceil(candidateTotal / candidateLimit));
  const [selectedCandidateForDrawer, setSelectedCandidateForDrawer] = useState<Candidate | null>(null);
  const [selectedMatchForDrawer, setSelectedMatchForDrawer] = useState<MatchResult | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<Candidate | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const detailRequest = useRef(0);

  const loadDashboardData = useCallback(async () => {
    setDashboardError('');
    try {
      const [jobsData, statsData] = await Promise.all([jobApi.getAll(), dashboardApi.getStats()]);
      if (!statsData) throw new Error('Missing statistics');
      setJobs(jobsData);
      setDashboardStats(statsData);
      setSelectedJobId(current => jobsData.some(job => job.id === current) ? current : jobsData[0]?.id || '');
    } catch { setDashboardError('Không thể tải thống kê. Vui lòng thử làm mới.'); }
    finally { setIsLoading(false); }
  }, []);
  useEffect(() => { void loadDashboardData(); }, [loadDashboardData]);

  useEffect(() => {
    let active = true;
    setCandidateLoading(true);
    setCandidateError('');
    const timer = window.setTimeout(async () => {
      try {
        const result = await candidateListApi.list({ search: candidateSearchQuery, page: candidatePage, limit: candidateLimit });
        if (!active) return;
        const lastPage = Math.max(1, Math.ceil(result.total / candidateLimit));
        if (candidatePage > lastPage) { setCandidatePage(lastPage); return; }
        setCandidates(result.data);
        setCandidateTotal(result.total);
      } catch {
        if (active) { setCandidates([]); setCandidateError('Không thể tải danh sách ứng viên. Vui lòng thử lại.'); }
      } finally { if (active) setCandidateLoading(false); }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [candidateSearchQuery, candidatePage, revision]);

  useEffect(() => {
    let active = true;
    setSelectedJobLeaderboard([]);
    setCurrentJobStats(null);
    setJobError('');
    if (!selectedJobId) { setJobLoading(false); return; }
    setJobLoading(true);
    void Promise.all([matchingApi.getLeaderboard(selectedJobId), jobApi.getStats(selectedJobId)])
      .then(([leaderboard, stats]) => {
        if (!active) return;
        if (!leaderboard || !stats) throw new Error('Missing job data');
        setSelectedJobLeaderboard(leaderboard.matchResults || []);
        setCurrentJobStats(stats);
      }).catch(() => { if (active) setJobError('Không thể tải kết quả của vị trí đã chọn. Vui lòng thử lại.'); })
      .finally(() => { if (active) setJobLoading(false); });
    return () => { active = false; };
  }, [selectedJobId, revision]);

  const handleSelectJob = (id: string) => setSelectedJobId(id);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setRevision(value => value + 1);
    setIsRefreshing(false);
  };
  const systemStats = {
    totalJobs: dashboardStats?.totalJobs ?? 0, totalCandidates: dashboardStats?.totalCandidates ?? 0,
    totalMatches: dashboardStats?.totalMatches ?? 0, highRate: dashboardStats?.qualifiedRate ?? 0,
  };
  const currentJob = useMemo(() => jobs.find(job => job.id === selectedJobId) || null, [jobs, selectedJobId]);
  const filteredCandidates = candidates;
  const handleOpenInsight = async (match: MatchResult) => {
    const request = ++detailRequest.current;
    setIsDrawerOpen(false);
    try {
      const candidate = await candidateApi.getById(match.candidateId);
      if (request !== detailRequest.current || !candidate) return;
      setSelectedCandidateForDrawer(candidate);
      setSelectedMatchForDrawer(match);
      setIsDrawerOpen(true);
    } catch { toast.error('Không thể mở hồ sơ ứng viên'); }
  };
  const handleOpenCandidateDetails = async (item: Candidate) => {
    const request = ++detailRequest.current;
    setIsDrawerOpen(false);
    try {
      const candidate = await candidateApi.getById(item.id);
      if (request !== detailRequest.current || !candidate) return;
      setSelectedCandidateForDrawer(candidate);
      setSelectedMatchForDrawer(candidate.matchResults?.find(match => match.jobDescriptionId === selectedJobId) || null);
      setIsDrawerOpen(true);
    } catch { toast.error('Không thể mở hồ sơ ứng viên'); }
  };
  const handleRequestDelete = (candidate: Candidate) => { setCandidateToDelete(candidate); setIsDeleteModalOpen(true); };
  const handleConfirmDelete = async () => {
    if (!candidateToDelete) return;
    setIsDeleting(true);
    try {
      await candidateApi.delete(candidateToDelete.id);
      detailRequest.current++;
      setIsDeleteModalOpen(false);
      setCandidateToDelete(null);
      setIsDrawerOpen(false);
      setCandidates(items => items.filter(item => item.id !== candidateToDelete.id));
      setSelectedJobLeaderboard(items => items.filter(item => item.candidateId !== candidateToDelete.id));
      setRevision(value => value + 1);
      await loadDashboardData();
      toast.success('Đã xóa ứng viên và các kết quả đối soát liên quan');
    } catch { toast.error('Xóa ứng viên thất bại. Vui lòng thử lại.'); }
    finally { setIsDeleting(false); }
  };

  // Helper hiển thị badge điểm số theo 3 ngưỡng (🟢 >= 80, 🟡 50-79, 🔴 < 50)
  const renderScoreBadge = (score: number) => {
    if (score >= 80) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {score}/100 - Rất phù hợp
        </span>
      );
    }
    if (score >= 50) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          {score}/100 - Khá phù hợp
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm">
        <span className="w-2 h-2 rounded-full bg-rose-500" />
        {score}/100 - Cần cân nhắc
      </span>
    );
  };

  // Helper hiển thị thứ hạng huy chương
  const renderRank = (index: number) => {
    if (index === 0) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-100 text-amber-800 font-extrabold text-xs shadow-sm border border-amber-300">
          🥇 1
        </span>
      );
    }
    if (index === 1) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-200 text-slate-800 font-extrabold text-xs shadow-sm border border-slate-300">
          🥈 2
        </span>
      );
    }
    if (index === 2) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-700/20 text-amber-900 font-extrabold text-xs shadow-sm border border-amber-600/30">
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
      {dashboardError && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-700">{dashboardError}</div>}
      {activeTab === 'leaderboard' && jobError && <p role="alert" className="text-rose-700">{jobError}</p>}
      {/* 1. Hero Banner with Real-time Status */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-4xl lg:max-w-5xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/20">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Bảng điều khiển & Xếp hạng tuyển dụng</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Trung tâm Bảng điều khiển Tuyển dụng
          </h1>

          <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
            Phân tích chuyên sâu kết quả sàng lọc hai tầng: Tổng hợp số liệu hồ sơ, theo dõi biểu đồ phân bố điểm số và khám phá chi tiết nhận xét AI Gemini cho từng ứng viên.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            {canRunMatching && (<Link
              to="/matching"
              className="inline-flex items-center gap-2 bg-white text-blue-700 font-bold px-5 py-2.5 rounded-xl text-sm shadow-md hover:bg-blue-50 transition transform hover:-translate-y-0.5"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Chạy đối soát AI Matching</span>
            </Link>)}

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
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition bg-white flex flex-col justify-between">
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
              {isLoading || dashboardError ? '...' : systemStats.totalJobs}
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
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition bg-white flex flex-col justify-between">
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
              {isLoading || dashboardError ? '...' : systemStats.totalCandidates}
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
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition bg-white flex flex-col justify-between">
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
              {isLoading || dashboardError ? '...' : systemStats.totalMatches}
            </span>
            <span className="text-xs text-slate-400">kết quả matching</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            {canRunMatching && (<Link to="/matching" className="text-amber-600 font-semibold hover:underline inline-flex items-center gap-1">
              Chạy AI Studio <ArrowRight className="w-3 h-3" />
            </Link>)}
          </div>
        </div>

        {/* Card 4: Tỷ lệ ứng viên đạt chuẩn */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition bg-white flex flex-col justify-between">
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
              {isLoading || dashboardError ? '...' : `${systemStats.highRate}%`}
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
              <span>Bảng xếp hạng theo vị trí</span>
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
              <span>Danh mục ứng viên</span>
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
                className="bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm min-w-[220px]"
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
            {isLoading || jobLoading ? <p role="status" className="p-8">Đang tải bảng xếp hạng...</p> : jobError || dashboardError ? null : jobs.length === 0 ? (
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
                  jobStats={currentJobStats}
                />

                {/* Leaderboard Table (FR5.2 & Wireframe 4.2.4) */}
                <div className="glass-panel rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white">
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
                      {canRunMatching && (<Link
                        to="/matching"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold transition"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>Chấm điểm thêm ứng viên</span>
                      </Link>)}
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
                        {canRunMatching && (<Link
                          to="/matching"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-sm hover:bg-blue-700 transition"
                        >
                          Chạy AI Matching ngay
                        </Link>)}
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
          <div className="glass-panel rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white space-y-4 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span>Danh mục ứng viên</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tổng cộng {candidateTotal} hồ sơ đã tải lên máy chủ và bóc tách dữ liệu
                </p>
              </div>

              {/* Search input */}
              <div className="relative min-w-[260px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên, email, kỹ năng..."
                  value={candidateSearchQuery}
                  onChange={(e) => { setCandidateSearchQuery(e.target.value); setCandidatePage(1); }}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {candidateLoading ? <p role="status" className="p-8">Đang tải danh sách ứng viên...</p> : candidateError ? <p role="alert" className="p-8 text-rose-700">{candidateError}</p> : filteredCandidates.length === 0 ? (
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

      {activeTab === 'allCandidates' && <nav aria-label="Phân trang ứng viên" className="flex items-center justify-between gap-4">
        <button disabled={candidateLoading || candidatePage <= 1} onClick={() => setCandidatePage(page => page - 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Trang trước</button>
        <span>Trang {candidatePage}/{candidatePages} · {candidateTotal} hồ sơ</span>
        <button disabled={candidateLoading || candidatePage >= candidatePages} onClick={() => setCandidatePage(page => page + 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Trang sau</button>
      </nav>}

      {/* AI Insight Drawer (FR5.3 & Wireframe 4.2.3) */}
      <CandidateInsightDrawer
        key={selectedCandidateForDrawer?.id}
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
