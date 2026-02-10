// src/controllers/communication.controller.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import logger from '../utils/logger';
import emailService from '../services/email.service';
import {
  CreateEmailDto,
  EmailType,
  EmailStatus,
  TemplateCategory,
  CreateTemplateDto,
  UpdateTemplateDto,
} from '../types/email';

// ==================== EMAIL CONTROLLERS ====================

/**
 * Send individual email to a candidate
 */
export const sendIndividualEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      candidateId,
      jdId,
      subject,
      message,
      htmlBody,
      templateId,
      variables = {},
      attachments = [],
    } = req.body;

    const sentBy = req.user?.id || 'system';

    const result = await emailService.sendIndividualEmail(
      candidateId,
      jdId,
      subject,
      message,
      htmlBody || null,
      variables,
      templateId,
      attachments,
      sentBy
    );

    logger.info(`Individual email sent by ${req.user?.email}`, { emailId: result.emailId });

    res.status(201).json({
      message: 'Email sent successfully',
      data: result,
    });
  } catch (error: any) {
    logger.error('Failed to send individual email:', error);
    next(error);
  }
};

/**
 * Send bulk email to multiple candidates
 */
export const sendBulkEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      jdId,
      templateId,
      subject,
      message,
      htmlBody,
      variables = {},
      filters = {},
      candidateIds,
      scheduledAt,
      priority = 0,
      attachments = [],
    } = req.body;

    const sentBy = req.user?.id || 'system';

    const emailData: CreateEmailDto = {
      jdId,
      type: EmailType.BULK,
      templateId,
      subject,
      message,
      htmlBody,
      variables,
      filters,
      candidateIds,
      scheduledAt,
      priority,
      attachments,
      sentBy,
    };

    const result = await emailService.sendBulkEmail(emailData);

    logger.info(`Bulk email initiated by ${req.user?.email}`, {
      emailId: result.emailId,
      recipients: result.totalRecipients,
    });

    res.status(201).json({
      message: 'Bulk email initiated',
      data: result,
    });
  } catch (error: any) {
    logger.error('Failed to send bulk email:', error);
    next(error);
  }
};

/**
 * Get all emails with pagination and filters
 */
export const getAllEmails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      jdId,
      type,
      status,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const result = await emailService.getAllEmails({
      jdId: jdId as string,
      type: type as EmailType,
      page: Number(page),
      limit: Number(limit),
    });

    res.json({
      message: 'Emails retrieved successfully',
      data: result.emails,
      pagination: result.pagination,
    });
  } catch (error: any) {
    logger.error('Failed to get emails:', error);
    next(error);
  }
};

/**
 * Get single email by ID
 */
export const getEmailById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const email = await emailService.getEmailById(id);

    if (!email) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    res.json({
      message: 'Email retrieved successfully',
      data: email,
    });
  } catch (error: any) {
    logger.error('Failed to get email:', error);
    next(error);
  }
};

/**
 * Get emails by JD
 */
export const getEmailsByJD = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await emailService.getAllEmails({
      jdId,
      page: Number(page),
      limit: Number(limit),
    });

    res.json({
      message: 'Emails retrieved successfully',
      data: result.emails,
      pagination: result.pagination,
    });
  } catch (error: any) {
    logger.error('Failed to get emails by JD:', error);
    next(error);
  }
};

/**
 * Get candidate emails
 */
export const getCandidateEmails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { candidateId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const [emails, total] = await Promise.all([
      prisma.candidateEmail.findMany({
        where: { candidateId },
        include: {
          email: {
            select: {
              id: true,
              subject: true,
              type: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.candidateEmail.count({ where: { candidateId } }),
    ]);

    res.json({
      message: 'Candidate emails retrieved successfully',
      data: emails,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get candidate emails:', error);
    next(error);
  }
};

/**
 * Retry failed email
 */
export const retryFailedEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { candidateEmailId } = req.params;

    await emailService.retryFailedEmail(candidateEmailId);

    logger.info(`Email retry initiated for: ${candidateEmailId}`);

    res.json({
      message: 'Email retry initiated',
    });
  } catch (error: any) {
    logger.error('Failed to retry email:', error);
    next(error);
  }
};

// ==================== TEMPLATE CONTROLLERS ====================

/**
 * Get all templates
 */
export const getAllTemplates = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      category,
      isActive,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const where: any = {};
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const [templates, total] = await Promise.all([
      prisma.emailTemplate.findMany({
        where,
        orderBy: { [sortBy as string]: sortOrder },
        skip,
        take: limitNum,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.emailTemplate.count({ where }),
    ]);

    res.json({
      message: 'Templates retrieved successfully',
      data: templates,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get templates:', error);
    next(error);
  }
};

/**
 * Get single template by ID
 */
export const getTemplateById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const template = await prisma.emailTemplate.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    res.json({
      message: 'Template retrieved successfully',
      data: template,
    });
  } catch (error: any) {
    logger.error('Failed to get template:', error);
    next(error);
  }
};

/**
 * Create new template
 */
export const createTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      name,
      description,
      category,
      subject,
      body,
      htmlBody,
      variables = [],
      defaultValues,
      previewData,
      attachments = [],
      isDefault = false,
    } = req.body;

    const createdBy = req.user?.id || 'system';

    // If setting as default, unset other defaults in same category
    if (isDefault) {
      await prisma.emailTemplate.updateMany({
        where: {
          category,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name,
        description,
        category,
        subject,
        body,
        htmlBody,
        variables,
        defaultValues,
        previewData,
        attachments,
        isDefault,
        createdBy,
      },
    });

    logger.info(`Template created: ${template.name} by ${req.user?.email}`);

    res.status(201).json({
      message: 'Template created successfully',
      data: template,
    });
  } catch (error: any) {
    logger.error('Failed to create template:', error);
    next(error);
  }
};

/**
 * Update template
 */
export const updateTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData: UpdateTemplateDto = req.body;

    const existingTemplate = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    // If setting as default, unset other defaults in same category
    if (updateData.isDefault) {
      await prisma.emailTemplate.updateMany({
        where: {
          category: existingTemplate.category,
          isDefault: true,
          id: { not: id },
        },
        data: {
          isDefault: false,
        },
      });
    }

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: updateData,
    });

    logger.info(`Template updated: ${template.name} by ${req.user?.email}`);

    res.json({
      message: 'Template updated successfully',
      data: template,
    });
  } catch (error: any) {
    logger.error('Failed to update template:', error);
    next(error);
  }
};

