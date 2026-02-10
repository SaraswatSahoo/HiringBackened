// src/controllers/dashboard.controller.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import analyticsService from '../services/analytics.service';


export const getAdminDashboard = async (
  _req: Request,
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
            type: 'SELECTED',
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
    
    // FIX: Get dashboards and JDs separately
    const dashboards = await prisma.dashboard.findMany({
      orderBy: { lastUpdated: 'desc' },
    });
    
    const jdStatsWithDetails = await Promise.all(
      dashboards.map(async (dashboard) => {
        const jd = await prisma.jobDescription.findUnique({
          where: { id: dashboard.jdId },
          select: {
            id: true,
            title: true,
            department: true,
            status: true,
          },
        });
        
        return {
          ...dashboard,
          jd,
        };
      })
    );
    
    res.json({
      overview: {
        totalJDs,
        activeJDs,
        totalCandidates,
        totalSelections,
      },
      recentJDs,
      jdStats: jdStatsWithDetails,
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
    
    const collegePerformance = await analyticsService.getCollegePerformance(jdId);
    const timeToHire = await analyticsService.getAverageTimeToHire(jdId);
    
    // ✅ FIXED: Changed from 'communication' to 'email'
    const recentEmails = await prisma.email.findMany({
      where: { jdId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        subject: true,
        type: true,
        totalRecipients: true,
        sentCount: true,
        failedCount: true,
        sentAt: true,
        createdAt: true,
      },
    });
    
    res.json({
      jd: {
        id: jd.id,
        title: jd.title,
        department: jd.department,
        status: jd.status,
        openings: jd.openings,
      },
      stats,
      stageDistribution,
      recentCandidates,
      collegePerformance,
      timeToHire,
      recentEmails, // ✅ FIXED: Changed from 'recentComms' to 'recentEmails'
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


export const getDashboardSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;
    
    const [
      totalCandidates,
      eligibleCandidates,
      shortlisted,
      interviewed,
      selected,
      rejected,
    ] = await Promise.all([
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
    
    // FIX: Use aggregate instead of groupBy for simpler counting
    const colleges = await prisma.candidate.findMany({
      where: { jdId },
      select: { college: true },
      distinct: ['college'],
    });
    
    const collegeBreakdown = await Promise.all(
      colleges.map(async (c) => {
        const count = await prisma.candidate.count({
          where: { jdId, college: c.college },
        });
        return {
          college: c.college,
          count,
        };
      })
    );
    
    res.json({
      summary: {
        totalCandidates,
        eligibleCandidates,
        shortlisted,
        interviewed,
        selected,
        rejected,
        eligibilityRate: totalCandidates > 0 
          ? ((eligibleCandidates / totalCandidates) * 100).toFixed(2) 
          : '0',
        selectionRate: totalCandidates > 0 
          ? ((selected / totalCandidates) * 100).toFixed(2) 
          : '0',
        totalColleges: colleges.length,
      },
      collegeBreakdown,
    });
  } catch (error) {
    next(error);
  }
};


export const getStageWiseStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;
    
    const stages = await prisma.stage.findMany({
      where: { jdId },
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { currentCandidates: true },
        },
      },
    });
    
    const totalCandidates = await prisma.candidate.count({ where: { jdId } });
    
    const stageStats = stages.map(stage => ({
      stageId: stage.id,
      stageName: stage.name,
      stageType: stage.type,
      count: stage._count.currentCandidates,
      percentage: totalCandidates > 0 
        ? ((stage._count.currentCandidates / totalCandidates) * 100).toFixed(2)
        : '0',
    }));
    
    res.json({ 
      totalCandidates,
      stages: stageStats 
    });
  } catch (error) {
    next(error);
  }
};


export const getTopColleges = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;
    const { limit = '10' } = req.query;
    
    // FIX: Use raw query for better type safety
    const colleges = await prisma.$queryRaw<Array<{
      college: string;
      count: bigint;
      avgcgpa: number | null;
    }>>`
      SELECT 
        college,
        COUNT(*)::bigint as count,
        AVG(cgpa) as avgcgpa
      FROM candidates
      WHERE "jdId" = ${jdId}::uuid
      GROUP BY college
      ORDER BY count DESC
      LIMIT ${parseInt(limit as string, 10)}
    `;
    
    const collegeStats = await Promise.all(
      colleges.map(async (college) => {
        const totalApplied = Number(college.count);
        
        const selected = await prisma.candidate.count({
          where: {
            jdId,
            college: college.college,
            currentStage: { type: 'SELECTED' },
          },
        });
        
        const eligible = await prisma.candidate.count({
          where: {
            jdId,
            college: college.college,
            isEligible: true,
          },
        });
        
        return {
          college: college.college || 'Unknown',
          totalApplied,
          eligible,
          selected,
          avgCGPA: college.avgcgpa ? college.avgcgpa.toFixed(2) : null,
          selectionRate: totalApplied > 0 
            ? ((selected / totalApplied) * 100).toFixed(2)
            : '0',
        };
      })
    );
    
    res.json({ colleges: collegeStats });
  } catch (error) {
    next(error);
  }
};


