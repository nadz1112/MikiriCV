-- CreateTable
CREATE TABLE "job_descriptions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requiredSkills" TEXT[],
    "minExperience" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_descriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "rawText" TEXT NOT NULL,
    "skills" TEXT[],
    "yearsOfExperience" INTEGER NOT NULL DEFAULT 0,
    "education" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_results" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobDescriptionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "matchedSkills" TEXT[],
    "missingSkills" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "match_results_candidateId_jobDescriptionId_key" ON "match_results"("candidateId", "jobDescriptionId");

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "job_descriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
