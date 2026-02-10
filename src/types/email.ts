// src/types/email.ts
import { Prisma } from '@prisma/client';

// ==================== ENUMS ====================

export enum EmailStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  BOUNCED = 'BOUNCED',
}

export enum EmailType {
  BULK = 'BULK',
  INDIVIDUAL = 'INDIVIDUAL',
}

export enum TemplateCategory {
  INTERVIEW_CALL = 'INTERVIEW_CALL',
  TEST_LINK = 'TEST_LINK',
  REJECTION = 'REJECTION',
  OFFER = 'OFFER',
  SHORTLIST = 'SHORTLIST',
  REMINDER = 'REMINDER',
  FEEDBACK_REQUEST = 'FEEDBACK_REQUEST',
  ONBOARDING = 'ONBOARDING',
  GENERAL = 'GENERAL',
}

// ==================== INTERFACES ====================

// Email Campaign
export interface Email {
  id: string;
  jdId: string;
  type: EmailType;
  templateId?: string | null;
  subject: string;
  message: string;
  htmlBody?: string | null;
  attachments: string[];
  variables?: Prisma.JsonValue | null;
  filters?: Prisma.JsonValue | null;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  bouncedCount: number;
  scheduledAt?: Date | null;
  sentAt?: Date | null;
  completedAt?: Date | null;
  priority: number;
  sentBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Individual Email to Candidate
export interface CandidateEmail {
  id: string;
  emailId: string;
  candidateId: string;
  recipientEmail: string;
  recipientName: string;
  personalizedSubject: string;
  personalizedMessage: string;
  personalizedHtmlBody?: string | null;
  status: EmailStatus;
  sentAt?: Date | null;
  failedAt?: Date | null;
  failureReason?: string | null;
  smtpResponse?: string | null;
  messageId?: string | null;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}

// Email Template
export interface EmailTemplate {
  id: string;
  name: string;
  description?: string | null;
  category: TemplateCategory;
  subject: string;
  body: string;
  htmlBody?: string | null;
  variables: string[];
  defaultValues?: Prisma.JsonValue | null;
  previewData?: Prisma.JsonValue | null;
  attachments: string[];
  usageCount: number;
  lastUsedAt?: Date | null;
  isActive: boolean;
  isDefault: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== DTOs (Data Transfer Objects) ====================

// Create Email Request
export interface CreateEmailDto {
  jdId: string;
  type?: EmailType;
  templateId?: string;
  subject: string;
  message: string;
  htmlBody?: string;
  attachments?: string[];
  variables?: Record<string, any>;
  filters?: Record<string, any>;
  candidateIds?: string[]; // For individual/bulk emails
  scheduledAt?: Date | string;
  priority?: number;
  sentBy?: string;
}

// Update Email Request
export interface UpdateEmailDto {
  subject?: string;
  message?: string;
  htmlBody?: string;
  attachments?: string[];
  variables?: Record<string, any>;
  scheduledAt?: Date | string;
  priority?: number;
}

// Send Email Response
export interface SendEmailResponse {
  emailId: string;
  totalRecipients: number;
  status: 'pending' | 'scheduled' | 'processing' | 'sent';
  message: string;
  scheduledAt?: Date;
}

// Email Stats
export interface EmailStats {
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  bouncedCount: number;
  pendingCount: number;
  successRate: number;
}

// Email with Relations
export interface EmailWithRelations extends Email {
  jd?: {
    id: string;
    title: string;
    department?: string;
  };
  template?: EmailTemplate | null;
  sender?: {
    id: string;
    name: string;
    email: string;
  };
  recipients?: CandidateEmail[];
  stats?: EmailStats;
}

// Candidate Email with Relations
export interface CandidateEmailWithRelations extends CandidateEmail {
  email?: {
    id: string;
    subject: string;
    type: EmailType;
  };
  candidate?: {
    id: string;
    name: string;
    email: string;
  };
}

// Template Variables
export interface TemplateVariables {
  [key: string]: string | number | Date | boolean;
}

// Email Filters
export interface EmailFilters {
  stageId?: string | string[];
  isEligible?: boolean;
  minCGPA?: number;
  passOutYear?: number | number[];
  college?: string | string[];
  degree?: string | string[];
  applicationStatus?: string | string[];
  [key: string]: any;
}

// Create Template DTO
export interface CreateTemplateDto {
  name: string;
  description?: string;
  category: TemplateCategory;
  subject: string;
  body: string;
  htmlBody?: string;
  variables?: string[];
  defaultValues?: Record<string, any>;
  previewData?: Record<string, any>;
  attachments?: string[];
  isDefault?: boolean;
}

// Update Template DTO
export interface UpdateTemplateDto {
  name?: string;
  description?: string;
  category?: TemplateCategory;
  subject?: string;
  body?: string;
  htmlBody?: string;
  variables?: string[];
  defaultValues?: Record<string, any>;
  previewData?: Record<string, any>;
  attachments?: string[];
  isActive?: boolean;
  isDefault?: boolean;
}

// Template Preview Request
export interface TemplatePreviewDto {
  templateId: string;
  variables?: Record<string, any>;
}

// Template Preview Response
export interface TemplatePreviewResponse {
  subject: string;
  body: string;
  htmlBody?: string;
}

// Email Query Params
export interface EmailQueryParams {
  jdId?: string;
  type?: EmailType;
  status?: EmailStatus;
  sentBy?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'sentAt' | 'priority';
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

// Template Query Params
export interface TemplateQueryParams {
  category?: TemplateCategory;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'category' | 'usageCount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// Pagination
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Email List Response
export interface EmailListResponse {
  emails: EmailWithRelations[];
  pagination: Pagination;
}

// Template List Response
export interface TemplateListResponse {
  templates: EmailTemplate[];
  pagination: Pagination;
}

// Candidate Email List Response
export interface CandidateEmailListResponse {
  emails: CandidateEmailWithRelations[];
  pagination: Pagination;
}

// Send Individual Email DTO
export interface SendIndividualEmailDto {
  candidateId: string;
  jdId: string;
  templateId?: string;
  subject: string;
  message: string;
  htmlBody?: string;
  attachments?: string[];
  variables?: Record<string, any>;
}

// Send Bulk Email DTO
export interface SendBulkEmailDto {
  jdId: string;
  templateId?: string;
  subject: string;
  message: string;
  htmlBody?: string;
  attachments?: string[];
  variables?: Record<string, any>;
  filters?: EmailFilters;
  candidateIds?: string[]; // Optional: specific candidate IDs
}

// Email Sending Result
export interface EmailSendingResult {
  candidateEmailId: string;
  candidateId: string;
  candidateName: string;
  recipientEmail: string;
  status: 'success' | 'failed';
  error?: string;
}

// Bulk Email Progress
export interface BulkEmailProgress {
  emailId: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  inProgress: boolean;
  results: EmailSendingResult[];
}
