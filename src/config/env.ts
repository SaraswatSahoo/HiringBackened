// src/config/env.ts
import dotenv from 'dotenv';

dotenv.config();

interface Config {
  env: string;
  port: number;
  apiPrefix: string;
  jwt: {
    secret: string;
    expire: string;
    refreshSecret: string;
    refreshExpire: string;
  };
  database: {
    url: string;
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
    fromEmail: string;
    fromName: string;
    replyToEmail?: string;
    replyToName?: string;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  cors: {
    origin: string;
  };
  logging: {
    level: string;
  };
  upload: {
    maxBulkUploadSize: number; // in bytes
  };
  features: {
    enableEmailNotifications: boolean;
    enableBulkUpload: boolean;
  };
  security: {
    bcryptRounds: number;
  };
}

const config: Config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',

  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expire: process.env.JWT_EXPIRE || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
    refreshExpire: process.env.JWT_REFRESH_EXPIRE || '30d',
  },

  database: {
    url: process.env.DATABASE_URL || '',
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    username: process.env.SMTP_USERNAME || '',
    password: process.env.SMTP_PASSWORD || '',
    fromEmail: process.env.SMTP_FROM_EMAIL || '',
    fromName: process.env.SMTP_FROM_NAME || 'HR Team',
    replyToEmail: process.env.SMTP_REPLY_TO_EMAIL,
    replyToName: process.env.SMTP_REPLY_TO_NAME,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info', // debug, info, warn, error
  },

  upload: {
    maxBulkUploadSize: parseInt(process.env.MAX_BULK_UPLOAD_SIZE || '52428800', 10), // 50MB default
  },

  features: {
    enableEmailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'false',
    enableBulkUpload: process.env.ENABLE_BULK_UPLOAD !== 'false',
  },

  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  },
};

// Validate critical configuration
const validateConfig = (): void => {
  const errors: string[] = [];

  // Validate JWT secrets
  if (!config.jwt.secret || config.jwt.secret === 'your-secret-key') {
    errors.push('JWT_SECRET must be set in production');
  }

  if (!config.jwt.refreshSecret || config.jwt.refreshSecret === 'your-refresh-secret') {
    errors.push('JWT_REFRESH_SECRET must be set in production');
  }

  // Validate database URL
  if (!config.database.url) {
    errors.push('DATABASE_URL must be set');
  }

  // Validate SMTP config if email is enabled
  if (config.features.enableEmailNotifications) {
    if (!config.smtp.host) errors.push('SMTP_HOST must be set');
    if (!config.smtp.username) errors.push('SMTP_USERNAME must be set');
    if (!config.smtp.password) errors.push('SMTP_PASSWORD must be set');
    if (!config.smtp.fromEmail) errors.push('SMTP_FROM_EMAIL must be set');
  }

  // Only throw errors in production
  if (config.env === 'production' && errors.length > 0) {
    throw new Error(
      `Configuration validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`
    );
  }

  // Warn in development
  if (config.env === 'development' && errors.length > 0) {
    console.warn('⚠️  Configuration warnings:');
    errors.forEach((error) => console.warn(`  - ${error}`));
  }
};

// Run validation
validateConfig();

export default config;
