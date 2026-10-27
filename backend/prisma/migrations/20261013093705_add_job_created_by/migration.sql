-- AlterTable
ALTER TABLE "job_descriptions" ADD COLUMN     "createdById" TEXT;

-- CreateIndex
CREATE INDEX "job_descriptions_createdById_idx" ON "job_descriptions"("createdById");

-- AddForeignKey
ALTER TABLE "job_descriptions" ADD CONSTRAINT "job_descriptions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
