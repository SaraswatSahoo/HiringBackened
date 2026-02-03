// src/controllers/communication.controller.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import logger from '../utils/logger';
import emailService from '../services/email.service';
import whatsappService from '../services/whatsapp.service';
import smsService from '../services/sms.service';
import { CommChannel } from '@prisma/client';
import { CommunicationFilters } from '../types/api';

export const sendBulkCommunication = async (
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
      filters,
      scheduledAt,
    } = req.body;
    
    let candidates;
    
    if (candidateIds && candidateIds.length > 0) {
      candidates = await prisma.candidate.findMany({
        where: {
          id: { in: candidateIds },
          jdId,
        },
        select: { id: true, name: true, email: true, phone: true },
      });
    } else if (filters) {
      const where: any = { jdId };
      if (filters.stageId) where.currentStageId = filters.stageId;
      if (filters.isEligible !== undefined) where.isEligible = filters.isEligible;
      if (filters.college) where.college = filters.college;
      
      candidates = await prisma.candidate.findMany({
        where,
        select: { id: true, name: true, email: true, phone: true },
      });
    } else {
      res.status(400).json({ 
        error: 'Either candidateIds or filters must be provided' 
      });
      return;
    }
    
    if (candidates.length === 0) {
      res.status(400).json({ error: 'No candidates found matching criteria' });
      return;
    }
    
    const communication = await prisma.communication.create({
      data: {
        jdId,
        channel: channel as CommChannel,
        templateId,
        subject,
        message,
        totalRecipients: candidates.length,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
    });
    
    await prisma.candidateComm.createMany({
      data: candidates.map(candidate => ({
        communicationId: communication.id,
        candidateId: candidate.id,
        status: 'PENDING',
      })),
    });
    
    if (!scheduledAt) {
      processCommunication(communication.id, channel as CommChannel, candidates, message, subject)
        .catch(err => logger.error('Communication processing failed:', err));
    }
    
    res.status(202).json({
      message: 'Communication initiated successfully',
      communicationId: communication.id,
      totalRecipients: candidates.length,
    });
  } catch (error) {
    next(error);
  }
};

async function processCommunication(
  commId: string, 
  channel: CommChannel, 
  candidates: any[], 
  message: string, 
  subject?: string
): Promise<void> {
  try {
    const service = {
      EMAIL: emailService,
      WHATSAPP: whatsappService,
      SMS: smsService,
    }[channel];
    
    let sentCount = 0;
    let failedCount = 0;
    
    const BATCH_SIZE = 10;
    const BATCH_DELAY = 1000;
    
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      
      const results = await Promise.allSettled(
        batch.map(async (candidate) => {
          const personalizedMessage = message.replace(/\{name\}/g, candidate.name);
          
          if (channel === 'EMAIL' && subject) {
            await service.send(candidate.email, subject, personalizedMessage);
          } else {
            await service.send(candidate.phone, personalizedMessage);
          }
          
          await prisma.candidateComm.updateMany({
            where: {
              communicationId: commId,
              candidateId: candidate.id,
            },
            data: {
              status: 'SENT',
              sentAt: new Date(),
            },
          });
        })
      );
      
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          sentCount++;
        } else {
          failedCount++;
        }
      });
      
      if (i + BATCH_SIZE < candidates.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }
    
    await prisma.communication.update({
      where: { id: commId },
      data: {
        sentCount,
        failedCount,
        sentAt: new Date(),
      },
    });
    
    logger.info(`Communication ${commId} completed: ${sentCount}/${candidates.length} sent`);
    
  } catch (error) {
    logger.error(`Communication ${commId} failed:`, error);
  }
}

export const getCommunicationsByJD = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;
    const { page = '1', limit = '20', channel } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;
    const where: any = { jdId };
    
    if (channel) where.channel = channel;
    
    const [communications, total] = await Promise.all([
      prisma.communication.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          template: {
            select: { name: true, category: true },
          },
        },
      }),
      prisma.communication.count({ where }),
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

export const getCommunicationDetails = async (
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
              select: { id: true, name: true, email: true, phone: true },
            },
          },
        },
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

// Template Management
export const createTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, channel, category, subject, body, variables } = req.body;
    
    const template = await prisma.template.create({
      data: {
        name,
        channel: channel as CommChannel,
        category,
        subject,
        body,
        variables: variables || [],
      },
    });
    
    res.status(201).json({
      message: 'Template created successfully',
      template,
    });
  } catch (error) {
    next(error);
  }
};

export const getTemplates = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { channel, category, isActive = 'true' } = req.query;
    
    const where: any = {};
    if (channel) where.channel = channel;
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    
    const templates = await prisma.template.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    
    res.json({ templates });
  } catch (error) {
    next(error);
  }
};

export const updateTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    delete updateData.id;
    delete updateData.createdAt;
    
    const template = await prisma.template.update({
      where: { id },
      data: updateData,
    });
    
    res.json({
      message: 'Template updated successfully',
      template,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    
    await prisma.template.delete({
      where: { id },
    });
    
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    next(error);
  }
};
