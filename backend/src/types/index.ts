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
  preferredSkills?: string[];
  evaluationConfig?: Record<string, unknown>;
}

export interface UpdateJobDto {
  title: string;
  description: string;
  requiredSkills: string[];
  minExperience: number;
  preferredSkills?: string[];
  evaluationConfig?: Record<string, unknown>;
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
  matchLevel?: 'strong_match' | 'good_match' | 'partial_match' | 'low_match';
  scoreBreakdown?: CvTestCategoryAssessment[];
  strengths?: string[];
  gapsAndConcerns?: string[];
  requirementsAnalysis?: CvTestRequirementAnalysis[];
  interviewQuestions?: string[];
  careerPotential?: CvTestCareerPotential;
  confidence?: 'high' | 'medium' | 'low';
  limitations?: string[];
  evidence?: CvTestEvidence[];
}

export type CvTestCategory =
  | 'skill_matching'
  | 'experience_relevance'
  | 'project_achievement'
  | 'soft_skills'
  | 'education_certification'
  | 'cv_quality';

export interface CvTestEvidence {
  source: 'CV' | 'JD';
  section: string;
  text: string;
}

export interface CvTestCategoryAssessment {
  category: CvTestCategory;
  score: number;
  maxScore: number;
  reason: string;
  evidence: CvTestEvidence[];
  gaps: string[];
  status: 'not_found' | 'insufficient_evidence' | 'partially_matched' | 'matched' | 'strongly_matched';
  confidence: 'high' | 'medium' | 'low';
}

export interface CvTestRequirementAnalysis {
  requirement: string;
  priority: 'required' | 'preferred';
  status: 'not_found' | 'insufficient_evidence' | 'partially_matched' | 'matched' | 'strongly_matched';
  evidence: CvTestEvidence[];
  gap?: string;
}

export interface CvTestCareerPotential {
  assessment: 'positive_evidence' | 'insufficient_evidence' | 'mixed_evidence';
  reason: string;
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

