-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "address" TEXT,
ADD COLUMN     "backlogs" INTEGER DEFAULT 0,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "tenthPercentage" DECIMAL(5,2),
ADD COLUMN     "twelfthPercentage" DECIMAL(5,2),
ALTER COLUMN "cgpa" SET DATA TYPE DECIMAL(4,2);

-- AlterTable
ALTER TABLE "job_descriptions" ADD COLUMN     "eligibleStreams" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "employmentType" TEXT,
ADD COLUMN     "experienceLevel" TEXT,
ADD COLUMN     "responsibilities" TEXT,
ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "workMode" TEXT,
ALTER COLUMN "status" SET DEFAULT 'DRAFT',
ALTER COLUMN "eligibleDegrees" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "eligibleYears" SET DEFAULT ARRAY[]::INTEGER[],
ALTER COLUMN "minCGPA" SET DATA TYPE DECIMAL(4,2);

-- CreateIndex
CREATE INDEX "bulk_uploads_uploadedBy_idx" ON "bulk_uploads"("uploadedBy");

-- CreateIndex
CREATE INDEX "bulk_uploads_createdAt_idx" ON "bulk_uploads"("createdAt");

-- CreateIndex
CREATE INDEX "candidates_degree_idx" ON "candidates"("degree");

-- CreateIndex
CREATE INDEX "candidates_branch_idx" ON "candidates"("branch");

-- CreateIndex
CREATE INDEX "candidates_cgpa_idx" ON "candidates"("cgpa");

-- CreateIndex
CREATE INDEX "candidates_createdAt_idx" ON "candidates"("createdAt");

-- CreateIndex
CREATE INDEX "candidates_city_idx" ON "candidates"("city");

-- CreateIndex
CREATE INDEX "college_performance_collegeName_idx" ON "college_performance"("collegeName");

-- CreateIndex
CREATE INDEX "college_performance_totalSelected_idx" ON "college_performance"("totalSelected");
