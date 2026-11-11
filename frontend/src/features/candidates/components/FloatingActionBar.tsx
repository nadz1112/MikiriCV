import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { useCandidateFeatureStore } from '../store/candidateStore';
import { useAuthStore } from '../../auth/authStore';

export const FloatingActionBar: React.FC = () => {
  const navigate = useNavigate();
  const { selectedCandidateIds, clearSelection, filter } = useCandidateFeatureStore();
  const user = useAuthStore((state) => state.user);

  if (selectedCandidateIds.length === 0) {
    return null;
  }

  const handleGoToMatching = () => {
    navigate('/matching', {
      state: {
        selectedCandidateIds,
        jobId: filter.jobId,
      },
    });
  };

  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-4 rounded-2xl border border-slate-700/80 bg-slate-900/95 px-5 py-3 text-white shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-2 text-xs font-bold text-white">
            {selectedCandidateIds.length}
          </span>
          <span className="text-sm font-medium text-slate-100">
            Đã chọn <strong className="text-white">{selectedCandidateIds.length}</strong> ứng viên
          </span>
        </div>

        <div className="h-4 w-px bg-slate-700" />

        <button
          type="button"
          onClick={clearSelection}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
          <span>Bỏ chọn</span>
        </button>

        {user?.role !== 'ADMIN' && (
          <button
            type="button"
            onClick={handleGoToMatching}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-500/20 transition hover:from-blue-500 hover:to-indigo-500"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>Chạy AI Matching</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

