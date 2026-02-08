import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import logger from '../utils/logger';
import { Prisma } from '@prisma/client';

// Helper to create default stages
const DEFAULT_STAGES = [
  { name: 'Applied', type: 'APPLIED' as const, order: 1, description: 'Initial application received' },
  { name: 'Shortlisted', type: 'SHORTLISTED' as const, order: 2, description: 'Candidate shortlisted for next round' },
  { name: 'Interviewed', type: 'INTERVIEWED' as const, order: 3, description: 'Interview completed' },
  { name: 'Selected', type: 'SELECTED' as const, order: 4, description: 'Candidate selected for the role' },
  { name: 'Rejected', type: 'REJECTED' as const, order: 5, description: 'Application rejected' },
];

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
      status,
      salaryMin,
      salaryMax,
      openings,
      eligibleDegrees,
      eligibleStreams,
      eligibleYears,
      minCGPA,
      responsibilities,
      skills,
      employmentType,
      experienceLevel,
      workMode,
    } = req.body;

    const jd = await prisma.$transaction(
      async (tx) => {
        // Create JD
        const newJD = await tx.jobDescription.create({
          data: {
            title,
            description,
            department,
            location,
            status: status || 'DRAFT',
            salaryMin: salaryMin ? new Prisma.Decimal(salaryMin) : null,
            salaryMax: salaryMax ? new Prisma.Decimal(salaryMax) : null,
            openings: openings ? parseInt(openings, 10) : 1,
            eligibleDegrees: eligibleDegrees || [],
            eligibleStreams: eligibleStreams || [],
            eligibleYears: eligibleYears || [],
            minCGPA: minCGPA ? new Prisma.Decimal(minCGPA) : null,
            responsibilities,
            skills: skills || [],
            employmentType,
            experienceLevel,
            workMode,
            createdById: req.user!.id,
          },
          include: {
            createdBy: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        });

        // Create default stages using createMany (more efficient)
        await tx.stage.createMany({
          data: DEFAULT_STAGES.map(stage => ({
            ...stage,
            jdId: newJD.id,
          })),
        });

        // Create dashboard entry
        await tx.dashboard.create({
          data: { jdId: newJD.id },
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
      },
      {
        maxWait: 10000, // 10 seconds
        timeout: 15000, // 15 seconds
      }
    );

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
        { department: { contains: search as string, mode: 'insensitive' } },
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
            select: { id: true, name: true, email: true, role: true },
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
          select: { id: true, name: true, email: true, role: true },
        },
        stages: {
          orderBy: { order: 'asc' },
          include: {
            _count: {
              select: { currentCandidates: true },
            },
          },
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

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.createdById;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData._count;
    delete updateData.stages;
    delete updateData.createdBy;

    // Parse numeric fields if they exist - Use Prisma.Decimal for Decimal fields
    if (updateData.salaryMin !== undefined) {
      updateData.salaryMin = updateData.salaryMin ? new Prisma.Decimal(updateData.salaryMin) : null;
    }
    if (updateData.salaryMax !== undefined) {
      updateData.salaryMax = updateData.salaryMax ? new Prisma.Decimal(updateData.salaryMax) : null;
    }
    if (updateData.minCGPA !== undefined) {
      updateData.minCGPA = updateData.minCGPA ? new Prisma.Decimal(updateData.minCGPA) : null;
    }
    if (updateData.openings !== undefined) {
      updateData.openings = parseInt(updateData.openings, 10);
    }

    const [jd] = await prisma.$transaction([
      prisma.jobDescription.update({
        where: { id },
        data: updateData,
        include: {
          createdBy: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
      prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          action: 'JD_UPDATED',
          entityType: 'JD',
          entityId: id,
          metadata: { updatedFields: Object.keys(updateData) } as Prisma.InputJsonValue,
        },
      }),
    ]);

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

    // Check if JD has candidates
    const candidateCount = await prisma.candidate.count({
      where: { jdId: id },
    });

    if (candidateCount > 0) {
      res.status(400).json({
        error: 'Cannot delete Job Description with associated candidates. Close it instead.',
      });
      return;
    }

    await prisma.$transaction([
      prisma.jobDescription.delete({
        where: { id },
      }),
      prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          action: 'JD_DELETED',
          entityType: 'JD',
          entityId: id,
        },
      }),
    ]);

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

    if (!status || !['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED'].includes(status)) {
      res.status(400).json({ error: 'Invalid status value' });
      return;
    }

    const [jd] = await prisma.$transaction([
      prisma.jobDescription.update({
        where: { id },
        data: { status },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
      prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          action: 'JD_STATUS_UPDATED',
          entityType: 'JD',
          entityId: id,
          metadata: { status } as Prisma.InputJsonValue,
        },
      }),
    ]);

    logger.info(`JD status updated: ${id} to ${status} by user: ${req.user!.id}`);

    res.json({
      message: 'Job Description status updated successfully',
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

    const jd = await prisma.jobDescription.findUnique({
      where: { id },
      select: { id: true, title: true },
    });

    if (!jd) {
      res.status(404).json({ error: 'Job Description not found' });
      return;
    }

    const stages = await prisma.stage.findMany({
      where: { jdId: id },
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: {
            currentCandidates: true,
            candidateStages: true,
          },
        },
      },
    });

    res.json({ stages });
  } catch (error) {
    next(error);
  }
};

