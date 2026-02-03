// src/controllers/dashboard.controller.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import analyticsService from '../services/analytics.service';

export const getAdminDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const [
      totalJDs,
      activeJDs,
      totalCandidates,
      totalSelections,
    ] = await Promise.all([
      prisma.jobDescription.count(),
      prisma.jobDescription.count({ where: { status: 'ACTIVE' } }),
      prisma.candidate.count(),
      prisma.candidate.count({
        where: {
          currentStage: {
            type: { in: ['SELECTED', 'JOINED', 'OFFER_ACCEPTED'] },
          },
        },
      }),
    ]);
    
    const recentJDs = await prisma.jobDescription.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { candidates: true },
        },
      },
    });
    
    const jdStats = await prisma.dashboard.findMany({
      include: {
        jd: {
          select: {
            id: true,
            title: true,
            department: true,
            hiringType: true,
            status: true,
          },
        },
      },
      orderBy: { lastUpdated: 'desc' },
    });
    
    res.json({
      overview: {
        totalJDs,
        activeJDs,
        totalCandidates,
        totalSelections,
      },
      recentJDs,
      jdStats,
    });
  } catch (error) {
    next(error);
  }
};

export const getJDDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;
    
    const jd = await prisma.jobDescription.findUnique({
      where: { id: jdId },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: {
            _count: {
              select: { currentCandidates: true },
            },
          },
        },
      },
    });
    
    if (!jd) {
      res.status(404).json({ error: 'Job Description not found' });
      return;
    }
    
    const stats = await prisma.dashboard.findUnique({
      where: { jdId },
    });
    
    const stageDistribution = jd.stages.map(stage => ({
      stageId: stage.id,
      stageName: stage.name,
      count: stage._count.currentCandidates,
    }));
    
    const recentCandidates = await prisma.candidate.findMany({
      where: { jdId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        currentStage: true,
      },
    });
    
    let collegePerformance = null;
    if (jd.hiringType === 'BULK') {
      collegePerformance = await analyticsService.getCollegePerformance(jdId);
    }
    
    const timeToHire = await analyticsService.getAverageTimeToHire(jdId);
    
    const recentComms = await prisma.communication.findMany({
      where: { jdId },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
    
    res.json({
      jd: {
        id: jd.id,
        title: jd.title,
        department: jd.department,
        hiringType: jd.hiringType,
        status: jd.status,
        openings: jd.openings,
      },
      stats,
      stageDistribution,
      recentCandidates,
      collegePerformance,
      timeToHire,
      recentComms,
    });
  } catch (error) {
    next(error);
  }
};

export const getCollegePerformance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;
    
    const performance = await analyticsService.getCollegePerformance(jdId);
    
    res.json({ performance });
  } catch (error) {
    next(error);
  }
};

export const getAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;
    const { startDate, endDate } = req.query;
    
    const analytics = await analyticsService.getDetailedAnalytics(
      jdId,
      startDate ? new Date(startDate as string) : null,
      endDate ? new Date(endDate as string) : null
    );
    
    res.json({ analytics });
  } catch (error) {
    next(error);
  }
};
