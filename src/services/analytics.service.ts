// src/services/analytics.service.ts
import prisma from '../prisma/client';
import { CollegePerformance } from '../types/api';

class AnalyticsService {
  async getCollegePerformance(jdId: string): Promise<CollegePerformance[]> {
    const candidates = await prisma.candidate.findMany({
      where: { 
        jdId,
        college: { 
          not: ''
        } 
      },
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
      if (!candidate.college || candidate.college.trim() === '') return;
      
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
      
      if (candidate.currentStage?.type === 'SELECTED') {
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
          type: 'SELECTED',
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
    let validCandidates = 0;
    
    selectedCandidates.forEach(candidate => {
      if (candidate.stageHistory.length === 0) return;
      
      const firstStage = candidate.stageHistory[0];
      const lastStage = candidate.stageHistory[candidate.stageHistory.length - 1];
      
      if (firstStage && lastStage) {
        const days = Math.ceil(
          (new Date(lastStage.enteredAt).getTime() - new Date(firstStage.enteredAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        totalDays += days;
        validCandidates++;
      }
    });
    
    return {
      avgDays: validCandidates > 0 ? Math.round(totalDays / validCandidates) : null,
      count: validCandidates,
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
    
    const totalCandidates = await prisma.candidate.count({ where });
    
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
          : totalCandidates;
        
        return {
          stage: stage.name,
          stageType: stage.type,
          count,
          conversionRate: previousCount > 0 ? ((count / previousCount) * 100).toFixed(2) : '0',
        };
      })
    );
    
    const feedbacks = await prisma.feedback.findMany({
      where: {
        candidate: {
          jdId,
        },
      },
      select: {
        rating: true,
        technicalSkills: true,
        communication: true,
        cultureFit: true,
        problemSolving: true,
      },
    });
    
    const avgRating = feedbacks.length > 0 ? {
      rating: (feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length).toFixed(2),
      technicalSkills: feedbacks.filter(f => f.technicalSkills).length > 0
        ? (feedbacks.reduce((sum, f) => sum + (f.technicalSkills || 0), 0) / feedbacks.filter(f => f.technicalSkills).length).toFixed(2)
        : null,
      communication: feedbacks.filter(f => f.communication).length > 0
        ? (feedbacks.reduce((sum, f) => sum + (f.communication || 0), 0) / feedbacks.filter(f => f.communication).length).toFixed(2)
        : null,
      cultureFit: feedbacks.filter(f => f.cultureFit).length > 0
        ? (feedbacks.reduce((sum, f) => sum + (f.cultureFit || 0), 0) / feedbacks.filter(f => f.cultureFit).length).toFixed(2)
        : null,
      problemSolving: feedbacks.filter(f => f.problemSolving).length > 0
        ? (feedbacks.reduce((sum, f) => sum + (f.problemSolving || 0), 0) / feedbacks.filter(f => f.problemSolving).length).toFixed(2)
        : null,
    } : null;
    
    const collegeStats = await this.getCollegePerformance(jdId);
    const timeToHire = await this.getAverageTimeToHire(jdId);
    
    return {
      totalCandidates,
      dateRange: {
        start: startDate?.toISOString() || null,
        end: endDate?.toISOString() || null,
      },
      stageConversion,
      avgRating,
      collegeStats: collegeStats.slice(0, 10),
      timeToHire,
      feedbackCount: feedbacks.length,
    };
  }
  
  async getDailyApplicationTrend(jdId: string, days: number = 30): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const candidates = await prisma.candidate.findMany({
      where: {
        jdId,
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        createdAt: true,
      },
    });
    
    const dateMap: { [key: string]: number } = {};
    
    candidates.forEach(candidate => {
      const date = candidate.createdAt.toISOString().split('T')[0];
      dateMap[date] = (dateMap[date] || 0) + 1;
    });
    
    return Object.entries(dateMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  
  async getSourceDistribution(jdId: string): Promise<any[]> {
    const totalCandidates = await prisma.candidate.count({ where: { jdId } });
    
    return [
      {
        source: 'BULK_UPLOAD',
        count: totalCandidates,
        percentage: '100.00',
      },
    ];
  }
  
  async getEligibilityBreakdown(jdId: string): Promise<any> {
    const [total, eligible, notEligible] = await Promise.all([
      prisma.candidate.count({ where: { jdId } }),
      prisma.candidate.count({ where: { jdId, isEligible: true } }),
      prisma.candidate.count({ where: { jdId, isEligible: false } }),
    ]);
    
    return {
      total,
      eligible,
      notEligible,
      eligibilityRate: total > 0 ? ((eligible / total) * 100).toFixed(2) : '0',
    };
  }
  
  async getPassOutYearDistribution(jdId: string): Promise<any[]> {
    // FIX: Use raw query to avoid TypeScript issues with groupBy
    const result = await prisma.$queryRaw<Array<{
      passoutyear: number;
      count: bigint;
    }>>`
      SELECT 
        "passOutYear" as passoutyear,
        COUNT(*)::bigint as count
      FROM candidates
      WHERE "jdId" = ${jdId}::uuid
      GROUP BY "passOutYear"
      ORDER BY "passOutYear" ASC
    `;
    
    const total = await prisma.candidate.count({ where: { jdId } });
    
    return result.map(item => ({
      year: item.passoutyear,
      count: Number(item.count),
      percentage: total > 0 ? ((Number(item.count) / total) * 100).toFixed(2) : '0',
    }));
  }
  
  async getBranchDistribution(jdId: string): Promise<any[]> {
    // FIX: Use raw query to avoid TypeScript issues with groupBy
    const result = await prisma.$queryRaw<Array<{
      branch: string | null;
      count: bigint;
    }>>`
      SELECT 
        branch,
        COUNT(*)::bigint as count
      FROM candidates
      WHERE "jdId" = ${jdId}::uuid
        AND branch IS NOT NULL 
        AND branch != ''
      GROUP BY branch
      ORDER BY count DESC
    `;
    
    const total = await prisma.candidate.count({ where: { jdId } });
    
    return result.map(item => ({
      branch: item.branch || 'Unknown',
      count: Number(item.count),
      percentage: total > 0 ? ((Number(item.count) / total) * 100).toFixed(2) : '0',
    }));
  }
}

export default new AnalyticsService();
