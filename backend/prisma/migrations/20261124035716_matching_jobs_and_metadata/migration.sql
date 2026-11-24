-- CreateEnum
CREATE TYPE "MatchingJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "MatchingItemStatus" AS ENUM ('PENDING', 'DONE', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "match_results" ADD COLUMN     "modelName" TEXT,
ADD COLUMN     "promptVersion" TEXT;

-- CreateTable
CREATE TABLE "matching_jobs" (
    "id" TEXT NOT NULL,
    "jobDescriptionId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "companyId" TEXT,
    "planName" TEXT,
    "quotaMonth" DATE,
    "status" "MatchingJobStatus" NOT NULL DEFAULT 'QUEUED',
    "total" INTEGER NOT NULL,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "matching_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matching_job_items" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "status" "MatchingItemStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "matching_job_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "matching_jobs_status_idx" ON "matching_jobs"("status");

-- CreateIndex
CREATE INDEX "matching_jobs_jobDescriptionId_createdAt_idx" ON "matching_jobs"("jobDescriptionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "matching_jobs_ownerId_idx" ON "matching_jobs"("ownerId");

-- CreateIndex
CREATE INDEX "matching_job_items_jobId_status_idx" ON "matching_job_items"("jobId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "matching_job_items_jobId_candidateId_key" ON "matching_job_items"("jobId", "candidateId");

-- AddForeignKey
ALTER TABLE "matching_jobs" ADD CONSTRAINT "matching_jobs_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "job_descriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matching_jobs" ADD CONSTRAINT "matching_jobs_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matching_job_items" ADD CONSTRAINT "matching_job_items_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "matching_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matching_job_items" ADD CONSTRAINT "matching_job_items_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
