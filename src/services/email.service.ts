// src/services/email.service.ts
import nodemailer from 'nodemailer';
import config from '../config/env';
import logger from '../utils/logger';

interface Recipient {
  email: string;
  name: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.secure,
      auth: {
        user: config.email.smtp.user,
        pass: config.email.smtp.password,
      },
    });

    // Verify connection on initialization
    this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified successfully');
    } catch (error) {
      logger.error('SMTP connection failed:', error);
    }
  }

  async send(
    to: string,
    subject: string,
    htmlContent: string,
    textContent?: string
  ): Promise<{ success: boolean }> {
    try {
      const info = await this.transporter.sendMail({
        from: `"${config.email.fromName}" <${config.email.from}>`,
        to,
        subject,
        text: textContent || htmlContent.replace(/<[^>]*>/g, ''),
        html: htmlContent,
      });

      logger.info(`Email sent to ${to}: ${info.messageId}`);

      return { success: true };
    } catch (error) {
      logger.error(`Email failed to ${to}:`, error);
      throw error;
    }
  }

  async sendBulk(
    recipients: Recipient[],
    subject: string,
    htmlContent: string
  ): Promise<{ success: boolean; count: number }> {
    try {
      const promises = recipients.map((recipient) => {
        const personalizedHtml = htmlContent.replace(/\{name\}/g, recipient.name);
        return this.send(recipient.email, subject, personalizedHtml);
      });

      await Promise.all(promises);
      logger.info(`Bulk email sent to ${recipients.length} recipients`);

      return { success: true, count: recipients.length };
    } catch (error) {
      logger.error('Bulk email failed:', error);
      throw error;
    }
  }

  // Email templates for hiring platform
  
  async sendInterviewInvitation(
    candidateEmail: string,
    candidateName: string,
    jdTitle: string,
    interviewDate: Date,
    interviewMode: string,
    meetingLink?: string
  ): Promise<{ success: boolean }> {
    const subject = `Interview Invitation - ${jdTitle}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
          .button { background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; display: inline-block; margin: 20px 0; border-radius: 4px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Interview Invitation</h1>
          </div>
          <div class="content">
            <p>Dear ${candidateName},</p>
            <p>Congratulations! We are pleased to invite you for an interview for the position of <strong>${jdTitle}</strong>.</p>
            
            <div class="details">
              <h3>Interview Details:</h3>
              <p><strong>Date & Time:</strong> ${interviewDate.toLocaleString()}</p>
              <p><strong>Mode:</strong> ${interviewMode}</p>
              ${meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>` : ''}
            </div>
            
            <p>Please confirm your availability at the earliest.</p>
            
            ${meetingLink ? `<a href="${meetingLink}" class="button">Join Interview</a>` : ''}
            
            <p>Best regards,<br>HR Team</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return this.send(candidateEmail, subject, html);
  }

  async sendSelectionNotification(
    candidateEmail: string,
    candidateName: string,
    jdTitle: string
  ): Promise<{ success: boolean }> {
    const subject = `Congratulations! You've been selected - ${jdTitle}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .celebration { text-align: center; font-size: 48px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Selection Notification</h1>
          </div>
          <div class="content">
            <div class="celebration">🎉</div>
            <p>Dear ${candidateName},</p>
            <p>We are delighted to inform you that you have been <strong>selected</strong> for the position of <strong>${jdTitle}</strong>!</p>
            <p>Our HR team will contact you shortly with the next steps regarding the offer letter and joining formalities.</p>
            <p>Once again, congratulations on your selection!</p>
            <p>Best regards,<br>HR Team</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return this.send(candidateEmail, subject, html);
  }

  async sendRejectionNotification(
    candidateEmail: string,
    candidateName: string,
    jdTitle: string
  ): Promise<{ success: boolean }> {
    const subject = `Application Status Update - ${jdTitle}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Application Status Update</h1>
          </div>
          <div class="content">
            <p>Dear ${candidateName},</p>
            <p>Thank you for your interest in the position of <strong>${jdTitle}</strong> and for taking the time to go through our selection process.</p>
            <p>After careful consideration, we regret to inform you that we will not be moving forward with your application at this time.</p>
            <p>We encourage you to apply for future opportunities that match your profile. We wish you all the best in your career endeavors.</p>
            <p>Best regards,<br>HR Team</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return this.send(candidateEmail, subject, html);
  }

  async sendTestLink(
    candidateEmail: string,
    candidateName: string,
    jdTitle: string,
    testLink: string,
    deadline: Date
  ): Promise<{ success: boolean }> {
    const subject = `Assessment Test Link - ${jdTitle}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #FF9800; }
          .button { background-color: #FF9800; color: white; padding: 12px 24px; text-decoration: none; display: inline-block; margin: 20px 0; border-radius: 4px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Assessment Test</h1>
          </div>
          <div class="content">
            <p>Dear ${candidateName},</p>
            <p>As part of the selection process for <strong>${jdTitle}</strong>, you are required to complete an online assessment.</p>
            
            <div class="details">
              <h3>Test Details:</h3>
              <p><strong>Deadline:</strong> ${deadline.toLocaleString()}</p>
              <p><strong>Test Link:</strong> <a href="${testLink}">${testLink}</a></p>
            </div>
            
            <p>Please complete the test before the deadline. Late submissions will not be considered.</p>
            
            <a href="${testLink}" class="button">Start Test</a>
            
            <p>Best regards,<br>HR Team</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return this.send(candidateEmail, subject, html);
  }

  async sendBulkUploadConfirmation(
    hrEmail: string,
    hrName: string,
    jdTitle: string,
    totalCandidates: number,
    successCount: number,
    failureCount: number
  ): Promise<{ success: boolean }> {
    const subject = `Bulk Upload Completed - ${jdTitle}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .stats { background-color: white; padding: 15px; margin: 15px 0; }
          .stat-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .success { color: #4CAF50; font-weight: bold; }
          .failure { color: #f44336; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Bulk Upload Summary</h1>
          </div>
          <div class="content">
            <p>Dear ${hrName},</p>
            <p>Your bulk candidate upload for <strong>${jdTitle}</strong> has been completed.</p>
            
            <div class="stats">
              <h3>Upload Statistics:</h3>
              <div class="stat-item">
                <span>Total Rows:</span>
                <span>${totalCandidates}</span>
              </div>
              <div class="stat-item">
                <span>Successfully Added:</span>
                <span class="success">${successCount}</span>
              </div>
              <div class="stat-item">
                <span>Failed:</span>
                <span class="failure">${failureCount}</span>
              </div>
            </div>
            
            ${failureCount > 0 ? '<p>Please check the dashboard for detailed error logs.</p>' : '<p>All candidates were successfully added!</p>'}
            
            <p>Best regards,<br>System Notification</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return this.send(hrEmail, subject, html);
  }
}

export default new EmailService();
