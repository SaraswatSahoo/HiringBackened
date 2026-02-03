// src/controllers/feedback.controller.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import logger from '../utils/logger';

export const createFeedback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      candidateId,
      rating,
      comments,
      technicalSkills,
      communication,
      cultureFit,
      problemSolving,
      recommendation,
    } = req.body;
    
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });
    
    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }
    
    const feedback = await prisma.feedback.create({
      data: {
        candidateId,
        givenById: req.user!.id,
        rating,
        comments,
        technicalSkills,
        communication,
        cultureFit,
        problemSolving,
        recommendation,
      },
      include: {
        givenBy: {
          select: { id: true, name: true, email: true },
        },
        candidate: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    
    logger.info(`Feedback created for candidate ${candidateId} by ${req.user!.id}`);
    
    res.status(201).json({
      message: 'Feedback submitted successfully',
      feedback,
    });
  } catch (error) {
    next(error);
  }
};

export const getFeedbacksByCandidate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { candidateId } = req.params;
    
    const feedbacks = await prisma.feedback.findMany({
      where: { candidateId },
      include: {
        givenBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    const avgRating = await prisma.feedback.aggregate({
      where: { candidateId },
      _avg: {
        rating: true,
        technicalSkills: true,
        communication: true,
        cultureFit: true,
        problemSolving: true,
      },
    });
    
    res.json({
      feedbacks,
      averages: avgRating._avg,
      count: feedbacks.length,
    });
  } catch (error) {
    next(error);
  }
};

export const getFeedbackById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    
    const feedback = await prisma.feedback.findUnique({
      where: { id },
      include: {
        givenBy: {
          select: { id: true, name: true, email: true },
        },
        candidate: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    
    if (!feedback) {
      res.status(404).json({ error: 'Feedback not found' });
      return;
    }
    
    res.json({ feedback });
  } catch (error) {
    next(error);
  }
};

export const updateFeedback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Check ownership
    const existingFeedback = await prisma.feedback.findUnique({
      where: { id },
    });
    
    if (!existingFeedback) {
      res.status(404).json({ error: 'Feedback not found' });
      return;
    }
    
    if (existingFeedback.givenById !== req.user!.id && req.user!.role !== 'ADMIN') {
      res.status(403).json({ error: 'You can only update your own feedback' });
      return;
    }
    
    delete updateData.id;
    delete updateData.candidateId;
    delete updateData.givenById;
    delete updateData.createdAt;
    
    const feedback = await prisma.feedback.update({
      where: { id },
      data: updateData,
    });
    
    logger.info(`Feedback updated: ${id} by user: ${req.user!.id}`);
    
    res.json({
      message: 'Feedback updated successfully',
      feedback,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteFeedback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    
    const existingFeedback = await prisma.feedback.findUnique({
      where: { id },
    });
    
    if (!existingFeedback) {
      res.status(404).json({ error: 'Feedback not found' });
      return;
    }
    
    if (existingFeedback.givenById !== req.user!.id && req.user!.role !== 'ADMIN') {
      res.status(403).json({ error: 'You can only delete your own feedback' });
      return;
    }
    
    await prisma.feedback.delete({
      where: { id },
    });
    
    logger.info(`Feedback deleted: ${id} by user: ${req.user!.id}`);
    
    res.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getFeedbacksByJD = async (
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
    
    const [feedbacks, total] = await Promise.all([
      prisma.feedback.findMany({
        where: {
          candidate: { jdId },
        },
        skip,
        take: limitNum,
        include: {
          givenBy: {
            select: { id: true, name: true, email: true },
          },
          candidate: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.feedback.count({
        where: {
          candidate: { jdId },
        },
      }),
    ]);
    
    res.json({
      feedbacks,
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
