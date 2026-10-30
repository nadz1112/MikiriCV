export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
}

export interface CreateJobDto {
  title: string;
  description: string;
  requiredSkills: string[];
  minExperience?: number;
}

export interface UpdateJobDto {
  title?: string;
  description?: string;
  requiredSkills?: string[];
  minExperience?: number;
}

export interface CandidateFilterQuery {
  search?: string;
  skills?: string;
  minExp?: string;
}

export interface RunMatchingDto {
  jobDescriptionId: string;
  candidateIds: string[];
}

export interface AiMatchingResult {
  score: number;
  summary: string;
  matchedSkills: string[];
  missingSkills: string[];
}

export interface ExtractedCandidateInfo {
  fullName: string;
  email: string | null;
  phone: string | null;
  yearsOfExperience: number;
  skills: string[];
  education: string | null;
  rawText: string;
}

export interface JobScoreDistribution {
  range: string;
  label: string;
  count: number;
  percentage: number;
}

export interface JobStats {
  jobId: string;
  jobTitle: string;
  totalEvaluated: number;
  qualifiedCount: number;
  qualifiedRate: number;
  avgScore: number;
  topScore: number;
  lowestScore: number;
  distribution: {
    under50: number;
    range50to70: number;
    range71to85: number;
    over85: number;
  };
  buckets: JobScoreDistribution[];
}

export interface DashboardStats {
  totalJobs: number;
  totalCandidates: number;
  totalMatches: number;
  qualifiedMatches: number;
  qualifiedRate: number;
  avgScore: number;
  recentEvaluations?: Array<{
    id: string;
    candidateName: string;
    jobTitle: string;
    score: number;
    createdAt: Date;
  }>;
}

