import { useEffect, useMemo } from 'react';
import { useJobStore } from '../../../store/useJobStore';
import { useJobFeatureStore } from '../store/jobStore';

export function useJobs() {
  const { jobs, isLoading, fetchJobs, updateJob, deleteJob } = useJobStore();
  const { searchQuery } = useJobFeatureStore();

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

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
