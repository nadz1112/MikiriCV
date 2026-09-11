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
  matchResults?: {
    jobDescriptionId: string;
    score: number;
  }[];
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
