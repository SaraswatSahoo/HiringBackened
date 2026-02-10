// src/services/notification.service.ts
import prisma from '../prisma/client';
import emailService from './email.service';
import logger from '../utils/logger';
import config from '../config/env';
import { TemplateCategory } from '../types/email';

interface NotificationPayload {
  candidateId: string;
  jdId: string;
  sentBy?: string;
}

class NotificationService {
  /**
   * Get or create default template for a category
   */
  private async getTemplateByCategory(category: TemplateCategory) {
    let template = await prisma.emailTemplate.findFirst({
      where: {
        category,
        isActive: true,
        isDefault: true,
      },
    });

    // If no default template, get any active template
    if (!template) {
      template = await prisma.emailTemplate.findFirst({
        where: {
          category,
          isActive: true,
        },
      });
    }

    return template;
  }

  /**
   * Send interview invitation
   */
  async sendInterviewInvite(
    payload: NotificationPayload & {
      interviewDate: Date | string;
      interviewMode: string;
      meetingLink?: string;
      interviewerName?: string;
      instructions?: string;
    }
  ): Promise<void> {
    if (!config.features.enableEmailNotifications) {
      logger.warn('Email notifications are disabled');
      return;
    }

    try {
      const { candidateId, jdId, interviewDate, interviewMode, meetingLink, sentBy } = payload;

      // Get candidate and JD details
      const [candidate, jd] = await Promise.all([
        prisma.candidate.findUnique({ where: { id: candidateId } }),
        prisma.jobDescription.findUnique({ where: { id: jdId } }),
      ]);

      if (!candidate || !jd) {
        throw new Error('Candidate or JD not found');
      }

      // Get template
      const template = await this.getTemplateByCategory(TemplateCategory.INTERVIEW_CALL);

      const subject = template?.subject || `Interview Invitation - ${jd.title}`;
      const message =
        template?.body ||
        `Dear {{candidate_name}},\n\nYou are invited for an interview for the position of ${jd.title}.\n\nDate: {{interview_date}}\nMode: {{interview_mode}}\n${meetingLink ? `Link: {{meeting_link}}` : ''}\n\nBest regards,\nHR Team`;

      const htmlBody =
        template?.htmlBody ||
        `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">Interview Invitation</h2>
          <p>Dear {{candidate_name}},</p>
          <p>You are invited for an interview for the position of <strong>${jd.title}</strong>.</p>
          <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-left: 4px solid #4CAF50;">
            <p><strong>Date & Time:</strong> {{interview_date}}</p>
            <p><strong>Mode:</strong> {{interview_mode}}</p>
            ${meetingLink ? `<p><strong>Meeting Link:</strong> <a href="{{meeting_link}}">{{meeting_link}}</a></p>` : ''}
          </div>
          <p>Please confirm your availability.</p>
          <p>Best regards,<br>HR Team</p>
        </div>
      `;

      const variables = {
        candidate_name: candidate.name,
        candidate_email: candidate.email,
        jd_title: jd.title,
        interview_date: new Date(interviewDate).toLocaleString(),
        interview_mode: interviewMode,
        meeting_link: meetingLink || '',
      };

      await emailService.sendIndividualEmail(
        candidateId,
        jdId,
        subject,
        message,
        htmlBody,
        variables,
        template?.id,
        [],
        sentBy || 'system'
      );

      logger.info(`Interview invite sent to ${candidate.email}`);
    } catch (error) {
      logger.error('Failed to send interview invite:', error);
      throw error;
    }
  }

  /**
   * Send selection/offer notification
   */
  async sendSelectionNotification(payload: NotificationPayload): Promise<void> {
    if (!config.features.enableEmailNotifications) {
      logger.warn('Email notifications are disabled');
      return;
    }

    try {
      const { candidateId, jdId, sentBy } = payload;

      const [candidate, jd] = await Promise.all([
        prisma.candidate.findUnique({ where: { id: candidateId } }),
        prisma.jobDescription.findUnique({ where: { id: jdId } }),
      ]);

      if (!candidate || !jd) {
        throw new Error('Candidate or JD not found');
      }

      const template = await this.getTemplateByCategory(TemplateCategory.OFFER);

      const subject = template?.subject || `Congratulations! You've been selected - ${jd.title}`;
      const message =
        template?.body ||
        `Dear {{candidate_name}},\n\nCongratulations! You have been selected for the position of ${jd.title}.\n\nOur HR team will contact you shortly.\n\nBest regards,\nHR Team`;

      const htmlBody =
        template?.htmlBody ||
        `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">🎉 Congratulations!</h2>
          <p>Dear {{candidate_name}},</p>
          <p>We are delighted to inform you that you have been <strong>selected</strong> for the position of <strong>${jd.title}</strong>!</p>
          <p>Our HR team will contact you shortly with the next steps.</p>
          <p>Best regards,<br>HR Team</p>
        </div>
      `;

      const variables = {
        candidate_name: candidate.name,
        candidate_email: candidate.email,
        jd_title: jd.title,
      };

      await emailService.sendIndividualEmail(
        candidateId,
        jdId,
        subject,
        message,
        htmlBody,
        variables,
        template?.id,
        [],
        sentBy || 'system'
      );

      logger.info(`Selection notification sent to ${candidate.email}`);
    } catch (error) {
      logger.error('Failed to send selection notification:', error);
      throw error;
    }
  }

