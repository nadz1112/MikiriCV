export interface CandidateListItemRaw {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  yearsOfExperience: number;
  skills: string[];
  education?: string | null;
  fileName: string;
  extractionStatus: string;
  extractionMessage: string | null;
  createdAt: Date;
  matchResults?: Array<{ score: number }>;
  uploadedBy?: { id: string; fullName: string; email: string } | null;
  owner?: { id: string; fullName: string; email: string } | null;
}

export interface CandidateListItemDto {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  yearsOfExperience: number;
  skills: string[];
  education?: string | null;
  fileName: string;
  extractionStatus: string;
  extractionMessage: string | null;
  matchScore: number | null;
  createdAt: string;
  uploadedBy?: { id: string; fullName: string; email: string } | null;
}

export function toCandidateListItemDto(
  candidate: CandidateListItemRaw,
  isAdmin = false,
): CandidateListItemDto {
  return {
    id: candidate.id,
    fullName: candidate.fullName,
    email: candidate.email,
    phone: candidate.phone,
    yearsOfExperience: candidate.yearsOfExperience,
    skills: candidate.skills,
    education: candidate.education ?? null,
    fileName: candidate.fileName,
    extractionStatus: candidate.extractionStatus,
    extractionMessage: candidate.extractionMessage,
    matchScore: candidate.matchResults?.[0]?.score ?? null,
    createdAt: candidate.createdAt.toISOString(),
    uploadedBy: isAdmin ? (candidate.uploadedBy ?? candidate.owner ?? null) : null,
  };
}

export function toCandidateUploadDto(candidate: {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  yearsOfExperience: number;
  skills: string[];
  fileName: string;
  extractionStatus: string;
  extractionMessage: string | null;
  createdAt: Date;
}) {
  return {
    id: candidate.id,
    fullName: candidate.fullName,
    email: candidate.email,
    phone: candidate.phone,
    yearsOfExperience: candidate.yearsOfExperience,
    skills: candidate.skills,
    fileName: candidate.fileName,
    extractionStatus: candidate.extractionStatus,
    extractionMessage: candidate.extractionMessage,
    createdAt: candidate.createdAt,
  };
}
