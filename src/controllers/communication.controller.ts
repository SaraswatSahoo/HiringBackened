// src/controllers/communication.controller.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import logger from '../utils/logger';
import emailService from '../services/email.service';

export const createCommunication = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      jdId,
      channel,
      templateId,
      subject,
      message,
      candidateIds,
      scheduledAt,
    } = req.body;
    
    // Validate channel - only EMAIL supported
    if (channel !== 'EMAIL') {
      res.status(400).json({ 
        error: 'Only EMAIL channel is supported in this version' 
      });
      return;
    }
    
    const candidates = await prisma.candidate.findMany({
      where: {
        id: { in: candidateIds },
        jdId,
      },
      include: {
        jd: {
          select: { title: true },
        },
      },
    });
    
    if (candidates.length === 0) {
      res.status(404).json({ error: 'No candidates found' });
      return;
    }
    
    const communication = await prisma.communication.create({
      data: {
        jdId,
        channel,
        templateId,
        subject,
        message,
        totalRecipients: candidates.length,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
    });
    
    // Send emails asynchronously
    const sendPromises = candidates.map(async (candidate) => {
      try {
        const personalizedMessage = message
          .replace(/\{name\}/g, candidate.name)
          .replace(/\{email\}/g, candidate.email)
          .replace(/\{jdTitle\}/g, candidate.jd.title);
        
        await emailService.send(
          candidate.email,
          subject || 'Update from HR Team',
          personalizedMessage
        );
        
        await prisma.candidateComm.create({
          data: {
            communicationId: communication.id,
            candidateId: candidate.id,
            status: 'SENT',
            sentAt: new Date(),
          },
        });
        
        return { success: true, candidateId: candidate.id };
      } catch (error) {
        await prisma.candidateComm.create({
          data: {
            communicationId: communication.id,
            candidateId: candidate.id,
            status: 'FAILED',
            failureReason: error instanceof Error ? error.message : 'Unknown error',
          },
        });
        
        return { success: false, candidateId: candidate.id };
      }
    });
    
    const results = await Promise.allSettled(sendPromises);
    
    const sentCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failedCount = results.length - sentCount;
    
    await prisma.communication.update({
      where: { id: communication.id },
      data: {
        sentCount,
        failedCount,
        sentAt: new Date(),
      },
    });
    
    logger.info(`Communication sent: ${sentCount}/${candidates.length} successful`);
    
    res.status(201).json({
      message: 'Communication sent',
      communicationId: communication.id,
      sentCount,
      failedCount,
      totalRecipients: candidates.length,
    });
  } catch (error) {
    next(error);
  }
};

export const getCommunicationsByJD = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;
    const { page = '1', limit = '20' } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;
    
    const [communications, total] = await Promise.all([
      prisma.communication.findMany({
        where: { jdId },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          template: true,
        },
      }),
      prisma.communication.count({ where: { jdId } }),
    ]);
    
    res.json({
      communications,
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

export const getCommunicationById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    
    const communication = await prisma.communication.findUnique({
      where: { id },
      include: {
        recipients: {
          include: {
            candidate: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        template: true,
      },
    });
    
    if (!communication) {
      res.status(404).json({ error: 'Communication not found' });
      return;
    }
    
    res.json({ communication });
  } catch (error) {
    next(error);
  }
};
