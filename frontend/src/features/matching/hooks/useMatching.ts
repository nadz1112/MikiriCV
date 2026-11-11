import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useJobStore } from '../../../store/useJobStore';
import { useCandidateStore } from '../../../store/useCandidateStore';
import { useMatchingFeatureStore } from '../store/matchingStore';
import { matchingFeatureApi } from '../api/matchingApi';
import { Candidate, MatchResult } from '../../../types';

export function useMatching(initialJobId?: string, initialCandidateIds?: string[]) {
  const { jobs, fetchJobs } = useJobStore();
  const { candidates, fetchCandidates } = useCandidateStore();
  const {
    selectedJobId,
    selectedCandidateIds,
    candidateSearch,
    onlyUnscored,
    isConfirmModalOpen,
    setSelectedJobId,
    setSelectedCandidateIds,
    toggleCandidateId,
    setCandidateSearch,
    setOnlyUnscored,
    openConfirmModal,
    closeConfirmModal,
    clearSelection,
  } = useMatchingFeatureStore();

  const [matchingResults, setMatchingResults] = useState<MatchResult[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const [insightCandidate, setInsightCandidate] = useState<Candidate | null>(null);
  const [insightMatchResult, setInsightMatchResult] = useState<MatchResult | null>(null);
  const [candidateToDelete, setCandidateToDelete] = useState<Candidate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadLeaderboard = useCallback(async (jobId: string) => {
    if (!jobId) {
      setMatchingResults([]);
      return;
    }
    setIsLoadingLeaderboard(true);
    try {
      const jobData = await matchingFeatureApi.getLeaderboard(jobId);
      setMatchingResults(jobData?.matchResults || []);
    } catch {
      setMatchingResults([]);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  }, []);

  useEffect(() => {
    void fetchJobs();
    void fetchCandidates();
  }, [fetchJobs, fetchCandidates]);

  useEffect(() => {
    if (initialJobId) {
      setSelectedJobId(initialJobId);
    }
    if (initialCandidateIds && initialCandidateIds.length > 0) {
      setSelectedCandidateIds(initialCandidateIds);
    }
  }, [initialJobId, initialCandidateIds, setSelectedJobId, setSelectedCandidateIds]);

  useEffect(() => {
    void loadLeaderboard(selectedJobId);
  }, [selectedJobId, loadLeaderboard]);

  // Bản đồ candidateId -> score của JD đang chọn
  const scoredByCandidateId = useMemo(() => {
    const map = new Map<string, number>();
    matchingResults.forEach((m) => {
      map.set(m.candidateId, m.score);
    });
    return map;
  }, [matchingResults]);

  // Danh sách ứng viên hợp lệ (loại trừ FAILED) và lọc theo tìm kiếm / chưa chấm
  const selectableCandidates = useMemo(() => {
    const q = candidateSearch.trim().toLowerCase();
    return candidates.filter((c) => {
      if (c.extractionStatus === 'FAILED') return false;
      if (onlyUnscored && scoredByCandidateId.has(c.id)) return false;
      if (!q) return true;
      return (
        c.fullName.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        c.skills.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [candidates, candidateSearch, onlyUnscored, scoredByCandidateId]);

  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === selectedJobId) || null,
    [jobs, selectedJobId],
  );

  const handleSelectAllFiltered = () => {
    const visibleIds = selectableCandidates.map((c) => c.id);
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedCandidateIds.includes(id));
    if (allSelected) {
      setSelectedCandidateIds(selectedCandidateIds.filter((id) => !visibleIds.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedCandidateIds, ...visibleIds]));
      setSelectedCandidateIds(merged);
    }
  };

  const handleRunMatching = async () => {
    if (!selectedJobId) {
      toast.error('Vui lòng chọn một Job Description mục tiêu');
      return;
    }
    if (selectedCandidateIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một ứng viên để chấm điểm');
      return;
    }

    setIsRunning(true);
    try {
      const res = await matchingFeatureApi.run(selectedJobId, selectedCandidateIds);
      const count = res.data?.length ?? selectedCandidateIds.length;
      toast.success(res.message || `Hoàn tất đánh giá ${count} ứng viên`);
      closeConfirmModal();
      await loadLeaderboard(selectedJobId);
      void fetchJobs();
    } catch {
      // Lỗi đã được hiển thị qua interceptor toast tiếng Việt
    } finally {
      setIsRunning(false);
    }
  };

  const handleOpenInsight = async (result: MatchResult) => {
    setInsightMatchResult(result);
    const baseCandidate: Candidate = result.candidate || {
      id: result.candidateId,
      fullName: 'Ứng viên',
      email: null,
      phone: null,
      skills: [],
      yearsOfExperience: 0,
      education: null,
      fileName: '',
      createdAt: result.createdAt,
    };
    setInsightCandidate(baseCandidate);

    try {
      const fullCandidate = await matchingFeatureApi.getCandidateDetail(result.candidateId);
      if (fullCandidate) {
        setInsightCandidate(fullCandidate);
      }
    } catch {
      // Giữ thông tin cơ bản nếu không tải được chi tiết
    }
  };

  const handleCloseInsight = () => {
    setInsightCandidate(null);
    setInsightMatchResult(null);
  };

  const handleConfirmDeleteCandidate = async () => {
    if (!candidateToDelete) return;
    setIsDeleting(true);
    try {
      await matchingFeatureApi.deleteCandidate(candidateToDelete.id);
      toast.success(`Đã xóa ứng viên ${candidateToDelete.fullName} và các kết quả liên quan`);
      setSelectedCandidateIds(selectedCandidateIds.filter((id) => id !== candidateToDelete.id));
      if (insightCandidate?.id === candidateToDelete.id) {
        handleCloseInsight();
      }
      setCandidateToDelete(null);
      await Promise.all([fetchCandidates(), loadLeaderboard(selectedJobId)]);
    } catch {
      toast.error('Xóa ứng viên thất bại');
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    jobs,
    candidates,
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
  };
}