export const getCGPADistribution = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;
    
    const candidates = await prisma.candidate.findMany({
      where: { 
        jdId,
        cgpa: { not: null },
      },
      select: { cgpa: true },
    });
    
    const buckets = {
      '9.0-10.0': 0,
      '8.0-8.9': 0,
      '7.0-7.9': 0,
      '6.0-6.9': 0,
      'Below 6.0': 0,
    };
    
    candidates.forEach(candidate => {
      if (!candidate.cgpa) return;
      const cgpa = parseFloat(candidate.cgpa.toString());
      if (cgpa >= 9.0) buckets['9.0-10.0']++;
      else if (cgpa >= 8.0) buckets['8.0-8.9']++;
      else if (cgpa >= 7.0) buckets['7.0-7.9']++;
      else if (cgpa >= 6.0) buckets['6.0-6.9']++;
      else buckets['Below 6.0']++;
    });
    
    const avgCGPA = candidates.length > 0
      ? (candidates.reduce((sum, c) => {
          const cgpaValue = c.cgpa ? parseFloat(c.cgpa.toString()) : 0;
          return sum + cgpaValue;
        }, 0) / candidates.length).toFixed(2)
      : null;
    
    res.json({
      distribution: buckets,
      totalCandidates: candidates.length,
      avgCGPA,
    });
  } catch (error) {
    next(error);
  }
};


export const getDegreeDistribution = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;
    
    // FIX: Use raw query for type safety
    const degrees = await prisma.$queryRaw<Array<{
      degree: string;
      count: bigint;
    }>>`
      SELECT 
        degree,
        COUNT(*)::bigint as count
      FROM candidates
      WHERE "jdId" = ${jdId}::uuid
      GROUP BY degree
      ORDER BY count DESC
    `;
    
    const totalCandidates = await prisma.candidate.count({ where: { jdId } });
    
    const degreeStats = degrees.map(degree => ({
      degree: degree.degree || 'Unknown',
      count: Number(degree.count),
      percentage: totalCandidates > 0 
        ? ((Number(degree.count)) / totalCandidates * 100).toFixed(2)
        : '0',
    }));
    
    res.json({
      totalCandidates,
      degrees: degreeStats,
    });
  } catch (error) {
    next(error);
  }
};


export const getEligibilityStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;
    
    const [total, eligible, notEligible] = await Promise.all([
      prisma.candidate.count({ where: { jdId } }),
      prisma.candidate.count({ where: { jdId, isEligible: true } }),
      prisma.candidate.count({ where: { jdId, isEligible: false } }),
    ]);
    
    const jd = await prisma.jobDescription.findUnique({
      where: { id: jdId },
    });
    
    if (!jd) {
      res.status(404).json({ error: 'Job Description not found' });
      return;
    }
    
    const ineligibleByDegree = await prisma.candidate.count({
      where: {
        jdId,
        degree: { notIn: jd.eligibleDegrees },
      },
    });
    
    const ineligibleByYear = await prisma.candidate.count({
      where: {
        jdId,
        passOutYear: { notIn: jd.eligibleYears },
      },
    });
    
    const ineligibleByCGPA = jd.minCGPA 
      ? await prisma.candidate.count({
          where: {
            jdId,
            cgpa: { lt: jd.minCGPA },
          },
        })
      : 0;
    
    res.json({
      total,
      eligible,
      notEligible,
      eligibilityRate: total > 0 ? ((eligible / total) * 100).toFixed(2) : '0',
      ineligibilityReasons: {
        degree: ineligibleByDegree,
        year: ineligibleByYear,
        cgpa: ineligibleByCGPA,
      },
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
