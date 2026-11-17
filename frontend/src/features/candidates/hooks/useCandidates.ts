import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { candidateApi, CandidateItem, CandidateQueryParams } from '../api/candidateApi';
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh';

export function useCandidates(filter: CandidateQueryParams, autoRefresh = false) {
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(filter.page ?? 1);
  const [limit, setLimit] = useState(filter.limit ?? 50);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = () => setReloadKey((prev) => prev + 1);

  const backgroundLoad = useRef<((signal: AbortSignal) => Promise<void>) | null>(null);
  useAutoRefresh((signal) => backgroundLoad.current?.(signal), autoRefresh);

  useEffect(() => {
    let active = true;
    let running = false;
    const controller = new AbortController();

    async function loadCandidates(background = false, signal = controller.signal) {
      if (running || !active) return;
      running = true;
      if (!background) setIsLoading(true);
      setError(null);
      try {
        const res = await candidateApi.list(filter, signal);
        if (active && !signal.aborted) {
          setCandidates(res.data);
          setTotal(res.total);
          setPage(res.page);
          setLimit(res.limit);
        }
      } catch (err) {
        if (active && !signal.aborted) {
          const msg = (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message || 'Không thể tải danh sách ứng viên';
          setError(msg);
          toast.error(msg);
        }
      } finally {
        running = false;
        if (active && !signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    backgroundLoad.current = (signal) => loadCandidates(true, signal);
    void loadCandidates();

    return () => {
      active = false;
      controller.abort();
      backgroundLoad.current = null;
    };
  }, [
    filter.search,
    filter.enterpriseId,
    filter.skills?.join(','),
    filter.skillMode,
    filter.minExp,
    filter.extractionStatus,
    filter.jobId,
    filter.page,
    filter.limit,
    filter.sort,
    reloadKey,
  ]);

  return {
    candidates,
    total,
    page,
    limit,
    isLoading,
    error,
    refresh,
  };
}
