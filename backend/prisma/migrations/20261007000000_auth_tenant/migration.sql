CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ENTERPRISE');

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "companyName" TEXT,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Existing MVP data belongs to a disabled system admin record. Active admins can inspect it;
-- no enterprise account is silently granted access to legacy CV/JD records.
INSERT INTO "users" ("id", "email", "passwordHash", "fullName", "role", "isActive", "updatedAt")
VALUES ('legacy-system-owner', 'legacy-owner@system.invalid', '!disabled-no-login!', 'Dữ liệu hệ thống cũ', 'ADMIN', false, CURRENT_TIMESTAMP);

ALTER TABLE "job_descriptions" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "candidates" ADD COLUMN "ownerId" TEXT;
UPDATE "job_descriptions" SET "ownerId" = 'legacy-system-owner';
UPDATE "candidates" SET "ownerId" = 'legacy-system-owner';
ALTER TABLE "job_descriptions" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "candidates" ALTER COLUMN "ownerId" SET NOT NULL;
CREATE INDEX "job_descriptions_ownerId_idx" ON "job_descriptions"("ownerId");
CREATE INDEX "candidates_ownerId_idx" ON "candidates"("ownerId");
ALTER TABLE "job_descriptions" ADD CONSTRAINT "job_descriptions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
