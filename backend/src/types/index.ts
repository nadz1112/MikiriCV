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
  page?: string;
  limit?: string;
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
