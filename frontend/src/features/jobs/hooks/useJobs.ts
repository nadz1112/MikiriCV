import { useEffect, useMemo } from 'react';
import { useJobStore } from '../../../store/useJobStore';
import { useJobFeatureStore } from '../store/jobStore';
import { useAuthStore } from '../../auth/authStore';
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh';

export function useJobs() {
  const isAdmin = useAuthStore((state) => state.user?.role === 'ADMIN');
  const { jobs, isLoading, fetchJobs, updateJob, deleteJob } = useJobStore();
  const { searchQuery } = useJobFeatureStore();

  useEffect(() => {
    const controller = new AbortController();
    void fetchJobs({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchJobs]);
  useAutoRefresh((signal) => fetchJobs({ background: true, signal }), isAdmin && !isLoading);
  useEffect(() => {
    if (!isAdmin) return;
    useJobFeatureStore.setState((state) => ({
      detailJob: state.detailJob ? jobs.find((job) => job.id === state.detailJob?.id) ?? null : null,
      deletingJob: state.deletingJob ? jobs.find((job) => job.id === state.deletingJob?.id) ?? null : null,
    }));
  }, [jobs, isAdmin]);

  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(q) ||
        job.description.toLowerCase().includes(q) ||
        job.requiredSkills.some((s) => s.toLowerCase().includes(q)),
    );
  }, [jobs, searchQuery]);

  return {
    jobs,
    filteredJobs,
    isLoading,
    fetchJobs,
    updateJob,
    deleteJob,
  };
}
