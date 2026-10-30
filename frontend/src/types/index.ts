export interface JobDescription {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  minExperience: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    matchResults: number;
  };
  matchResults?: MatchResult[];
}

export interface Candidate {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  rawText: string;
  skills: string[];
  yearsOfExperience: number;
  education: string | null;
  fileName: string;
  fileUrl: string;
  createdAt: string;
  matchResults?: MatchResult[];
}

export interface MatchResult {
  id: string;
  candidateId: string;
  jobDescriptionId: string;
  score: number;
  summary: string;
  matchedSkills: string[];
  missingSkills: string[];
  createdAt: string;
  candidate?: Candidate;
  jobDescription?: JobDescription;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
}

export interface CandidateFilter {
  search?: string;
  skills?: string;
  minExp?: string;
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
    createdAt: string;
  }>;
}