  /**
   * Send rejection notification
   */
  async sendRejectionNotification(payload: NotificationPayload): Promise<void> {
    if (!config.features.enableEmailNotifications) {
      logger.warn('Email notifications are disabled');
      return;
    }

    try {
      const { candidateId, jdId, sentBy } = payload;

      const [candidate, jd] = await Promise.all([
        prisma.candidate.findUnique({ where: { id: candidateId } }),
        prisma.jobDescription.findUnique({ where: { id: jdId } }),
      ]);

      if (!candidate || !jd) {
        throw new Error('Candidate or JD not found');
      }

      const template = await this.getTemplateByCategory(TemplateCategory.REJECTION);

      const subject = template?.subject || `Application Status Update - ${jd.title}`;
      const message =
        template?.body ||
        `Dear {{candidate_name}},\n\nThank you for your interest in ${jd.title}.\n\nAfter careful consideration, we will not be moving forward with your application at this time.\n\nWe wish you all the best.\n\nBest regards,\nHR Team`;

      const htmlBody =
        template?.htmlBody ||
        `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2196F3;">Application Status Update</h2>
          <p>Dear {{candidate_name}},</p>
          <p>Thank you for your interest in the position of <strong>${jd.title}</strong>.</p>
          <p>After careful consideration, we regret to inform you that we will not be moving forward with your application at this time.</p>
          <p>We encourage you to apply for future opportunities.</p>
          <p>Best regards,<br>HR Team</p>
        </div>
      `;

      const variables = {
        candidate_name: candidate.name,
        candidate_email: candidate.email,
        jd_title: jd.title,
      };

      await emailService.sendIndividualEmail(
        candidateId,
        jdId,
        subject,
        message,
        htmlBody,
        variables,
        template?.id,
        [],
        sentBy || 'system'
      );

      logger.info(`Rejection notification sent to ${candidate.email}`);
    } catch (error) {
      logger.error('Failed to send rejection notification:', error);
      throw error;
    }
  }

  /**
   * Send test/assessment link
   */
  async sendTestLink(
    payload: NotificationPayload & {
      testLink: string;
      deadline: Date | string;
      testName?: string;
      duration?: string;
    }
  ): Promise<void> {
    if (!config.features.enableEmailNotifications) {
      logger.warn('Email notifications are disabled');
      return;
    }

    try {
      const { candidateId, jdId, testLink, deadline, testName, sentBy } = payload;

      const [candidate, jd] = await Promise.all([
        prisma.candidate.findUnique({ where: { id: candidateId } }),
        prisma.jobDescription.findUnique({ where: { id: jdId } }),
      ]);

      if (!candidate || !jd) {
        throw new Error('Candidate or JD not found');
      }

      const template = await this.getTemplateByCategory(TemplateCategory.TEST_LINK);

      const subject = template?.subject || `Assessment Test - ${jd.title}`;
      const message =
        template?.body ||
        `Dear {{candidate_name}},\n\nPlease complete the assessment test for ${jd.title}.\n\nTest Link: {{test_link}}\nDeadline: {{deadline}}\n\nBest regards,\nHR Team`;

      const htmlBody =
        template?.htmlBody ||
        `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF9800;">Assessment Test</h2>
          <p>Dear {{candidate_name}},</p>
          <p>Please complete the assessment test for <strong>${jd.title}</strong>.</p>
          <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-left: 4px solid #FF9800;">
            ${testName ? `<p><strong>Test:</strong> ${testName}</p>` : ''}
            <p><strong>Deadline:</strong> {{deadline}}</p>
            <p><strong>Link:</strong> <a href="{{test_link}}">{{test_link}}</a></p>
          </div>
          <a href="{{test_link}}" style="display: inline-block; background: #FF9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0;">Start Test</a>
          <p>Best regards,<br>HR Team</p>
        </div>
      `;

      const variables = {
        candidate_name: candidate.name,
        candidate_email: candidate.email,
        jd_title: jd.title,
        test_link: testLink,
        deadline: new Date(deadline).toLocaleString(),
        test_name: testName || 'Assessment Test',
      };

      await emailService.sendIndividualEmail(
        candidateId,
        jdId,
        subject,
        message,
        htmlBody,
        variables,
        template?.id,
        [],
        sentBy || 'system'
      );

      logger.info(`Test link sent to ${candidate.email}`);
    } catch (error) {
      logger.error('Failed to send test link:', error);
      throw error;
    }
  }

