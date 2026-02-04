/*
  Warnings:

  - You are about to drop the `candidate_history` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `candidates` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `comments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `communications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dashboard_metrics` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `interviews` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `job_descriptions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `message_templates` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'HR', 'RECRUITER');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('BULK', 'NORMAL');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('APPLIED', 'SHORTLISTED', 'INTERVIEWED', 'SELECTED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "candidate_history" DROP CONSTRAINT "candidate_history_candidateId_fkey";

-- DropForeignKey
ALTER TABLE "candidate_history" DROP CONSTRAINT "candidate_history_changedById_fkey";

-- DropForeignKey
ALTER TABLE "candidates" DROP CONSTRAINT "candidates_jobDescriptionId_fkey";

-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_authorId_fkey";

-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_candidateId_fkey";

-- DropForeignKey
ALTER TABLE "communications" DROP CONSTRAINT "communications_candidateId_fkey";

-- DropForeignKey
ALTER TABLE "interviews" DROP CONSTRAINT "interviews_candidateId_fkey";

-- DropForeignKey
ALTER TABLE "interviews" DROP CONSTRAINT "interviews_interviewerId_fkey";

-- DropForeignKey
ALTER TABLE "job_descriptions" DROP CONSTRAINT "job_descriptions_createdById_fkey";

-- DropForeignKey
ALTER TABLE "message_templates" DROP CONSTRAINT "message_templates_jobDescriptionId_fkey";

-- DropTable
DROP TABLE "candidate_history";

-- DropTable
DROP TABLE "candidates";

-- DropTable
DROP TABLE "comments";

-- DropTable
DROP TABLE "communications";

-- DropTable
DROP TABLE "dashboard_metrics";

-- DropTable
DROP TABLE "interviews";

-- DropTable
DROP TABLE "job_descriptions";

-- DropTable
DROP TABLE "message_templates";

-- DropTable
DROP TABLE "users";

-- DropEnum
DROP TYPE "CandidateStage";

-- DropEnum
DROP TYPE "CommunicationChannel";

-- DropEnum
DROP TYPE "CommunicationStatus";

-- DropEnum
DROP TYPE "EmploymentType";

-- DropEnum
DROP TYPE "HiringType";

-- DropEnum
DROP TYPE "InterviewStatus";

-- DropEnum
DROP TYPE "UserRole";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'HR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "JobType" NOT NULL DEFAULT 'BULK',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minYop" INTEGER,
    "allowedDegrees" TEXT[],
    "hrId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "college" TEXT,
    "degree" TEXT,
    "yop" INTEGER,
    "experience" INTEGER,
    "currentCompany" TEXT,
    "resumeUrl" TEXT,
    "status" "CandidateStatus" NOT NULL DEFAULT 'APPLIED',
    "sourceTag" TEXT,
    "jobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "interviewer" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_email_jobId_key" ON "Candidate"("email", "jobId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_hrId_fkey" FOREIGN KEY ("hrId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
