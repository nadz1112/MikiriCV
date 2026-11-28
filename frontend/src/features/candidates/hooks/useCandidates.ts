import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { candidateApi, CandidateItem, CandidateQueryParams } from '../api/candidateApi';
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh';
import { useSafeAuth } from '../../auth/useSafeAuth';
import { offlineDb } from '../../../shared/offline/offlineDb';
import { normalizeForSearchClient } from '../../../shared/offline/normalizeVi';
import { isNetworkOfflineError } from '../../../shared/platform/runtime';

function filterCandidatesOffline(items: CandidateItem[], filter: CandidateQueryParams): {
  data: CandidateItem[];
  total: number;
  page: number;
  limit: number;
} {
  let list = [...items];
  if (filter.search?.trim()) {
    const kw = normalizeForSearchClient(filter.search);
    list = list.filter((c) => {
      const hay = normalizeForSearchClient(
        `${c.fullName} ${c.email || ''} ${c.skills.join(' ')} ${c.education || ''}`,
      );
      return hay.includes(kw);
    });
  }
  if (filter.skills && filter.skills.length > 0) {
    const wanted = filter.skills.map((s) => normalizeForSearchClient(s)).filter(Boolean);
    list = list.filter((c) => {
      const cSkills = c.skills.map((s) => normalizeForSearchClient(s));
      return filter.skillMode === 'all'
        ? wanted.every((w) => cSkills.some((cs) => cs === w || cs.includes(w)))
        : wanted.some((w) => cSkills.some((cs) => cs === w || cs.includes(w)));
    });
  }
  if (filter.minExp !== undefined && filter.minExp > 0) {
    list = list.filter((c) => c.yearsOfExperience >= filter.minExp!);
  }
  if (filter.extractionStatus) {
    list = list.filter((c) => c.extractionStatus === filter.extractionStatus);
  }
  if (filter.sort === 'yearsOfExperience') {
    list.sort((a, b) => b.yearsOfExperience - a.yearsOfExperience);
  } else if (filter.sort === 'fullName') {
    list.sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
  } else {
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  const page = Math.max(1, filter.page ?? 1);
  const limit = Math.max(1, filter.limit ?? 50);
  const start = (page - 1) * limit;
  return {
    data: list.slice(start, start + limit),
    total: list.length,
    page,
    limit,
  };
}

export function useCandidates(filter: CandidateQueryParams, autoRefresh = false) {
  const { user } = useSafeAuth();
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
    const onSynced = () => refresh();
    window.addEventListener('offline:synced', onSynced);
    return () => window.removeEventListener('offline:synced', onSynced);
  }, []);

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
          if (user?.id) {
            const isBasePage =
              !filter.search?.trim() &&
              (!filter.skills || filter.skills.length === 0) &&
              !filter.minExp &&
              !filter.extractionStatus &&
              !filter.jobId &&
              (filter.page ?? 1) === 1;
            if (isBasePage) {
              void offlineDb.saveCandidates(user.id, res.data, res.total);
            }
          }
        }
      } catch (err) {
        if (active && !signal.aborted) {
          if (isNetworkOfflineError(err) && user?.id) {
            const cached = await offlineDb.getCandidates(user.id);
            if (cached && active && !signal.aborted) {
              const filtered = filterCandidatesOffline(cached.items, filter);
              setCandidates(filtered.data);
              setTotal(filtered.total);
              setPage(filtered.page);
              setLimit(filtered.limit);
              setError(null);
              return;
            }
          }
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
    user?.id,
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
