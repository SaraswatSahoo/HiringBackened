/*
  Warnings:

  - You are about to drop the `candidate_communications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `communications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `templates` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('BULK', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('INTERVIEW_CALL', 'TEST_LINK', 'REJECTION', 'OFFER', 'SHORTLIST', 'REMINDER', 'FEEDBACK_REQUEST', 'ONBOARDING', 'GENERAL');

-- DropForeignKey
ALTER TABLE "candidate_communications" DROP CONSTRAINT "candidate_communications_candidateId_fkey";

-- DropForeignKey
ALTER TABLE "candidate_communications" DROP CONSTRAINT "candidate_communications_communicationId_fkey";

-- DropForeignKey
ALTER TABLE "communications" DROP CONSTRAINT "communications_jdId_fkey";

-- DropForeignKey
ALTER TABLE "communications" DROP CONSTRAINT "communications_templateId_fkey";

-- DropTable
DROP TABLE "candidate_communications";

-- DropTable
DROP TABLE "communications";

-- DropTable
DROP TABLE "templates";

-- DropEnum
DROP TYPE "CommChannel";

-- DropEnum
DROP TYPE "CommStatus";

-- CreateTable
CREATE TABLE "emails" (
    "id" TEXT NOT NULL,
    "jdId" TEXT NOT NULL,
    "type" "EmailType" NOT NULL DEFAULT 'BULK',
    "templateId" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "htmlBody" TEXT,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "variables" JSONB,
    "filters" JSONB,
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "bouncedCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "sentBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_emails" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "personalizedSubject" TEXT NOT NULL,
    "personalizedMessage" TEXT NOT NULL,
    "personalizedHtmlBody" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "smtpResponse" TEXT,
    "messageId" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "TemplateCategory" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "htmlBody" TEXT,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultValues" JSONB,
    "previewData" JSONB,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "emails_jdId_idx" ON "emails"("jdId");

-- CreateIndex
CREATE INDEX "emails_type_idx" ON "emails"("type");

-- CreateIndex
CREATE INDEX "emails_sentBy_idx" ON "emails"("sentBy");

-- CreateIndex
CREATE INDEX "emails_scheduledAt_idx" ON "emails"("scheduledAt");

-- CreateIndex
CREATE INDEX "emails_createdAt_idx" ON "emails"("createdAt");

-- CreateIndex
CREATE INDEX "candidate_emails_emailId_idx" ON "candidate_emails"("emailId");

-- CreateIndex
CREATE INDEX "candidate_emails_candidateId_idx" ON "candidate_emails"("candidateId");

-- CreateIndex
CREATE INDEX "candidate_emails_status_idx" ON "candidate_emails"("status");

-- CreateIndex
CREATE INDEX "candidate_emails_sentAt_idx" ON "candidate_emails"("sentAt");

-- CreateIndex
CREATE INDEX "candidate_emails_recipientEmail_idx" ON "candidate_emails"("recipientEmail");

-- CreateIndex
CREATE INDEX "email_templates_category_idx" ON "email_templates"("category");

-- CreateIndex
CREATE INDEX "email_templates_isActive_idx" ON "email_templates"("isActive");

-- CreateIndex
CREATE INDEX "email_templates_createdBy_idx" ON "email_templates"("createdBy");

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_jdId_fkey" FOREIGN KEY ("jdId") REFERENCES "job_descriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_sentBy_fkey" FOREIGN KEY ("sentBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_emails" ADD CONSTRAINT "candidate_emails_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_emails" ADD CONSTRAINT "candidate_emails_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
