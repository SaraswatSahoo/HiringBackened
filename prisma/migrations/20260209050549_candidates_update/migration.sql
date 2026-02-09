-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "activeBacklogs" INTEGER DEFAULT 0,
ADD COLUMN     "applicationStatus" TEXT DEFAULT 'PENDING',
ADD COLUMN     "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "country" TEXT DEFAULT 'India',
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "hasJoined" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasWorkExperience" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hrScore" DECIMAL(5,2),
ADD COLUMN     "idProofUrl" TEXT,
ADD COLUMN     "ineligibilityReason" TEXT,
ADD COLUMN     "internships" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "interviewScore" DECIMAL(5,2),
ADD COLUMN     "joiningDate" TIMESTAMP(3),
ADD COLUMN     "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "marksheetUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "offerLetterUrl" TEXT,
ADD COLUMN     "offerStatus" TEXT,
ADD COLUMN     "offeredCTC" DECIMAL(10,2),
ADD COLUMN     "overallRating" DECIMAL(3,2),
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "projects" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "stream" TEXT,
ADD COLUMN     "technicalScore" DECIMAL(5,2),
ADD COLUMN     "yearsOfExperience" DECIMAL(3,1);

-- CreateIndex
CREATE INDEX "candidates_phone_idx" ON "candidates"("phone");

-- CreateIndex
CREATE INDEX "candidates_stream_idx" ON "candidates"("stream");

-- CreateIndex
CREATE INDEX "candidates_applicationStatus_idx" ON "candidates"("applicationStatus");

-- CreateIndex
CREATE INDEX "candidates_offerStatus_idx" ON "candidates"("offerStatus");

-- CreateIndex
CREATE INDEX "candidates_state_idx" ON "candidates"("state");

-- CreateIndex
CREATE INDEX "candidates_hasWorkExperience_idx" ON "candidates"("hasWorkExperience");

-- CreateIndex
CREATE INDEX "candidates_appliedAt_idx" ON "candidates"("appliedAt");

-- CreateIndex
CREATE INDEX "candidates_lastActivityAt_idx" ON "candidates"("lastActivityAt");
