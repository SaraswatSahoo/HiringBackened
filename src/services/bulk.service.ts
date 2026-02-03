// src/services/bulk.service.ts
import prisma from '../prisma/client';
import logger from '../utils/logger';
import csvParser from '../utils/csvParser';
import { JobDescription } from '@prisma/client';
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
      
      const BATCH_SIZE = 100;
      
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
      }
      
      await prisma.bulkUpload.update({
        where: { id: uploadId },
        data: {
          totalRows,
          successCount,
          failureCount,
          status: failureCount === 0 ? 'COMPLETED' : 'PARTIAL',
          errorLog: errorLog.length > 0 ? errorLog : null,
        },
      });
      
      logger.info(`Bulk upload ${uploadId} completed: ${successCount}/${totalRows} successful`);
      
      await this.updateDashboardStats(jd.id);
      
    } catch (error: any) {
      logger.error(`Bulk upload ${uploadId} failed:`, error);
      
      await prisma.bulkUpload.update({
        where: { id: uploadId },
        data: {
          status: 'FAILED',
          errorLog: [{ error: error.message }],
        },
      });
    }
  }
  
  async processRow(
    row: CSVRow, 
    jd: JobDescription, 
    firstStage: any, 
    rowIndex: number
  ): Promise<any> {
    if (!row.name || !row.email || !row.phone) {
      throw new Error('Missing required fields: name, email, or phone');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(row.email)) {
      throw new Error('Invalid email format');
    }
    
    const candidateData: any = {
      name: row.name.trim(),
      email: row.email.toLowerCase().trim(),
      phone: row.phone.toString().trim(),
      alternatePhone: row.alternatePhone?.toString().trim(),
      jdId: jd.id,
      source: 'BULK_UPLOAD',
      currentStageId: firstStage.id,
    };
    
    if (jd.hiringType === 'BULK') {
      candidateData.college = row.college?.toString().trim();
      candidateData.degree = row.degree?.toString().trim();
      candidateData.branch = row.branch?.toString().trim();
      candidateData.passOutYear = row.passOutYear ? parseInt(row.passOutYear.toString(), 10) : null;
      candidateData.cgpa = row.cgpa ? parseFloat(row.cgpa.toString()) : null;
      
      if (candidateData.college) {
        candidateData.tags = [`college_${candidateData.college.toLowerCase().replace(/\s+/g, '_')}`];
      }
      
      candidateData.isEligible = 
        candidateData.degree && jd.eligibleDegrees.includes(candidateData.degree) &&
        candidateData.passOutYear && jd.eligibleYears.includes(candidateData.passOutYear) &&
        (!jd.minCGPA || (candidateData.cgpa && candidateData.cgpa >= parseFloat(jd.minCGPA.toString())));
      
    } else {
      candidateData.currentCompany = row.currentCompany?.toString().trim();
      candidateData.previousCompany = row.previousCompany?.toString().trim();
      candidateData.totalExperience = row.totalExperience ? parseFloat(row.totalExperience.toString()) : null;
      candidateData.relevantExp = row.relevantExp ? parseFloat(row.relevantExp.toString()) : null;
      
      if (row.skills) {
        candidateData.skills = row.skills.toString().split(/[,|]/).map(s => s.trim()).filter(Boolean);
      }
      
      candidateData.currentLocation = row.currentLocation?.toString().trim();
      candidateData.preferredLocation = row.preferredLocation?.toString().trim();
      candidateData.currentCTC = row.currentCTC ? parseFloat(row.currentCTC.toString()) : null;
      candidateData.expectedCTC = row.expectedCTC ? parseFloat(row.expectedCTC.toString()) : null;
      candidateData.noticePeriod = row.noticePeriod ? parseInt(row.noticePeriod.toString(), 10) : null;
    }
    
    return await prisma.$transaction(async (tx) => {
      const candidate = await tx.candidate.create({
        data: candidateData,
      });
      
      await tx.candidateStage.create({
        data: {
          candidateId: candidate.id,
          stageId: firstStage.id,
        },
      });
      
      return candidate;
    });
  }
  
  async updateDashboardStats(jdId: string): Promise<void> {
    const stats = await prisma.candidate.groupBy({
      by: ['currentStageId'],
      where: { jdId },
      _count: true,
    });
    
    const eligible = await prisma.candidate.count({
      where: { jdId, isEligible: true },
    });
    
    const total = await prisma.candidate.count({
      where: { jdId },
    });
    
    await prisma.dashboard.update({
      where: { jdId },
      data: {
        totalCandidates: total,
        eligibleCount: eligible,
        lastUpdated: new Date(),
      },
    });
  }
}

export default new BulkService();
