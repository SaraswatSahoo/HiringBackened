// src/services/bulk.service.ts
import prisma from '../prisma/client';
import logger from '../utils/logger';
import csvParser from '../utils/csvParser';
import { JobDescription, Prisma } from '@prisma/client'; // Import Prisma
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
          errorLog: errorLog.length > 0 
            ? (errorLog as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
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
          errorLog: [{ error: error.message }] as unknown as Prisma.InputJsonValue,
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
    if (!row.name || !row.email || !row.phone || !row.college || !row.degree) {
      throw new Error('Missing required fields: name, email, phone, college, or degree');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(row.email)) {
      throw new Error('Invalid email format');
    }
    
    const phoneStr = row.phone.toString().replace(/\D/g, '');
    if (phoneStr.length < 10) {
      throw new Error('Invalid phone number');
    }
    
    const passOutYear = parseInt(row.passoutyear.toString(), 10);
    const cgpa = row.cgpa ? parseFloat(row.cgpa.toString()) : null;
    
    const candidateData: any = {
      name: row.name.trim(),
      email: row.email.toLowerCase().trim(),
      phone: phoneStr,
      alternatePhone: row.alternatephone?.toString().replace(/\D/g, ''),
      college: row.college.trim(),
      degree: row.degree.trim(),
      branch: row.branch?.trim(),
      passOutYear,
      cgpa,
      resumeLink: row.resumelink?.trim(),
      jdId: jd.id,
      currentStageId: firstStage.id,
    };
    
    candidateData.tags = [`college_${candidateData.college.toLowerCase().replace(/\s+/g, '_')}`];
    
    candidateData.isEligible = 
      jd.eligibleDegrees.includes(candidateData.degree) &&
      jd.eligibleYears.includes(candidateData.passOutYear) &&
      (!jd.minCGPA || (candidateData.cgpa && candidateData.cgpa >= parseFloat(jd.minCGPA.toString())));
    
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
    const [total, eligible, shortlisted, interviewed, selected, rejected] = await Promise.all([
      prisma.candidate.count({ where: { jdId } }),
      prisma.candidate.count({ where: { jdId, isEligible: true } }),
      prisma.candidate.count({
        where: { jdId, currentStage: { type: 'SHORTLISTED' } },
      }),
      prisma.candidate.count({
        where: { jdId, currentStage: { type: 'INTERVIEWED' } },
      }),
      prisma.candidate.count({
        where: { jdId, currentStage: { type: 'SELECTED' } },
      }),
      prisma.candidate.count({
        where: { jdId, currentStage: { type: 'REJECTED' } },
      }),
    ]);
    
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
      },
      update: {
        totalCandidates: total,
        eligibleCount: eligible,
        shortlistedCount: shortlisted,
        interviewedCount: interviewed,
        selectedCount: selected,
        rejectedCount: rejected,
        lastUpdated: new Date(),
      },
    });
  }
}

export default new BulkService();
