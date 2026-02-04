/*
  Warnings:

  - The values [READ] on the enum `CommStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [HR_ROUND,TECHNICAL_ROUND,MANAGER_ROUND,CLIENT_ROUND,OFFER_RELEASED,OFFER_ACCEPTED,JOINED,DROPPED] on the enum `StageType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `userAgent` on the `activity_logs` table. All the data in the column will be lost.
  - You are about to drop the column `readAt` on the `candidate_communications` table. All the data in the column will be lost.
  - You are about to drop the column `currentCTC` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `currentCompany` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `currentLocation` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `expectedCTC` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `githubUrl` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `linkedinUrl` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `noticePeriod` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `portfolioUrl` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `preferredLocation` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `previousCompany` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `relevantExp` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `resumeFileName` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `resumeUrl` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `skills` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `totalExperience` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `droppedCount` on the `dashboards` table. All the data in the column will be lost.
  - You are about to drop the column `experienceMax` on the `job_descriptions` table. All the data in the column will be lost.
  - You are about to drop the column `experienceMin` on the `job_descriptions` table. All the data in the column will be lost.
  - You are about to drop the column `hiringType` on the `job_descriptions` table. All the data in the column will be lost.
  - You are about to drop the column `preferredSkills` on the `job_descriptions` table. All the data in the column will be lost.
  - You are about to drop the column `requiredSkills` on the `job_descriptions` table. All the data in the column will be lost.
  - Made the column `college` on table `candidates` required. This step will fail if there are existing NULL values in that column.
  - Made the column `degree` on table `candidates` required. This step will fail if there are existing NULL values in that column.
  - Made the column `passOutYear` on table `candidates` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CommStatus_new" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');
ALTER TABLE "public"."candidate_communications" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "candidate_communications" ALTER COLUMN "status" TYPE "CommStatus_new" USING ("status"::text::"CommStatus_new");
ALTER TYPE "CommStatus" RENAME TO "CommStatus_old";
ALTER TYPE "CommStatus_new" RENAME TO "CommStatus";
DROP TYPE "public"."CommStatus_old";
ALTER TABLE "candidate_communications" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "StageType_new" AS ENUM ('APPLIED', 'SHORTLISTED', 'INTERVIEWED', 'SELECTED', 'REJECTED');
ALTER TABLE "stages" ALTER COLUMN "type" TYPE "StageType_new" USING ("type"::text::"StageType_new");
ALTER TYPE "StageType" RENAME TO "StageType_old";
ALTER TYPE "StageType_new" RENAME TO "StageType";
DROP TYPE "public"."StageType_old";
COMMIT;

-- DropIndex
DROP INDEX "job_descriptions_hiringType_idx";

-- AlterTable
ALTER TABLE "activity_logs" DROP COLUMN "userAgent";

-- AlterTable
ALTER TABLE "bulk_uploads" ALTER COLUMN "fileUrl" DROP NOT NULL;

-- AlterTable
ALTER TABLE "candidate_communications" DROP COLUMN "readAt";

-- AlterTable
ALTER TABLE "candidates" DROP COLUMN "currentCTC",
DROP COLUMN "currentCompany",
DROP COLUMN "currentLocation",
DROP COLUMN "expectedCTC",
DROP COLUMN "githubUrl",
DROP COLUMN "linkedinUrl",
DROP COLUMN "noticePeriod",
DROP COLUMN "portfolioUrl",
DROP COLUMN "preferredLocation",
DROP COLUMN "previousCompany",
DROP COLUMN "relevantExp",
DROP COLUMN "resumeFileName",
DROP COLUMN "resumeUrl",
DROP COLUMN "skills",
DROP COLUMN "source",
DROP COLUMN "totalExperience",
ADD COLUMN     "resumeLink" TEXT,
ALTER COLUMN "college" SET NOT NULL,
ALTER COLUMN "degree" SET NOT NULL,
ALTER COLUMN "passOutYear" SET NOT NULL;

-- AlterTable
ALTER TABLE "dashboards" DROP COLUMN "droppedCount";

-- AlterTable
ALTER TABLE "job_descriptions" DROP COLUMN "experienceMax",
DROP COLUMN "experienceMin",
DROP COLUMN "hiringType",
DROP COLUMN "preferredSkills",
DROP COLUMN "requiredSkills";

-- DropEnum
DROP TYPE "CandidateSource";

-- DropEnum
DROP TYPE "HiringType";
