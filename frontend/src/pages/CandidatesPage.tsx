import React from 'react';
import { FilterBar } from '../features/candidates/components/FilterBar';
import { CandidateTable } from '../features/candidates/components/CandidateTable';
import { useCandidateFeatureStore } from '../features/candidates/store/candidateStore';
import { useCandidates } from '../features/candidates/hooks/useCandidates';

export const CandidatesPage: React.FC = () => {
  const { filter, setPage } = useCandidateFeatureStore();
  const { candidates, total, page, limit, isLoading } = useCandidates(filter);

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quản lý CV</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sàng lọc và tìm kiếm ứng viên nhanh chóng theo từ khóa, kỹ năng chuyên môn và số năm kinh nghiệm.
        </p>
      </div>

      {/* Sticky FilterBar */}
      <FilterBar />

      {/* Candidate Table */}
      <CandidateTable
        candidates={candidates}
        total={total}
        page={page}
        limit={limit}
        isLoading={isLoading}
        onPageChange={setPage}
      />
    </div>
  );
};

export default CandidatesPage;
