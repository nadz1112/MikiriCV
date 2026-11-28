import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useJobStore } from '../../../store/useJobStore';
import { useCandidateStore } from '../../../store/useCandidateStore';
import { useMatchingFeatureStore } from '../store/matchingStore';
import { matchingFeatureApi } from '../api/matchingApi';
import { Candidate, MatchResult, MatchingJob } from '../../../types';
import { candidateApi } from '../../../services/candidateApi';
import { useAccountDialogsStore, showMatchingQuotaError } from '../../subscription/accountDialogsStore';
import { useSubscriptionStore } from '../../subscription/subscriptionStore';
import { useSafeAuth } from '../../auth/useSafeAuth';
import { useNetworkStore } from '../../../shared/offline/networkStore';
import { offlineDb } from '../../../shared/offline/offlineDb';
import { isNetworkOfflineError } from '../../../shared/platform/runtime';

const TERMINAL_JOB_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'FAILED']);

export function useMatching(initialJobId?: string, initialCandidateIds?: string[]) {
  const { user } = useSafeAuth();
  const isOnline = useNetworkStore((state) => state.isOnline);
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
  const [activeJob, setActiveJob] = useState<MatchingJob | null>(null);
  const [isCancellingJob, setIsCancellingJob] = useState(false);
  const announcedTerminalJobId = useRef<string | null>(null);

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
      const results = jobData?.matchResults || [];
      setMatchingResults(results);
      if (user?.id) {
        void offlineDb.saveLeaderboard(user.id, jobId, results);
      }
    } catch (error) {
      if (isNetworkOfflineError(error) && user?.id) {
        const cached = await offlineDb.getLeaderboard(user.id, jobId);
        setMatchingResults(cached?.results ?? []);
      } else {
        setMatchingResults([]);
      }
    } finally {
      setIsLoadingLeaderboard(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchJobs();
    void fetchCandidates();
  }, [fetchJobs, fetchCandidates]);

  useEffect(() => {
    let active = true;
    if (!user?.id) return;
    void offlineDb.getMatchingDraft(user.id).then((draft) => {
      if (!active || !draft) return;
      if (!initialJobId && !useMatchingFeatureStore.getState().selectedJobId && draft.selectedJobId) {
        setSelectedJobId(draft.selectedJobId);
      }
      if (
        (!initialCandidateIds || initialCandidateIds.length === 0) &&
        useMatchingFeatureStore.getState().selectedCandidateIds.length === 0 &&
        draft.selectedCandidateIds.length > 0
      ) {
        setSelectedCandidateIds(draft.selectedCandidateIds);
      }
      if (draft.activeJob && !TERMINAL_JOB_STATUSES.has(draft.activeJob.status)) {
        setActiveJob(draft.activeJob);
      }
    });
    return () => {
      active = false;
    };
  }, [user?.id, initialJobId, initialCandidateIds, setSelectedJobId, setSelectedCandidateIds]);

  useEffect(() => {
    if (!user?.id) return;
    void offlineDb.saveMatchingDraft(user.id, {
      selectedJobId,
      selectedCandidateIds,
      activeJob,
    });
  }, [user?.id, selectedJobId, selectedCandidateIds, activeJob]);

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

  const notifyTerminalJob = useCallback((job: MatchingJob) => {
    if (announcedTerminalJobId.current === job.id) return;
    announcedTerminalJobId.current = job.id;

    const items = job.items ?? [];
    for (const item of items) useAccountDialogsStore.getState().showQuota(item.errorCode);
    void useSubscriptionStore.getState().refreshBalance();
    const doneCount = items.length ? items.filter((item) => item.status === 'DONE').length : Math.max(0, job.processed - job.failed);
    const failedCount = items.length ? items.filter((item) => item.status === 'FAILED').length : job.failed;
    const skippedCount = items.length ? items.filter((item) => item.status === 'SKIPPED').length : 0;

    if (job.status === 'FAILED') {
      toast.error(job.errorMessage || 'Tiến trình AI Matching thất bại');
    } else if (failedCount === 0 && skippedCount === 0) {
      toast.success(`Hoàn tất đánh giá ${doneCount}/${job.total} ứng viên`);
    } else {
      toast.error(`Đã đánh giá ${doneCount}/${job.total} ứng viên; ${failedCount} hồ sơ lỗi, ${skippedCount} bỏ qua/đã hủy`);
    }
  }, []);

  useEffect(() => {
    if (!activeJob || TERMINAL_JOB_STATUSES.has(activeJob.status)) return;
    if (typeof matchingFeatureApi.getJob !== 'function') return;

    let cancelled = false;
    let lastProcessed = activeJob.processed;

    const pollOnce = async () => {
      try {
        const updated = await matchingFeatureApi.getJob(activeJob.id, true);
        if (cancelled || !updated) return;
        setActiveJob(updated);
        if (updated.processed > lastProcessed) {
          lastProcessed = updated.processed;
          void loadLeaderboard(updated.jobDescriptionId);
          void fetchJobs();
        }
        if (TERMINAL_JOB_STATUSES.has(updated.status)) {
          notifyTerminalJob(updated);
          void loadLeaderboard(updated.jobDescriptionId);
          void fetchJobs();
        }
      } catch {
        // Keep polling while server recovers or retry on next tick.
      }
    };

    const timer = setInterval(() => {
      void pollOnce();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeJob, loadLeaderboard, fetchJobs, notifyTerminalJob]);

  const scoredByCandidateId = useMemo(() => {
    const map = new Map<string, number>();
    matchingResults.forEach((m) => {
      map.set(m.candidateId, m.score);
    });
    return map;
  }, [matchingResults]);

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

  const startAsyncJob = useCallback(
    async (jobId: string, candidateIds: string[]) => {
      announcedTerminalJobId.current = null;
      const res = await matchingFeatureApi.createJob(jobId, candidateIds);
      if (!res.success || !res.data) {
        throw new Error(res.message || 'Không thể khởi tạo tiến trình AI Matching');
      }
      setActiveJob(res.data);
      closeConfirmModal();
      if (TERMINAL_JOB_STATUSES.has(res.data.status)) {
        notifyTerminalJob(res.data);
        await loadLeaderboard(jobId);
        void fetchJobs();
      } else {
        toast.success(res.message || `Đã đưa ${res.data.total} ứng viên vào hàng đợi chấm điểm`);
      }
    },
    [closeConfirmModal, fetchJobs, loadLeaderboard, notifyTerminalJob],
  );

  const handleRunMatching = async () => {
    if (isRunning) return;
    if (!isOnline) {
      toast.error('Đang ngoại tuyến: Không thể chấm điểm AI Gemini lúc này. Lựa chọn của bạn đã được lưu.');
      return;
    }
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
      // Refresh before submitting: another page/tab may have deleted a selected CV.
      const freshCandidates = await candidateApi.getAll();
      const validIds = new Set(freshCandidates.filter((candidate) => candidate.extractionStatus !== 'FAILED').map((candidate) => candidate.id));
      const currentIds = useMatchingFeatureStore.getState().selectedCandidateIds;
      const candidateIds = currentIds.filter((id) => validIds.has(id));
      setSelectedCandidateIds(candidateIds);
      useCandidateStore.setState({ candidates: freshCandidates });
      if (candidateIds.length !== currentIds.length) {
        toast.error('Một số CV đã bị xóa hoặc không còn hợp lệ. Vui lòng kiểm tra lại lựa chọn rồi chạy AI.');
        return;
      }
      if (candidateIds.length === 0) {
        toast.error('Không còn CV hợp lệ để chấm điểm.');
        return;
      }

      if (candidateIds.length > 1 && typeof matchingFeatureApi.createJob === 'function') {
        await startAsyncJob(selectedJobId, candidateIds);
        return;
      }

      const res = await matchingFeatureApi.run(selectedJobId, candidateIds);
      if (!res.success) throw new Error(res.message || 'AI Matching thất bại');
      const count = res.data?.length ?? candidateIds.length;
      toast.success(res.message || `Hoàn tất đánh giá ${count} ứng viên`);
      closeConfirmModal();
      await loadLeaderboard(selectedJobId);
      void fetchJobs();
    } catch (error) {
      showMatchingQuotaError(error);
      if (error instanceof Error && !('response' in error)) toast.error(error.message);
    } finally {
      void useSubscriptionStore.getState().refreshBalance();
      setIsRunning(false);
      closeConfirmModal();
    }
  };

  const handleCancelJob = async () => {
    if (!activeJob || isCancellingJob || TERMINAL_JOB_STATUSES.has(activeJob.status)) return;
    setIsCancellingJob(true);
    try {
      const res = await matchingFeatureApi.cancelJob(activeJob.id);
      if (res.data) {
        setActiveJob((prev) => ({ ...(prev ?? {}), ...res.data! }));
        if (TERMINAL_JOB_STATUSES.has(res.data.status)) {
          notifyTerminalJob(res.data);
          void loadLeaderboard(res.data.jobDescriptionId);
        } else {
          toast.success('Đã gửi yêu cầu dừng; các hồ sơ đang chạy dở sẽ hoàn tất');
        }
      }
    } catch {
      // Lỗi hiển thị qua interceptor
    } finally {
      setIsCancellingJob(false);
    }
  };

  const handleRetryFailedItems = async () => {
    if (!activeJob) return;
    const failedIds = (activeJob.items ?? [])
      .filter((item) => item.status === 'FAILED')
      .map((item) => item.candidateId);
    if (failedIds.length === 0) return;

    setIsRunning(true);
    try {
      await startAsyncJob(activeJob.jobDescriptionId, failedIds);
    } catch (error) {
      showMatchingQuotaError(error);
      if (error instanceof Error && !('response' in error)) toast.error(error.message);
    } finally {
      void useSubscriptionStore.getState().refreshBalance();
      setIsRunning(false);
    }
  };

  const dismissActiveJob = () => setActiveJob(null);

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
      if (user?.id) {
        const pinned = await offlineDb.getPinnedCv(user.id, result.candidateId);
        if (pinned?.candidate) {
          setInsightCandidate(pinned.candidate);
        }
      }
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
  };
}