export const getJDStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const jd = await prisma.jobDescription.findUnique({
      where: { id },
      select: { id: true, title: true, openings: true },
    });

    if (!jd) {
      res.status(404).json({ error: 'Job Description not found' });
      return;
    }

    // Get detailed stats
    const [
      totalCandidates,
      eligibleCandidates,
      ineligibleCandidates,
      stageCounts,
      dashboard,
    ] = await Promise.all([
      prisma.candidate.count({ where: { jdId: id } }),
      prisma.candidate.count({ where: { jdId: id, isEligible: true } }),
      prisma.candidate.count({ where: { jdId: id, isEligible: false } }),
      prisma.stage.findMany({
        where: { jdId: id },
        orderBy: { order: 'asc' },
        include: {
          _count: {
            select: { currentCandidates: true },
          },
        },
      }),
      prisma.dashboard.findUnique({ where: { jdId: id } }),
    ]);

    const selectedCount = dashboard?.selectedCount || 0;
    const fillRate = jd.openings > 0 
      ? ((selectedCount / jd.openings) * 100).toFixed(2) 
      : '0';

    const stats = {
      totalCandidates,
      eligibleCandidates,
      ineligibleCandidates,
      openings: jd.openings,
      fillRate,
      stages: stageCounts.map(stage => ({
        name: stage.name,
        type: stage.type,
        count: stage._count.currentCandidates,
      })),
      dashboard,
    };

    res.json({ stats });
  } catch (error) {
    next(error);
  }
};

export const duplicateJD = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const originalJD = await prisma.jobDescription.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!originalJD) {
      res.status(404).json({ error: 'Job Description not found' });
      return;
    }

    const duplicatedJD = await prisma.$transaction(
      async (tx) => {
        // Create duplicated JD
        const { id: _, stages, createdAt, updatedAt, createdById, ...jdData } = originalJD;

        const newJD = await tx.jobDescription.create({
          data: {
            ...jdData,
            title: `${originalJD.title} (Copy)`,
            status: 'DRAFT',
            createdById: req.user!.id,
          },
          include: {
            createdBy: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        });

        // Duplicate stages using createMany
        if (originalJD.stages && originalJD.stages.length > 0) {
          await tx.stage.createMany({
            data: originalJD.stages.map(stage => {
              const { id, jdId, createdAt, updatedAt, ...stageData } = stage;
              return {
                ...stageData,
                jdId: newJD.id,
              };
            }),
          });
        }

        // Create dashboard
        await tx.dashboard.create({
          data: { jdId: newJD.id },
        });

        // Log activity
        await tx.activityLog.create({
          data: {
            userId: req.user!.id,
            action: 'JD_DUPLICATED',
            entityType: 'JD',
            entityId: newJD.id,
            metadata: { originalJdId: id } as Prisma.InputJsonValue,
          },
        });

        return newJD;
      },
      {
        maxWait: 10000,
        timeout: 15000,
      }
    );

    logger.info(`JD duplicated: ${id} -> ${duplicatedJD.id} by user: ${req.user!.id}`);

    res.status(201).json({
      message: 'Job Description duplicated successfully',
      jd: duplicatedJD,
    });
  } catch (error) {
    next(error);
  }
};
