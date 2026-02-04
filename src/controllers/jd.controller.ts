// src/controllers/jd.controller.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import logger from '../utils/logger';
import { Prisma } from '@prisma/client';

export const createJD = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      title,
      description,
      department,
      location,
      salaryMin,
      salaryMax,
      openings,
      eligibleDegrees,
      eligibleYears,
      minCGPA,
    } = req.body;
    
    const jd = await prisma.$transaction(async (tx) => {
      // Create JD
      const newJD = await tx.jobDescription.create({
        data: {
          title,
          description,
          department,
          location,
          salaryMin,
          salaryMax,
          openings: openings || 1,
          eligibleDegrees: eligibleDegrees || [],
          eligibleYears: eligibleYears || [],
          minCGPA,
          createdById: req.user!.id,
          status: 'DRAFT',
        },
      });
      
      // Create default stages for bulk hiring
      const defaultStages = [
        { name: 'Applied', type: 'APPLIED' as const, order: 1 },
        { name: 'Shortlisted', type: 'SHORTLISTED' as const, order: 2 },
        { name: 'Interviewed', type: 'INTERVIEWED' as const, order: 3 },
        { name: 'Selected', type: 'SELECTED' as const, order: 4 },
        { name: 'Rejected', type: 'REJECTED' as const, order: 5 },
      ];
      
      await Promise.all(
        defaultStages.map(stage =>
          tx.stage.create({
            data: {
              ...stage,
              jdId: newJD.id,
            },
          })
        )
      );
      
      // Create dashboard entry
      await tx.dashboard.create({
        data: {
          jdId: newJD.id,
        },
      });
      
      // Log activity
      await tx.activityLog.create({
        data: {
          userId: req.user!.id,
          action: 'JD_CREATED',
          entityType: 'JD',
          entityId: newJD.id,
          metadata: { title, department } as Prisma.InputJsonValue,
        },
      });
      
      return newJD;
    });
    
    logger.info(`JD created: ${jd.id} by user: ${req.user!.id}`);
    
    res.status(201).json({
      message: 'Job Description created successfully',
      jd,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllJDs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      department,
      search,
    } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;
    
    const where: any = {};
    
    if (status) where.status = status;
    if (department) where.department = { contains: department as string, mode: 'insensitive' };
    
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    
    const [jds, total] = await Promise.all([
      prisma.jobDescription.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: {
              candidates: true,
              stages: true,
            },
          },
        },
      }),
      prisma.jobDescription.count({ where }),
    ]);
    
    res.json({
      jds,
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

export const getJDById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    
    const jd = await prisma.jobDescription.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        stages: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            candidates: true,
          },
        },
      },
    });
    
    if (!jd) {
      res.status(404).json({ error: 'Job Description not found' });
      return;
    }
    
    // Get stats
    const stats = await prisma.dashboard.findUnique({
      where: { jdId: id },
    });
    
    res.json({ jd, stats });
  } catch (error) {
    next(error);
  }
};

export const updateJD = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.createdById;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    const jd = await prisma.jobDescription.update({
      where: { id },
      data: updateData,
    });
    
    logger.info(`JD updated: ${id} by user: ${req.user!.id}`);
    
    res.json({
      message: 'Job Description updated successfully',
      jd,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteJD = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    
    await prisma.jobDescription.delete({
      where: { id },
    });
    
    logger.info(`JD deleted: ${id} by user: ${req.user!.id}`);
    
    res.json({ message: 'Job Description deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const updateJDStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const jd = await prisma.jobDescription.update({
      where: { id },
      data: { status },
    });
    
    logger.info(`JD status updated: ${id} to ${status} by user: ${req.user!.id}`);
    
    res.json({
      message: 'Job Description status updated successfully',
      jd,
    });
  } catch (error) {
    next(error);
  }
};

// Get JD stages
export const getJDStages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    
    const stages = await prisma.stage.findMany({
      where: { jdId: id },
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { currentCandidates: true },
        },
      },
    });
    
    res.json({ stages });
  } catch (error) {
    next(error);
  }
};

// Create custom stage
export const createStage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, type, description, order } = req.body;
    
    const stage = await prisma.stage.create({
      data: {
        name,
        type,
        description,
        order,
        jdId: id,
      },
    });
    
    logger.info(`Stage created for JD ${id}: ${stage.id}`);
    
    res.status(201).json({
      message: 'Stage created successfully',
      stage,
    });
  } catch (error) {
    next(error);
  }
};

// Update stage
export const updateStage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { stageId } = req.params;
    const updateData = { ...req.body };
    
    delete updateData.id;
    delete updateData.jdId;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    const stage = await prisma.stage.update({
      where: { id: stageId },
      data: updateData,
    });
    
    res.json({
      message: 'Stage updated successfully',
      stage,
    });
  } catch (error) {
    next(error);
  }
};

// Delete stage
export const deleteStage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { stageId } = req.params;
    
    await prisma.stage.delete({
      where: { id: stageId },
    });
    
    res.json({ message: 'Stage deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Get eligibility criteria
export const getEligibilityCriteria = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    
    const jd = await prisma.jobDescription.findUnique({
      where: { id },
      select: {
        eligibleDegrees: true,
        eligibleYears: true,
        minCGPA: true,
      },
    });
    
    if (!jd) {
      res.status(404).json({ error: 'Job Description not found' });
      return;
    }
    
    res.json({ criteria: jd });
  } catch (error) {
    next(error);
  }
};

// Update eligibility criteria
export const updateEligibilityCriteria = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { eligibleDegrees, eligibleYears, minCGPA } = req.body;
    
    const jd = await prisma.jobDescription.update({
      where: { id },
      data: {
        eligibleDegrees,
        eligibleYears,
        minCGPA,
      },
    });
    
    // Re-check eligibility for all candidates
    const candidates = await prisma.candidate.findMany({
      where: { jdId: id },
    });
    
    await Promise.all(
      candidates.map(async (candidate) => {
        const isEligible = 
          eligibleDegrees.includes(candidate.degree) &&
          eligibleYears.includes(candidate.passOutYear) &&
          (!minCGPA || (candidate.cgpa && candidate.cgpa >= minCGPA));
        
        return prisma.candidate.update({
          where: { id: candidate.id },
          data: { isEligible },
        });
      })
    );
    
    logger.info(`Eligibility criteria updated for JD ${id}`);
    
    res.json({
      message: 'Eligibility criteria updated and candidates re-evaluated',
      jd,
    });
  } catch (error) {
    next(error);
  }
};