/**
 * Delete template
 */
export const deleteTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    // Check if template is being used
    const emailCount = await prisma.email.count({
      where: { templateId: id },
    });

    if (emailCount > 0) {
      res.status(400).json({
        error: 'Cannot delete template that is being used',
        usageCount: emailCount,
      });
      return;
    }

    await prisma.emailTemplate.delete({
      where: { id },
    });

    logger.info(`Template deleted: ${template.name} by ${req.user?.email}`);

    res.json({
      message: 'Template deleted successfully',
    });
  } catch (error: any) {
    logger.error('Failed to delete template:', error);
    next(error);
  }
};

/**
 * Preview template with variables
 */
export const previewTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { variables = {} } = req.body;

    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    // Use preview data or provided variables
    const previewVars = {
      ...(template.previewData as object),
      ...variables,
    };

    // Replace variables in subject and body
    const replaceVars = (text: string, vars: any): string => {
      let result = text;
      Object.keys(vars).forEach((key) => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        result = result.replace(regex, String(vars[key]));
      });
      return result;
    };

    const previewedSubject = replaceVars(template.subject, previewVars);
    const previewedBody = replaceVars(template.body, previewVars);
    const previewedHtmlBody = template.htmlBody
      ? replaceVars(template.htmlBody, previewVars)
      : undefined;

    res.json({
      message: 'Template preview generated',
      data: {
        subject: previewedSubject,
        body: previewedBody,
        htmlBody: previewedHtmlBody,
        variables: previewVars,
      },
    });
  } catch (error: any) {
    logger.error('Failed to preview template:', error);
    next(error);
  }
};

// ==================== STATS CONTROLLERS ====================

/**
 * Get email statistics
 */
export const getEmailStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId, startDate, endDate } = req.query;

    const where: any = {};
    if (jdId) where.jdId = jdId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [
      totalEmails,
      totalRecipients,
      sentCount,
      failedCount,
      bouncedCount,
      pendingCount,
    ] = await Promise.all([
      prisma.email.count({ where }),
      prisma.email.aggregate({
        where,
        _sum: { totalRecipients: true },
      }),
      prisma.email.aggregate({
        where,
        _sum: { sentCount: true },
      }),
      prisma.email.aggregate({
        where,
        _sum: { failedCount: true },
      }),
      prisma.email.aggregate({
        where,
        _sum: { bouncedCount: true },
      }),
      prisma.candidateEmail.count({
        where: {
          email: where,
          status: EmailStatus.PENDING,
        },
      }),
    ]);

    const totalRecipientsSum = totalRecipients._sum.totalRecipients ?? 0;
    const sentCountSum = sentCount._sum.sentCount ?? 0;
    const failedCountSum = failedCount._sum.failedCount ?? 0;
    const bouncedCountSum = bouncedCount._sum.bouncedCount ?? 0;

    const stats = {
      totalEmails,
      totalRecipients: totalRecipientsSum,
      sentCount: sentCountSum,
      failedCount: failedCountSum,
      bouncedCount: bouncedCountSum,
      pendingCount,
      successRate:
        totalRecipientsSum > 0
          ? Math.round((sentCountSum / totalRecipientsSum) * 100)
          : 0,
    };

    res.json({
      message: 'Email statistics retrieved successfully',
      data: stats,
    });
  } catch (error: any) {
    logger.error('Failed to get email stats:', error);
    next(error);
  }
};

/**
 * Get email statistics by JD
 */
export const getEmailStatsByJD = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;

    const emails = await prisma.email.findMany({
      where: { jdId },
      select: {
        id: true,
        subject: true,
        type: true,
        totalRecipients: true,
        sentCount: true,
        failedCount: true,
        bouncedCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totals = emails.reduce(
      (acc, email) => ({
        totalRecipients: acc.totalRecipients + email.totalRecipients,
        sentCount: acc.sentCount + email.sentCount,
        failedCount: acc.failedCount + email.failedCount,
        bouncedCount: acc.bouncedCount + email.bouncedCount,
      }),
      { totalRecipients: 0, sentCount: 0, failedCount: 0, bouncedCount: 0 }
    );

    res.json({
      message: 'JD email statistics retrieved successfully',
      data: {
        jdId,
        emails,
        summary: {
          ...totals,
          successRate:
            totals.totalRecipients > 0
              ? Math.round((totals.sentCount / totals.totalRecipients) * 100)
              : 0,
        },
      },
    });
  } catch (error: any) {
    logger.error('Failed to get JD email stats:', error);
    next(error);
  }
};
