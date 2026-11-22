ALTER TABLE "job_descriptions"
  ADD COLUMN "preferredSkills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "evaluationConfig" JSONB,
  ADD COLUMN "jdAnalysis" JSONB,
  ADD COLUMN "evaluationVersion" TEXT NOT NULL DEFAULT 'cvtest-1.0',
  ADD COLUMN "analyzedAt" TIMESTAMP(3);

ALTER TABLE "candidates"
  ADD COLUMN "structuredProfile" JSONB,
  ADD COLUMN "profileVersion" TEXT,
  ADD COLUMN "profileAnalyzedAt" TIMESTAMP(3);

ALTER TABLE "match_results"
  ADD COLUMN "matchLevel" TEXT,
  ADD COLUMN "scoreBreakdown" JSONB,
  ADD COLUMN "strengths" JSONB,
  ADD COLUMN "gaps" JSONB,
  ADD COLUMN "requirementsAnalysis" JSONB,
  ADD COLUMN "interviewQuestions" JSONB,
  ADD COLUMN "careerPotential" JSONB,
  ADD COLUMN "confidence" TEXT,
  ADD COLUMN "limitations" JSONB,
  ADD COLUMN "evidence" JSONB,
  ADD COLUMN "evaluationConfig" JSONB,
  ADD COLUMN "evaluationVersion" TEXT NOT NULL DEFAULT 'cvtest-1.0',
  ADD COLUMN "candidateProfileSnapshot" JSONB,
  ADD COLUMN "jdAnalysisSnapshot" JSONB;
