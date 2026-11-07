import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { candidateApi, CandidateItem, CandidateQueryParams } from '../api/candidateApi';

export function useCandidates(filter: CandidateQueryParams) {
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(filter.page ?? 1);
  const [limit, setLimit] = useState(filter.limit ?? 50);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = () => setReloadKey((prev) => prev + 1);

  const filterRef = useRef(filter);
  filterRef.current = filter;

  useEffect(() => {
    let active = true;

    async function loadCandidates() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await candidateApi.list(filter);
        if (active) {
          setCandidates(res.data);
          setTotal(res.total);
          setPage(res.page);
          setLimit(res.limit);
        }
      } catch (err: any) {
        if (active) {
          const msg = err.response?.data?.error?.message || 'Không thể tải danh sách ứng viên';
          setError(msg);
          toast.error(msg);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadCandidates();

    return () => {
      active = false;
    };
  }, [
    filter.search,
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
