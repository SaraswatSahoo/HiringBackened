// src/controllers/bulk.controller.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import logger from '../utils/logger';
import bulkService from '../services/bulk.service';
import storageService from '../services/storage.service';

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
    
    const jd = await prisma.jobDescription.findUnique({
      where: { id: jdId },
    });
    
    if (!jd) {
      res.status(404).json({ error: 'Job Description not found' });
      return;
    }
    
    if (jd.hiringType !== 'BULK') {
      res.status(400).json({ 
        error: 'Bulk upload is only available for bulk hiring JDs' 
      });
      return;
    }
    
    const fileUrl = await storageService.uploadFile(file, 'bulk-uploads');
    
    const bulkUpload = await prisma.bulkUpload.create({
      data: {
        jdId,
        fileName: file.originalname,
        fileUrl,
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
    
    const upload = await prisma.bulkUpload.findUnique({
      where: { id },
    });
    
    if (!upload) {
      res.status(404).json({ error: 'Upload not found' });
      return;
    }
    
    res.json({ upload });
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
    
    const candidates = await prisma.candidate.findMany({
      where: { jdId },
      select: { id: true, degree: true, passOutYear: true, cgpa: true },
    });
    
    const eligibilityUpdates = candidates.map(candidate => {
      const isEligible = 
        candidate.degree && jd.eligibleDegrees.includes(candidate.degree) &&
        candidate.passOutYear && jd.eligibleYears.includes(candidate.passOutYear) &&
        (!jd.minCGPA || (candidate.cgpa && candidate.cgpa >= jd.minCGPA));
      
      return prisma.candidate.update({
        where: { id: candidate.id },
        data: { isEligible: !!isEligible },
      });
    });
    
    await prisma.$transaction(eligibilityUpdates);
    
    const eligibleCount = await prisma.candidate.count({
      where: { jdId, isEligible: true },
    });
    
    logger.info(`Eligibility marked for JD ${jdId}: ${eligibleCount} eligible`);
    
    res.json({
      message: 'Eligibility marked successfully',
      totalCandidates: candidates.length,
      eligibleCount,
    });
  } catch (error) {
    next(error);
  }
};

export const downloadSampleCSV = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { hiringType } = req.query;
    
    const sampleData = hiringType === 'BULK'
      ? 'Name,Email,Phone,College,Degree,Branch,Pass Out Year,CGPA\n' +
        'John Doe,john@example.com,9876543210,ABC College,B.Tech,CSE,2024,8.5\n' +
        'Jane Smith,jane@example.com,9876543211,XYZ College,B.Tech,ECE,2025,7.8'
      : 'Name,Email,Phone,Current Company,Previous Company,Total Experience,Relevant Experience,Skills,Current Location,Expected CTC,Notice Period\n' +
        'John Doe,john@example.com,9876543210,Google,Microsoft,5.5,4,JavaScript|React|Node.js,Bangalore,2500000,30\n' +
        'Jane Smith,jane@example.com,9876543211,Amazon,TCS,3.2,3,Python|Django|AWS,Mumbai,1800000,45';
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=sample_${hiringType}.csv`);
    res.send(sampleData);
  } catch (error) {
    next(error);
  }
};
