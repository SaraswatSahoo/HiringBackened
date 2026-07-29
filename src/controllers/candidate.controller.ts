// src/controllers/candidate.controller.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import logger from '../utils/logger';
import { Prisma } from '@prisma/client';

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
      // Prepare data with Decimal conversions
      const newCandidate = await tx.candidate.create({
        data: {
          // Basic Information
          name: candidateData.name,
          email: candidateData.email,
          phone: candidateData.phone,
          alternatePhone: candidateData.alternatePhone,
          dateOfBirth: candidateData.dateOfBirth ? new Date(candidateData.dateOfBirth) : undefined,
          gender: candidateData.gender,
          
          // College/Academic Information
          college: candidateData.college,
          degree: candidateData.degree,
          branch: candidateData.branch,
          stream: candidateData.stream,
          passOutYear: candidateData.passOutYear,
          cgpa: candidateData.cgpa ? new Prisma.Decimal(candidateData.cgpa) : undefined,
          backlogs: candidateData.backlogs,
          activeBacklogs: candidateData.activeBacklogs,
          tenthPercentage: candidateData.tenthPercentage ? new Prisma.Decimal(candidateData.tenthPercentage) : undefined,
          twelfthPercentage: candidateData.twelfthPercentage ? new Prisma.Decimal(candidateData.twelfthPercentage) : undefined,
          
          // Documents
          resumeLink: candidateData.resumeLink,
          photoUrl: candidateData.photoUrl,
          idProofUrl: candidateData.idProofUrl,
          marksheetUrls: candidateData.marksheetUrls || [],
          
          // Location
          address: candidateData.address,
          city: candidateData.city,
          state: candidateData.state,
          pincode: candidateData.pincode,
          country: candidateData.country,
          
          // Skills & Experience
          skills: candidateData.skills || [],
          certifications: candidateData.certifications || [],
          projects: candidateData.projects || [],
          internships: candidateData.internships || [],
          hasWorkExperience: candidateData.hasWorkExperience || false,
          yearsOfExperience: candidateData.yearsOfExperience ? new Prisma.Decimal(candidateData.yearsOfExperience) : undefined,
          
          // Application Status
          applicationStatus: candidateData.applicationStatus || 'PENDING',
          ineligibilityReason: candidateData.ineligibilityReason,
          
          // Assessment Scores
          interviewScore: candidateData.interviewScore ? new Prisma.Decimal(candidateData.interviewScore) : undefined,
          technicalScore: candidateData.technicalScore ? new Prisma.Decimal(candidateData.technicalScore) : undefined,
          hrScore: candidateData.hrScore ? new Prisma.Decimal(candidateData.hrScore) : undefined,
          overallRating: candidateData.overallRating ? new Prisma.Decimal(candidateData.overallRating) : undefined,
          
          // Offer Details
          offerStatus: candidateData.offerStatus,
          offerLetterUrl: candidateData.offerLetterUrl,
          offeredCTC: candidateData.offeredCTC ? new Prisma.Decimal(candidateData.offeredCTC) : undefined,
          joiningDate: candidateData.joiningDate ? new Date(candidateData.joiningDate) : undefined,
          hasJoined: candidateData.hasJoined || false,
          
          // Metadata
          tags: candidateData.tags || [],
          jdId,
          currentStageId: firstStage.id,
          appliedAt: new Date(),
          lastActivityAt: new Date(),
        },
      });
      
      // Create initial stage history
      await tx.candidateStage.create({
        data: {
          candidateId: newCandidate.id,
          stageId: firstStage.id,
        },
      });
      
      // Check eligibility for bulk hiring
      const jd = await tx.jobDescription.findUnique({
        where: { id: jdId },
      });
      
      if (jd) {
        let isEligible = true;
        let ineligibilityReason = '';
        
        // Check degree eligibility
        if (jd.eligibleDegrees.length > 0 && !jd.eligibleDegrees.includes(candidateData.degree)) {
          isEligible = false;
          ineligibilityReason += 'Degree not eligible. ';
        }
        
        // Check stream eligibility
        if (jd.eligibleStreams.length > 0 && candidateData.stream && !jd.eligibleStreams.includes(candidateData.stream)) {
          isEligible = false;
          ineligibilityReason += 'Stream not eligible. ';
        }
        
        // Check year eligibility
        if (jd.eligibleYears.length > 0 && !jd.eligibleYears.includes(candidateData.passOutYear)) {
          isEligible = false;
          ineligibilityReason += 'Pass out year not eligible. ';
        }
        
        // Check CGPA eligibility
        if (jd.minCGPA && candidateData.cgpa) {
          const minCGPA = parseFloat(jd.minCGPA.toString());
          const candidateCGPA = parseFloat(candidateData.cgpa.toString());
          if (candidateCGPA < minCGPA) {
            isEligible = false;
            ineligibilityReason += `CGPA below minimum (${minCGPA}). `;
          }
        }
        
        // Update eligibility
        await tx.candidate.update({
          where: { id: newCandidate.id },
          data: { 
            isEligible,
            ineligibilityReason: ineligibilityReason.trim() || undefined,
          },
        });
      }
      
      // Update dashboard counts
      await tx.dashboard.update({
        where: { jdId },
        data: {
          totalCandidates: { increment: 1 },
          eligibleCount: { increment: newCandidate.isEligible ? 1 : 0 },
        },
      });
      
      // Log activity
      await tx.activityLog.create({
        data: {
          userId: req.user!.id,
          action: 'CANDIDATE_CREATED',
          entityType: 'CANDIDATE',
          entityId: newCandidate.id,
          metadata: { jdId, name: newCandidate.name } as Prisma.InputJsonValue,
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
      applicationStatus,
      offerStatus,
      college,
      degree,
      branch,
      stream,
      city,
      state,
      passOutYear,
      minCGPA,
      maxCGPA,
      hasWorkExperience,
      hasJoined,
      gender,
      skills,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;
    
    const where: any = { jdId };
    
    // Filters
    if (stageId) where.currentStageId = stageId;
    if (isEligible !== undefined) where.isEligible = isEligible === 'true';
    if (applicationStatus) where.applicationStatus = applicationStatus;
    if (offerStatus) where.offerStatus = offerStatus;
    if (college) where.college = { contains: college as string, mode: 'insensitive' };
    if (degree) where.degree = degree;
    if (branch) where.branch = branch;
    if (stream) where.stream = stream;
    if (city) where.city = { contains: city as string, mode: 'insensitive' };
    if (state) where.state = state;
    if (passOutYear) where.passOutYear = parseInt(passOutYear as string, 10);
    if (hasWorkExperience !== undefined) where.hasWorkExperience = hasWorkExperience === 'true';
    if (hasJoined !== undefined) where.hasJoined = hasJoined === 'true';
    if (gender) where.gender = gender;
    
    // CGPA range filter
    if (minCGPA || maxCGPA) {
      where.cgpa = {};
      if (minCGPA) where.cgpa.gte = new Prisma.Decimal(minCGPA as string);
      if (maxCGPA) where.cgpa.lte = new Prisma.Decimal(maxCGPA as string);
    }
    
    // Skills filter
    if (skills) {
      where.skills = {
        hasSome: (skills as string).split(',').map(s => s.trim()),
      };
    }
    
    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
        { college: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    
    // Sorting
    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder;
    
    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        skip,
        take: limitNum,
        orderBy,
        include: {
          currentStage: true,
          feedbacks: {
            include: {
              givenBy: {
                select: { name: true, email: true },
              },
            },
            take: 3,
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: {
              feedbacks: true,
              emails: true,
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
          select: { 
            id: true, 
            title: true, 
            department: true, 
            status: true,
            eligibleDegrees: true,
            eligibleStreams: true,
            eligibleYears: true,
            minCGPA: true,
          },
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
        emails: {
          include: {
            email: {
              select: {
                id: true,
                subject: true,
                type: true,
                sentAt: true,
                createdAt: true,
              },
            },
          },
          orderBy: { sentAt: 'desc' },
          take: 10, // Limit to recent 10 emails
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
    
    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.jdId;
    delete updateData.createdAt;
    delete updateData.currentStageId;
    delete updateData.updatedAt;
    delete updateData.appliedAt;
    
    // Convert Decimal fields
    if (updateData.cgpa !== undefined) {
      updateData.cgpa = updateData.cgpa ? new Prisma.Decimal(updateData.cgpa) : null;
    }
    if (updateData.tenthPercentage !== undefined) {
      updateData.tenthPercentage = updateData.tenthPercentage ? new Prisma.Decimal(updateData.tenthPercentage) : null;
    }
    if (updateData.twelfthPercentage !== undefined) {
      updateData.twelfthPercentage = updateData.twelfthPercentage ? new Prisma.Decimal(updateData.twelfthPercentage) : null;
    }
    if (updateData.yearsOfExperience !== undefined) {
      updateData.yearsOfExperience = updateData.yearsOfExperience ? new Prisma.Decimal(updateData.yearsOfExperience) : null;
    }
    if (updateData.interviewScore !== undefined) {
      updateData.interviewScore = updateData.interviewScore ? new Prisma.Decimal(updateData.interviewScore) : null;
    }
    if (updateData.technicalScore !== undefined) {
      updateData.technicalScore = updateData.technicalScore ? new Prisma.Decimal(updateData.technicalScore) : null;
    }
    if (updateData.hrScore !== undefined) {
      updateData.hrScore = updateData.hrScore ? new Prisma.Decimal(updateData.hrScore) : null;
    }
    if (updateData.overallRating !== undefined) {
      updateData.overallRating = updateData.overallRating ? new Prisma.Decimal(updateData.overallRating) : null;
    }
    if (updateData.offeredCTC !== undefined) {
      updateData.offeredCTC = updateData.offeredCTC ? new Prisma.Decimal(updateData.offeredCTC) : null;
    }
    
    // Convert date fields
    if (updateData.dateOfBirth) {
      updateData.dateOfBirth = new Date(updateData.dateOfBirth);
    }
    if (updateData.joiningDate) {
      updateData.joiningDate = new Date(updateData.joiningDate);
    }
    
    // Update lastActivityAt
    updateData.lastActivityAt = new Date();
    
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

export const updateOfferStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { offerStatus, offerLetterUrl, offeredCTC, joiningDate } = req.body;
    
    const updateData: any = {
      offerStatus,
      lastActivityAt: new Date(),
    };
    
    if (offerLetterUrl) updateData.offerLetterUrl = offerLetterUrl;
    if (offeredCTC) updateData.offeredCTC = new Prisma.Decimal(offeredCTC);
    if (joiningDate) updateData.joiningDate = new Date(joiningDate);
    
    const candidate = await prisma.candidate.update({
      where: { id },
      data: updateData,
    });
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'OFFER_STATUS_UPDATED',
        entityType: 'CANDIDATE',
        entityId: id,
        metadata: { offerStatus } as Prisma.InputJsonValue,
      },
    });
    
    logger.info(`Offer status updated for candidate: ${id} to ${offerStatus}`);
    
    res.json({
      message: 'Offer status updated successfully',
      candidate,
    });
  } catch (error) {
    next(error);
  }
};

export const updateScores = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { interviewScore, technicalScore, hrScore, overallRating } = req.body;
    
    const updateData: any = {
      lastActivityAt: new Date(),
    };
    
    if (interviewScore !== undefined) updateData.interviewScore = new Prisma.Decimal(interviewScore);
    if (technicalScore !== undefined) updateData.technicalScore = new Prisma.Decimal(technicalScore);
    if (hrScore !== undefined) updateData.hrScore = new Prisma.Decimal(hrScore);
    if (overallRating !== undefined) updateData.overallRating = new Prisma.Decimal(overallRating);
    
    const candidate = await prisma.candidate.update({
      where: { id },
      data: updateData,
    });
    
    logger.info(`Scores updated for candidate: ${id}`);
    
    res.json({
      message: 'Scores updated successfully',
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
      // Exit current stage
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
      
      // Enter new stage
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
      
      // Update current stage and last activity
      await tx.candidate.update({
        where: { id },
        data: { 
          currentStageId: stageId,
          lastActivityAt: new Date(),
        },
      });
      
      // Log activity
      await tx.activityLog.create({
        data: {
          userId: req.user!.id,
          action: 'STAGE_CHANGED',
          entityType: 'CANDIDATE',
          entityId: id,
          metadata: { stageId, notes } as Prisma.InputJsonValue,
        },
      });
    });
    
    logger.info(`Candidate ${id} moved to stage ${stageId}`);
    
    res.json({ message: 'Candidate stage updated successfully' });
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
        // Exit current stage
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
        
        // Enter new stage
        await tx.candidateStage.create({
          data: {
            candidateId,
            stageId,
            notes,
          },
        });
        
        // Update current stage
        await tx.candidate.update({
          where: { id: candidateId },
          data: { 
            currentStageId: stageId,
            lastActivityAt: new Date(),
          },
        });
      }
      
      // Log bulk activity
      await tx.activityLog.create({
        data: {
          userId: req.user!.id,
          action: 'BULK_STAGE_CHANGE',
          entityType: 'CANDIDATE',
          entityId: 'multiple',
          metadata: { 
            candidateIds, 
            stageId, 
            count: candidateIds.length 
          } as Prisma.InputJsonValue,
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

export const bulkUpdateOffers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { candidateIds, offerStatus } = req.body;
    
    if (!candidateIds || candidateIds.length === 0) {
      res.status(400).json({ error: 'No candidates selected' });
      return;
    }
    
    await prisma.$transaction(async (tx) => {
      await tx.candidate.updateMany({
        where: {
          id: { in: candidateIds },
        },
        data: {
          offerStatus,
          lastActivityAt: new Date(),
        },
      });
      
      // Log bulk activity
      await tx.activityLog.create({
        data: {
          userId: req.user!.id,
          action: 'BULK_OFFER_UPDATE',
          entityType: 'CANDIDATE',
          entityId: 'multiple',
          metadata: { 
            candidateIds, 
            offerStatus, 
            count: candidateIds.length 
          } as Prisma.InputJsonValue,
        },
      });
    });
    
    logger.info(`Bulk updated offer status for ${candidateIds.length} candidates to ${offerStatus}`);
    
    res.json({ 
      message: `${candidateIds.length} candidates updated successfully` 
    });
  } catch (error) {
    next(error);
  }
};

export const getCandidatesByCollege = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId, college } = req.params;
    const { page = '1', limit = '50' } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;
    
    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where: {
          jdId,
          college: { contains: college, mode: 'insensitive' },
        },
        skip,
        take: limitNum,
        include: {
          currentStage: true,
        },
        orderBy: { cgpa: 'desc' },
      }),
      prisma.candidate.count({
        where: {
          jdId,
          college: { contains: college, mode: 'insensitive' },
        },
      }),
    ]);
    
    res.json({ 
      candidates, 
      count: total,
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

export const getEligibleCandidates = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;
    const { page = '1', limit = '50' } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;
    
    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where: {
          jdId,
          isEligible: true,
        },
        skip,
        take: limitNum,
        include: {
          currentStage: true,
        },
        orderBy: { cgpa: 'desc' },
      }),
      prisma.candidate.count({
        where: {
          jdId,
          isEligible: true,
        },
      }),
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

