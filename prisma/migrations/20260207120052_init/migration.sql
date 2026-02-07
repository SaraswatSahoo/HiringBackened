-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'HR', 'RECRUITER');

-- CreateEnum
CREATE TYPE "JDStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED', 'DRAFT');

-- CreateEnum
CREATE TYPE "StageType" AS ENUM ('APPLIED', 'SHORTLISTED', 'INTERVIEWED', 'SELECTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CommChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'SMS');

-- CreateEnum
CREATE TYPE "CommStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'RECRUITER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_descriptions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "status" "JDStatus" NOT NULL DEFAULT 'ACTIVE',
    "location" TEXT,
    "salaryMin" DECIMAL(10,2),
    "salaryMax" DECIMAL(10,2),
    "openings" INTEGER NOT NULL DEFAULT 1,
    "eligibleDegrees" TEXT[],
    "eligibleYears" INTEGER[],
    "minCGPA" DECIMAL(3,2),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_descriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "college" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "branch" TEXT,
    "passOutYear" INTEGER NOT NULL,
    "cgpa" DECIMAL(3,2),
    "resumeLink" TEXT,
    "isEligible" BOOLEAN NOT NULL DEFAULT false,
    "currentStageId" TEXT,
    "jdId" TEXT NOT NULL,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "StageType" NOT NULL,
    "order" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "jdId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_stages" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" TIMESTAMP(3),
    "notes" TEXT,
    "interviewDate" TIMESTAMP(3),
    "interviewMode" TEXT,
    "interviewerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedbacks" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "givenById" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comments" TEXT NOT NULL,
    "technicalSkills" INTEGER,
    "communication" INTEGER,
    "cultureFit" INTEGER,
    "problemSolving" INTEGER,
    "recommendation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications" (
    "id" TEXT NOT NULL,
    "jdId" TEXT NOT NULL,
    "channel" "CommChannel" NOT NULL,
    "templateId" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_communications" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "status" "CommStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failureReason" TEXT,

    CONSTRAINT "candidate_communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "CommChannel" NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variables" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_uploads" (
    "id" TEXT NOT NULL,
    "jdId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "status" "UploadStatus" NOT NULL DEFAULT 'PROCESSING',
    "errorLog" JSONB,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboards" (
    "id" TEXT NOT NULL,
    "jdId" TEXT NOT NULL,
    "totalCandidates" INTEGER NOT NULL DEFAULT 0,
    "eligibleCount" INTEGER NOT NULL DEFAULT 0,
    "shortlistedCount" INTEGER NOT NULL DEFAULT 0,
    "interviewedCount" INTEGER NOT NULL DEFAULT 0,
    "selectedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "avgTimeToHire" INTEGER,
    "avgRating" DECIMAL(3,2),
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "college_performance" (
    "id" TEXT NOT NULL,
    "jdId" TEXT NOT NULL,
    "collegeName" TEXT NOT NULL,
    "totalApplied" INTEGER NOT NULL DEFAULT 0,
    "totalEligible" INTEGER NOT NULL DEFAULT 0,
    "totalShortlisted" INTEGER NOT NULL DEFAULT 0,
    "totalSelected" INTEGER NOT NULL DEFAULT 0,
    "avgCGPA" DECIMAL(3,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "college_performance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "job_descriptions_status_idx" ON "job_descriptions"("status");

-- CreateIndex
CREATE INDEX "job_descriptions_createdById_idx" ON "job_descriptions"("createdById");

-- CreateIndex
CREATE INDEX "candidates_jdId_idx" ON "candidates"("jdId");

-- CreateIndex
CREATE INDEX "candidates_email_idx" ON "candidates"("email");

-- CreateIndex
CREATE INDEX "candidates_college_idx" ON "candidates"("college");

-- CreateIndex
CREATE INDEX "candidates_currentStageId_idx" ON "candidates"("currentStageId");

-- CreateIndex
CREATE INDEX "candidates_isEligible_idx" ON "candidates"("isEligible");

-- CreateIndex
CREATE INDEX "candidates_passOutYear_idx" ON "candidates"("passOutYear");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_email_jdId_key" ON "candidates"("email", "jdId");

-- CreateIndex
CREATE INDEX "stages_jdId_idx" ON "stages"("jdId");

-- CreateIndex
CREATE UNIQUE INDEX "stages_jdId_order_key" ON "stages"("jdId", "order");

-- CreateIndex
CREATE INDEX "candidate_stages_candidateId_idx" ON "candidate_stages"("candidateId");

-- CreateIndex
CREATE INDEX "candidate_stages_stageId_idx" ON "candidate_stages"("stageId");

-- CreateIndex
CREATE INDEX "feedbacks_candidateId_idx" ON "feedbacks"("candidateId");

-- CreateIndex
CREATE INDEX "feedbacks_givenById_idx" ON "feedbacks"("givenById");

-- CreateIndex
CREATE INDEX "communications_jdId_idx" ON "communications"("jdId");

-- CreateIndex
CREATE INDEX "communications_channel_idx" ON "communications"("channel");

-- CreateIndex
CREATE INDEX "candidate_communications_communicationId_idx" ON "candidate_communications"("communicationId");

-- CreateIndex
CREATE INDEX "candidate_communications_candidateId_idx" ON "candidate_communications"("candidateId");

-- CreateIndex
CREATE INDEX "candidate_communications_status_idx" ON "candidate_communications"("status");

-- CreateIndex
CREATE INDEX "templates_category_idx" ON "templates"("category");

-- CreateIndex
CREATE INDEX "templates_channel_idx" ON "templates"("channel");

-- CreateIndex
CREATE INDEX "bulk_uploads_jdId_idx" ON "bulk_uploads"("jdId");

-- CreateIndex
CREATE INDEX "bulk_uploads_status_idx" ON "bulk_uploads"("status");

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_action_idx" ON "activity_logs"("action");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "dashboards_jdId_key" ON "dashboards"("jdId");

-- CreateIndex
CREATE INDEX "dashboards_jdId_idx" ON "dashboards"("jdId");

-- CreateIndex
CREATE INDEX "college_performance_jdId_idx" ON "college_performance"("jdId");

-- CreateIndex
CREATE UNIQUE INDEX "college_performance_jdId_collegeName_key" ON "college_performance"("jdId", "collegeName");

-- AddForeignKey
ALTER TABLE "job_descriptions" ADD CONSTRAINT "job_descriptions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_jdId_fkey" FOREIGN KEY ("jdId") REFERENCES "job_descriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_jdId_fkey" FOREIGN KEY ("jdId") REFERENCES "job_descriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_stages" ADD CONSTRAINT "candidate_stages_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_stages" ADD CONSTRAINT "candidate_stages_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_givenById_fkey" FOREIGN KEY ("givenById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_jdId_fkey" FOREIGN KEY ("jdId") REFERENCES "job_descriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_communications" ADD CONSTRAINT "candidate_communications_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "communications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_communications" ADD CONSTRAINT "candidate_communications_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_jdId_fkey" FOREIGN KEY ("jdId") REFERENCES "job_descriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
