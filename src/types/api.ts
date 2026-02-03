// src/types/api.ts
import { Request } from 'express';
import { UserRole } from '@prisma/client';

export interface AuthRequest extends Request {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    isActive: boolean;
  };
}

export interface CSVRow {
  [key: string]: string | number | undefined;
  name: string;
  email: string;
  phone: string;
  // Bulk hiring fields
  college?: string;
  degree?: string;
  branch?: string;
  passOutYear?: string | number;
  cgpa?: string | number;
  alternatePhone?: string;
  // Normal hiring fields
  currentCompany?: string;
  previousCompany?: string;
  totalExperience?: string | number;
  relevantExp?: string | number;
  skills?: string;
  currentLocation?: string;
  preferredLocation?: string;
  currentCTC?: string | number;
  expectedCTC?: string | number;
  noticePeriod?: string | number;
}

export interface BulkUploadError {
  row: number;
  error: string;
  data: CSVRow;
}

export interface CommunicationFilters {
  stageId?: string;
  isEligible?: boolean;
  college?: string;
  degree?: string;
  passOutYear?: number;
}

export interface CollegePerformance {
  collegeName: string;
  totalApplied: number;
  totalEligible: number;
  totalShortlisted: number;
  totalSelected: number;
  avgCGPA: string | null;
}
