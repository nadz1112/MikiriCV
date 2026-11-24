import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MatchingControlPanel } from '../features/matching/components/MatchingControlPanel';
import { MatchingConfirmModal } from '../features/matching/components/MatchingConfirmModal';
import { MatchingJobProgressPanel } from '../features/matching/components/MatchingJobProgressPanel';
import { MatchingResultsTable } from '../features/matching/components/MatchingResultsTable';
import { useMatching } from '../features/matching/hooks/useMatching';
import { CandidateInsightDrawer } from '../components/dashboard/CandidateInsightDrawer';
import { DeleteConfirmModal } from '../components/dashboard/DeleteConfirmModal';
import { getSubscription, type Subscription } from '../services/subscriptionApi';
import { SubscriptionPlans } from '../components/common/SubscriptionPlans';
import { ComparisonExport } from '../features/matching/components/ComparisonExport';

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
    activeJob,
    isCancellingJob,
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
    handleCancelJob,
    handleRetryFailedItems,
    dismissActiveJob,
    handleOpenInsight,
    handleCloseInsight,
    setCandidateToDelete,
    handleConfirmDeleteCandidate,
  } = useMatching(navState?.jobId, navState?.selectedCandidateIds);
  const [subscription, setSubscription] = useState<Subscription>();
  const [subscriptionError, setSubscriptionError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void getSubscription(controller.signal).then((value) => { if (!controller.signal.aborted) { setSubscription(value); setSubscriptionError(''); } }).catch(() => { if (!controller.signal.aborted) setSubscriptionError('Không thể tải gói dịch vụ và hạn mức doanh nghiệp.'); });
    return () => controller.abort();
  }, [isRunning]);

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
      <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold">Gói dịch vụ và hạn mức doanh nghiệp</h2>{subscriptionError && <p role="alert" className="mt-2 text-sm text-red-700">{subscriptionError}</p>}<SubscriptionPlans subscription={subscription} /></section>
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

      {activeJob && (
        <MatchingJobProgressPanel
          job={activeJob}
          isCancelling={isCancellingJob}
          isRetrying={isRunning}
          onCancel={() => void handleCancelJob()}
          onRetryFailed={() => void handleRetryFailedItems()}
          onDismiss={dismissActiveJob}
        />
      )}

      {/* Bảng xếp hạng ứng viên theo JD */}
      <ComparisonExport jobId={selectedJobId} candidateIds={matchingResults.map((result) => result.candidateId)} plus={subscription?.name === 'PLUS'} />
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