export const getCandidatesWithOffers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;
    const { status, page = '1', limit = '50' } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;
    
    const where: any = {
      jdId,
      offerStatus: { not: null },
    };
    
    if (status) {
      where.offerStatus = status;
    }
    
    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          currentStage: true,
        },
        orderBy: { offeredCTC: 'desc' },
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

export const getCandidatesBySkills = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;
    const { skills, matchAll } = req.query;
    
    if (!skills) {
      res.status(400).json({ error: 'Skills parameter is required' });
      return;
    }
    
    const skillsArray = (skills as string).split(',').map(s => s.trim());
    const shouldMatchAll = matchAll === 'true';
    
    const where: any = {
      jdId,
      skills: shouldMatchAll 
        ? { hasEvery: skillsArray }
        : { hasSome: skillsArray },
    };
    
    const candidates = await prisma.candidate.findMany({
      where,
      include: {
        currentStage: true,
      },
      orderBy: { cgpa: 'desc' },
    });
    
    res.json({
      candidates,
      count: candidates.length,
      matchType: shouldMatchAll ? 'ALL' : 'ANY',
      searchedSkills: skillsArray,
    });
  } catch (error) {
    next(error);
  }
};

export const exportCandidatesCSV = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;
    const {
      stageId,
      isEligible,
      applicationStatus,
      offerStatus,
      college,
      degree,
      branch,
      stream,
      city,
      state,
      passOutYear,
      minCGPA,
      maxCGPA,
      hasWorkExperience,
      hasJoined,
      gender,
      skills,
      search,
    } = req.query;

    const jd = await prisma.jobDescription.findUnique({
      where: { id: jdId },
      select: { title: true },
    });

    if (!jd) {
      res.status(404).json({ error: 'Job Description not found' });
      return;
    }

    const where: any = { jdId };

    if (stageId) where.currentStageId = stageId;
    if (isEligible !== undefined) where.isEligible = isEligible === 'true';
    if (applicationStatus) where.applicationStatus = applicationStatus;
    if (offerStatus) where.offerStatus = offerStatus;
    if (college) where.college = { contains: college as string, mode: 'insensitive' };
    if (degree) where.degree = { contains: degree as string, mode: 'insensitive' };
    if (branch) where.branch = { contains: branch as string, mode: 'insensitive' };
    if (stream) where.stream = { contains: stream as string, mode: 'insensitive' };
    if (city) where.city = { contains: city as string, mode: 'insensitive' };
    if (state) where.state = { contains: state as string, mode: 'insensitive' };
    if (passOutYear) where.passOutYear = parseInt(passOutYear as string, 10);
    if (gender) where.gender = gender;
    if (hasWorkExperience !== undefined) where.hasWorkExperience = hasWorkExperience === 'true';
    if (hasJoined !== undefined) where.hasJoined = hasJoined === 'true';

    if (minCGPA || maxCGPA) {
      where.cgpa = {};
      if (minCGPA) where.cgpa.gte = parseFloat(minCGPA as string);
      if (maxCGPA) where.cgpa.lte = parseFloat(maxCGPA as string);
    }

    if (skills) {
      const skillsList = (skills as string).split(',').map((s) => s.trim());
      where.skills = { hasSome: skillsList };
    }

    if (search) {
      const searchStr = search as string;
      where.OR = [
        { name: { contains: searchStr, mode: 'insensitive' } },
        { email: { contains: searchStr, mode: 'insensitive' } },
        { phone: { contains: searchStr, mode: 'insensitive' } },
        { college: { contains: searchStr, mode: 'insensitive' } },
      ];
    }

    const candidates = await prisma.candidate.findMany({
      where,
      include: {
        currentStage: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'Name',
      'Email',
      'Phone',
      'College',
      'Degree',
      'Branch',
      'Pass Out Year',
      'CGPA',
      'Eligible',
      'Ineligibility Reason',
      'Current Stage',
      'Offer Status',
      'Offered CTC',
      'Technical Score',
      'HR Score',
      'Interview Score',
      'Overall Rating',
      'Applied At',
    ];

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const val = String(str).replace(/"/g, '""');
      return `"${val}"`;
    };

    const rows = candidates.map((c) => [
      escapeCsv(c.name),
      escapeCsv(c.email),
      escapeCsv(c.phone),
      escapeCsv(c.college),
      escapeCsv(c.degree),
      escapeCsv(c.branch || 'N/A'),
      escapeCsv(c.passOutYear),
      escapeCsv(c.cgpa ? c.cgpa.toString() : 'N/A'),
      escapeCsv(c.isEligible ? 'Yes' : 'No'),
      escapeCsv(c.ineligibilityReason || ''),
      escapeCsv(c.currentStage?.name || 'N/A'),
      escapeCsv(c.offerStatus || 'PENDING'),
      escapeCsv(c.offeredCTC ? c.offeredCTC.toString() : 'N/A'),
      escapeCsv(c.technicalScore ? c.technicalScore.toString() : 'N/A'),
      escapeCsv(c.hrScore ? c.hrScore.toString() : 'N/A'),
      escapeCsv(c.interviewScore ? c.interviewScore.toString() : 'N/A'),
      escapeCsv(c.overallRating ? c.overallRating.toString() : 'N/A'),
      escapeCsv(new Date(c.appliedAt).toISOString().split('T')[0]),
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const sanitizedTitle = jd.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `candidates_${sanitizedTitle}_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    next(error);
  }
};
