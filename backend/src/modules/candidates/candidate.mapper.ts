export interface CandidateSummaryRaw {
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
  uploadedBy?: { id: string; fullName: string; email: string; companyName: string | null } | null;
  owner?: { id: string; fullName: string; email: string; companyName: string | null } | null;
}

export interface CandidateListItemRaw extends CandidateSummaryRaw {
  matchResults?: Array<{ score: number }>;
}

export function toCandidateSummaryDto(candidate: CandidateSummaryRaw) {
  return {
    id: candidate.id, fullName: candidate.fullName, email: candidate.email, phone: candidate.phone,
    education: candidate.education ?? null, yearsOfExperience: candidate.yearsOfExperience,
    skills: candidate.skills, fileName: candidate.fileName, extractionStatus: candidate.extractionStatus,
    extractionMessage: candidate.extractionMessage, createdAt: candidate.createdAt.toISOString(),
  };
}

function toUploaderDto(user: CandidateSummaryRaw['uploadedBy']) {
  return user ? { id: user.id, fullName: user.fullName, email: user.email, companyName: user.companyName } : null;
}

interface CandidateHistoryRaw {
  jobDescriptionId: string; score: number; summary: string; matchedSkills: string[]; missingSkills: string[];
  createdAt: Date; updatedAt: Date | null; jobDescription: { title: string };
}

export function toCandidateDetailDto(candidate: CandidateSummaryRaw & { rawText: string; matchResults: CandidateHistoryRaw[] }) {
  return {
    ...toCandidateSummaryDto(candidate), rawText: candidate.rawText,
    uploadedBy: toUploaderDto(candidate.uploadedBy ?? candidate.owner),
    matchResults: candidate.matchResults.map((match) => ({
      jobDescriptionId: match.jobDescriptionId, jobTitle: match.jobDescription.title,
      score: match.score, summary: match.summary, matchedSkills: match.matchedSkills, missingSkills: match.missingSkills,
      evaluatedAt: (match.updatedAt ?? match.createdAt).toISOString(),
    })),
  };
}

interface MatchResultRaw {
  id: string; candidateId: string; jobDescriptionId: string; score: number; summary: string;
  matchedSkills: string[]; missingSkills: string[]; createdAt: Date;
  matchLevel?: string | null;
  scoreBreakdown?: unknown;
  strengths?: unknown;
  gaps?: unknown;
  requirementsAnalysis?: unknown;
  careerPotential?: unknown;
  confidence?: string | null;
  limitations?: unknown;
  evidence?: unknown;
  candidate?: CandidateSummaryRaw;
  interviewQuestions?: unknown;
  highlights?: string[]; skillAnalysis?: string[]; redFlags?: string[];
}

export function toMatchResultDto(match: MatchResultRaw) {
  return {
    id: match.id, candidateId: match.candidateId, jobDescriptionId: match.jobDescriptionId,
    score: match.score, summary: match.summary, matchedSkills: match.matchedSkills, missingSkills: match.missingSkills,
    highlights: match.highlights ?? [], skillAnalysis: match.skillAnalysis ?? [], redFlags: match.redFlags ?? [],
    createdAt: match.createdAt.toISOString(),
    matchLevel: match.matchLevel ?? undefined,
    scoreBreakdown: match.scoreBreakdown ?? undefined,
    strengths: match.strengths ?? undefined,
    gapsAndConcerns: match.gaps ?? undefined,
    requirementsAnalysis: match.requirementsAnalysis ?? undefined,
    interviewQuestions: match.interviewQuestions ?? undefined,
    careerPotential: match.careerPotential ?? undefined,
    confidence: match.confidence ?? undefined,
    limitations: match.limitations ?? undefined,
    evidence: match.evidence ?? undefined,
    ...(match.candidate ? { candidate: toCandidateSummaryDto(match.candidate) } : {}),
  };
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
  uploadedBy?: { id: string; fullName: string; email: string; companyName: string | null } | null;
}

export function toCandidateListItemDto(
  candidate: CandidateListItemRaw,
  isAdmin = false,
): CandidateListItemDto {
  return {
    ...toCandidateSummaryDto(candidate),
    matchScore: candidate.matchResults?.[0]?.score ?? null,
    uploadedBy: isAdmin ? toUploaderDto(candidate.uploadedBy ?? candidate.owner) : null,
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
  return toCandidateSummaryDto(candidate);
}
