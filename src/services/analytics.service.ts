// src/services/analytics.service.ts
import prisma from '../prisma/client';
import { CollegePerformance } from '../types/api';

class AnalyticsService {
  async getCollegePerformance(jdId: string): Promise<CollegePerformance[]> {
    const candidates = await prisma.candidate.findMany({
      where: { jdId, college: { not: null } },
      select: {
        college: true,
        isEligible: true,
        cgpa: true,
        currentStage: {
          select: { type: true },
        },
      },
    });
    
    const collegeMap: { [key: string]: any } = {};
    
    candidates.forEach(candidate => {
      if (!candidate.college) return;
      
      if (!collegeMap[candidate.college]) {
        collegeMap[candidate.college] = {
          collegeName: candidate.college,
          totalApplied: 0,
          totalEligible: 0,
          totalShortlisted: 0,
          totalSelected: 0,
          cgpaSum: 0,
          cgpaCount: 0,
        };
      }
      
      const stats = collegeMap[candidate.college];
      stats.totalApplied++;
      
      if (candidate.isEligible) stats.totalEligible++;
      if (candidate.currentStage?.type === 'SHORTLISTED') stats.totalShortlisted++;
      if (['SELECTED', 'JOINED', 'OFFER_ACCEPTED'].includes(candidate.currentStage?.type || '')) {
        stats.totalSelected++;
      }
      
      if (candidate.cgpa) {
        stats.cgpaSum += parseFloat(candidate.cgpa.toString());
        stats.cgpaCount++;
      }
    });
    
    return Object.values(collegeMap).map(stats => ({
      collegeName: stats.collegeName,
      totalApplied: stats.totalApplied,
      totalEligible: stats.totalEligible,
      totalShortlisted: stats.totalShortlisted,
      totalSelected: stats.totalSelected,
      avgCGPA: stats.cgpaCount > 0 ? (stats.cgpaSum / stats.cgpaCount).toFixed(2) : null,
    })).sort((a, b) => b.totalSelected - a.totalSelected);
  }
  
  async getAverageTimeToHire(jdId: string): Promise<{ avgDays: number | null; count: number }> {
    const selectedCandidates = await prisma.candidate.findMany({
      where: {
        jdId,
        currentStage: {
          type: { in: ['SELECTED', 'JOINED'] },
        },
      },
      include: {
        stageHistory: {
          orderBy: { enteredAt: 'asc' },
        },
      },
    });
    
    if (selectedCandidates.length === 0) {
      return { avgDays: null, count: 0 };
    }
    
    let totalDays = 0;
    
    selectedCandidates.forEach(candidate => {
      const firstStage = candidate.stageHistory[0];
      const lastStage = candidate.stageHistory[candidate.stageHistory.length - 1];
      
      if (firstStage && lastStage) {
        const days = Math.ceil(
          (new Date(lastStage.enteredAt).getTime() - new Date(firstStage.enteredAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        totalDays += days;
      }
    });
    
    return {
      avgDays: Math.round(totalDays / selectedCandidates.length),
      count: selectedCandidates.length,
    };
  }
  
  async getDetailedAnalytics(
    jdId: string, 
    startDate: Date | null, 
    endDate: Date | null
  ): Promise<any> {
    const where: any = { jdId };
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }
    
    const sourceDistribution = await prisma.candidate.groupBy({
      by: ['source'],
      where,
      _count: true,
    });
    
    const stages = await prisma.stage.findMany({
      where: { jdId },
      orderBy: { order: 'asc' },
    });
    
    const stageConversion = await Promise.all(
      stages.map(async (stage, index) => {
        const count = await prisma.candidate.count({
          where: { ...where, currentStageId: stage.id },
        });
        
        const previousCount = index > 0
          ? await prisma.candidate.count({
              where: { ...where, currentStageId: stages[index - 1].id },
            })
          : await prisma.candidate.count({ where });
        
        return {
          stage: stage.name,
          count,
          conversionRate: previousCount > 0 ? ((count / previousCount) * 100).toFixed(2) : null,
        };
      })
    );
    
    const avgRating = await prisma.feedback.aggregate({
      where: {
        candidate: where,
      },
      _avg: {
        rating: true,
        technicalSkills: true,
        communication: true,
        cultureFit: true,
        problemSolving: true,
      },
    });
    
    return {
      sourceDistribution,
      stageConversion,
      avgRating: avgRating._avg,
    };
  }
}

export default new AnalyticsService();