  /**
   * Send bulk upload summary to HR
   */
  async sendBulkUploadSummary(
    hrEmail: string,
    hrName: string,
    jdId: string,
    stats: {
      total: number;
      success: number;
      failure: number;
    }
  ): Promise<void> {
    if (!config.features.enableEmailNotifications) {
      logger.warn('Email notifications are disabled');
      return;
    }

    try {
      const jd = await prisma.jobDescription.findUnique({ where: { id: jdId } });

      if (!jd) {
        throw new Error('JD not found');
      }

      const subject = `Bulk Upload Summary - ${jd.title}`;
      const message = `Dear ${hrName},\n\nYour bulk upload for ${jd.title} is complete.\n\nTotal: ${stats.total}\nSuccess: ${stats.success}\nFailed: ${stats.failure}\n\nBest regards,\nSystem`;

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2196F3;">Bulk Upload Summary</h2>
          <p>Dear ${hrName},</p>
          <p>Your bulk upload for <strong>${jd.title}</strong> is complete.</p>
          <div style="background: #f5f5f5; padding: 15px; margin: 20px 0;">
            <table style="width: 100%;">
              <tr>
                <td style="padding: 8px 0;"><strong>Total Rows:</strong></td>
                <td style="text-align: right;">${stats.total}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4CAF50;"><strong>Success:</strong></td>
                <td style="text-align: right; color: #4CAF50; font-weight: bold;">${stats.success}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #f44336;"><strong>Failed:</strong></td>
                <td style="text-align: right; color: #f44336; font-weight: bold;">${stats.failure}</td>
              </tr>
            </table>
          </div>
          ${stats.failure > 0 ? '<p style="color: #f44336;">Please check the dashboard for error details.</p>' : '<p style="color: #4CAF50;">All candidates uploaded successfully!</p>'}
          <p>Best regards,<br>System</p>
        </div>
      `;

      // Send directly via SMTP (not stored in database)
      const transporter = await import('../config/smtp').then((m) => m.getDefaultTransporter());
      const smtpDefaults = await import('../config/smtp').then((m) => m.getSmtpDefaults());

      await transporter.sendMail({
        from: smtpDefaults.from,
        to: hrEmail,
        subject,
        text: message,
        html: htmlBody,
      });

      logger.info(`Bulk upload summary sent to ${hrEmail}`);
    } catch (error) {
      logger.error('Failed to send bulk upload summary:', error);
      throw error;
    }
  }

  /**
   * Send reminder notification
   */
  async sendReminder(
    payload: NotificationPayload & {
      reminderType: string;
      reminderMessage: string;
      actionLink?: string;
    }
  ): Promise<void> {
    if (!config.features.enableEmailNotifications) {
      logger.warn('Email notifications are disabled');
      return;
    }

    try {
      const { candidateId, jdId, reminderType, reminderMessage, actionLink, sentBy } = payload;

      const [candidate, jd] = await Promise.all([
        prisma.candidate.findUnique({ where: { id: candidateId } }),
        prisma.jobDescription.findUnique({ where: { id: jdId } }),
      ]);

      if (!candidate || !jd) {
        throw new Error('Candidate or JD not found');
      }

      const template = await this.getTemplateByCategory(TemplateCategory.REMINDER);

      const subject = template?.subject || `Reminder: ${reminderType} - ${jd.title}`;
      const message = template?.body || reminderMessage;
      const htmlBody = template?.htmlBody || `<p>${reminderMessage}</p>`;

      const variables = {
        candidate_name: candidate.name,
        candidate_email: candidate.email,
        jd_title: jd.title,
        reminder_type: reminderType,
        reminder_message: reminderMessage,
        action_link: actionLink || '',
      };

      await emailService.sendIndividualEmail(
        candidateId,
        jdId,
        subject,
        message,
        htmlBody,
        variables,
        template?.id,
        [],
        sentBy || 'system'
      );

      logger.info(`Reminder sent to ${candidate.email}`);
    } catch (error) {
      logger.error('Failed to send reminder:', error);
      throw error;
    }
  }
}

export default new NotificationService();
