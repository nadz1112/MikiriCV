import React from 'react';
import { useLocation } from 'react-router-dom';
import { MatchingControlPanel } from '../features/matching/components/MatchingControlPanel';
import { MatchingConfirmModal } from '../features/matching/components/MatchingConfirmModal';
import { MatchingResultsTable } from '../features/matching/components/MatchingResultsTable';
import { useMatching } from '../features/matching/hooks/useMatching';
import { CandidateInsightDrawer } from '../components/dashboard/CandidateInsightDrawer';
import { DeleteConfirmModal } from '../components/dashboard/DeleteConfirmModal';

interface MatchingLocationState {
  selectedCandidateIds?: string[];
  jobId?: string;
}

export const MatchingPage: React.FC = () => {
  const location = useLocation();
  const navState = (location.state as MatchingLocationState | null) || null;

  const {
    jobs,
    selectableCandidates,
    selectedJob,
    selectedJobId,
    selectedCandidateIds,
    candidateSearch,
    onlyUnscored,
    matchingResults,
    scoredByCandidateId,
    isLoadingLeaderboard,
    isConfirmModalOpen,
    isRunning,
    insightCandidate,
    insightMatchResult,
    candidateToDelete,
    isDeleting,
    setSelectedJobId,
    toggleCandidateId,
    setCandidateSearch,
    setOnlyUnscored,
    handleSelectAllFiltered,
    clearSelection,
    openConfirmModal,
    closeConfirmModal,
    handleRunMatching,
    handleOpenInsight,
    handleCloseInsight,
    setCandidateToDelete,
    handleConfirmDeleteCandidate,
  } = useMatching(navState?.jobId, navState?.selectedCandidateIds);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">AI Matching Studio</h1>
        <p className="mt-1 text-sm text-slate-500">
          Đánh giá kỹ năng và số năm kinh nghiệm đã trích xuất theo Job Description bằng Google Gemini AI.
        </p>
      </div>

      {/* Bảng điều khiển Chọn JD & Chọn tập ứng viên */}
      <MatchingControlPanel
        jobs={jobs}
        selectedJob={selectedJob}
        selectedJobId={selectedJobId}
        selectableCandidates={selectableCandidates}
        selectedCandidateIds={selectedCandidateIds}
        scoredByCandidateId={scoredByCandidateId}
        candidateSearch={candidateSearch}
        onlyUnscored={onlyUnscored}
        isRunning={isRunning}
        onSelectJob={setSelectedJobId}
        onToggleCandidate={toggleCandidateId}
        onSearchChange={setCandidateSearch}
        onToggleOnlyUnscored={setOnlyUnscored}
        onSelectAllFiltered={handleSelectAllFiltered}
        onClearSelection={clearSelection}
        onOpenConfirm={openConfirmModal}
      />

      {/* Bảng xếp hạng ứng viên theo JD */}
      <MatchingResultsTable
        selectedJobId={selectedJobId}
        jobTitle={selectedJob?.title}
        results={matchingResults}
        isLoading={isLoadingLeaderboard}
        onOpenInsight={(result) => void handleOpenInsight(result)}
      />

      {/* Modal xác nhận chạy AI Matching (Luồng 4.1.3d) */}
      <MatchingConfirmModal
        isOpen={isConfirmModalOpen}
        isRunning={isRunning}
        selectedJob={selectedJob}
        selectedCandidateIds={selectedCandidateIds}
        scoredByCandidateId={scoredByCandidateId}
        onClose={closeConfirmModal}
        onConfirm={() => void handleRunMatching()}
      />

      {/* Drawer Chi tiết AI Insight với 2 cột tương phản Gestalt (Wireframe 4.2.3) */}
      <CandidateInsightDrawer
        isOpen={Boolean(insightCandidate)}
        onClose={handleCloseInsight}
        candidate={insightCandidate}
        matchResult={insightMatchResult}
        jobTitle={selectedJob?.title}
        onDeleteRequest={(candidate) => setCandidateToDelete(candidate)}
      />

      {/* Modal Xác nhận xóa ứng viên từ Drawer */}
      <DeleteConfirmModal
        isOpen={Boolean(candidateToDelete)}
        onClose={() => setCandidateToDelete(null)}
        candidate={candidateToDelete}
        onConfirm={handleConfirmDeleteCandidate}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default MatchingPage;
