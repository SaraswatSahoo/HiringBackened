// src/services/email.service.ts
import sgMail from '@sendgrid/mail';
import config from '../config/env';
import logger from '../utils/logger';

sgMail.setApiKey(config.email.sendgridApiKey);

interface Recipient {
  email: string;
  name: string;
}

class EmailService {
  async send(to: string, subject: string, htmlContent: string, textContent?: string): Promise<{ success: boolean }> {
    try {
      const msg = {
        to,
        from: config.email.from,
        subject,
        text: textContent || htmlContent.replace(/<[^>]*>/g, ''),
        html: htmlContent,
      };
      
      await sgMail.send(msg);
      logger.info(`Email sent to ${to}`);
      
      return { success: true };
    } catch (error) {
      logger.error(`Email failed to ${to}:`, error);
      throw error;
    }
  }
  
  async sendBulk(recipients: Recipient[], subject: string, htmlContent: string): Promise<{ success: boolean; count: number }> {
    try {
      const messages = recipients.map(recipient => ({
        to: recipient.email,
        from: config.email.from,
        subject,
        html: htmlContent.replace(/\{name\}/g, recipient.name),
      }));
      
      await sgMail.send(messages);
      logger.info(`Bulk email sent to ${recipients.length} recipients`);
      
      return { success: true, count: recipients.length };
    } catch (error) {
      logger.error('Bulk email failed:', error);
      throw error;
    }
  }
}

export default new EmailService();
