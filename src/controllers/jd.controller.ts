// src/controllers/jd.controller.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import logger from '../utils/logger';
import { HiringType, JDStatus, StageType } from '@prisma/client';

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
      hiringType,
      location,
      salaryMin,
      salaryMax,
      openings,
      eligibleDegrees,
      eligibleYears,
      minCGPA,
      experienceMin,
      experienceMax,
      requiredSkills,
      preferredSkills,
    } = req.body;
    
    const jd = await prisma.$transaction(async (tx) => {
      const newJD = await tx.jobDescription.create({
        data: {
          title,
          description,
          department,
          hiringType: hiringType as HiringType,
          location,
          salaryMin,
          salaryMax,
          openings: openings || 1,
          eligibleDegrees: eligibleDegrees || [],
          eligibleYears: eligibleYears || [],
          minCGPA,
          experienceMin,
          experienceMax,
          requiredSkills: requiredSkills || [],
          preferredSkills: preferredSkills || [],
          createdById: req.user!.id,
          status: 'ACTIVE' as JDStatus,
        },
      });
      
      const stages = hiringType === 'BULK'
        ? [
            { name: 'Applied', type: 'APPLIED', order: 1 },
            { name: 'Shortlisted', type: 'SHORTLISTED', order: 2 },
            { name: 'Interviewed', type: 'INTERVIEWED', order: 3 },
            { name: 'Selected', type: 'SELECTED', order: 4 },
            { name: 'Rejected', type: 'REJECTED', order: 5 },
          ]
        : [
            { name: 'Applied', type: 'APPLIED', order: 1 },
            { name: 'HR Round', type: 'HR_ROUND', order: 2 },
            { name: 'Technical Round', type: 'TECHNICAL_ROUND', order: 3 },
            { name: 'Manager Round', type: 'MANAGER_ROUND', order: 4 },
            { name: 'Offer Released', type: 'OFFER_RELEASED', order: 5 },
            { name: 'Offer Accepted', type: 'OFFER_ACCEPTED', order: 6 },
            { name: 'Joined', type: 'JOINED', order: 7 },
            { name: 'Rejected', type: 'REJECTED', order: 8 },
          ];
      
      await tx.stage.createMany({
        data: stages.map(stage => ({
          ...stage,
          type: stage.type as StageType,
          jdId: newJD.id,
        })),
      });
      
      await tx.dashboard.create({
        data: { jdId: newJD.id },
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
      status, 
      hiringType, 
      department,
      page = '1', 
      limit = '20',
      search 
    } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;
    
    const where: any = {};
    
    if (status) where.status = status;
    if (hiringType) where.hiringType = hiringType;
    if (department) where.department = department;
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
            select: { candidates: true },
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
          select: { candidates: true },
        },
      },
    });
    
    if (!jd) {
      res.status(404).json({ error: 'Job Description not found' });
      return;
    }
    
    res.json({ jd });
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
    
    delete updateData.id;
    delete updateData.createdById;
    delete updateData.createdAt;
    
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
      data: { status: status as JDStatus },
    });
    
    logger.info(`JD status updated: ${id} to ${status}`);
    
    res.json({
      message: 'Status updated successfully',
      jd,
    });
  } catch (error) {
    next(error);
  }
};

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
