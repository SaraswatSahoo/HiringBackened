// src/services/email.service.ts
import prisma from '../prisma/client';
import { getDefaultTransporter, getSmtpDefaults } from '../config/smtp';
import logger from '../utils/logger';
import {
  EmailStatus,
  EmailType,
  CreateEmailDto,
  SendEmailResponse,
  EmailWithRelations,
  TemplateVariables,
  EmailFilters,
} from '../types/email';
import { Candidate, Prisma } from '@prisma/client';

class EmailService {
  /**
   * Replace template variables with actual values
   */
  private replaceVariables(
    template: string,
    variables: TemplateVariables
  ): string {
    let result = template;
    
    Object.keys(variables).forEach((key) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, String(variables[key]));
    });
    
    return result;
  }

  /**
   * Get candidates based on filters
   */
  private async getCandidatesByFilters(
    jdId: string,
    filters: EmailFilters
  ): Promise<Candidate[]> {
    const where: any = { jdId };

    if (filters.isEligible !== undefined) {
      where.isEligible = filters.isEligible;
    }

    if (filters.stageId) {
      where.currentStageId = Array.isArray(filters.stageId)
        ? { in: filters.stageId }
        : filters.stageId;
    }

    if (filters.minCGPA) {
      where.cgpa = { gte: filters.minCGPA };
    }

    if (filters.passOutYear) {
      where.passOutYear = Array.isArray(filters.passOutYear)
        ? { in: filters.passOutYear }
        : filters.passOutYear;
    }

    if (filters.college) {
      where.college = Array.isArray(filters.college)
        ? { in: filters.college }
        : filters.college;
    }

    if (filters.degree) {
      where.degree = Array.isArray(filters.degree)
        ? { in: filters.degree }
        : filters.degree;
    }

    if (filters.applicationStatus) {
      where.applicationStatus = Array.isArray(filters.applicationStatus)
        ? { in: filters.applicationStatus }
        : filters.applicationStatus;
    }

    return prisma.candidate.findMany({ where });
  }

  /**
   * Send individual email to a candidate
   */
  async sendIndividualEmail(
    candidateId: string,
    jdId: string,
    subject: string,
    message: string,
    htmlBody: string | null,
    variables: TemplateVariables = {},
    templateId?: string,
    attachments: string[] = [],
    sentBy: string = 'system'
  ): Promise<SendEmailResponse> {
    try {
      // Get candidate details
      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
      });

      if (!candidate) {
        throw new Error('Candidate not found');
      }

      // Create email record
      const email = await prisma.email.create({
        data: {
          jdId,
          type: EmailType.INDIVIDUAL,
          templateId,
          subject,
          message,
          htmlBody,
          attachments,
          variables: variables as Prisma.InputJsonValue,
          totalRecipients: 1,
          sentBy,
        },
      });

      // Merge default variables with provided ones
      const allVariables: TemplateVariables = {
        candidate_name: candidate.name,
        candidate_email: candidate.email,
        ...variables,
      };

      // Personalize content
      const personalizedSubject = this.replaceVariables(subject, allVariables);
      const personalizedMessage = this.replaceVariables(message, allVariables);
      const personalizedHtmlBody = htmlBody
        ? this.replaceVariables(htmlBody, allVariables)
        : null;

      // Create candidate email record
      const candidateEmail = await prisma.candidateEmail.create({
        data: {
          emailId: email.id,
          candidateId: candidate.id,
          recipientEmail: candidate.email,
          recipientName: candidate.name,
          personalizedSubject,
          personalizedMessage,
          personalizedHtmlBody,
          status: EmailStatus.PENDING,
        },
      });

      // Send email via SMTP
      await this.sendViaSMTP(candidateEmail.id);

      return {
        emailId: email.id,
        totalRecipients: 1,
        status: 'sent',
        message: 'Email sent successfully',
      };
    } catch (error: any) {
      logger.error('Failed to send individual email:', error);
      throw error;
    }
  }

  /**
   * Send bulk emails to multiple candidates
   */
  async sendBulkEmail(data: CreateEmailDto): Promise<SendEmailResponse> {
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
      } = data;

      // Get candidates
      let candidates: Candidate[];
      if (candidateIds && candidateIds.length > 0) {
        candidates = await prisma.candidate.findMany({
          where: {
            id: { in: candidateIds },
            jdId,
          },
        });
      } else {
        candidates = await this.getCandidatesByFilters(jdId, filters);
      }

      if (candidates.length === 0) {
        throw new Error('No candidates found matching the criteria');
      }

      // Create email record
      const email = await prisma.email.create({
        data: {
          jdId,
          type: EmailType.BULK,
          templateId,
          subject,
          message,
          htmlBody: htmlBody || null,
          attachments: data.attachments || [],
          variables: variables as Prisma.InputJsonValue,
          filters: filters as Prisma.InputJsonValue,
          totalRecipients: candidates.length,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          priority,
          sentBy: data.sentBy || 'system',
        },
      });

      // Create candidate email records
      const candidateEmailsData = candidates.map((candidate) => {
        const allVariables: TemplateVariables = {
          candidate_name: candidate.name,
          candidate_email: candidate.email,
          candidate_phone: candidate.phone,
          ...variables,
        };

        const personalizedSubject = this.replaceVariables(subject, allVariables);
        const personalizedMessage = this.replaceVariables(message, allVariables);
        const personalizedHtmlBody = htmlBody
          ? this.replaceVariables(htmlBody, allVariables)
          : null;

        return {
          emailId: email.id,
          candidateId: candidate.id,
          recipientEmail: candidate.email,
          recipientName: candidate.name,
          personalizedSubject,
          personalizedMessage,
          personalizedHtmlBody,
          status: EmailStatus.PENDING,
        };
      });

      await prisma.candidateEmail.createMany({
        data: candidateEmailsData,
      });

      // If not scheduled, send immediately
      if (!scheduledAt) {
        // Send emails in background (non-blocking)
        this.processBulkEmail(email.id).catch((error) => {
          logger.error(`Failed to process bulk email ${email.id}:`, error);
        });

        return {
          emailId: email.id,
          totalRecipients: candidates.length,
          status: 'processing',
          message: `Email is being sent to ${candidates.length} candidates`,
        };
      }

      return {
        emailId: email.id,
        totalRecipients: candidates.length,
        status: 'scheduled',
        message: `Email scheduled for ${scheduledAt}`,
        scheduledAt: new Date(scheduledAt),
      };
    } catch (error: any) {
      logger.error('Failed to send bulk email:', error);
      throw error;
    }
  }

  /**
   * Process bulk email sending
   */
  private async processBulkEmail(emailId: string): Promise<void> {
    try {
      // Update email status
      await prisma.email.update({
        where: { id: emailId },
        data: { sentAt: new Date() },
      });

      // Get all pending candidate emails
      const candidateEmails = await prisma.candidateEmail.findMany({
        where: {
          emailId,
          status: EmailStatus.PENDING,
        },
      });

      // Send emails sequentially to avoid rate limiting
      for (const candidateEmail of candidateEmails) {
        try {
          await this.sendViaSMTP(candidateEmail.id);
          await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay
        } catch (error) {
          logger.error(
            `Failed to send email to ${candidateEmail.recipientEmail}:`,
            error
          );
        }
      }

      // Update email completion
      const stats = await this.getEmailStats(emailId);
      await prisma.email.update({
        where: { id: emailId },
        data: {
          sentCount: stats.sentCount,
          failedCount: stats.failedCount,
          completedAt: new Date(),
        },
      });

      logger.info(`Bulk email ${emailId} completed: ${stats.sentCount}/${stats.totalRecipients} sent`);
    } catch (error: any) {
      logger.error(`Failed to process bulk email ${emailId}:`, error);
    }
  }

  /**
   * Send email via SMTP
   */
  private async sendViaSMTP(candidateEmailId: string): Promise<void> {
    const candidateEmail = await prisma.candidateEmail.findUnique({
      where: { id: candidateEmailId },
      include: {
        email: true,
      },
    });

    if (!candidateEmail) {
      throw new Error('Candidate email not found');
    }

    try {
      const transporter = getDefaultTransporter();
      const smtpDefaults = getSmtpDefaults();

      const mailOptions = {
        from: smtpDefaults.from,
        replyTo: smtpDefaults.replyTo,
        to: candidateEmail.recipientEmail,
        subject: candidateEmail.personalizedSubject,
        text: candidateEmail.personalizedMessage,
        html: candidateEmail.personalizedHtmlBody || candidateEmail.personalizedMessage,
        // attachments: candidateEmail.email.attachments.map(path => ({ path })),
      };

      const info = await transporter.sendMail(mailOptions);

      // Update status to SENT
      await prisma.candidateEmail.update({
        where: { id: candidateEmailId },
        data: {
          status: EmailStatus.SENT,
          sentAt: new Date(),
          messageId: info.messageId,
          smtpResponse: info.response,
        },
      });

      // Update email stats
      await this.updateEmailStats(candidateEmail.emailId);

      logger.info(`Email sent to ${candidateEmail.recipientEmail}: ${info.messageId}`);
    } catch (error: any) {
      // Update status to FAILED
      await prisma.candidateEmail.update({
        where: { id: candidateEmailId },
        data: {
          status: EmailStatus.FAILED,
          failedAt: new Date(),
          failureReason: error.message,
          retryCount: { increment: 1 },
        },
      });

      // Update email stats
      await this.updateEmailStats(candidateEmail.emailId);

      logger.error(`Email failed to ${candidateEmail.recipientEmail}:`, error);
      throw error;
    }
  }

  /**
   * Retry failed emails
   */
  async retryFailedEmail(candidateEmailId: string): Promise<void> {
    const candidateEmail = await prisma.candidateEmail.findUnique({
      where: { id: candidateEmailId },
    });

    if (!candidateEmail) {
      throw new Error('Candidate email not found');
    }

    if (candidateEmail.retryCount >= candidateEmail.maxRetries) {
      throw new Error('Maximum retry attempts reached');
    }

    // Reset status to PENDING
    await prisma.candidateEmail.update({
      where: { id: candidateEmailId },
      data: {
        status: EmailStatus.PENDING,
        failureReason: null,
      },
    });

    // Retry sending
    await this.sendViaSMTP(candidateEmailId);
  }

  /**
   * Update email statistics
   */
  private async updateEmailStats(emailId: string): Promise<void> {
    const stats = await prisma.candidateEmail.groupBy({
      by: ['status'],
      where: { emailId },
      _count: true,
    });

    const sentCount = stats.find((s) => s.status === EmailStatus.SENT)?._count || 0;
    const failedCount = stats.find((s) => s.status === EmailStatus.FAILED)?._count || 0;
    const bouncedCount = stats.find((s) => s.status === EmailStatus.BOUNCED)?._count || 0;

    await prisma.email.update({
      where: { id: emailId },
      data: {
        sentCount,
        failedCount,
        bouncedCount,
      },
    });
  }

  /**
   * Get email statistics
   */
  private async getEmailStats(emailId: string) {
    const email = await prisma.email.findUnique({
      where: { id: emailId },
      include: {
        _count: {
          select: {
            recipients: true,
          },
        },
      },
    });

    if (!email) {
      throw new Error('Email not found');
    }

    return {
      totalRecipients: email.totalRecipients,
      sentCount: email.sentCount,
      failedCount: email.failedCount,
      bouncedCount: email.bouncedCount,
      pendingCount: email.totalRecipients - email.sentCount - email.failedCount,
      successRate:
        email.totalRecipients > 0
          ? Math.round((email.sentCount / email.totalRecipients) * 100)
          : 0,
    };
  }

  /**
   * Get email by ID with relations
   */
  async getEmailById(emailId: string): Promise<EmailWithRelations | null> {
    const email = await prisma.email.findUnique({
      where: { id: emailId },
      include: {
        jd: {
          select: {
            id: true,
            title: true,
            department: true,
          },
        },
        template: true,
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        recipients: {
          take: 10, // Limit recipients for performance
        },
      },
    });

    if (!email) return null;

    const stats = await this.getEmailStats(emailId);

    return {
      ...email,
      stats,
    } as EmailWithRelations;
  }

  /**
   * Get all emails with pagination
   */
  async getAllEmails(params: {
    jdId?: string;
    type?: EmailType;
    page?: number;
    limit?: number;
  }) {
    const { jdId, type, page = 1, limit = 10 } = params;

    const where: any = {};
    if (jdId) where.jdId = jdId;
    if (type) where.type = type;

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where,
        include: {
          jd: {
            select: {
              id: true,
              title: true,
            },
          },
          sender: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              recipients: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.email.count({ where }),
    ]);

    return {
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export default new EmailService();
