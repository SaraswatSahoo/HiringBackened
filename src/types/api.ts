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

// src/types/api.ts
export interface CSVRow {
  name: string;
  email: string;
  phone: string;
  alternatephone?: string;
  college: string;
  degree: string;
  branch?: string;
  passoutyear: string | number;
  cgpa?: string | number;
  resumelink?: string;
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
