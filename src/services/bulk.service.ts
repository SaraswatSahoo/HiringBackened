// src/services/bulk.service.ts
import prisma from '../prisma/client';
import logger from '../utils/logger';
import csvParser from '../utils/csvParser';
import { JobDescription, Prisma } from '@prisma/client';
import { CSVRow, BulkUploadError } from '../types/api';

class BulkService {
  async processBulkUpload(
    uploadId: string, 
    fileBuffer: Buffer, 
    jd: JobDescription
  ): Promise<void> {
    try {
      const rows = await csvParser.parse(fileBuffer);
      
      const totalRows = rows.length;
      let successCount = 0;
      let failureCount = 0;
      const errorLog: BulkUploadError[] = [];
      
      const firstStage = await prisma.stage.findFirst({
        where: { jdId: jd.id, order: 1 },
      });
      
      if (!firstStage) {
        throw new Error('No stages configured for this JD');
      }
      
      // Reduce batch size to prevent transaction timeouts
      const BATCH_SIZE = 10; // Changed from 100 to 10
      
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        
        const results = await Promise.allSettled(
          batch.map((row, index) => this.processRow(row, jd, firstStage, i + index))
        );
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            successCount++;
          } else {
            failureCount++;
            errorLog.push({
              row: i + index + 2,
              error: result.reason.message,
              data: batch[index],
            });
          }
        });
        
        // Update progress after each batch
        await prisma.bulkUpload.update({
          where: { id: uploadId },
          data: {
            successCount,
            failureCount,
            processedRows: successCount + failureCount,
          },
        });
        
        // Add small delay between batches to reduce database load
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Final update
      await prisma.bulkUpload.update({
        where: { id: uploadId },
        data: {
          totalRows,
          successCount,
          failureCount,
          processedRows: totalRows,
          status: failureCount === 0 ? 'COMPLETED' : failureCount === totalRows ? 'FAILED' : 'PARTIAL',
          errorLog: errorLog.length > 0 
            ? (errorLog as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          completedAt: new Date(),
        },
      });
      
      logger.info(`Bulk upload ${uploadId} completed: ${successCount}/${totalRows} successful`);
      
      // Update dashboard stats
      await this.updateDashboardStats(jd.id);
      
    } catch (error: any) {
      logger.error(`Bulk upload ${uploadId} failed:`, error);
      
      await prisma.bulkUpload.update({
        where: { id: uploadId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          errorLog: [{ error: error.message }] as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
    }
  }
  
  async processRow(
    row: CSVRow, 
    jd: JobDescription, 
    firstStage: any, 
    _rowIndex: number
  ): Promise<any> {
    // Validate required fields
    if (!row.name || !row.email || !row.phone || !row.college || !row.degree || !row.passoutyear) {
      throw new Error('Missing required fields: name, email, phone, college, degree, or passoutyear');
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(row.email)) {
      throw new Error('Invalid email format');
    }
    
    // Validate and clean phone number
    const phoneStr = row.phone.toString().replace(/\D/g, '');
    if (phoneStr.length < 10) {
      throw new Error('Invalid phone number (minimum 10 digits)');
    }
    
    // Parse numeric fields
    const passOutYear = parseInt(row.passoutyear.toString(), 10);
    if (isNaN(passOutYear) || passOutYear < 2020 || passOutYear > 2035) {
      throw new Error('Invalid pass out year (must be between 2020-2035)');
    }
    
    // Parse CGPA
    const cgpa = row.cgpa ? parseFloat(row.cgpa.toString()) : undefined;
    if (cgpa !== undefined && (isNaN(cgpa) || cgpa < 0 || cgpa > 10)) {
      throw new Error('Invalid CGPA (must be between 0-10)');
    }
    
    // Parse percentages
    const tenthPercentage = row.tenthpercentage ? parseFloat(row.tenthpercentage.toString()) : undefined;
    const twelfthPercentage = row.twelfthpercentage ? parseFloat(row.twelfthpercentage.toString()) : undefined;
    
    if (tenthPercentage !== undefined && (tenthPercentage < 0 || tenthPercentage > 100)) {
      throw new Error('Invalid 10th percentage (must be between 0-100)');
    }
    if (twelfthPercentage !== undefined && (twelfthPercentage < 0 || twelfthPercentage > 100)) {
      throw new Error('Invalid 12th percentage (must be between 0-100)');
    }
    
    // Parse backlogs
    const backlogs = row.backlogs ? parseInt(row.backlogs.toString(), 10) : undefined;
    const activeBacklogs = row.activebacklogs ? parseInt(row.activebacklogs.toString(), 10) : undefined;
    
    // Build candidate data object
    const candidateData: any = {
      // Basic Information
      name: row.name.trim(),
      email: row.email.toLowerCase().trim(),
      phone: phoneStr,
      alternatePhone: row.alternatephone ? row.alternatephone.toString().replace(/\D/g, '') : undefined,
      dateOfBirth: row.dateofbirth ? new Date(row.dateofbirth.toString()) : undefined,
      gender: row.gender?.trim(),
      
      // College/Academic Information
      college: row.college.trim(),
      degree: row.degree.trim(),
      branch: row.branch?.trim(),
      stream: row.stream?.trim(),
      passOutYear,
      cgpa: cgpa !== undefined ? new Prisma.Decimal(cgpa) : undefined,
      backlogs: backlogs,
      activeBacklogs: activeBacklogs,
      tenthPercentage: tenthPercentage !== undefined ? new Prisma.Decimal(tenthPercentage) : undefined,
      twelfthPercentage: twelfthPercentage !== undefined ? new Prisma.Decimal(twelfthPercentage) : undefined,
      
      // Documents
      resumeLink: row.resumelink?.trim(),
      photoUrl: row.photourl?.trim(),
      idProofUrl: row.idproofurl?.trim(),
      
      // Location
      address: row.address?.trim(),
      city: row.city?.trim(),
      state: row.state?.trim(),
      pincode: row.pincode?.trim(),
      country: row.country?.trim() || 'India',
      
      // Skills & Experience (parse comma-separated strings)
      skills: row.skills ? row.skills.toString().split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      certifications: row.certifications ? row.certifications.toString().split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      projects: row.projects ? row.projects.toString().split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      internships: row.internships ? row.internships.toString().split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      hasWorkExperience: row.hasworkexperience ? row.hasworkexperience.toString().toLowerCase() === 'true' : false,
      yearsOfExperience: row.yearsofexperience ? new Prisma.Decimal(parseFloat(row.yearsofexperience.toString())) : undefined,
      
      // Application Status
      applicationStatus: 'PENDING',
      
      // JD Reference
      jdId: jd.id,
      currentStageId: firstStage.id,
      
      // Timestamps
      appliedAt: new Date(),
      lastActivityAt: new Date(),
    };
    
    // Generate tags
    candidateData.tags = [
      `college_${candidateData.college.toLowerCase().replace(/\s+/g, '_')}`,
      `degree_${candidateData.degree.toLowerCase().replace(/\s+/g, '_')}`,
      `year_${candidateData.passOutYear}`,
    ];
    
    if (candidateData.branch) {
      candidateData.tags.push(`branch_${candidateData.branch.toLowerCase().replace(/\s+/g, '_')}`);
    }
    
    // Check eligibility based on JD criteria
    let isEligible = true;
    let ineligibilityReason = '';
    
    // Check degree eligibility
    if (jd.eligibleDegrees.length > 0 && !jd.eligibleDegrees.includes(candidateData.degree)) {
      isEligible = false;
      ineligibilityReason += `Degree '${candidateData.degree}' not eligible. `;
    }
    
    // Check stream eligibility
    if (jd.eligibleStreams.length > 0 && candidateData.stream && !jd.eligibleStreams.includes(candidateData.stream)) {
      isEligible = false;
      ineligibilityReason += `Stream '${candidateData.stream}' not eligible. `;
    }
    
    // Check year eligibility
    if (jd.eligibleYears.length > 0 && !jd.eligibleYears.includes(candidateData.passOutYear)) {
      isEligible = false;
      ineligibilityReason += `Pass out year ${candidateData.passOutYear} not eligible. `;
    }
    
    // Check CGPA eligibility
    if (jd.minCGPA && cgpa) {
      const minCGPA = parseFloat(jd.minCGPA.toString());
      if (cgpa < minCGPA) {
        isEligible = false;
        ineligibilityReason += `CGPA ${cgpa} below minimum (${minCGPA}). `;
      }
    }
    
    candidateData.isEligible = isEligible;
    candidateData.ineligibilityReason = ineligibilityReason.trim() || undefined;
    
    // Check for duplicate BEFORE transaction (faster)
    const existingCandidate = await prisma.candidate.findFirst({
      where: {
        email: candidateData.email,
        jdId: jd.id,
      },
    });
    
    if (existingCandidate) {
      throw new Error(`Duplicate email: ${candidateData.email}`);
    }
    
    // Create candidate and stage history in transaction with increased timeout
    return await prisma.$transaction(
      async (tx) => {
        // Create candidate
        const candidate = await tx.candidate.create({
          data: candidateData,
        });
        
        // Create initial stage history
        await tx.candidateStage.create({
          data: {
            candidateId: candidate.id,
            stageId: firstStage.id,
            notes: 'Bulk upload',
          },
        });
        
        return candidate;
      },
      {
        maxWait: 10000,  // Wait up to 10 seconds for a transaction slot
        timeout: 20000,  // Transaction must complete within 20 seconds
      }
    );
  }
  
  async updateDashboardStats(jdId: string): Promise<void> {
    const [
      total, 
      eligible, 
      shortlisted, 
      interviewed, 
      selected, 
      rejected
    ] = await Promise.all([
      prisma.candidate.count({ where: { jdId } }),
      prisma.candidate.count({ where: { jdId, isEligible: true } }),
      prisma.candidate.count({
        where: { 
          jdId, 
          currentStage: { type: 'SHORTLISTED' } 
        },
      }),
      prisma.candidate.count({
        where: { 
          jdId, 
          currentStage: { type: 'INTERVIEWED' } 
        },
      }),
      prisma.candidate.count({
        where: { 
          jdId, 
          currentStage: { type: 'SELECTED' } 
        },
      }),
      prisma.candidate.count({
        where: { 
          jdId, 
          currentStage: { type: 'REJECTED' } 
        },
      }),
    ]);
    
    // Calculate average rating if feedbacks exist
    const feedbacks = await prisma.feedback.findMany({
      where: {
        candidate: { jdId },
      },
      select: {
        rating: true,
      },
    });
    
    const avgRating = feedbacks.length > 0
      ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length
      : undefined;
    
    await prisma.dashboard.upsert({
      where: { jdId },
      create: {
        jdId,
        totalCandidates: total,
        eligibleCount: eligible,
        shortlistedCount: shortlisted,
        interviewedCount: interviewed,
        selectedCount: selected,
        rejectedCount: rejected,
        avgRating: avgRating ? new Prisma.Decimal(avgRating) : undefined,
      },
      update: {
        totalCandidates: total,
        eligibleCount: eligible,
        shortlistedCount: shortlisted,
        interviewedCount: interviewed,
        selectedCount: selected,
        rejectedCount: rejected,
        avgRating: avgRating ? new Prisma.Decimal(avgRating) : undefined,
        lastUpdated: new Date(),
      },
    });
    
    logger.info(`Dashboard stats updated for JD: ${jdId}`);
  }
  
  /**
   * Validate CSV data without uploading
   */
  async validateCSVData(rows: CSVRow[], jd: JobDescription): Promise<{
    validRows: number;
    invalidRows: number;
    errors: BulkUploadError[];
  }> {
    const errors: BulkUploadError[] = [];
    let validRows = 0;
    
    rows.forEach((row, index) => {
      try {
        // Check required fields
        if (!row.name || !row.email || !row.phone || !row.college || !row.degree || !row.passoutyear) {
          throw new Error('Missing required fields');
        }
        
        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(row.email)) {
          throw new Error('Invalid email format');
        }
        
        // Validate phone
        const phoneStr = row.phone.toString().replace(/\D/g, '');
        if (phoneStr.length < 10) {
          throw new Error('Invalid phone number');
        }
        
        // Validate pass out year
        const passOutYear = parseInt(row.passoutyear.toString(), 10);
        if (isNaN(passOutYear) || passOutYear < 2020 || passOutYear > 2035) {
          throw new Error('Invalid pass out year');
        }
        
        // Validate CGPA if present
        if (row.cgpa) {
          const cgpa = parseFloat(row.cgpa.toString());
          if (isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
            throw new Error('Invalid CGPA (must be between 0-10)');
          }
        }
        
        validRows++;
      } catch (error: any) {
        errors.push({
          row: index + 2,
          error: error.message,
          data: row,
        });
      }
    });
    
    return {
      validRows,
      invalidRows: errors.length,
      errors,
    };
  }
  
  /**
   * Re-process failed/partial uploads
   */
  async retryUpload(uploadId: string): Promise<void> {
    const upload = await prisma.bulkUpload.findUnique({
      where: { id: uploadId },
      include: { jd: true },
    });
    
    if (!upload) {
      throw new Error('Upload not found');
    }
    
    if (upload.status !== 'FAILED' && upload.status !== 'PARTIAL') {
      throw new Error('Only failed or partial uploads can be retried');
    }
    
    // Extract failed rows from error log
    const errorLog = upload.errorLog as any[];
    if (!errorLog || errorLog.length === 0) {
      throw new Error('No error log found for retry');
    }
    
    const failedRows = errorLog.map((err: any) => err.data as CSVRow);
    
    // Update retry count and reset status
    await prisma.bulkUpload.update({
      where: { id: uploadId },
      data: {
        status: 'PROCESSING',
        errorLog: Prisma.JsonNull,
        retryCount: upload.retryCount + 1,
      },
    });
    
    // Re-process failed rows
    const firstStage = await prisma.stage.findFirst({
      where: { jdId: upload.jdId, order: 1 },
    });
    
    if (!firstStage) {
      throw new Error('No stages configured for this JD');
    }
    
    let successCount = upload.successCount;
    let failureCount = 0;
    const newErrorLog: BulkUploadError[] = [];
    
    // Process in smaller batches
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < failedRows.length; i += BATCH_SIZE) {
      const batch = failedRows.slice(i, i + BATCH_SIZE);
      
      const results = await Promise.allSettled(
        batch.map((row, index) => this.processRow(row, upload.jd, firstStage, i + index))
      );
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failureCount++;
          newErrorLog.push({
            row: i + index + 2,
            error: result.reason.message,
            data: batch[index],
          });
        }
      });
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    await prisma.bulkUpload.update({
      where: { id: uploadId },
      data: {
        successCount,
        failureCount,
        status: failureCount === 0 ? 'COMPLETED' : 'PARTIAL',
        errorLog: newErrorLog.length > 0 
          ? (newErrorLog as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        completedAt: new Date(),
      },
    });
    
    logger.info(`Retry upload ${uploadId} completed: ${successCount}/${upload.totalRows} successful`);
    
    await this.updateDashboardStats(upload.jdId);
  }
}

export default new BulkService();
