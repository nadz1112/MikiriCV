import React, { useEffect, useState } from 'react';
import { Briefcase, Users, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { jobApi } from '../services/jobApi';
import { candidateApi } from '../services/candidateApi';

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState({
    totalJobs: 0,
    totalCandidates: 0,
    matchedCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [jobs, candidates] = await Promise.all([jobApi.getAll(), candidateApi.getAll()]);
        const totalMatches = candidates.reduce(
          (acc, c) => acc + (c.matchResults?.length || 0),
          0
        );
        setStats({
          totalJobs: jobs.length,
          totalCandidates: candidates.length,
          matchedCount: totalMatches,
        });
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const cards = [
    {
      title: 'Vị trí Tuyển dụng (JD)',
      value: stats.totalJobs,
      icon: Briefcase,
      color: 'from-blue-500 to-indigo-500',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      link: '/jobs',
      actionText: 'Quản lý JD',
    },
    {
      title: 'Hồ sơ Ứng viên (CV)',
      value: stats.totalCandidates,
      icon: Users,
      color: 'from-purple-500 to-pink-500',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      link: '/candidates',
      actionText: 'Xem danh sách',
    },
    {
      title: 'Lượt đánh giá bằng AI',
      value: stats.matchedCount,
      icon: Sparkles,
      color: 'from-amber-500 to-orange-500',
      textColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
      link: '/matching',
      actionText: 'Chạy Matching',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>AI Resume Matching Engine</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Chào mừng đến với CVMikiri
          </h1>
          <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
            Hệ thống sàng lọc hồ sơ 2 tầng: Lọc nhanh tức thì bằng quy tắc (Rule-based) và Chấm điểm phân tích ngữ nghĩa sâu với Google Gemini AI.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              to="/candidates"
              className="inline-flex items-center gap-2 bg-white text-blue-600 font-semibold px-4 py-2.5 rounded-xl text-sm shadow-md hover:bg-blue-50 transition"
            >
              <Users className="w-4 h-4" />
              <span>Tải lên CV ngay</span>
            </Link>
            <Link
              to="/matching"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-4 py-2.5 rounded-xl text-sm backdrop-blur-md transition"
            >
              <Sparkles className="w-4 h-4" />
              <span>Chạy đối soát AI</span>
            </Link>
          </div>
        </div>
        {/* Background decorative circles */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-32 -top-12 w-48 h-48 bg-indigo-400/20 rounded-full blur-xl pointer-events-none" />
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="glass-panel p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-200/80 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-slate-500">{card.title}</span>
                <div className={`p-2.5 rounded-xl ${card.bgColor} ${card.textColor}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-800">
                  {loading ? '...' : card.value}
                </span>
                <span className="text-xs text-slate-400">bản ghi</span>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <Link
                  to={card.link}
                  className={`text-xs font-semibold ${card.textColor} hover:underline inline-flex items-center gap-1`}
                >
                  {card.actionText}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quy trình hoạt động 4 bước */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-200/80 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Quy trình Sàng lọc 2 tầng Chuẩn mực</h2>
            <p className="text-xs text-slate-500 mt-1">Từ chuẩn hóa Job Description đến bảng xếp hạng phỏng vấn</p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Tối ưu 80% thời gian
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
              1
            </div>
            <h3 className="font-semibold text-sm text-slate-800">Tạo Job Description</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Thiết lập tiêu đề, kinh nghiệm tối thiểu và danh sách kỹ năng cốt lõi.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
              2
            </div>
            <h3 className="font-semibold text-sm text-slate-800">Nạp CV hàng loạt</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Hỗ trợ kéo thả nhiều file PDF/DOCX. Tự động bóc tách họ tên, SĐT, email.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-purple-600 text-white font-bold flex items-center justify-center text-xs">
              3
            </div>
            <h3 className="font-semibold text-sm text-slate-800">Lọc Thô Rule-based</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Sàng lọc tức thời &lt;100ms dựa vào kỹ năng và số năm kinh nghiệm, chi phí $0.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
              4
            </div>
            <h3 className="font-semibold text-sm text-slate-800">Chấm điểm Gemini AI</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              AI chấm điểm 0-100, tóm tắt lý do, chỉ ra kỹ năng đạt và kỹ năng còn thiếu.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
