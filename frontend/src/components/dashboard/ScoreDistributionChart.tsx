import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts';
import { MatchResult } from '../../types';
import { TrendingUp, Target } from 'lucide-react';

interface ScoreDistributionChartProps {
  matchResults: MatchResult[];
  jobTitle?: string;
}

interface BucketData {
  range: string;
  label: string;
  count: number;
  color: string;
  bgLight: string;
}

export const ScoreDistributionChart: React.FC<ScoreDistributionChartProps> = ({
  matchResults,
  jobTitle,
}) => {
  // Chuẩn hóa 4 khoảng điểm theo hợp đồng FR5.5 và Wireframe 4.2.4
  // 1. Dưới 50
  // 2. 50 - 70
  // 3. 70 - 85
  // 4. Trên 85
  const buckets: BucketData[] = [
    {
      range: '< 50',
      label: 'Dưới 50',
      count: matchResults.filter((m) => m.score < 50).length,
      color: '#f43f5e', // rose-500
      bgLight: 'bg-rose-50 border-rose-200 text-rose-700',
    },
    {
      range: '50 - 70',
      label: '50 - 70',
      count: matchResults.filter((m) => m.score >= 50 && m.score <= 70).length,
      color: '#f59e0b', // amber-500
      bgLight: 'bg-amber-50 border-amber-200 text-amber-700',
    },
    {
      range: '71 - 85',
      label: '70 - 85',
      count: matchResults.filter((m) => m.score > 70 && m.score <= 85).length,
      color: '#0ea5e9', // sky-500
      bgLight: 'bg-sky-50 border-sky-200 text-sky-700',
    },
    {
      range: '> 85',
      label: 'Trên 85',
      count: matchResults.filter((m) => m.score > 85).length,
      color: '#10b981', // emerald-500
      bgLight: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    },
  ];

  const total = matchResults.length;
  const qualifiedCount = matchResults.filter((m) => m.score >= 70).length;
  const qualifiedRate = total > 0 ? Math.round((qualifiedCount / total) * 100) : 0;
  const avgScore =
    total > 0
      ? Math.round(matchResults.reduce((acc, curr) => acc + curr.score, 0) / total)
      : 0;
  const topScore =
    total > 0 ? Math.max(...matchResults.map((m) => m.score)) : 0;

  // Custom tooltip for Recharts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as BucketData;
      const pct = total > 0 ? Math.round((data.count / total) * 100) : 0;
      return (
        <div className="bg-slate-900/90 backdrop-blur-md text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-slate-100">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: data.color }}
            />
            Khoảng điểm: {data.label}
          </div>
          <div className="text-slate-300">
            Số ứng viên: <span className="font-bold text-white text-sm">{data.count}</span> ({pct}%)
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      {/* Header & Metric Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-base">
              Phân bổ Điểm số Phù hợp (Score Distribution)
            </h3>
            <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
              FR5.5 Recharts
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {jobTitle ? `Thống kê đối soát cho vị trí: ${jobTitle}` : 'Dữ liệu phân bổ theo 4 khoảng điểm chuẩn'}
          </p>
        </div>

        {/* Quick Highlights */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-600" />
            <div className="text-xs">
              <span className="text-slate-500">Tỷ lệ đạt (≥70đ): </span>
              <span className="font-bold text-emerald-700">{qualifiedRate}%</span>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <div className="text-xs">
              <span className="text-slate-500">Điểm TB: </span>
              <span className="font-bold text-blue-700">{avgScore}/100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Chart (Left) + Detailed Breakdown (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Recharts Bar Chart */}
        <div className="lg:col-span-8 h-64 w-full">
          {total === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Chưa có dữ liệu matching để vẽ biểu đồ
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={buckets}
                margin={{ top: 15, right: 15, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={48}>
                  {buckets.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Breakdown Cards by 4 Buckets */}
        <div className="lg:col-span-4 space-y-2.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Chi tiết 4 nhóm điểm chuẩn
          </h4>
          {buckets.map((b, idx) => {
            const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-transform hover:scale-[1.01] ${b.bgLight}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: b.color }}
                  />
                  <span className="font-semibold">{b.label}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-sm">{b.count}</span>
                  <span className="text-[11px] opacity-75">ứng viên ({pct}%)</span>
                </div>
              </div>
            );
          })}

          <div className="pt-2 text-[11px] text-slate-400 italic">
            * Điểm cao nhất ghi nhận: <strong className="text-slate-600">{topScore}/100</strong> trong tổng số <strong className="text-slate-600">{total}</strong> ứng viên đã đánh giá.
          </div>
        </div>
      </div>
    </div>
  );
};
