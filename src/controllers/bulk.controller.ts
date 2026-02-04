// src/controllers/bulk.controller.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import logger from '../utils/logger';
import bulkService from '../services/bulk.service';

export const bulkUploadCandidates = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.body;
    const file = req.file;
    
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    
    // Validate file type
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!allowedTypes.includes(file.mimetype)) {
      res.status(400).json({ 
        error: 'Invalid file type. Only CSV and Excel files are allowed.' 
      });
      return;
    }
    
    const jd = await prisma.jobDescription.findUnique({
      where: { id: jdId },
    });
    
    if (!jd) {
      res.status(404).json({ error: 'Job Description not found' });
      return;
    }
    
    const bulkUpload = await prisma.bulkUpload.create({
      data: {
        jdId,
        fileName: file.originalname,
        uploadedBy: req.user!.id,
        status: 'PROCESSING',
      },
    });
    
    // Process async
    bulkService.processBulkUpload(bulkUpload.id, file.buffer, jd)
      .catch(err => logger.error('Bulk upload processing failed:', err));
    
    res.status(202).json({
      message: 'Bulk upload initiated successfully',
      uploadId: bulkUpload.id,
      status: 'PROCESSING',
    });
  } catch (error) {
    next(error);
  }
};

export const getBulkUploadStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    
    const bulkUpload = await prisma.bulkUpload.findUnique({
      where: { id },
    });
    
    if (!bulkUpload) {
      res.status(404).json({ error: 'Bulk upload not found' });
      return;
    }
    
    res.json({
      upload: {
        id: bulkUpload.id,
        fileName: bulkUpload.fileName,
        status: bulkUpload.status,
        totalRows: bulkUpload.totalRows,
        successCount: bulkUpload.successCount,
        failureCount: bulkUpload.failureCount,
        errorLog: bulkUpload.errorLog,
        createdAt: bulkUpload.createdAt,
        updatedAt: bulkUpload.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBulkUploadsByJD = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;
    const { page = '1', limit = '20' } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;
    
    const [uploads, total] = await Promise.all([
      prisma.bulkUpload.findMany({
        where: { jdId },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.bulkUpload.count({ where: { jdId } }),
    ]);
    
    res.json({
      uploads,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const markEligibleCandidates = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;
    
    const jd = await prisma.jobDescription.findUnique({
      where: { id: jdId },
    });
    
    if (!jd) {
      res.status(404).json({ error: 'Job Description not found' });
      return;
    }
    
    // Get all candidates for this JD
    const candidates = await prisma.candidate.findMany({
      where: { jdId },
    });
    
    let updatedCount = 0;
    let eligibleCount = 0;
    let notEligibleCount = 0;
    
    // Update eligibility for each candidate
    for (const candidate of candidates) {
      // Calculate eligibility - this returns boolean (true or false), never null
      const isEligible: boolean = 
        jd.eligibleDegrees.includes(candidate.degree) &&
        jd.eligibleYears.includes(candidate.passOutYear) &&
        (!jd.minCGPA || (candidate.cgpa !== null && candidate.cgpa >= jd.minCGPA));
      
      // Convert candidate.isEligible to boolean for comparison (null becomes false)
      const currentEligibility = candidate.isEligible ?? false;
      
      // Only update if eligibility status changed
      if (currentEligibility !== isEligible) {
        await prisma.candidate.update({
          where: { id: candidate.id },
          data: { isEligible }, // Now guaranteed to be boolean
        });
        updatedCount++;
      }
      
      // Count eligible vs not eligible
      if (isEligible) {
        eligibleCount++;
      } else {
        notEligibleCount++;
      }
    }
    
    logger.info(`Marked eligibility for ${updatedCount} candidates in JD ${jdId}`);
    
    res.json({
      message: 'Eligibility marking completed',
      totalCandidates: candidates.length,
      updatedCount,
      eligibleCount,
      notEligibleCount,
      criteria: {
        eligibleDegrees: jd.eligibleDegrees,
        eligibleYears: jd.eligibleYears,
        minCGPA: jd.minCGPA?.toString() || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const downloadSampleCSV = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sampleData = 
      'Name,Email,Phone,Alternate Phone,College,Degree,Branch,Pass Out Year,CGPA,Resume Link\n' +
      'John Doe,john.doe@example.com,9876543210,9876543211,IIT Delhi,B.Tech,Computer Science,2024,8.5,https://drive.google.com/file/d/xxxxx/view\n' +
      'Jane Smith,jane.smith@example.com,9876543212,,NIT Trichy,B.Tech,Electronics,2024,7.8,https://drive.google.com/file/d/yyyyy/view\n' +
      'Raj Kumar,raj.kumar@example.com,9876543213,9876543214,BITS Pilani,B.E,Mechanical,2025,8.2,https://drive.google.com/file/d/zzzzz/view\n' +
      'Priya Singh,priya.singh@example.com,9876543215,,Anna University,B.Tech,Civil,2024,7.5,https://drive.google.com/file/d/aaaaa/view\n' +
      'Amit Patel,amit.patel@example.com,9876543216,9876543217,VIT Vellore,B.Tech,Information Technology,2025,8.9,https://drive.google.com/file/d/bbbbb/view';
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=sample_bulk_hiring.csv');
    res.send(sampleData);
  } catch (error) {
    next(error);
  }
};
