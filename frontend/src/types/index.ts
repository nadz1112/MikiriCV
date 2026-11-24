export type CvTestCategory =
  | 'skill_matching'
  | 'experience_relevance'
  | 'project_achievement'
  | 'soft_skills'
  | 'education_certification'
  | 'cv_quality';

export type CvTestWeights = Record<CvTestCategory, number>;

export interface CvTestEvaluationConfig {
  weights?: CvTestWeights;
}

export interface CvTestEvidence {
  source: 'CV' | 'JD';
  section: string;
  text: string;
}

export interface CvTestRequirementAnalysis {
  requirement: string;
  priority: 'required' | 'preferred';
  status: 'not_found' | 'insufficient_evidence' | 'partially_matched' | 'matched' | 'strongly_matched';
  evidence: CvTestEvidence[];
  gap?: string;
}

export interface JobDescription {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  minExperience: number;
  preferredSkills?: string[];
  evaluationConfig?: CvTestEvaluationConfig;
  createdAt: string;
  updatedAt: string;
  createdById?: string | null;
  createdBy?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
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
  rawText?: string;
  skills: string[];
  yearsOfExperience: number;
  education: string | null;
  fileName: string;
  fileUrl?: string;
  createdAt: string;
  extractionStatus?: 'SUCCESS' | 'WARNING' | 'FAILED';
  extractionMessage?: string | null;
  uploadedBy?: { id: string; fullName: string; email: string; companyName?: string | null } | null;
  matchResults?: {
    jobDescriptionId: string;
    score: number;
    jobTitle?: string;
    summary?: string;
    matchedSkills?: string[];
    missingSkills?: string[];
    evaluatedAt?: string;
  }[];
}

export interface CandidatePage { data: Candidate[]; total: number; page: number; limit: number }

export interface MatchResult {
  id: string;
  candidateId: string;
  jobDescriptionId: string;
  score: number;
  summary: string;
  matchedSkills: string[];
  missingSkills: string[];
  createdAt: string;
  matchLevel?: 'strong_match' | 'good_match' | 'partial_match' | 'low_match';
  scoreBreakdown?: Array<{
    category: 'skill_matching' | 'experience_relevance' | 'project_achievement' | 'soft_skills' | 'education_certification' | 'cv_quality';
    score: number;
    maxScore: number;
    reason: string;
    evidence: Array<{ source: 'CV' | 'JD'; section: string; text: string }>;
    gaps: string[];
    status: 'not_found' | 'insufficient_evidence' | 'partially_matched' | 'matched' | 'strongly_matched';
    confidence: 'high' | 'medium' | 'low';
  }>;
  strengths?: string[];
  gapsAndConcerns?: string[];
  requirementsAnalysis?: CvTestRequirementAnalysis[];
  interviewQuestions?: string[];
  careerPotential?: { assessment: 'positive_evidence' | 'insufficient_evidence' | 'mixed_evidence'; reason: string };
  confidence?: 'high' | 'medium' | 'low';
  limitations?: string[];
  evidence?: CvTestEvidence[];
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

