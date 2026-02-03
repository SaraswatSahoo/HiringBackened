// src/controllers/candidate.controller.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import logger from '../utils/logger';
import storageService from '../services/storage.service';
import { CandidateSource } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export const createCandidate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const candidateData = req.body;
    const { jdId } = candidateData;
    
    const firstStage = await prisma.stage.findFirst({
      where: { jdId, order: 1 },
    });
    
    if (!firstStage) {
      res.status(400).json({ error: 'No stages configured for this JD' });
      return;
    }
    
    const candidate = await prisma.$transaction(async (tx) => {
      const newCandidate = await tx.candidate.create({
        data: {
          ...candidateData,
          currentStageId: firstStage.id,
          source: (candidateData.source as CandidateSource) || 'MANUAL_UPLOAD',
        },
      });
      
      await tx.candidateStage.create({
        data: {
          candidateId: newCandidate.id,
          stageId: firstStage.id,
        },
      });
      
      // Check eligibility for bulk hiring
      if (candidateData.degree && candidateData.passOutYear) {
        const jd = await tx.jobDescription.findUnique({
          where: { id: jdId },
        });
        
        if (jd) {
          const isEligible = 
            jd.eligibleDegrees.includes(candidateData.degree) &&
            jd.eligibleYears.includes(candidateData.passOutYear) &&
            (!jd.minCGPA || (candidateData.cgpa && new Decimal(candidateData.cgpa).gte(jd.minCGPA)));
          
          await tx.candidate.update({
            where: { id: newCandidate.id },
            data: { isEligible },
          });
        }
      }
      
      await tx.activityLog.create({
        data: {
          userId: req.user!.id,
          action: 'CANDIDATE_CREATED',
          entityType: 'CANDIDATE',
          entityId: newCandidate.id,
          metadata: { jdId, name: newCandidate.name },
        },
      });
      
      return newCandidate;
    });
    
    logger.info(`Candidate created: ${candidate.id} for JD: ${jdId}`);
    
    res.status(201).json({
      message: 'Candidate created successfully',
      candidate,
    });
  } catch (error) {
    next(error);
  }
};

export const getCandidatesByJD = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;
    const {
      page = '1',
      limit = '50',
      stageId,
      isEligible,
      college,
      degree,
      passOutYear,
      skills,
      minExperience,
      maxExperience,
      search,
    } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;
    
    const where: any = { jdId };
    
    if (stageId) where.currentStageId = stageId;
    if (isEligible !== undefined) where.isEligible = isEligible === 'true';
    if (college) where.college = { contains: college as string, mode: 'insensitive' };
    if (degree) where.degree = degree;
    if (passOutYear) where.passOutYear = parseInt(passOutYear as string, 10);
    
    if (skills) {
      where.skills = {
        hasSome: Array.isArray(skills) ? skills : [skills],
      };
    }
    
    if (minExperience || maxExperience) {
      where.totalExperience = {};
      if (minExperience) where.totalExperience.gte = parseFloat(minExperience as string);
      if (maxExperience) where.totalExperience.lte = parseFloat(maxExperience as string);
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    
    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          currentStage: true,
          feedbacks: {
            include: {
              givenBy: {
                select: { name: true, email: true },
              },
            },
          },
        },
      }),
      prisma.candidate.count({ where }),
    ]);
    
    res.json({
      candidates,
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

export const getCandidateById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    
    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: {
        jd: {
          select: { id: true, title: true, hiringType: true },
        },
        currentStage: true,
        stageHistory: {
          include: {
            stage: true,
          },
          orderBy: { enteredAt: 'desc' },
        },
        feedbacks: {
          include: {
            givenBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        communications: {
          include: {
            communication: true,
          },
          orderBy: { sentAt: 'desc' },
        },
      },
    });
    
    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }
    
    res.json({ candidate });
  } catch (error) {
    next(error);
  }
};

export const updateCandidate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    delete updateData.id;
    delete updateData.jdId;
    delete updateData.createdAt;
    delete updateData.currentStageId;
    
    const candidate = await prisma.candidate.update({
      where: { id },
      data: updateData,
    });
    
    logger.info(`Candidate updated: ${id} by user: ${req.user!.id}`);
    
    res.json({
      message: 'Candidate updated successfully',
      candidate,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCandidate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    
    await prisma.candidate.delete({
      where: { id },
    });
    
    logger.info(`Candidate deleted: ${id} by user: ${req.user!.id}`);
    
    res.json({ message: 'Candidate deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const moveCandidateStage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { stageId, notes, interviewDate, interviewMode, interviewerName } = req.body;
    
    await prisma.$transaction(async (tx) => {
      const currentStageHistory = await tx.candidateStage.findFirst({
        where: {
          candidateId: id,
          exitedAt: null,
        },
      });
      
      if (currentStageHistory) {
        await tx.candidateStage.update({
          where: { id: currentStageHistory.id },
          data: { exitedAt: new Date() },
        });
      }
      
      await tx.candidateStage.create({
        data: {
          candidateId: id,
          stageId,
          notes,
          interviewDate: interviewDate ? new Date(interviewDate) : undefined,
          interviewMode,
          interviewerName,
        },
      });
      
      await tx.candidate.update({
        where: { id },
        data: { currentStageId: stageId },
      });
      
      await tx.activityLog.create({
        data: {
          userId: req.user!.id,
          action: 'STAGE_CHANGED',
          entityType: 'CANDIDATE',
          entityId: id,
          metadata: { stageId, notes },
        },
      });
    });
    
    logger.info(`Candidate ${id} moved to stage ${stageId}`);
    
    res.json({ message: 'Candidate stage updated successfully' });
  } catch (error) {
    next(error);
  }
};

export const uploadResume = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const file = req.file;
    
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    
    const fileUrl = await storageService.uploadFile(file, 'resumes');
    
    await prisma.candidate.update({
      where: { id },
      data: {
        resumeUrl: fileUrl,
        resumeFileName: file.originalname,
      },
    });
    
    res.json({
      message: 'Resume uploaded successfully',
      resumeUrl: fileUrl,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkMoveCandidates = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { candidateIds, stageId, notes } = req.body;
    
    if (!candidateIds || candidateIds.length === 0) {
      res.status(400).json({ error: 'No candidates selected' });
      return;
    }
    
    await prisma.$transaction(async (tx) => {
      for (const candidateId of candidateIds) {
        const currentStageHistory = await tx.candidateStage.findFirst({
          where: {
            candidateId,
            exitedAt: null,
          },
        });
        
        if (currentStageHistory) {
          await tx.candidateStage.update({
            where: { id: currentStageHistory.id },
            data: { exitedAt: new Date() },
          });
        }
        
        await tx.candidateStage.create({
          data: {
            candidateId,
            stageId,
            notes,
          },
        });
        
        await tx.candidate.update({
          where: { id: candidateId },
          data: { currentStageId: stageId },
        });
      }
      
      await tx.activityLog.create({
        data: {
          userId: req.user!.id,
          action: 'BULK_STAGE_CHANGE',
          entityType: 'CANDIDATE',
          entityId: 'multiple',
          metadata: { candidateIds, stageId, count: candidateIds.length },
        },
      });
    });
    
    logger.info(`Bulk moved ${candidateIds.length} candidates to stage ${stageId}`);
    
    res.json({ 
      message: `${candidateIds.length} candidates moved successfully` 
    });
  } catch (error) {
    next(error);
  }
};
