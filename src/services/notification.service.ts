// src/services/notification.service.ts
import emailService from './email.service';
import logger from '../utils/logger';
import config from '../config/env';

interface NotificationPayload {
  candidateEmail: string;
  candidateName: string;
  jdTitle: string;
  additionalData?: any;
}

class NotificationService {
  async sendInterviewInvite(payload: NotificationPayload & {
    interviewDate: Date;
    interviewMode: string;
    meetingLink?: string;
  }): Promise<void> {
    if (!config.features.enableEmail) {
      logger.warn('Email notifications are disabled');
      return;
    }

    try {
      await emailService.sendInterviewInvitation(
        payload.candidateEmail,
        payload.candidateName,
        payload.jdTitle,
        payload.interviewDate,
        payload.interviewMode,
        payload.meetingLink
      );
      
      logger.info(`Interview invite sent to ${payload.candidateEmail}`);
    } catch (error) {
      logger.error('Failed to send interview invite:', error);
      throw error;
    }
  }

  async sendSelectionNotification(payload: NotificationPayload): Promise<void> {
    if (!config.features.enableEmail) {
      logger.warn('Email notifications are disabled');
      return;
    }

    try {
      await emailService.sendSelectionNotification(
        payload.candidateEmail,
        payload.candidateName,
        payload.jdTitle
      );
      
      logger.info(`Selection notification sent to ${payload.candidateEmail}`);
    } catch (error) {
      logger.error('Failed to send selection notification:', error);
      throw error;
    }
  }

  async sendRejectionNotification(payload: NotificationPayload): Promise<void> {
    if (!config.features.enableEmail) {
      logger.warn('Email notifications are disabled');
      return;
    }

    try {
      await emailService.sendRejectionNotification(
        payload.candidateEmail,
        payload.candidateName,
        payload.jdTitle
      );
      
      logger.info(`Rejection notification sent to ${payload.candidateEmail}`);
    } catch (error) {
      logger.error('Failed to send rejection notification:', error);
      throw error;
    }
  }

  async sendTestLink(payload: NotificationPayload & {
    testLink: string;
    deadline: Date;
  }): Promise<void> {
    if (!config.features.enableEmail) {
      logger.warn('Email notifications are disabled');
      return;
    }

    try {
      await emailService.sendTestLink(
        payload.candidateEmail,
        payload.candidateName,
        payload.jdTitle,
        payload.testLink,
        payload.deadline
      );
      
      logger.info(`Test link sent to ${payload.candidateEmail}`);
    } catch (error) {
      logger.error('Failed to send test link:', error);
      throw error;
    }
  }

  async sendBulkUploadSummary(
    hrEmail: string,
    hrName: string,
    jdTitle: string,
    stats: {
      total: number;
      success: number;
      failure: number;
    }
  ): Promise<void> {
    if (!config.features.enableEmail) {
      logger.warn('Email notifications are disabled');
      return;
    }

    try {
      await emailService.sendBulkUploadConfirmation(
        hrEmail,
        hrName,
        jdTitle,
        stats.total,
        stats.success,
        stats.failure
      );
      
      logger.info(`Bulk upload summary sent to ${hrEmail}`);
    } catch (error) {
      logger.error('Failed to send bulk upload summary:', error);
      throw error;
    }
  }
}

export default new NotificationService();
