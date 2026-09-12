import React from 'react';

interface ScoreBadgeProps {
  score: number;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({ score, showProgress = false, size = 'md' }) => {
  const getScoreColor = (val: number) => {
    if (val >= 80) {
      return {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        bar: 'bg-emerald-500',
        label: 'Rất phù hợp',
      };
    }
    if (val >= 50) {
      return {
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        bar: 'bg-amber-500',
        label: 'Tiềm năng',
      };
    }
    return {
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      bar: 'bg-rose-500',
      label: 'Chưa phù hợp',
    };
  };

  const { bg, bar, label } = getScoreColor(score);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5 font-bold',
  };

  return (
    <div className="inline-flex flex-col gap-1 items-start">
      <div className="flex items-center gap-1.5">
        <span className={`inline-flex items-center gap-1 font-semibold rounded-lg border ${bg} ${sizeClasses[size]}`}>
          <span>{score}</span>
          <span className="opacity-70 text-[10px]">/100</span>
        </span>
        {size !== 'sm' && <span className="text-xs text-slate-500 font-medium">({label})</span>}
      </div>

      {showProgress && (
        <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
          <div
            className={`h-full rounded-full transition-all duration-500 ${bar}`}
            style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
          />
        </div>
      )}
    </div>
  );
};
