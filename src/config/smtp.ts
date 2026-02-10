// src/config/smtp.ts
import nodemailer, { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import logger from '../utils/logger';

// SMTP Configuration Interface
export interface SmtpOptions {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  replyToEmail?: string;
  replyToName?: string;
}

// Default SMTP Configuration from Environment Variables
const defaultSmtpConfig: SmtpOptions = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587/25
  username: process.env.SMTP_USERNAME || '',
  password: process.env.SMTP_PASSWORD || '',
  fromEmail: process.env.SMTP_FROM_EMAIL || '',
  fromName: process.env.SMTP_FROM_NAME || 'HR Team',
  replyToEmail: process.env.SMTP_REPLY_TO_EMAIL,
  replyToName: process.env.SMTP_REPLY_TO_NAME,
};

// Validate SMTP Configuration
const validateSmtpConfig = (config: SmtpOptions): void => {
  const required = ['host', 'username', 'password', 'fromEmail'];
  const missing = required.filter((field) => !config[field as keyof SmtpOptions]);

  if (missing.length > 0) {
    throw new Error(
      `SMTP configuration is incomplete. Missing: ${missing.join(', ')}. ` +
      `Please set the following environment variables: ` +
      `${missing.map((f) => `SMTP_${f.toUpperCase()}`).join(', ')}`
    );
  }

  // Validate port
  if (config.port < 1 || config.port > 65535) {
    throw new Error('SMTP port must be between 1 and 65535');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(config.fromEmail)) {
    throw new Error('Invalid SMTP_FROM_EMAIL format');
  }

  if (config.replyToEmail && !emailRegex.test(config.replyToEmail)) {
    throw new Error('Invalid SMTP_REPLY_TO_EMAIL format');
  }
};

// Create SMTP Transporter
export const createSmtpTransporter = (
  config: Partial<SmtpOptions> = {}
): Transporter<SMTPTransport.SentMessageInfo> => {
  const smtpConfig = { ...defaultSmtpConfig, ...config };

  // Validate configuration
  validateSmtpConfig(smtpConfig);

  const transportOptions: SMTPTransport.Options = {
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.username,
      pass: smtpConfig.password,
    },
    // TLS options
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      minVersion: 'TLSv1.2' as const,
    },
    // Timeouts
    connectionTimeout: 30000, // 30 seconds
    greetingTimeout: 10000, // 10 seconds
    socketTimeout: 60000, // 60 seconds
    // Logging (only in development)
    logger: process.env.NODE_ENV === 'development',
    debug: process.env.NODE_ENV === 'development',
  };

  const transporter = nodemailer.createTransport(transportOptions);

  // Verify connection configuration
  transporter.verify((error) => {
    if (error) {
      logger.error('SMTP connection verification failed:', error);
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`SMTP configuration error: ${error.message}`);
      }
    } else {
      logger.info('SMTP server is ready to send emails', {
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        from: smtpConfig.fromEmail,
      });
    }
  });

  return transporter;
};

// Default transporter instance (singleton)
let defaultTransporter: Transporter<SMTPTransport.SentMessageInfo> | null = null;

/**
 * Get default SMTP transporter (singleton)
 */
export const getDefaultTransporter = (): Transporter<SMTPTransport.SentMessageInfo> => {
  if (!defaultTransporter) {
    try {
      defaultTransporter = createSmtpTransporter();
    } catch (error) {
      logger.error('Failed to create default SMTP transporter:', error);
      throw error;
    }
  }
  return defaultTransporter;
};

/**
 * Get SMTP configuration for email headers
 */
export const getSmtpDefaults = () => ({
  from: {
    name: defaultSmtpConfig.fromName,
    address: defaultSmtpConfig.fromEmail,
  },
  replyTo: defaultSmtpConfig.replyToEmail
    ? {
        name: defaultSmtpConfig.replyToName || defaultSmtpConfig.fromName,
        address: defaultSmtpConfig.replyToEmail,
      }
    : undefined,
});

/**
 * Test SMTP connection
 */
export const testSmtpConnection = async (): Promise<boolean> => {
  try {
    const transporter = getDefaultTransporter();
    await transporter.verify();
    logger.info('SMTP connection test successful');
    return true;
  } catch (error) {
    logger.error('SMTP connection test failed:', error);
    return false;
  }
};

/**
 * Close SMTP transporter (for graceful shutdown)
 */
export const closeTransporter = async (): Promise<void> => {
  if (defaultTransporter) {
    defaultTransporter.close();
    defaultTransporter = null;
    logger.info('SMTP transporter closed');
  }
};

// Export default config for reference
export { defaultSmtpConfig };
